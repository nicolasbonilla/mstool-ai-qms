"""
Audit Simulation API routes — MSTool-AI-QMS.

IEC 62304 clause-by-clause audit simulation with evidence gathering.
"""

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.core.auth import get_current_user, require_editor, CurrentUser
from app.models.schemas import AuditSimulateRequest
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/audit", tags=["Audit Simulator"])


@router.post("/run")
async def run_audit(request: AuditSimulateRequest, user: CurrentUser = Depends(get_current_user)):
    """Run an audit simulation."""
    from app.services.audit_engine import AuditEngine
    engine = AuditEngine()
    result = engine.run_audit(mode=request.mode, target=request.target)

    # Log to audit trail
    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="run_audit", resource_type="audit",
        resource_id=result["id"],
        details={"mode": request.mode, "readiness_score": result["readiness_score"]},
    )

    return result


@router.get("/history")
async def get_audit_history(limit: int = 20, user: CurrentUser = Depends(get_current_user)):
    """Get previous audit run results from audit trail."""
    entries = FirestoreService.get_audit_trail(limit=limit, resource_type="audit")
    return {"history": entries}


@router.post("/export-pdf")
async def export_audit_pdf(request: AuditSimulateRequest, user: CurrentUser = Depends(get_current_user)):
    """Run audit and export as PDF."""
    from app.services.audit_engine import AuditEngine
    from app.services.pdf_service import PDFService
    engine = AuditEngine()
    result = engine.run_audit(mode=request.mode, target=request.target)
    pdf_bytes = PDFService.generate_audit_report_pdf(result)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=audit_report_{result['id']}.pdf"},
    )