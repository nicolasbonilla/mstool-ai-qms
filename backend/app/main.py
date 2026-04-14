"""
MSTool-AI-QMS — Regulatory Compliance Automation Platform.

AI-powered compliance monitoring for IEC 62304 + ISO 13485 + EU MDR.
Analyzes the MSTool-AI medical device software repository in real-time.

This is a SEPARATE application from MSTool-AI (the medical device).
It monitors and reports on compliance without modifying the medical software.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from app.core.config import get_settings

settings = get_settings()

from contextlib import asynccontextmanager
import threading


def _warm_cache():
    """Pre-load GitHub data into cache on startup (background thread)."""
    try:
        from app.services.compliance_service import ComplianceService
        svc = ComplianceService()
        svc.compute_full_score()
        logger.info("Cache warmed: compliance scores pre-loaded")
    except Exception as e:
        logger.warning(f"Cache warm failed (non-fatal): {e}")


@asynccontextmanager
async def lifespan(app):
    # Startup: warm cache in background thread so it doesn't block startup
    threading.Thread(target=_warm_cache, daemon=True).start()
    yield


import logging
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MSTool-AI-QMS",
    version=settings.APP_VERSION,
    description="AI-powered regulatory compliance automation for IEC 62304 Class C medical device software",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from app.api.routes import compliance, forms, users, traceability, audit, soup, ai

app.include_router(compliance.router, prefix=settings.API_V1_STR)
app.include_router(forms.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(traceability.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(soup.router, prefix=settings.API_V1_STR)
app.include_router(ai.router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "MSTool-AI-QMS",
        "version": settings.APP_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "target_repo": settings.MSTOOL_AI_REPO_PATH or "not configured",
    }


@app.get("/api/health", tags=["Health"])
async def api_health():
    return {"status": "healthy", "version": settings.APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
