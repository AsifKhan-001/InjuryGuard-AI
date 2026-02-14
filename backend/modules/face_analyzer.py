"""
Facial Expression & Physiological Indicator Module
====================================================
Uses MediaPipe Tasks FaceLandmarker to detect pain expressions, stress
markers, and skin color changes indicating injury or overexertion.
"""

import math
import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    RunningMode,
)

from config import (
    FACE_CONFIDENCE_THRESHOLD,
    PAIN_EXPRESSION_THRESHOLD,
    SKIN_STRESS_PALENESS_THRESHOLD,
    SKIN_STRESS_REDNESS_THRESHOLD,
)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models_data", "face_landmarker.task")


@dataclass
class FacialAnalysis:
    pain_score: float
    stress_score: float
    skin_redness: float
    skin_paleness: float
    overall_facial_stress: float
    face_detected: bool
    indicators: List[str] = field(default_factory=list)


# Key landmark indices for expression analysis
LEFT_BROW_TOP = 70
LEFT_BROW_BOTTOM = 63
RIGHT_BROW_TOP = 300
RIGHT_BROW_BOTTOM = 293

LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145
RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374

MOUTH_TOP = 13
MOUTH_BOTTOM = 14
MOUTH_LEFT = 61
MOUTH_RIGHT = 291

NOSE_TIP = 1
NOSE_BRIDGE = 6

LEFT_CHEEK_LANDMARKS = [123, 147, 213, 192]
RIGHT_CHEEK_LANDMARKS = [352, 376, 433, 416]


