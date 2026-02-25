"""
AI Virtual Try-On — FastAPI application entry point.

Run with:
    cd backend
    python -m app.main
"""
import logging
import sys

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import tryon, recommend, combos

# ── Logging ─────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ── App ─────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="AI Virtual Try-On API",
        description="Backend API for the AI Virtual Try-On application. "
                    "Supports virtual clothing try-on, AI-powered style recommendations, "
                    "and outfit combo suggestions.",
        version="2.0.0",
    )

    # ── CORS ────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ─────────────────────────────────────────────────────
    app.include_router(tryon.router)
    app.include_router(recommend.router)
    app.include_router(combos.router)

    # ── Health check ────────────────────────────────────────────────
    @app.get("/api/health", tags=["Health"])
    def health_check():
        """Health check endpoint."""
        return {
            "status": "Online",
            "service": "AI Virtual Try-On API",
            "version": "2.0.0",
            "mock_mode": settings.USE_MOCK_AI,
            "gemini_configured": bool(settings.GEMINI_API_KEY),
        }

    # ── Global exception handler ────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Internal server error"},
        )

    # ── Static Files ────────────────────────────────────────────────
    from fastapi.staticfiles import StaticFiles
    from pathlib import Path

    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/images", StaticFiles(directory=settings.STORAGE_DIR), name="images")

    # Serve frontend files (HTML/JS/CSS) — avoids file:// CORS issues
    frontend_dir = Path(__file__).resolve().parent.parent.parent  # e:\pinku
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    # ── Database ────────────────────────────────────────────────────
    from app.database import init_db
    init_db()

    # Ensure temp directory exists
    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    logger.info(f"App initialized — Mock AI: {settings.USE_MOCK_AI}, Gemini: {'configured' if settings.GEMINI_API_KEY else 'not configured'}")
    logger.info(f"Storage: {settings.STORAGE_DIR}")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
    )
