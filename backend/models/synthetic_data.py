"""
Synthetic Data Generation
==========================
Generates realistic training data for the injury prediction model.
Simulates normal, fatigued, and injured biomechanical states per sport.
"""

import random
from typing import Dict, List, Tuple

import numpy as np

from config import MODEL_RANDOM_STATE, SYNTHETIC_SAMPLES_PER_SPORT
from models.sport_profiles import SPORT_PROFILES, SportProfile

# Seed for reproducibility
rng = np.random.default_rng(MODEL_RANDOM_STATE)


# Feature names (must match prediction engine input)
FEATURE_NAMES = [
    "knee_angle_left",
    "knee_angle_right",
    "hip_angle_left",
    "hip_angle_right",
    "shoulder_angle_left",
    "shoulder_angle_right",
    "elbow_angle_left",
    "elbow_angle_right",
    "spine_angle",
    "knee_asymmetry",
    "hip_asymmetry",
    "shoulder_asymmetry",
    "facial_stress",
    "object_speed",
    "impact_proximity",
    "fatigue_score",
    "time_elapsed_minutes",
]

NUM_FEATURES = len(FEATURE_NAMES)


def _sample_angle(ar, state: str) -> float:
    """Sample an angle based on the state (normal/warning/danger)."""
    if state == "normal":
        return rng.uniform(ar.safe_min, ar.safe_max)
    elif state == "warning":
        if rng.random() > 0.5:
            return rng.uniform(ar.warning_min, ar.safe_min)
        else:
            return rng.uniform(ar.safe_max, ar.warning_max)
    else:  # danger
        if rng.random() > 0.5:
            return rng.uniform(ar.danger_min, ar.warning_min)
        else:
            return rng.uniform(ar.warning_max, ar.danger_max)


def _generate_sample(profile: SportProfile, state: str) -> Tuple[List[float], int, str]:
    """
    Generate a single training sample for the given sport and state.

    Returns: (features, label, injury_type)
      label: 0 = safe, 1 = at-risk, 2 = injured
      injury_type: name of the most likely injury
    """
    ar_map = {ar.joint: ar for ar in profile.angle_ranges}

    features = []

    # Joint angles (bilateral + spine)
    for joint in ["knee", "hip", "shoulder", "elbow"]:
        ar = ar_map.get(joint)
        if ar:
            left = _sample_angle(ar, state)
            right = _sample_angle(ar, state)
            # Add some noise for realism
            left += rng.normal(0, 2)
            right += rng.normal(0, 2)
        else:
            left = rng.uniform(60, 170)
            right = rng.uniform(60, 170)
        features.append(left)
        features.append(right)

    # Spine
    spine_ar = ar_map.get("spine")
    if spine_ar:
        spine = _sample_angle(spine_ar, state) + rng.normal(0, 2)
    else:
        spine = rng.uniform(140, 180)
    features.append(spine)

    # Asymmetry (derived from L/R differences)
    features.append(abs(features[0] - features[1]))  # knee asymmetry
    features.append(abs(features[2] - features[3]))  # hip asymmetry
    features.append(abs(features[4] - features[5]))  # shoulder asymmetry

    # Facial stress
    if state == "normal":
        facial = rng.uniform(0, 25)
    elif state == "warning":
        facial = rng.uniform(20, 60)
    else:
        facial = rng.uniform(50, 100)
    features.append(facial)

    # Object speed
    st = profile.speed_threshold
    if state == "normal":
        speed = rng.uniform(0, st.safe_max)
    elif state == "warning":
        speed = rng.uniform(st.safe_max * 0.7, st.warning_max)
    else:
        speed = rng.uniform(st.warning_max * 0.8, st.danger_min * 1.2)
    features.append(speed)

    # Impact proximity (0 = far, 1 = direct hit)
    if state == "normal":
        proximity = rng.uniform(0, 0.3)
    elif state == "warning":
        proximity = rng.uniform(0.2, 0.6)
    else:
        proximity = rng.uniform(0.5, 1.0)
    features.append(proximity)

    # Fatigue score
    if state == "normal":
        fatigue = rng.uniform(0, 30)
    elif state == "warning":
        fatigue = rng.uniform(25, 65)
    else:
        fatigue = rng.uniform(55, 100)
    features.append(fatigue)

    # Time elapsed (minutes)
    if state == "normal":
        time_elapsed = rng.uniform(0, 30)
    elif state == "warning":
        time_elapsed = rng.uniform(20, 60)
    else:
        time_elapsed = rng.uniform(40, 90)
    features.append(time_elapsed)

    # Label
    if state == "normal":
        label = 0
    elif state == "warning":
        label = 1
    else:
        label = 2

    # Pick most likely injury type based on state
    if state == "danger" and profile.injuries:
        # Weight by risk_weight
        weights = [i.risk_weight for i in profile.injuries]
        total = sum(weights)
        probs = [w / total for w in weights]
        injury = rng.choice(profile.injuries, p=probs)
        injury_type = injury.name
    elif state == "warning" and profile.injuries:
        injury_type = rng.choice(profile.injuries).name
    else:
        injury_type = "None"

    return features, label, injury_type


def generate_dataset(
    sport: str,
    n_samples: int = SYNTHETIC_SAMPLES_PER_SPORT,
) -> Dict:
    """
    Generate a full synthetic dataset for training.

    Returns dict with keys: 'X', 'y', 'injury_types', 'feature_names'
    """
    profile = SPORT_PROFILES.get(sport.lower())
    if not profile:
        profile = SPORT_PROFILES["generic"]

    X = []
    y = []
    injury_types = []

    # Distribution: 50% normal, 30% warning, 20% danger
    state_distribution = (
        ["normal"] * int(n_samples * 0.5)
        + ["warning"] * int(n_samples * 0.3)
        + ["danger"] * int(n_samples * 0.2)
    )
    # Pad to exact n_samples
    while len(state_distribution) < n_samples:
        state_distribution.append("normal")

    rng.shuffle(state_distribution)

    for state in state_distribution:
        features, label, inj_type = _generate_sample(profile, state)
        X.append(features)
        y.append(label)
        injury_types.append(inj_type)

    return {
        "X": np.array(X),
        "y": np.array(y),
        "injury_types": injury_types,
        "feature_names": FEATURE_NAMES,
    }


def generate_all_datasets() -> Dict[str, Dict]:
    """Generate datasets for all supported sports."""
    datasets = {}
    for sport in SPORT_PROFILES:
        datasets[sport] = generate_dataset(sport)
    return datasets
