#!/bin/bash
set -e

# ==========================================
# unified deployment build script
# ==========================================

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Frontend built successfully."
echo "Returning to root..."
cd ..

echo "Installing backend dependencies..."
cd backend
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

echo "Build script completed successfully."
