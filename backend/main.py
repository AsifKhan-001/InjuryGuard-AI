"""
Injury Detection & Injury Risk Prediction System
=================================================
FastAPI entry point.

Start with:
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from routes.analysis import router as analysis_router

# ─── Logging ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Injury Detection & Risk Prediction System",
    description=(
        "Real-time injury detection and future injury risk prediction "
        "for Football, Cricket, Weightlifting, and more."
    ),
    version="1.0.0",
)

# ─── CORS ────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routes ──────────────────────────────────────────────────────────────
app.include_router(analysis_router)

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
            
        # Serve index.html for all non-API routes if the file isn't found
        # (This is needed for React SPA routing)
        path = os.path.join(frontend_dist, full_path)
        if os.path.exists(path) and os.path.isfile(path):
            return FileResponse(path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))


@app.on_event("startup")
async def startup():
    logger.info("=" * 60)
    logger.info("  Injury Detection & Risk Prediction System")
    logger.info("  Starting up...")
    logger.info("=" * 60)

    # Pre-load a generic predictor so first request isn't slow
    from models.prediction_engine import get_predictor
    try:
        get_predictor("generic")
        logger.info("Generic prediction model loaded")
    except Exception as e:
        logger.warning(f"Could not pre-load model: {e}")

    logger.info("System ready — accepting connections")


@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down Injury Detection System")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
