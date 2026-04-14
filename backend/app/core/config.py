"""
Application configuration — MSTool-AI-QMS.

Environment-based settings for the QMS compliance automation platform.
"""

from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MSTool-AI-QMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8010
    API_V1_STR: str = "/api/v1"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5174,http://localhost:3000,https://mstool-ai-qms.web.app,https://mstool-ai-qms.firebaseapp.com"

    # MSTool-AI connection (the medical device app we monitor)
    MSTOOL_AI_REPO_PATH: str = ""  # Local path to medical-imaging-viewer repo
    MSTOOL_AI_API_URL: str = "http://localhost:8000"
    MSTOOL_AI_API_TOKEN: str = ""

    # GitHub API
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = "nicolasbonilla/medical-imaging-viewer"

    # Claude API (for AI agents)
    ANTHROPIC_API_KEY: str = ""

    # JWT (shared with MSTool-AI or standalone)
    JWT_SECRET_KEY: str = "change-me-in-production-minimum-32-characters"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # NVD API (for SOUP CVE scanning)
    NVD_API_KEY: str = ""  # Optional, increases rate limit

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