class FaceAnalyzer:
    """Analyze facial expressions and physiological indicators."""

    def __init__(self):
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=FACE_CONFIDENCE_THRESHOLD,
            min_face_presence_confidence=FACE_CONFIDENCE_THRESHOLD,
        )
        self.landmarker = FaceLandmarker.create_from_options(options)
        self._baseline_skin_color: Optional[np.ndarray] = None
        self._frame_count = 0

    def analyze_frame(self, frame: np.ndarray) -> FacialAnalysis:
        """Analyze a BGR frame for facial stress indicators."""
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        results = self.landmarker.detect(mp_image)

        if not results.face_landmarks or len(results.face_landmarks) == 0:
            return FacialAnalysis(
                pain_score=0, stress_score=0, skin_redness=0,
                skin_paleness=0, overall_facial_stress=0, face_detected=False,
            )

        landmarks = results.face_landmarks[0]
        h, w = frame.shape[:2]

        pts = {}
        for i, lm in enumerate(landmarks):
            pts[i] = (lm.x * w, lm.y * h)

        indicators = []
        pain_score = self._compute_pain_score(pts, indicators)
        stress_score = self._compute_stress_score(pts, indicators)
        redness, paleness = self._analyze_skin_color(frame, pts, h, w, indicators)
        overall = self._compute_overall_stress(pain_score, stress_score, redness, paleness)

        self._frame_count += 1

        return FacialAnalysis(
            pain_score=round(pain_score, 1),
            stress_score=round(stress_score, 1),
            skin_redness=round(redness, 3),
            skin_paleness=round(paleness, 3),
            overall_facial_stress=round(overall, 1),
            face_detected=True,
            indicators=indicators,
        )

    def _compute_pain_score(self, pts: Dict, indicators: List[str]) -> float:
        score = 0.0
        ref_dist = self._dist(pts.get(NOSE_TIP, (0, 0)), pts.get(NOSE_BRIDGE, (0, 0)))
        if ref_dist < 1:
            return 0.0

        left_brow_gap = self._dist(pts.get(LEFT_BROW_TOP, (0, 0)), pts.get(LEFT_BROW_BOTTOM, (0, 0))) / ref_dist
        right_brow_gap = self._dist(pts.get(RIGHT_BROW_TOP, (0, 0)), pts.get(RIGHT_BROW_BOTTOM, (0, 0))) / ref_dist
        avg_brow = (left_brow_gap + right_brow_gap) / 2

        if avg_brow < 0.25:
            score += 35
            indicators.append("Brow furrow detected")

        left_eye_gap = self._dist(pts.get(LEFT_EYE_TOP, (0, 0)), pts.get(LEFT_EYE_BOTTOM, (0, 0))) / ref_dist
        right_eye_gap = self._dist(pts.get(RIGHT_EYE_TOP, (0, 0)), pts.get(RIGHT_EYE_BOTTOM, (0, 0))) / ref_dist
        avg_eye = (left_eye_gap + right_eye_gap) / 2

        if avg_eye < 0.08:
            score += 35
            indicators.append("Eye squeeze detected (pain indicator)")

        mouth_v = self._dist(pts.get(MOUTH_TOP, (0, 0)), pts.get(MOUTH_BOTTOM, (0, 0))) / ref_dist
        mouth_h = self._dist(pts.get(MOUTH_LEFT, (0, 0)), pts.get(MOUTH_RIGHT, (0, 0))) / ref_dist

        if mouth_v < 0.05 and mouth_h > 0.4:
            score += 30
            indicators.append("Mouth compression detected")

        return min(100.0, score)

    def _compute_stress_score(self, pts: Dict, indicators: List[str]) -> float:
        score = 0.0
        ref_dist = self._dist(pts.get(NOSE_TIP, (0, 0)), pts.get(NOSE_BRIDGE, (0, 0)))
        if ref_dist < 1:
            return 0.0

        mouth_width = self._dist(pts.get(MOUTH_LEFT, (0, 0)), pts.get(MOUTH_RIGHT, (0, 0))) / ref_dist
        if mouth_width > 0.6:
            score += 40
            indicators.append("Jaw tension / grimace detected")

        left_brow = self._dist(pts.get(LEFT_BROW_TOP, (0, 0)), pts.get(LEFT_BROW_BOTTOM, (0, 0)))
        right_brow = self._dist(pts.get(RIGHT_BROW_TOP, (0, 0)), pts.get(RIGHT_BROW_BOTTOM, (0, 0)))
        brow_diff = abs(left_brow - right_brow) / ref_dist

        if brow_diff > 0.1:
            score += 30
            indicators.append("Brow asymmetry (stress indicator)")

        left_eye = self._dist(pts.get(LEFT_EYE_TOP, (0, 0)), pts.get(LEFT_EYE_BOTTOM, (0, 0))) / ref_dist
        right_eye = self._dist(pts.get(RIGHT_EYE_TOP, (0, 0)), pts.get(RIGHT_EYE_BOTTOM, (0, 0))) / ref_dist

        if abs(left_eye - right_eye) > 0.04:
            score += 30
            indicators.append("Eye asymmetry detected")

        return min(100.0, score)

    def _analyze_skin_color(
        self, frame: np.ndarray, pts: Dict, h: int, w: int, indicators: List[str]
    ) -> Tuple[float, float]:
        redness = 0.0
        paleness = 0.0
        try:
            cheek_colors = []
            for idx_list in [LEFT_CHEEK_LANDMARKS, RIGHT_CHEEK_LANDMARKS]:
                region_pts = []
                for idx in idx_list:
                    if idx in pts:
                        px, py = int(pts[idx][0]), int(pts[idx][1])
                        px = max(0, min(w - 1, px))
                        py = max(0, min(h - 1, py))
                        region_pts.append(frame[py, px])
                if region_pts:
                    cheek_colors.append(np.mean(region_pts, axis=0))

            if not cheek_colors:
                return 0.0, 0.0

            avg_color = np.mean(cheek_colors, axis=0)
            b, g, r = avg_color[0], avg_color[1], avg_color[2]

            if self._baseline_skin_color is None:
                self._baseline_skin_color = avg_color.copy()
                return 0.0, 0.0

            baseline_r = self._baseline_skin_color[2]
            if baseline_r > 0:
                redness = max(0, (r - baseline_r) / baseline_r)
                if redness > SKIN_STRESS_REDNESS_THRESHOLD:
                    indicators.append(f"Skin redness increase: {redness:.0%}")

            brightness = (r + g + b) / 3
            baseline_brightness = np.mean(self._baseline_skin_color)
            if baseline_brightness > 0:
                paleness = max(0, (baseline_brightness - brightness) / baseline_brightness)
                if paleness > SKIN_STRESS_PALENESS_THRESHOLD:
                    indicators.append(f"Skin paleness detected: {paleness:.0%}")
        except Exception:
            pass

        return redness, paleness

    @staticmethod
    def _compute_overall_stress(pain, stress, redness, paleness):
        skin_factor = min(100, (redness + paleness) * 100)
        overall = pain * 0.4 + stress * 0.3 + skin_factor * 0.3
        return min(100.0, overall)

    @staticmethod
    def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)

    def reset(self):
        self._baseline_skin_color = None
        self._frame_count = 0

    def __del__(self):
        try:
            self.landmarker.close()
        except Exception:
            pass
