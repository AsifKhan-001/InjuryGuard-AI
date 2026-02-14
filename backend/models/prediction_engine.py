"""
Injury Prediction Engine
=========================
ML-based injury risk predictor using Random Forest + Gradient Boosting
ensemble trained on synthetic data. Provides probability scores,
injury type predictions, and explainable contributing factors.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.preprocessing import StandardScaler

from config import MODEL_RANDOM_STATE, N_ESTIMATORS
from models.sport_profiles import SPORT_PROFILES, get_profile
from models.synthetic_data import FEATURE_NAMES, generate_dataset

logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    injury_probability: float      # 0–100
    injury_type: str                # most likely injury name
    time_horizon: str               # "immediate" / "short-term" / "long-term"
    risk_class: int                 # 0=safe, 1=at-risk, 2=injured
    contributing_factors: List[str] # ranked list of why score is high
    confidence: float               # model confidence 0–1
    all_injury_probabilities: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "injury_probability": round(self.injury_probability, 1),
            "injury_type": self.injury_type,
            "time_horizon": self.time_horizon,
            "risk_class": self.risk_class,
            "contributing_factors": self.contributing_factors,
            "confidence": round(self.confidence, 3),
            "all_injury_probabilities": {
                k: round(v, 1) for k, v in self.all_injury_probabilities.items()
            },
        }


class InjuryPredictor:
    """
    Ensemble injury prediction model.
    Trains on synthetic data at initialization and predicts from feature vectors.
    """

    def __init__(self, sport: str = "generic"):
        self.sport = sport.lower()
        self.profile = get_profile(self.sport)
        self.rf: Optional[RandomForestClassifier] = None
        self.gb: Optional[GradientBoostingClassifier] = None
        self.scaler = StandardScaler()
        self._trained = False
        self._injury_type_map: Dict[int, str] = {}

    def train(self, n_samples: int = 5000):
        """Train the ensemble on synthetic data."""
        logger.info(f"Generating {n_samples} training samples for {self.sport}...")
        dataset = generate_dataset(self.sport, n_samples)

        X = dataset["X"]
        y = dataset["y"]

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Random Forest
        self.rf = RandomForestClassifier(
            n_estimators=N_ESTIMATORS,
            max_depth=10,
            random_state=MODEL_RANDOM_STATE,
            n_jobs=-1,
        )
        self.rf.fit(X_scaled, y)

        # Gradient Boosting
        self.gb = GradientBoostingClassifier(
            n_estimators=N_ESTIMATORS,
            max_depth=5,
            learning_rate=0.1,
            random_state=MODEL_RANDOM_STATE,
        )
        self.gb.fit(X_scaled, y)

        # Build injury type label map from training data
        unique_types = list(set(dataset["injury_types"]))
        self._injury_type_map = {i: t for i, t in enumerate(unique_types)}

        self._trained = True
        logger.info(f"Model trained for {self.sport} — RF + GB ensemble ready")

    def predict(self, features: Dict[str, float]) -> PredictionResult:
        """
        Predict injury risk from a feature dictionary.

        Args:
            features: dict mapping FEATURE_NAMES → float values
        """
        if not self._trained:
            self.train()

        # Build feature vector in correct order
        vec = np.array([features.get(f, 0.0) for f in FEATURE_NAMES]).reshape(1, -1)
        vec_scaled = self.scaler.transform(vec)

        # Ensemble predictions
        rf_proba = self.rf.predict_proba(vec_scaled)[0]
        gb_proba = self.gb.predict_proba(vec_scaled)[0]

        # Average ensemble probabilities
        avg_proba = (rf_proba + gb_proba) / 2

        # Risk class (highest probability class)
        risk_class = int(np.argmax(avg_proba))

        # Injury probability (weighted: class 1 contributes partially, class 2 fully)
        if len(avg_proba) >= 3:
            injury_prob = (avg_proba[1] * 50 + avg_proba[2] * 100)
        elif len(avg_proba) >= 2:
            injury_prob = avg_proba[1] * 100
        else:
            injury_prob = 0.0

        injury_prob = min(100.0, max(0.0, injury_prob))

        # Confidence
        confidence = float(np.max(avg_proba))

        # Determine injury type based on the profile's injuries and feature analysis
        injury_type = self._determine_injury_type(features)

        # Time horizon
        time_horizon = self._determine_time_horizon(injury_prob, features)

        # Contributing factors (feature importance-based explainability)
        factors = self._explain_prediction(features)

        # Per-injury probabilities
        all_probs = self._compute_injury_probabilities(features, injury_prob)

        return PredictionResult(
            injury_probability=injury_prob,
            injury_type=injury_type,
            time_horizon=time_horizon,
            risk_class=risk_class,
            contributing_factors=factors,
            confidence=confidence,
            all_injury_probabilities=all_probs,
        )

    def predict_from_raw(
        self,
        joint_angles: Dict[str, float],
        asymmetry: Dict[str, float],
        facial_stress: float = 0,
        object_speed: float = 0,
        impact_proximity: float = 0,
        fatigue_score: float = 0,
        time_elapsed: float = 0,
    ) -> PredictionResult:
        """
        Convenience method: predict from individual analysis outputs.
        """
        features = {
            "knee_angle_left": joint_angles.get("knee_left", 150),
            "knee_angle_right": joint_angles.get("knee_right", 150),
            "hip_angle_left": joint_angles.get("hip_left", 160),
            "hip_angle_right": joint_angles.get("hip_right", 160),
            "shoulder_angle_left": joint_angles.get("shoulder_left", 90),
            "shoulder_angle_right": joint_angles.get("shoulder_right", 90),
            "elbow_angle_left": joint_angles.get("elbow_left", 140),
            "elbow_angle_right": joint_angles.get("elbow_right", 140),
            "spine_angle": joint_angles.get("spine_center", 170),
            "knee_asymmetry": asymmetry.get("knee", 0),
            "hip_asymmetry": asymmetry.get("hip", 0),
            "shoulder_asymmetry": asymmetry.get("shoulder", 0),
            "facial_stress": facial_stress,
            "object_speed": object_speed,
            "impact_proximity": impact_proximity,
            "fatigue_score": fatigue_score,
            "time_elapsed_minutes": time_elapsed,
        }
        return self.predict(features)

    # ─── Explainability ──────────────────────────────────────────────────

    def _explain_prediction(self, features: Dict[str, float]) -> List[str]:
        """Rank contributing factors by feature importance × feature value."""
        if self.rf is None:
            return []

        importances = self.rf.feature_importances_
        factors = []

        for i, fname in enumerate(FEATURE_NAMES):
            val = features.get(fname, 0)
            impact = importances[i] * abs(val) if i < len(importances) else 0
            factors.append((fname, val, impact))

        # Sort by impact descending
        factors.sort(key=lambda x: x[2], reverse=True)

        # Format top factors
        explanations = []
        for fname, val, impact in factors[:5]:
            readable = fname.replace("_", " ").title()
            explanations.append(f"{readable}: {val:.1f}")

        return explanations

    def _determine_injury_type(self, features: Dict[str, float]) -> str:
        """Determine most likely injury type based on features and sport profile."""
        if not self.profile.injuries:
            return "General Injury"

        best_score = -1
        best_injury = self.profile.injuries[0].name

        for injury in self.profile.injuries:
            score = 0
            for indicator in injury.primary_indicators:
                # Check related features
                if "knee" in indicator:
                    score += max(0, 170 - features.get("knee_angle_left", 150))
                    score += features.get("knee_asymmetry", 0)
                elif "hip" in indicator:
                    score += max(0, 170 - features.get("hip_angle_left", 160))
                    score += features.get("hip_asymmetry", 0)
                elif "shoulder" in indicator:
                    score += max(0, features.get("shoulder_angle_left", 90) - 150)
                    score += features.get("shoulder_asymmetry", 0)
                elif "spine" in indicator:
                    score += max(0, 170 - features.get("spine_angle", 170))
                elif "fatigue" in indicator:
                    score += features.get("fatigue_score", 0) * 0.5
                elif "speed" in indicator or "ball" in indicator:
                    score += features.get("object_speed", 0) * 0.3
                elif "facial" in indicator:
                    score += features.get("facial_stress", 0) * 0.4
                elif "impact" in indicator:
                    score += features.get("impact_proximity", 0) * 50

            score *= injury.risk_weight
            if score > best_score:
                best_score = score
                best_injury = injury.name

        return best_injury

    def _determine_time_horizon(self, prob: float, features: Dict) -> str:
        """Classify risk timeline."""
        fatigue = features.get("fatigue_score", 0)
        speed = features.get("object_speed", 0)

        if prob > 70 or speed > self.profile.speed_threshold.danger_min:
            return "immediate"
        elif prob > 40 or fatigue > 60:
            return "short-term"
        else:
            return "long-term"

    def _compute_injury_probabilities(
        self, features: Dict[str, float], base_prob: float
    ) -> Dict[str, float]:
        """Compute per-injury probabilities based on feature relevance."""
        probs = {}
        if not self.profile.injuries:
            return probs

        for injury in self.profile.injuries:
            # Each injury gets a fraction of base_prob scaled by its weight
            relevance = injury.risk_weight
            for indicator in injury.primary_indicators:
                if "fatigue" in indicator and features.get("fatigue_score", 0) > 50:
                    relevance *= 1.3
                if "speed" in indicator and features.get("object_speed", 0) > self.profile.speed_threshold.warning_max:
                    relevance *= 1.4
            probs[injury.name] = min(100, base_prob * relevance / 1.5)

        return probs


# ─── Pre-built Predictors ────────────────────────────────────────────────

_predictors: Dict[str, InjuryPredictor] = {}


def get_predictor(sport: str) -> InjuryPredictor:
    """Get or create a trained predictor for the given sport."""
    sport = sport.lower()
    if sport not in _predictors:
        predictor = InjuryPredictor(sport)
        predictor.train()
        _predictors[sport] = predictor
    return _predictors[sport]
