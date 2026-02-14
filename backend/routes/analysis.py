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

from config import WS_FRAME_SKIP
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

                result = _process_frame(frame, sport, fw, fh)
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
    """Decode a base64-encoded image to a numpy array."""
    try:
        # Handle data URL prefix
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.error(f"Frame decode error: {e}")
        return None


def _process_frame(
    frame: np.ndarray,
    sport: str,
    frame_width: int,
    frame_height: int,
) -> AnalysisResponse:
    """Run the full analysis pipeline on a single frame."""

    # 1. Pose Detection
    pose = pose_detector.analyze_frame(frame)
    pose_risk = pose.overall_pose_risk if pose else 0
    joint_angles_dict = {}
    asymmetry_dict = {}
    fatigue = 0
    skeleton = []
    pose_issues = []

    if pose:
        fatigue = pose.fatigue_score
        skeleton = pose.landmarks_normalized
        pose_issues = pose.issues
        for ja in pose.joint_angles:
            joint_angles_dict[f"{ja.name}_{ja.side}"] = ja.angle
        asymmetry_dict = pose.asymmetry_scores

    # 2. Facial Analysis
    face = face_analyzer.analyze_frame(frame)
    facial_stress = face.overall_facial_stress
    face_issues = face.indicators

    # 3. Object Tracking
    obj = object_tracker.analyze_frame(
        frame,
        body_keypoints=pose.keypoints if pose else None,
        frame_width=frame_width,
        frame_height=frame_height,
    )
    object_risk = obj.impact_risk
    object_speed = obj.primary_object.speed_kmh if obj.primary_object else 0
    obj_issues = obj.issues

    # 4. Prediction Engine
    predictor = get_predictor(sport)
    prediction = predictor.predict_from_raw(
        joint_angles=joint_angles_dict,
        asymmetry=asymmetry_dict,
        facial_stress=facial_stress,
        object_speed=object_speed,
        impact_proximity=1.0 - (obj.closest_body_distance / 500) if obj.closest_body_distance < 500 else 0,
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

    return AnalysisResponse(
        pose_risk=round(pose_risk, 1),
        facial_stress=round(facial_stress, 1),
        object_risk=round(object_risk, 1),
        injury_probability=round(prediction.injury_probability, 1),
        injury_type=prediction.injury_type,
        time_horizon=prediction.time_horizon,
        alert_level=alert.level,
        alert_message=alert.message,
        contributing_factors=alert.contributing_factors,
        recommended_action=alert.recommended_action,
        joint_angles=joint_angles_dict,
        asymmetry=asymmetry_dict,
        fatigue_score=round(fatigue, 1),
        skeleton_landmarks=skeleton,
        face_detected=face.face_detected,
        object_speed=round(object_speed, 1),
        issues=all_issues[:10],
    )
