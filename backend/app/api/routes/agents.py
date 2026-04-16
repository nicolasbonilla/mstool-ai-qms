"""
AI Agents API — Phase 4.

Endpoints for invoking the validated-AI agents and viewing their run history.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_current_user, require_editor, CurrentUser
from app.core.firebase import get_firestore_client, Collections
from app.agents.registry import list_agents, get_agent
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/agents", tags=["AI Agents"])


class InvokeRequest(BaseModel):
    context: dict = {}


class ApproveRequest(BaseModel):
    notes: str = ""


@router.get("")
async def get_agents(user: CurrentUser = Depends(get_current_user)):
    """List the registered agents with their tier + model version."""
    return {"agents": list_agents()}


@router.post("/{name}/invoke")
async def invoke_agent(name: str, request: InvokeRequest,
                        user: CurrentUser = Depends(require_editor)):
    """Invoke an agent. Editor role minimum — viewers cannot run."""
    try:
        agent = get_agent(name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {name}")

    record = agent.run(
        context=request.context,
        invoked_by_uid=user.uid,
        invoked_by_email=user.email,
    )
    return record


@router.get("/{name}/runs")
async def list_agent_runs(name: str, limit: int = 20,
                           user: CurrentUser = Depends(get_current_user)):
    """Return recent runs of a given agent (for the Agent detail page)."""
    db = get_firestore_client()
    query = (
        db.collection(Collections.AGENT_RUNS)
        .where("agent_name", "==", name)
        .order_by("started_at", direction="DESCENDING")
        .limit(limit)
    )
    runs = []
    for doc in query.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        runs.append(data)
    return {"runs": runs}


@router.get("/runs/{run_id}")
async def get_agent_run(run_id: str, user: CurrentUser = Depends(get_current_user)):
    db = get_firestore_client()
    snap = db.collection(Collections.AGENT_RUNS).document(run_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Run not found")
    data = snap.to_dict()
    data["id"] = snap.id
    return data


@router.post("/{name}/validate")
async def validate_agent(name: str, user: CurrentUser = Depends(require_editor)):
    """Run the golden suite against an agent; persist IQ/OQ/PQ evidence."""
    from app.services.ai_validation_service import AIValidationService
    try:
        result = AIValidationService.run_golden_suite_for_agent(
            agent_name=name,
            run_by_uid=user.uid,
            run_by_email=user.email,
        )
        result["id"] = AIValidationService.persist_validation_run(result)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/validation/dossier")
async def get_validation_dossier(user: CurrentUser = Depends(get_current_user)):
    """Generate the AI Validation Dossier — IQ/OQ/PQ + PCCP per agent.

    This is the auditor-consumable artifact: hand this to a Notified Body
    and they can accept the AI layer as a validated SOUP component.
    """
    from app.services.ai_validation_service import AIValidationService
    return AIValidationService.generate_dossier()


@router.post("/runs/{run_id}/approve")
async def approve_agent_run(run_id: str, request: ApproveRequest,
                              user: CurrentUser = Depends(require_editor)):
    """Apply 21 CFR Part 11 §11.50 e-signature to approve an agent's output."""
    db = get_firestore_client()
    doc_ref = db.collection(Collections.AGENT_RUNS).document(run_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="Run not found")
    doc_ref.update({
        "approved": True,
        "approved_by": user.email,
        "approved_at": datetime.now(timezone.utc).isoformat(),
        "approval_notes": request.notes,
    })
    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="approve_agent_run", resource_type="ai",
        resource_id=run_id,
        details={"notes": request.notes},
    )
    return doc_ref.get().to_dict()
