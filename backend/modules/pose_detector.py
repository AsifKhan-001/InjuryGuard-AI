"""
Pose Detection Module
=====================
Uses MediaPipe Tasks PoseLandmarker to extract body keypoints, compute
joint angles, detect posture asymmetry, and track fatigue degradation.
"""

import math
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
)

from config import (
    FATIGUE_ANGLE_DRIFT_THRESHOLD,
    FATIGUE_WINDOW_SECONDS,
    POSE_CONFIDENCE_THRESHOLD,
)

# Path to the downloaded model file
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models_data", "pose_landmarker_lite.task")


@dataclass
class JointAngle:
    name: str
    angle: float
    side: str
    is_safe: bool = True
    threshold_exceeded_by: float = 0.0


@dataclass
class PoseAnalysis:
    keypoints: Dict[str, Tuple[float, float, float]]
    joint_angles: List[JointAngle]
    asymmetry_scores: Dict[str, float]
    fatigue_score: float
    overall_pose_risk: float
    skeleton_connections: List[Tuple[str, str]]
    landmarks_normalized: list
    issues: List[str] = field(default_factory=list)


LANDMARK_NAMES = {
    0: "nose", 1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
    4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
    7: "left_ear", 8: "right_ear", 9: "mouth_left", 10: "mouth_right",
    11: "left_shoulder", 12: "right_shoulder", 13: "left_elbow",
    14: "right_elbow", 15: "left_wrist", 16: "right_wrist",
    17: "left_pinky", 18: "right_pinky", 19: "left_index",
    20: "right_index", 21: "left_thumb", 22: "right_thumb",
    23: "left_hip", 24: "right_hip", 25: "left_knee", 26: "right_knee",
    27: "left_ankle", 28: "right_ankle", 29: "left_heel",
    30: "right_heel", 31: "left_foot_index", 32: "right_foot_index",
}

ANGLE_DEFINITIONS = [
    ("knee", "left", "left_hip", "left_knee", "left_ankle"),
    ("knee", "right", "right_hip", "right_knee", "right_ankle"),
    ("elbow", "left", "left_shoulder", "left_elbow", "left_wrist"),
    ("elbow", "right", "right_shoulder", "right_elbow", "right_wrist"),
    ("shoulder", "left", "left_elbow", "left_shoulder", "left_hip"),
    ("shoulder", "right", "right_elbow", "right_shoulder", "right_hip"),
    ("hip", "left", "left_shoulder", "left_hip", "left_knee"),
    ("hip", "right", "right_shoulder", "right_hip", "right_knee"),
    ("spine", "center", "left_shoulder", "left_hip", "left_knee"),
]

SKELETON_CONNECTIONS = [
    ("left_shoulder", "right_shoulder"),
    ("left_shoulder", "left_elbow"), ("left_elbow", "left_wrist"),
    ("right_shoulder", "right_elbow"), ("right_elbow", "right_wrist"),
    ("left_shoulder", "left_hip"), ("right_shoulder", "right_hip"),
    ("left_hip", "right_hip"),
    ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
    ("right_hip", "right_knee"), ("right_knee", "right_ankle"),
]


