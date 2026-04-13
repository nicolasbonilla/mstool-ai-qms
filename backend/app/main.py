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

app = FastAPI(
    title="MSTool-AI-QMS",
    version=settings.APP_VERSION,
    description="AI-powered regulatory compliance automation for IEC 62304 Class C medical device software",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
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
from app.api.routes import compliance, forms

app.include_router(compliance.router, prefix=settings.API_V1_STR)
app.include_router(forms.router, prefix=settings.API_V1_STR)


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
