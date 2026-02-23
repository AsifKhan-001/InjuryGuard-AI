"""
API Routes for the Injury Detection System
============================================
REST endpoints + WebSocket handler for real-time analysis.
"""

import base64
import json
import logging
import time
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from config import (
    WS_FRAME_SKIP,
    PROCESS_FRAME_WIDTH,
    PROCESS_FRAME_HEIGHT,
    SECONDARY_ANALYSIS_INTERVAL,
)
from models.prediction_engine import get_predictor
from models.sport_profiles import list_sports
from modules.alert_system import AlertSystem
from modules.face_analyzer import FaceAnalyzer
from modules.object_tracker import ObjectTracker
from modules.pose_detector import PoseDetector

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Shared Module Instances ─────────────────────────────────────────────
pose_detector = PoseDetector()
face_analyzer = FaceAnalyzer()
object_tracker = ObjectTracker()
alert_system = AlertSystem()


# ─── Request / Response Models ───────────────────────────────────────────

class FrameRequest(BaseModel):
    image_base64: str
    sport: str = "generic"
    frame_width: int = 640
    frame_height: int = 480


class PostureAlertResponse(BaseModel):
    joint: str = ""
    side: str = ""
    message: str = ""
    severity: str = "warning"
    angle: float = 0
    safe_min: float = 0
    safe_max: float = 0


class AnalysisResponse(BaseModel):
    pose_risk: float = 0
    facial_stress: float = 0
    object_risk: float = 0
    injury_probability: float = 0
    injury_type: str = "Unknown"
    time_horizon: str = "long-term"
    alert_level: str = "GREEN"
    alert_message: str = ""
    contributing_factors: list = []
    recommended_action: str = ""
    joint_angles: dict = {}
    asymmetry: dict = {}
    fatigue_score: float = 0
    skeleton_landmarks: list = []
    face_detected: bool = False
    object_speed: float = 0
    issues: list = []
    posture_alerts: list = []  # NEW: abnormal posture alerts


# ─── REST Endpoints ──────────────────────────────────────────────────────

@router.get("/api/health")
async def health():
    return {"status": "healthy", "service": "Injury Detection System", "version": "1.0.0"}


@router.get("/api/sports")
async def get_sports():
    return {"sports": list_sports()}


@router.get("/api/alerts/history")
async def get_alert_history():
    return {"alerts": alert_system.get_history(50)}


@router.post("/api/analyze-frame", response_model=AnalysisResponse)
async def analyze_frame(request: FrameRequest):
    """Analyze a single video frame."""
    try:
        frame = _decode_frame(request.image_base64)
        if frame is None:
            return AnalysisResponse()

        result = _process_frame(frame, request.sport, request.frame_width, request.frame_height)
        return result
    except Exception as e:
        logger.error(f"Frame analysis error: {e}")
        return AnalysisResponse()


# ─── WebSocket for Real-Time Analysis ────────────────────────────────────

# Cache for secondary analysis results (face, object)
_secondary_cache = {
    "facial_stress": 0.0,
    "face_detected": False,
    "face_issues": [],
    "object_risk": 0.0,
    "object_speed": 0.0,
    "obj_issues": [],
    "closest_body_distance": float("inf"),
}


@router.websocket("/ws/analyze")
async def websocket_analyze(websocket: WebSocket):
    """
    Real-time frame analysis over WebSocket.

    Client sends JSON: { "image_base64": "...", "sport": "football" }
    Server responds with AnalysisResponse JSON.
    """
    await websocket.accept()
    frame_count = 0
    sport = "generic"
    logger.info("WebSocket client connected")

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Handle sport change
            if "sport" in msg:
                sport = msg["sport"]

            # Handle frame
            if "image_base64" in msg:
                frame_count += 1

                # Skip frames for performance
                if frame_count % WS_FRAME_SKIP != 0:
                    continue

                frame = _decode_frame(msg["image_base64"])
                if frame is None:
                    continue

                fw = msg.get("frame_width", 640)
                fh = msg.get("frame_height", 480)

                result = _process_frame(frame, sport, fw, fh, frame_count)
                await websocket.send_json(result.dict())

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass


# ─── Frame Processing Pipeline ──────────────────────────────────────────

