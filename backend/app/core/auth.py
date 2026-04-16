"""
Authentication middleware for MSTool-AI-QMS.

Verifies Firebase ID tokens and extracts user info + role.
Roles: admin, qms_manager, developer, qa, clinical_advisor, viewer
"""

import logging
from typing import Optional
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.firebase import verify_id_token

logger = logging.getLogger(__name__)


class CurrentUser(BaseModel):
    """Authenticated user extracted from Firebase ID token."""
    uid: str
    email: str
    name: str = ""
    role: str = "viewer"
    picture: Optional[str] = None


async def get_current_user(request: Request) -> CurrentUser:
    """
    FastAPI dependency: verify Firebase ID token from Authorization header.
    Header format: Authorization: Bearer <firebase_id_token>
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = auth_header.split("Bearer ", 1)[1]

    try:
        decoded = verify_id_token(token)
    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return CurrentUser(
        uid=decoded["uid"],
        email=decoded.get("email", ""),
        name=decoded.get("name", decoded.get("email", "")),
        role=decoded.get("role", "viewer"),
        picture=decoded.get("picture"),
    )


def require_qms_manager(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Require QMS Manager or admin role."""
    if user.role not in ("qms_manager", "admin"):
        raise HTTPException(status_code=403, detail="QMS Manager role required")
    return user


def require_editor(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Require any role that can edit (not viewer)."""
    if user.role == "viewer":
        raise HTTPException(status_code=403, detail="Viewer role cannot edit")
    return user


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Require admin role — used for ledger verification and system ops."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user