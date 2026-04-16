"""
Release Baselines API — Phase 3.

Immutable snapshots for CE Mark / FDA submission evidence.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import get_current_user, require_editor, require_qms_manager, CurrentUser
from app.services.baseline_service import BaselineService
from app.services.firestore_service import FirestoreService

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


@router.get("/{version_tag}/verify-signatures")
async def verify_baseline_signatures(version_tag: str,
                                       user: CurrentUser = Depends(get_current_user)):
    """Verify every signature attached to this baseline.

    Returns per-signature {valid, reason, method}. A failed verify means
    either tampering or the signing key has been rotated without a new
    signature being attached.
    """
    from app.services.esign_service import verify_signature
    snap = BaselineService.get_baseline(version_tag)
    if snap is None:
        raise HTTPException(status_code=404, detail="Baseline not found")
    payload = {
        "version_tag": snap.get("version_tag"),
        "hash": snap.get("hash"),
        "created_at": snap.get("created_at"),
        "compliance": snap.get("compliance"),
    }
    results = []
    for sig in snap.get("signatures", []):
        # Modern signatures carry content_hash_sha256; old ones don't.
        if "content_hash_sha256" in sig:
            results.append({
                "signer": sig.get("signer_email"),
                "verified": verify_signature(payload, sig),
            })
        else:
            results.append({
                "signer": sig.get("signer_email"),
                "verified": {"valid": False,
                              "reason": "Legacy text-only signature (pre-KMS)",
                              "method": "legacy"},
            })
    return {"version_tag": version_tag, "signatures": results}


@router.get("/{version_tag}/submission-package")
async def export_submission_package(version_tag: str,
                                       user: CurrentUser = Depends(require_editor)):
    """Build the CE Mark Submission Package ZIP for this baseline."""
    from app.services.submission_package import build_submission_package
    from app.services.traceability_service import TraceabilityService
    from app.services.soup_service import SOUPService
    from app.services.ai_validation_service import AIValidationService

    baseline = BaselineService.get_baseline(version_tag)
    if baseline is None:
        raise HTTPException(status_code=404, detail="Baseline not found")

    # Latest audit run
    audit_history = FirestoreService.get_audit_trail(limit=1, resource_type="audit")
    audit_result = audit_history[0]["details"] if audit_history else None

    traceability_graph = TraceabilityService().build_graph()
    soup = {
        "summary": SOUPService().get_summary(),
        "dependencies": SOUPService().get_all_dependencies(),
    }
    recent_activity = FirestoreService.get_audit_trail(limit=200)
    ai_dossier = AIValidationService.generate_dossier()

    zip_bytes = build_submission_package(
        baseline=baseline,
        audit_result=audit_result,
        traceability_graph=traceability_graph,
        soup=soup,
        recent_activity=recent_activity,
        ai_dossier=ai_dossier,
    )

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="export_submission_package", resource_type="baselines",
        resource_id=version_tag,
        details={"size_bytes": len(zip_bytes)},
    )

    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=submission_package_{version_tag}.zip",
        },
    )


class ReleaseNotesRequest(BaseModel):
    v_from: str
    v_to: str


@router.post("/release-notes")
async def generate_release_notes(request: ReleaseNotesRequest,
                                    user: CurrentUser = Depends(require_editor)):
    """AI-drafted regulatory release notes from a baseline diff (Opus 4.6)."""
    try:
        diff = BaselineService.diff_baselines(request.v_from, request.v_to)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    from app.agents.base_agent import get_anthropic_client, MODEL_TIER_MAP
    client = get_anthropic_client()
    if client is None:
        return {
            "from": request.v_from, "to": request.v_to,
            "release_notes_markdown": "(set ANTHROPIC_API_KEY for AI-generated notes)",
            "diff": diff,
        }

    import json
    system = (
        "You are the Release Notes Generator. Convert a baseline diff into "
        "regulatory-grade release notes for a Class C medical device. Sections: "
        "## Changed Requirements, ## Added Hazards, ## SOUP Updates, ## Test "
        "Coverage Changes, ## Risk Re-evaluations, ## Regulatory Impact. "
        "Use markdown. Cite REQ-IDs and HAZ-IDs from the diff verbatim."
    )
    message = client.messages.create(
        model=MODEL_TIER_MAP["opus"],
        max_tokens=3000,
        system=system,
        messages=[{
            "role": "user",
            "content": "Diff:\n" + json.dumps(diff, indent=2, default=str)
                       + "\n\nWrite the release notes markdown."
        }],
    )
    notes_md = message.content[0].text if message.content else ""

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="generate_release_notes", resource_type="baselines",
        resource_id=f"{request.v_from}->{request.v_to}",
        details={"length": len(notes_md)},
    )

    return {
        "from": request.v_from, "to": request.v_to,
        "release_notes_markdown": notes_md,
        "diff_summary": {
            "score_changes": len(diff.get("score_delta", {})),
            "soup_changes": (len(diff.get("soup", {}).get("added", []))
                              + len(diff.get("soup", {}).get("removed", []))
                              + len(diff.get("soup", {}).get("changed", []))),
        },
    }
