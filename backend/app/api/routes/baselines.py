"""
Release Baselines API — Phase 3.

Immutable snapshots for CE Mark / FDA submission evidence.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user, require_editor, require_qms_manager, CurrentUser
from app.services.baseline_service import BaselineService

router = APIRouter(prefix="/baselines", tags=["Release Baselines"])


class CreateBaselineRequest(BaseModel):
    version_tag: str
    notes: str = ""


class SignBaselineRequest(BaseModel):
    role: str
    meaning: str = "approved"  # approved | reviewed | witnessed


@router.get("")
async def list_baselines(limit: int = 50, user: CurrentUser = Depends(get_current_user)):
    return {"baselines": BaselineService.list_baselines(limit=limit)}


@router.post("")
async def create_baseline(request: CreateBaselineRequest,
                            user: CurrentUser = Depends(require_qms_manager)):
    """Create an immutable baseline. QMS Manager or Admin only."""
    try:
        snapshot = BaselineService.create_baseline(
            version_tag=request.version_tag,
            created_by_uid=user.uid,
            created_by_email=user.email,
            notes=request.notes,
        )
        return snapshot
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/{version_tag}")
async def get_baseline(version_tag: str, user: CurrentUser = Depends(get_current_user)):
    snap = BaselineService.get_baseline(version_tag)
    if snap is None:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return snap


@router.post("/{version_tag}/sign")
async def sign_baseline(version_tag: str, request: SignBaselineRequest,
                         user: CurrentUser = Depends(require_editor)):
    """Attach a 21 CFR Part 11 §11.50 e-signature to a baseline."""
    updated = BaselineService.sign_baseline(
        version_tag=version_tag,
        signer_uid=user.uid,
        signer_email=user.email,
        role=request.role,
        meaning=request.meaning,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Baseline not found")
    return updated


@router.get("/{v_from}/diff/{v_to}")
async def diff_baselines(v_from: str, v_to: str,
                          user: CurrentUser = Depends(get_current_user)):
    """Return a structured diff between two baselines."""
    try:
        return BaselineService.diff_baselines(v_from, v_to)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
