"""
Object Speed & Impact Analysis Module
======================================
Tracks fast-moving objects (ball, weights) using optical flow and contour
detection, estimates speed, and assesses impact risk relative to body parts.
"""

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from config import (
    BALL_MAX_CONTOUR_AREA,
    BALL_MIN_CONTOUR_AREA,
    FRAME_RATE,
    PIXELS_PER_METER,
)


@dataclass
class TrackedObject:
    position: Tuple[int, int]  # (x, y) center in pixels
    speed_kmh: float
    acceleration: float  # km/h per second
    direction: float     # angle in degrees (0=right, 90=down)
    contour_area: float


@dataclass
class ObjectAnalysis:
    objects_detected: int
    primary_object: Optional[TrackedObject]
    impact_risk: float       # 0–100
    impact_zone: str         # "none", "head", "torso", "arm", "leg"
    closest_body_distance: float  # pixels
    speed_alert: bool
    issues: List[str] = field(default_factory=list)


# Body zone mapping: keypoint name → zone label
BODY_ZONES = {
    "nose": "head", "left_eye": "head", "right_eye": "head",
    "left_ear": "head", "right_ear": "head",
    "left_shoulder": "torso", "right_shoulder": "torso",
    "left_hip": "torso", "right_hip": "torso",
    "left_elbow": "arm", "right_elbow": "arm",
    "left_wrist": "arm", "right_wrist": "arm",
    "left_knee": "leg", "right_knee": "leg",
    "left_ankle": "leg", "right_ankle": "leg",
}


class ObjectTracker:
    """Track fast-moving objects and assess impact risk."""

    def __init__(self, pixels_per_meter: float = PIXELS_PER_METER, fps: int = FRAME_RATE):
        self.ppm = pixels_per_meter
        self.fps = fps
        self._prev_gray: Optional[np.ndarray] = None
        self._position_history: deque = deque(maxlen=30)  # last 30 positions
        self._bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            history=60, varThreshold=50, detectShadows=False
        )

    def analyze_frame(
        self,
        frame: np.ndarray,
        body_keypoints: Optional[Dict[str, Tuple[float, float, float]]] = None,
        frame_width: int = 640,
        frame_height: int = 480,
    ) -> ObjectAnalysis:
        """
        Detect moving objects and compute speed/impact risk.

        Args:
            frame: BGR video frame
            body_keypoints: dict of keypoint_name → (norm_x, norm_y, visibility)
            frame_width/height: actual frame dimensions for denormalization
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Background subtraction to find moving objects
        fg_mask = self._bg_subtractor.apply(frame)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

        # Find contours of moving objects
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Filter by size → likely ball / equipment
        candidates = []
        for c in contours:
            area = cv2.contourArea(c)
            if BALL_MIN_CONTOUR_AREA <= area <= BALL_MAX_CONTOUR_AREA:
                M = cv2.moments(c)
                if M["m00"] > 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    candidates.append((cx, cy, area))

        if not candidates:
            self._prev_gray = gray
            return ObjectAnalysis(
                objects_detected=0, primary_object=None,
                impact_risk=0, impact_zone="none",
                closest_body_distance=float("inf"), speed_alert=False,
            )

        # Pick the fastest-moving / largest candidate as primary
        primary_pos = max(candidates, key=lambda c: c[2])
        cx, cy, area = primary_pos

        # Compute speed from position history
        self._position_history.append((cx, cy))
        speed_kmh, acceleration, direction = self._compute_kinematics()

        tracked = TrackedObject(
            position=(cx, cy),
            speed_kmh=round(speed_kmh, 1),
            acceleration=round(acceleration, 1),
            direction=round(direction, 1),
            contour_area=area,
        )

        # Assess impact risk relative to body keypoints
        issues = []
        impact_risk, impact_zone, closest_dist = self._assess_impact(
            cx, cy, speed_kmh, body_keypoints, frame_width, frame_height, issues
        )

        speed_alert = speed_kmh > 80  # > 80 km/h is dangerous for most sports

        self._prev_gray = gray

        return ObjectAnalysis(
            objects_detected=len(candidates),
            primary_object=tracked,
            impact_risk=round(impact_risk, 1),
            impact_zone=impact_zone,
            closest_body_distance=round(closest_dist, 1),
            speed_alert=speed_alert,
            issues=issues,
        )

    # ─── Kinematics ──────────────────────────────────────────────────────

    def _compute_kinematics(self) -> Tuple[float, float, float]:
        """Compute speed (km/h), acceleration, and direction from position history."""
        if len(self._position_history) < 2:
            return 0.0, 0.0, 0.0

        # Speed: displacement between last two frames
        p1 = self._position_history[-2]
        p2 = self._position_history[-1]
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        pixel_disp = math.sqrt(dx ** 2 + dy ** 2)

        meters_per_frame = pixel_disp / self.ppm
        meters_per_sec = meters_per_frame * self.fps
        speed_kmh = meters_per_sec * 3.6

        # Direction
        direction = math.degrees(math.atan2(dy, dx)) % 360

        # Acceleration: compare last two speeds
        acceleration = 0.0
        if len(self._position_history) >= 3:
            p0 = self._position_history[-3]
            prev_disp = math.sqrt((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2)
            prev_speed = (prev_disp / self.ppm) * self.fps * 3.6
            acceleration = (speed_kmh - prev_speed) * self.fps  # km/h per second

        return speed_kmh, acceleration, direction

    # ─── Impact Assessment ───────────────────────────────────────────────

    def _assess_impact(
        self,
        obj_x: int, obj_y: int,
        speed_kmh: float,
        keypoints: Optional[Dict],
        fw: int, fh: int,
        issues: List[str],
    ) -> Tuple[float, str, float]:
        """Compute impact risk based on proximity of object to body parts."""
        if not keypoints:
            return 0.0, "none", float("inf")

        closest_dist = float("inf")
        closest_zone = "none"

        for kp_name, (nx, ny, vis) in keypoints.items():
            if vis < 0.5 or kp_name not in BODY_ZONES:
                continue
            px, py = nx * fw, ny * fh
            dist = math.sqrt((obj_x - px) ** 2 + (obj_y - py) ** 2)
            if dist < closest_dist:
                closest_dist = dist
                closest_zone = BODY_ZONES[kp_name]

        # Risk formula: high speed + close proximity + vulnerable zone
        proximity_factor = max(0, 1.0 - (closest_dist / 200))  # within ~200px
        speed_factor = min(1.0, speed_kmh / 150)  # normalized to 150 km/h

        zone_weight = {"head": 1.5, "torso": 1.0, "arm": 0.7, "leg": 0.8, "none": 0}.get(
            closest_zone, 0.5
        )

        risk = proximity_factor * speed_factor * zone_weight * 100

        if risk > 50:
            issues.append(
                f"Object at {speed_kmh:.0f} km/h approaching {closest_zone} "
                f"(dist: {closest_dist:.0f}px)"
            )
        if speed_kmh > 120:
            issues.append(f"Extreme object speed: {speed_kmh:.0f} km/h")

        return min(100.0, risk), closest_zone, closest_dist

    def reset(self):
        self._position_history.clear()
        self._prev_gray = None
