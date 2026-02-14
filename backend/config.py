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
POSE_CONFIDENCE_THRESHOLD = 0.5
FACE_CONFIDENCE_THRESHOLD = 0.5

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
WS_FRAME_SKIP = 2  # process every Nth frame for performance

# ─── CORS ────────────────────────────────────────────────────────────────
CORS_ORIGINS = ["*"]  # Allow all origins (Vercel frontend, localhost dev, etc.)

