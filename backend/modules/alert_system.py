"""
Alert & Medical Readiness System
=================================
Evaluates all module outputs, determines risk level (GREEN/YELLOW/RED),
generates structured alerts with explanations, and maintains alert history.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from config import (
    ALERT_COOLDOWN_SECONDS,
    ALERT_GREEN,
    ALERT_HISTORY_MAX,
    ALERT_RED,
    ALERT_YELLOW,
    RED_THRESHOLD,
    YELLOW_THRESHOLD,
)


@dataclass
class Alert:
    level: str                     # GREEN / YELLOW / RED
    risk_score: float              # 0–100
    message: str
    injury_type: str               # predicted injury type
    contributing_factors: List[str]
    recommended_action: str
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "level": self.level,
            "risk_score": round(self.risk_score, 1),
            "message": self.message,
            "injury_type": self.injury_type,
            "contributing_factors": self.contributing_factors,
            "recommended_action": self.recommended_action,
            "timestamp": self.timestamp,
        }


class AlertSystem:
    """Evaluate risk and generate structured alerts."""

    def __init__(self):
        self._history: List[Alert] = []
        self._last_alert_time: Dict[str, float] = {}

    def evaluate(
        self,
        pose_risk: float = 0,
        facial_stress: float = 0,
        object_risk: float = 0,
        prediction_score: float = 0,
        injury_type: str = "Unknown",
        all_issues: Optional[List[str]] = None,
    ) -> Alert:
        """
        Combine all risk inputs into a single alert.

        Weighting:
          - Pose risk:       30%
          - Facial stress:   20%
          - Object risk:     20%
          - Prediction score: 30%
        """
        issues = all_issues or []

        # Weighted composite risk
        composite = (
            pose_risk * 0.30
            + facial_stress * 0.20
            + object_risk * 0.20
            + prediction_score * 0.30
        )
        composite = min(100.0, max(0.0, composite))

        # Determine level
        if composite >= RED_THRESHOLD:
            level = ALERT_RED
        elif composite >= YELLOW_THRESHOLD:
            level = ALERT_YELLOW
        else:
            level = ALERT_GREEN

        # Generate message
        message = self._generate_message(level, composite, injury_type)

        # Recommended action
        action = self._recommended_action(level, injury_type)

        alert = Alert(
            level=level,
            risk_score=composite,
            message=message,
            injury_type=injury_type,
            contributing_factors=issues[:5],  # top 5 factors
            recommended_action=action,
        )

        # Apply cooldown: don't spam same-level alerts
        now = time.time()
        last = self._last_alert_time.get(level, 0)
        if now - last >= ALERT_COOLDOWN_SECONDS or level == ALERT_RED:
            self._history.append(alert)
            self._last_alert_time[level] = now
            # Trim history
            if len(self._history) > ALERT_HISTORY_MAX:
                self._history = self._history[-ALERT_HISTORY_MAX:]

        return alert

    def get_history(self, limit: int = 50) -> List[dict]:
        """Return recent alert history as dicts."""
        return [a.to_dict() for a in self._history[-limit:]]

    def get_current_level(self) -> str:
        """Return the most recent alert level."""
        if self._history:
            return self._history[-1].level
        return ALERT_GREEN

    def clear_history(self):
        self._history.clear()
        self._last_alert_time.clear()

    # ─── Internal ────────────────────────────────────────────────────────

    @staticmethod
    def _generate_message(level: str, score: float, injury_type: str) -> str:
        if level == ALERT_RED:
            return (
                f"🔴 HIGH RISK — {injury_type} probability at {score:.0f}%. "
                f"Immediate medical attention recommended."
            )
        elif level == ALERT_YELLOW:
            return (
                f"🟡 CAUTION — Elevated {injury_type.lower()} risk ({score:.0f}%). "
                f"Monitor closely, consider rest."
            )
        else:
            return f"🟢 SAFE — All indicators within normal range ({score:.0f}%)."

    @staticmethod
    def _recommended_action(level: str, injury_type: str) -> str:
        if level == ALERT_RED:
            return (
                f"Stop activity immediately. Medical team should evaluate for {injury_type}. "
                f"Apply ice/immobilize if applicable."
            )
        elif level == ALERT_YELLOW:
            return (
                f"Reduce intensity. Monitor {injury_type.lower()} risk factors. "
                f"Consider substitution or rest period."
            )
        else:
            return "Continue activity. Maintain current form and hydration."
