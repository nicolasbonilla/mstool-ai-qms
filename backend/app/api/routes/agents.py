"""
AI Agents API — Phase 4.

Endpoints for invoking the validated-AI agents and viewing their run history.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.auth import get_current_user, require_editor, CurrentUser
from app.core.firebase import get_firestore_client, Collections
from app.core.rate_limit import limiter, enforce_agent_budget, RATE_LIMIT_AGENT_PER_MIN
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


@router.get("/skills")
async def get_skills(user: CurrentUser = Depends(get_current_user)):
    """Skills the agents lazy-load (IEC 62304, ISO 14971, SaMD brain MRI)."""
    from app.agents.skills import list_available_skills
    return {"skills": list_available_skills()}


@router.get("/skills/{skill_name}")
async def get_skill_content(skill_name: str,
                              user: CurrentUser = Depends(get_current_user)):
    """Return the concatenated Skill markdown for review/audit."""
    from app.agents.skills import load_skill
    return {"skill": skill_name, "content": load_skill(skill_name, max_chars=50000)}


@router.post("/{name}/invoke")
@limiter.limit(RATE_LIMIT_AGENT_PER_MIN)
async def invoke_agent(name: str, request: Request, body: InvokeRequest,
                        user: CurrentUser = Depends(require_editor)):
    """Invoke an agent. Editor role minimum — viewers cannot run.

    Three rate-limit gates apply (in order):
    1) Per-user per-minute (slowapi, in-memory) — burst protection
    2) Per-user daily cap (Firestore-backed, cross-instance)
    3) Global hourly Claude cap (Firestore-backed, cross-instance)
    """
    enforce_agent_budget(user.uid)

    try:
        agent = get_agent(name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown agent: {name}")

    record = agent.run(
        context=body.context,
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
async def validate_agent(name: str, suite: str = "core",
                           user: CurrentUser = Depends(require_editor)):
    """Run the golden suite against an agent; persist IQ/OQ/PQ evidence.

    suite='core' (default) — small fast canary set
    suite='extended' — full parametric suite (slower, more Claude calls)
    """
    from app.services.ai_validation_service import AIValidationService
    try:
        result = AIValidationService.run_golden_suite_for_agent(
            agent_name=name, run_by_uid=user.uid, run_by_email=user.email,
            suite=suite,
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


@router.post("/validation/canary-run")
async def run_canary(user: CurrentUser = Depends(require_editor)):
    """Run the canary suite NOW (instead of waiting for Monday cron).

    Useful after a model swap or a Skills update to immediately see if
    drift was introduced.
    """
    from app.services.drift_detector import run_canary_suite
    return run_canary_suite()


@router.get("/validation/drift-history")
async def drift_history(agent_name: Optional[str] = None, limit: int = 50,
                          user: CurrentUser = Depends(get_current_user)):
    """Recent canary fingerprints + drift evaluations."""
    from app.services.drift_detector import get_drift_history
    return {"history": get_drift_history(agent_name=agent_name, limit=limit)}


@router.post("/validation/pccp")
async def generate_pccp(user: CurrentUser = Depends(require_editor)):
    """Generate a Predetermined Change Control Plan for the AI agents.

    Uses Claude Opus 4.6 to draft an FDA-format PCCP from the current
    agent registry + last canary results. The output is auditable (every
    field cites which agent/canary/run it derives from).
    """
    from app.services.pccp_generator import generate_pccp_document
    return generate_pccp_document(user_uid=user.uid, user_email=user.email)


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