def _decode_frame(base64_str: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded image to a numpy array, resized for speed."""
    try:
        # Handle data URL prefix
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is not None:
            # Resize to processing dimensions for faster ML inference
            frame = cv2.resize(frame, (PROCESS_FRAME_WIDTH, PROCESS_FRAME_HEIGHT))

        return frame
    except Exception as e:
        logger.error(f"Frame decode error: {e}")
        return None


def _process_frame(
    frame: np.ndarray,
    sport: str,
    frame_width: int,
    frame_height: int,
    frame_count: int = 0,
) -> AnalysisResponse:
    """Run the full analysis pipeline on a single frame."""

    # 1. Pose Detection (every frame — this is the priority)
    pose = pose_detector.analyze_frame(frame)
    pose_risk = pose.overall_pose_risk if pose else 0
    joint_angles_dict = {}
    asymmetry_dict = {}
    fatigue = 0
    skeleton = []
    pose_issues = []
    posture_alerts_data = []

    if pose:
        fatigue = pose.fatigue_score
        skeleton = pose.landmarks_normalized
        pose_issues = pose.issues
        for ja in pose.joint_angles:
            joint_angles_dict[f"{ja.name}_{ja.side}"] = ja.angle
        asymmetry_dict = pose.asymmetry_scores

        # Serialize posture alerts
        for pa in pose.posture_alerts:
            posture_alerts_data.append({
                "joint": pa.joint,
                "side": pa.side,
                "message": pa.message,
                "severity": pa.severity,
                "angle": round(pa.angle, 1),
                "safe_min": pa.safe_min,
                "safe_max": pa.safe_max,
            })

    # 2. Facial Analysis (every Nth frame for performance)
    run_secondary = (frame_count % SECONDARY_ANALYSIS_INTERVAL == 0) or frame_count == 0
    
    if run_secondary:
        face = face_analyzer.analyze_frame(frame)
        _secondary_cache["facial_stress"] = face.overall_facial_stress
        _secondary_cache["face_detected"] = face.face_detected
        _secondary_cache["face_issues"] = face.indicators
    
    facial_stress = _secondary_cache["facial_stress"]
    face_issues = _secondary_cache["face_issues"]

    # 3. Object Tracking (every Nth frame for performance)
    if run_secondary:
        obj = object_tracker.analyze_frame(
            frame,
            body_keypoints=pose.keypoints if pose else None,
            frame_width=frame_width,
            frame_height=frame_height,
        )
        _secondary_cache["object_risk"] = obj.impact_risk
        _secondary_cache["object_speed"] = obj.primary_object.speed_kmh if obj.primary_object else 0
        _secondary_cache["obj_issues"] = obj.issues
        _secondary_cache["closest_body_distance"] = obj.closest_body_distance

    object_risk = _secondary_cache["object_risk"]
    object_speed = _secondary_cache["object_speed"]
    obj_issues = _secondary_cache["obj_issues"]

    # 4. Prediction Engine
    predictor = get_predictor(sport)
    closest_body_distance = _secondary_cache["closest_body_distance"]
    prediction = predictor.predict_from_raw(
        joint_angles=joint_angles_dict,
        asymmetry=asymmetry_dict,
        facial_stress=facial_stress,
        object_speed=object_speed,
        impact_proximity=1.0 - (closest_body_distance / 500) if closest_body_distance < 500 else 0,
        fatigue_score=fatigue,
        time_elapsed=0,
    )

    # 5. Alert System
    all_issues = pose_issues + face_issues + obj_issues + prediction.contributing_factors
    alert = alert_system.evaluate(
        pose_risk=pose_risk,
        facial_stress=facial_stress,
        object_risk=object_risk,
        prediction_score=prediction.injury_probability,
        injury_type=prediction.injury_type,
        all_issues=all_issues,
    )

    # If we have posture alerts, force alert level to at least YELLOW
    effective_alert_level = alert.level
    effective_alert_message = alert.message
    if posture_alerts_data:
        has_danger = any(pa["severity"] == "danger" for pa in posture_alerts_data)
        if has_danger and effective_alert_level != "RED":
            effective_alert_level = "RED"
            effective_alert_message = posture_alerts_data[0]["message"]
        elif not has_danger and effective_alert_level == "GREEN":
            effective_alert_level = "YELLOW"
            effective_alert_message = posture_alerts_data[0]["message"]

    return AnalysisResponse(
        pose_risk=round(pose_risk, 1),
        facial_stress=round(facial_stress, 1),
        object_risk=round(object_risk, 1),
        injury_probability=round(prediction.injury_probability, 1),
        injury_type=prediction.injury_type,
        time_horizon=prediction.time_horizon,
        alert_level=effective_alert_level,
        alert_message=effective_alert_message,
        contributing_factors=alert.contributing_factors,
        recommended_action=alert.recommended_action,
        joint_angles=joint_angles_dict,
        asymmetry=asymmetry_dict,
        fatigue_score=round(fatigue, 1),
        skeleton_landmarks=skeleton,
        face_detected=_secondary_cache["face_detected"],
        object_speed=round(object_speed, 1),
        issues=all_issues[:10],
        posture_alerts=posture_alerts_data,
    )
