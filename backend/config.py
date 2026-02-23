"""
Central configuration for the Injury Detection & Risk Prediction System.
All thresholds, constants, and tunable parameters live here.
"""

# ─── Alert Levels ────────────────────────────────────────────────────────
ALERT_GREEN = "GREEN"
ALERT_YELLOW = "YELLOW"
ALERT_RED = "RED"

# ─── Risk Score Thresholds ───────────────────────────────────────────────
YELLOW_THRESHOLD = 35  # risk score above this → YELLOW
RED_THRESHOLD = 70     # risk score above this → RED

# ─── Pose Detection ─────────────────────────────────────────────────────
POSE_CONFIDENCE_THRESHOLD = 0.3      # lowered for better detection
POSE_TRACKING_CONFIDENCE = 0.2       # lower tracking = smoother between detections
FACE_CONFIDENCE_THRESHOLD = 0.3      # lowered for more detections

# ─── Fatigue Detection ──────────────────────────────────────────────────
FATIGUE_WINDOW_SECONDS = 60       # rolling window for fatigue tracking
FATIGUE_ANGLE_DRIFT_THRESHOLD = 8  # degrees of drift that indicate fatigue

# ─── Object Tracking ────────────────────────────────────────────────────
PIXELS_PER_METER = 200            # calibration factor (adjustable)
FRAME_RATE = 30                   # default assumed FPS
BALL_MIN_CONTOUR_AREA = 100       # minimum contour area to consider as ball
BALL_MAX_CONTOUR_AREA = 5000      # maximum contour area

# ─── Facial Stress ──────────────────────────────────────────────────────
PAIN_EXPRESSION_THRESHOLD = 0.6   # above this → pain detected
SKIN_STRESS_REDNESS_THRESHOLD = 0.4
SKIN_STRESS_PALENESS_THRESHOLD = 0.3

# ─── Prediction Engine ──────────────────────────────────────────────────
SYNTHETIC_SAMPLES_PER_SPORT = 5000
MODEL_RANDOM_STATE = 42
N_ESTIMATORS = 100

# ─── Alert System ────────────────────────────────────────────────────────
ALERT_HISTORY_MAX = 100           # keep last N alerts
ALERT_COOLDOWN_SECONDS = 3        # minimum time between same-level alerts

# ─── Supported Sports ───────────────────────────────────────────────────
SUPPORTED_SPORTS = ["football", "cricket", "weightlifting", "generic"]

# ─── WebSocket ───────────────────────────────────────────────────────────
WS_FRAME_SKIP = 1  # process every frame (frames are now smaller/faster)

# ─── Frame Processing ───────────────────────────────────────────────────
PROCESS_FRAME_WIDTH = 320         # resize frames before ML inference
PROCESS_FRAME_HEIGHT = 240
SECONDARY_ANALYSIS_INTERVAL = 3   # run face/object every Nth processed frame

# ─── CORS ────────────────────────────────────────────────────────────────
CORS_ORIGINS = ["*"]  # Allow all origins (Vercel frontend, localhost dev, etc.)

# ─── Abnormal Posture Detection ──────────────────────────────────────────
# Safe angle ranges per joint: (min_angle, max_angle)
SAFE_ANGLE_RANGES = {
    "knee":     (10, 180),    # <10° = backward bend / hyperextension
    "elbow":    (10, 180),    # <10° = hyperextension
    "shoulder": (0, 175),     # >175° = hyperextension
    "hip":      (15, 180),    # <15° = unnatural bend
    "spine":    (100, 180),   # <100° = extreme spinal flexion
}
SUDDEN_ANGLE_CHANGE_THRESHOLD = 40  # degrees change in one frame = potential injury
