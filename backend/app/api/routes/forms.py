"""
Form Manager API routes — MSTool-AI-QMS.

Digital versions of TPL-01 through TPL-11 audit templates.
Persisted in Firestore. All actions logged to audit trail.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
import uuid

from app.models.schemas import CreateFormRequest, UpdateFormRequest
from app.core.auth import get_current_user, require_editor, CurrentUser
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/forms", tags=["Form Manager"])

TEMPLATES = {
    "TPL-01": {"title": "Problem Report", "standard": "IEC 62304 Clause 9"},
    "TPL-02": {"title": "Release Checklist", "standard": "IEC 62304 Clause 5.8"},
    "TPL-03": {"title": "Code Review Checklist", "standard": "IEC 62304 Clause 5.5.3"},
    "TPL-04": {"title": "Risk Control Verification", "standard": "ISO 14971 Clause 7.4"},
    "TPL-05": {"title": "Design Review Record", "standard": "IEC 62304 Clause 5.3/5.4"},
    "TPL-06": {"title": "Test Execution Report", "standard": "IEC 62304 Clause 5.5.5"},
    "TPL-07": {"title": "SOUP Vulnerability Review", "standard": "IEC 81001-5-1 Clause 5.3.12"},
    "TPL-08": {"title": "Serious Incident Report", "standard": "EU MDR Article 87"},
    "TPL-09": {"title": "Change Control Record", "standard": "IEC 62304 Clause 8"},
    "TPL-10": {"title": "Quality Gate Approval", "standard": "IEC 62304 Clause 5.1"},
    "TPL-11": {"title": "Document Approval Record", "standard": "ISO 13485 Clause 4.2.4"},
}


@router.get("/templates")
async def list_templates():
    """List all 11 form templates."""
    return {
        "templates": [{"template_id": k, **v} for k, v in TEMPLATES.items()],
        "total": len(TEMPLATES),
    }


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get template details."""
    if template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    return {"template_id": template_id, **TEMPLATES[template_id]}


@router.get("/templates/{template_id}/fields")
async def get_template_fields(template_id: str):
    """Get all field definitions for a template."""
    if template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    try:
        from app.services.form_templates import get_template_fields
        fields = get_template_fields(template_id)
        return {"template_id": template_id, "fields": fields}
    except ImportError:
        return {"template_id": template_id, "fields": []}


@router.post("/")
async def create_form(request: CreateFormRequest, user: CurrentUser = Depends(require_editor)):
    """Create a new form from template. Requires editor role."""
    if request.template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    form_id = str(uuid.uuid4())[:8]
    form_data = {
        "template_id": request.template_id,
        "title": request.title or TEMPLATES[request.template_id]["title"],
        "status": "draft",
        "version": 1,
        "created_by": user.email,
        "fields": {},
        "signatures": [],
    }

    form = FirestoreService.create_form(form_id, form_data)

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="create_form", resource_type="form",
        resource_id=form_id, details={"template_id": request.template_id},
    )

    return form


@router.get("/")
async def list_forms(
    template_id: Optional[str] = None,
    status: Optional[str] = None,
    user: CurrentUser = Depends(get_current_user),
):
    """List all forms with optional filters. Requires authentication."""
    forms = FirestoreService.list_forms(template_id=template_id, status=status)
    return {"forms": forms, "total": len(forms)}


@router.get("/{form_id}")
async def get_form(form_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get form details. Requires authentication."""
    form = FirestoreService.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.put("/{form_id}")
async def update_form(
    form_id: str,
    request: UpdateFormRequest,
    user: CurrentUser = Depends(require_editor),
):
    """Update form fields. Requires editor role."""
    form = FirestoreService.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    existing_fields = form.get("fields", {})
    existing_fields.update(request.fields)

    updated = FirestoreService.update_form(form_id, {"fields": existing_fields})

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="update_form", resource_type="form",
        resource_id=form_id, details={"updated_fields": list(request.fields.keys())},
    )

    return updated


@router.post("/{form_id}/sign")
async def sign_form(form_id: str, user: CurrentUser = Depends(get_current_user)):
    """Add electronic signature from the authenticated user."""
    form = FirestoreService.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    signatures = form.get("signatures", [])
    signatures.append({
        "user": user.email,
        "role": user.role,
        "signed_at": datetime.now(timezone.utc).isoformat(),
        "signature_type": "approver",
    })

    updated = FirestoreService.update_form(form_id, {"signatures": signatures})

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="sign_form", resource_type="form",
        resource_id=form_id,
    )

    return updated


@router.post("/{form_id}/approve")
async def approve_form(form_id: str, user: CurrentUser = Depends(require_editor)):
    """Approve form (changes status to approved). Requires editor role."""
    form = FirestoreService.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    updated = FirestoreService.update_form(form_id, {"status": "approved"})

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="approve_form", resource_type="form",
        resource_id=form_id,
    )

    return updated


@router.get("/{form_id}/pdf")
async def export_form_pdf(form_id: str, user: CurrentUser = Depends(get_current_user)):
    """Export form as PDF."""
    from fastapi.responses import Response
    form = FirestoreService.get_form(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    try:
        from app.services.pdf_service import PDFService
        template_config = TEMPLATES.get(form.get("template_id", ""), {})
        pdf_bytes = PDFService.generate_form_pdf(form, template_config)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={form.get('template_id', 'form')}_{form_id}.pdf"},
        )
    except ImportError:
        raise HTTPException(status_code=501, detail="PDF service not available")


@router.delete("/{form_id}")
async def delete_form(form_id: str, user: CurrentUser = Depends(require_editor)):
    """Delete a form. Requires editor role."""
    deleted = FirestoreService.delete_form(form_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Form not found")

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="delete_form", resource_type="form",
        resource_id=form_id,
    )

    return {"status": "deleted", "id": form_id}