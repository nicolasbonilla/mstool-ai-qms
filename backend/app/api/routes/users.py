"""
User management API routes — MSTool-AI-QMS.

Handles user profiles, roles, and audit trail.
First user to register gets admin role automatically.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from app.core.auth import get_current_user, require_qms_manager, CurrentUser
from app.core.firebase import set_custom_claims
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/users", tags=["Users"])


class SetRoleRequest(BaseModel):
    uid: str
    role: str  # admin, qms_manager, developer, qa, clinical_advisor, viewer


VALID_ROLES = {"admin", "qms_manager", "developer", "qa", "clinical_advisor", "viewer"}


@router.post("/me")
async def register_or_get_profile(user: CurrentUser = Depends(get_current_user)):
    """
    Called after Firebase login. Creates QMS profile if first time.
    First user ever gets admin role.
    """
    existing = FirestoreService.get_user(user.uid)
    if existing:
        return existing

    # Check if this is the first user (auto-admin)
    all_users = FirestoreService.list_users()
    role = "admin" if len(all_users) == 0 else "viewer"

    # Set Firebase custom claim
    set_custom_claims(user.uid, {"role": role})

    # Create QMS profile
    profile = FirestoreService.upsert_user(user.uid, {
        "email": user.email,
        "name": user.name,
        "role": role,
        "picture": user.picture,
    })

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="user_registered", resource_type="user",
        resource_id=user.uid, details={"role": role},
    )

    return profile


@router.get("/me")
async def get_my_profile(user: CurrentUser = Depends(get_current_user)):
    """Get current user's QMS profile."""
    profile = FirestoreService.get_user(user.uid)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Call POST /users/me first.")
    return profile


@router.get("/")
async def list_all_users(user: CurrentUser = Depends(require_qms_manager)):
    """List all QMS users. Requires QMS Manager or admin."""
    return {"users": FirestoreService.list_users()}


@router.put("/role")
async def set_user_role(request: SetRoleRequest, user: CurrentUser = Depends(require_qms_manager)):
    """Set a user's role. Requires QMS Manager or admin."""
    if request.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {VALID_ROLES}")

    # Update Firebase custom claim
    set_custom_claims(request.uid, {"role": request.role})

    # Update Firestore profile
    updated = FirestoreService.upsert_user(request.uid, {"role": request.role})

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="set_role", resource_type="user",
        resource_id=request.uid, details={"new_role": request.role},
    )

    return updated


@router.get("/audit-trail")
async def get_audit_trail(
    limit: int = 100,
    resource_type: Optional[str] = None,
    user: CurrentUser = Depends(require_qms_manager),
):
    """Get audit trail. Requires QMS Manager or admin."""
    entries = FirestoreService.get_audit_trail(limit=limit, resource_type=resource_type)
    return {"entries": entries, "total": len(entries)}