#!/bin/bash
# Download MediaPipe model files if not present
MODEL_DIR="models_data"
mkdir -p "$MODEL_DIR"

if [ ! -f "$MODEL_DIR/pose_landmarker_lite.task" ]; then
    echo "Downloading pose_landmarker model..."
    curl -sL -o "$MODEL_DIR/pose_landmarker_lite.task" \
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
fi

if [ ! -f "$MODEL_DIR/face_landmarker.task" ]; then
    echo "Downloading face_landmarker model..."
    curl -sL -o "$MODEL_DIR/face_landmarker.task" \
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
fi

echo "Models ready."

# Start the server
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
