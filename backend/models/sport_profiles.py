"""
Sport-Specific Risk Profiles
=============================
Defines safe/warning/danger ranges for joint angles, speeds, and loads
per sport. Used by the prediction engine and alert system.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Tuple


@dataclass
class AngleRange:
    """Min and max angle in degrees for a joint."""
    joint: str
    safe_min: float
    safe_max: float
    warning_min: float
    warning_max: float
    danger_min: float  # anything below this
    danger_max: float  # anything above this


@dataclass
class SpeedThreshold:
    """Speed thresholds in km/h for object impacts."""
    safe_max: float
    warning_max: float
    danger_min: float


@dataclass
class InjuryType:
    name: str
    body_region: str
    primary_indicators: List[str]
    risk_weight: float = 1.0


@dataclass
class SportProfile:
    sport: str
    display_name: str
    description: str
    injuries: List[InjuryType]
    angle_ranges: List[AngleRange]
    speed_threshold: SpeedThreshold
    fatigue_weight: float  # how much fatigue contributes (0–1)
    facial_weight: float   # how much facial stress contributes (0–1)
    max_safe_asymmetry: float  # degrees


# ─── Football Profile ────────────────────────────────────────────────────

FOOTBALL = SportProfile(
    sport="football",
    display_name="Football / Soccer",
    description="High-impact sport with running, tackling, and sudden direction changes",
    injuries=[
        InjuryType("ACL Tear", "knee", ["knee_angle", "asymmetry", "deceleration"], 1.5),
        InjuryType("Ankle Sprain", "ankle", ["ankle_angle", "lateral_movement"], 1.2),
        InjuryType("Hamstring Strain", "leg", ["hip_angle", "fatigue", "sprint_speed"], 1.3),
        InjuryType("Concussion", "head", ["impact_zone_head", "ball_speed"], 2.0),
        InjuryType("Groin Strain", "hip", ["hip_angle", "asymmetry"], 1.0),
    ],
    angle_ranges=[
        AngleRange("knee", 60, 170, 40, 175, 30, 180),
        AngleRange("hip", 80, 170, 60, 175, 45, 180),
        AngleRange("shoulder", 20, 160, 10, 170, 5, 175),
        AngleRange("spine", 140, 180, 120, 180, 100, 180),
        AngleRange("elbow", 30, 170, 20, 175, 10, 180),
    ],
    speed_threshold=SpeedThreshold(safe_max=80, warning_max=110, danger_min=120),
    fatigue_weight=0.7,
    facial_weight=0.5,
    max_safe_asymmetry=12.0,
)


# ─── Cricket Profile ─────────────────────────────────────────────────────

CRICKET = SportProfile(
    sport="cricket",
    display_name="Cricket",
    description="Bowling, batting, and fielding with high ball speeds and repetitive stress",
    injuries=[
        InjuryType("Finger Fracture", "hand", ["impact_zone_arm", "ball_speed"], 1.3),
        InjuryType("Wrist Injury", "wrist", ["wrist_angle", "ball_speed"], 1.2),
        InjuryType("Shoulder Strain", "shoulder", ["shoulder_angle", "bowling_action"], 1.5),
        InjuryType("Head Injury", "head", ["impact_zone_head", "ball_speed"], 2.0),
        InjuryType("Lower Back Stress", "spine", ["spine_angle", "fatigue", "bowling_load"], 1.4),
        InjuryType("Side Strain", "torso", ["rotation_speed", "asymmetry"], 1.1),
    ],
    angle_ranges=[
        AngleRange("knee", 50, 170, 35, 175, 25, 180),
        AngleRange("hip", 70, 170, 50, 175, 40, 180),
        AngleRange("shoulder", 10, 155, 5, 165, 0, 175),
        AngleRange("spine", 130, 180, 110, 180, 90, 180),
        AngleRange("elbow", 20, 165, 10, 175, 5, 180),
    ],
    speed_threshold=SpeedThreshold(safe_max=120, warning_max=145, danger_min=150),
    fatigue_weight=0.6,
    facial_weight=0.4,
    max_safe_asymmetry=15.0,
)


# ─── Weightlifting Profile ───────────────────────────────────────────────

WEIGHTLIFTING = SportProfile(
    sport="weightlifting",
    display_name="Weightlifting",
    description="Heavy load movements requiring strict form — spine, shoulders, and knees at highest risk",
    injuries=[
        InjuryType("Spinal Disc Herniation", "spine", ["spine_angle", "load_rate", "fatigue"], 2.0),
        InjuryType("Shoulder Impingement", "shoulder", ["shoulder_angle", "asymmetry"], 1.5),
        InjuryType("Knee Valgus Injury", "knee", ["knee_angle", "asymmetry"], 1.4),
        InjuryType("Wrist Strain", "wrist", ["wrist_angle", "load"], 1.0),
        InjuryType("Bicep Tear", "arm", ["elbow_angle", "load_rate"], 1.3),
    ],
    angle_ranges=[
        AngleRange("knee", 70, 170, 55, 175, 40, 180),
        AngleRange("hip", 60, 170, 45, 175, 30, 180),
        AngleRange("shoulder", 30, 150, 15, 165, 5, 175),
        AngleRange("spine", 150, 180, 130, 180, 110, 180),
        AngleRange("elbow", 40, 170, 25, 175, 15, 180),
    ],
    speed_threshold=SpeedThreshold(safe_max=20, warning_max=35, danger_min=40),
    fatigue_weight=0.9,
    facial_weight=0.7,
    max_safe_asymmetry=8.0,
)


# ─── Generic Profile ─────────────────────────────────────────────────────

GENERIC = SportProfile(
    sport="generic",
    display_name="Generic Sports",
    description="General movement analysis for any sport",
    injuries=[
        InjuryType("Joint Overextension", "joint", ["any_angle_extreme"], 1.0),
        InjuryType("Muscle Strain", "muscle", ["fatigue", "asymmetry"], 1.0),
        InjuryType("Impact Injury", "body", ["object_speed", "proximity"], 1.2),
        InjuryType("Fatigue Collapse", "general", ["fatigue", "facial_stress"], 1.1),
    ],
    angle_ranges=[
        AngleRange("knee", 50, 170, 35, 175, 25, 180),
        AngleRange("hip", 70, 170, 50, 175, 40, 180),
        AngleRange("shoulder", 15, 160, 5, 170, 0, 180),
        AngleRange("spine", 135, 180, 115, 180, 95, 180),
        AngleRange("elbow", 25, 170, 15, 175, 5, 180),
    ],
    speed_threshold=SpeedThreshold(safe_max=100, warning_max=130, danger_min=140),
    fatigue_weight=0.6,
    facial_weight=0.5,
    max_safe_asymmetry=12.0,
)


# ─── Registry ────────────────────────────────────────────────────────────

SPORT_PROFILES: Dict[str, SportProfile] = {
    "football": FOOTBALL,
    "cricket": CRICKET,
    "weightlifting": WEIGHTLIFTING,
    "generic": GENERIC,
}


def get_profile(sport: str) -> SportProfile:
    """Get a sport profile by name, defaulting to generic."""
    return SPORT_PROFILES.get(sport.lower(), GENERIC)


def list_sports() -> List[dict]:
    """Return summary of all available sport profiles."""
    return [
        {
            "sport": p.sport,
            "display_name": p.display_name,
            "description": p.description,
            "injury_count": len(p.injuries),
            "injuries": [i.name for i in p.injuries],
        }
        for p in SPORT_PROFILES.values()
    ]