class PoseDetector:
    """Real-time pose detection and biomechanical analysis."""

    def __init__(self):
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=POSE_CONFIDENCE_THRESHOLD,
            min_tracking_confidence=POSE_CONFIDENCE_THRESHOLD,
        )
        self.landmarker = PoseLandmarker.create_from_options(options)
        self._baseline_angles: Optional[Dict[str, float]] = None
        self._angle_history: List[Tuple[float, Dict[str, float]]] = []
        self._start_time = time.time()

    def analyze_frame(self, frame: np.ndarray) -> Optional[PoseAnalysis]:
        """Analyze a single BGR frame. Returns PoseAnalysis or None."""
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        results = self.landmarker.detect(mp_image)

        if not results.pose_landmarks or len(results.pose_landmarks) == 0:
            return None

        landmarks = results.pose_landmarks[0]

        keypoints = self._extract_keypoints(landmarks)
        joint_angles = self._compute_all_angles(keypoints)
        asymmetry = self._detect_asymmetry(joint_angles)
        fatigue_score = self._compute_fatigue(joint_angles)

        issues = []
        overall_risk = self._compute_pose_risk(joint_angles, asymmetry, fatigue_score, issues)

        return PoseAnalysis(
            keypoints=keypoints,
            joint_angles=joint_angles,
            asymmetry_scores=asymmetry,
            fatigue_score=fatigue_score,
            overall_pose_risk=overall_risk,
            skeleton_connections=SKELETON_CONNECTIONS,
            landmarks_normalized=[(lm.x, lm.y, lm.z, lm.visibility) for lm in landmarks],
            issues=issues,
        )

    def reset(self):
        self._baseline_angles = None
        self._angle_history.clear()
        self._start_time = time.time()

    def _extract_keypoints(self, landmarks) -> Dict[str, Tuple[float, float, float]]:
        kp = {}
        for idx, name in LANDMARK_NAMES.items():
            if idx < len(landmarks):
                lm = landmarks[idx]
                kp[name] = (lm.x, lm.y, lm.visibility)
        return kp

    @staticmethod
    def _angle_between(a: Tuple[float, float], b: Tuple[float, float], c: Tuple[float, float]) -> float:
        ba = (a[0] - b[0], a[1] - b[1])
        bc = (c[0] - b[0], c[1] - b[1])
        dot = ba[0] * bc[0] + ba[1] * bc[1]
        mag_ba = math.sqrt(ba[0] ** 2 + ba[1] ** 2)
        mag_bc = math.sqrt(bc[0] ** 2 + bc[1] ** 2)
        if mag_ba * mag_bc == 0:
            return 0.0
        cos_angle = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
        return math.degrees(math.acos(cos_angle))

    def _compute_all_angles(self, keypoints: Dict) -> List[JointAngle]:
        angles = []
        for name, side, pa, vertex, pc in ANGLE_DEFINITIONS:
            if pa in keypoints and vertex in keypoints and pc in keypoints:
                a = keypoints[pa][:2]
                b = keypoints[vertex][:2]
                c = keypoints[pc][:2]
                angle = self._angle_between(a, b, c)
                angles.append(JointAngle(name=name, angle=round(angle, 1), side=side))
        return angles

    def _detect_asymmetry(self, angles: List[JointAngle]) -> Dict[str, float]:
        left = {a.name: a.angle for a in angles if a.side == "left"}
        right = {a.name: a.angle for a in angles if a.side == "right"}
        asymmetry = {}
        for joint in left:
            if joint in right:
                diff = abs(left[joint] - right[joint])
                asymmetry[joint] = round(diff, 1)
        return asymmetry

    def _compute_fatigue(self, angles: List[JointAngle]) -> float:
        now = time.time()
        angle_dict = {f"{a.name}_{a.side}": a.angle for a in angles}

        if self._baseline_angles is None:
            self._baseline_angles = angle_dict.copy()

        self._angle_history.append((now, angle_dict))
        cutoff = now - FATIGUE_WINDOW_SECONDS
        self._angle_history = [(t, a) for t, a in self._angle_history if t >= cutoff]

        if len(self._angle_history) < 5:
            return 0.0

        total_drift = 0.0
        count = 0
        for key, baseline_val in self._baseline_angles.items():
            if key in angle_dict:
                drift = abs(angle_dict[key] - baseline_val)
                total_drift += drift
                count += 1

        if count == 0:
            return 0.0

        avg_drift = total_drift / count
        fatigue = min(100.0, (avg_drift / FATIGUE_ANGLE_DRIFT_THRESHOLD) * 100)
        return round(fatigue, 1)

    def _compute_pose_risk(self, angles, asymmetry, fatigue, issues) -> float:
        risk = 0.0
        for a in angles:
            if a.name == "knee" and a.angle < 40:
                risk += 25
                issues.append(f"Dangerous {a.side} knee angle: {a.angle}°")
            elif a.name == "spine" and a.angle < 120:
                risk += 30
                issues.append(f"Excessive spinal flexion: {a.angle}°")
            elif a.name == "shoulder" and a.angle > 170:
                risk += 20
                issues.append(f"Shoulder hyperextension ({a.side}): {a.angle}°")

        for joint, diff in asymmetry.items():
            if diff > 15:
                risk += 10
                issues.append(f"High {joint} asymmetry: {diff}° difference")

        if fatigue > 50:
            risk += fatigue * 0.2
            issues.append(f"Fatigue detected: {fatigue:.0f}%")

        return min(100.0, round(risk, 1))

    def __del__(self):
        try:
            self.landmarker.close()
        except Exception:
            pass
