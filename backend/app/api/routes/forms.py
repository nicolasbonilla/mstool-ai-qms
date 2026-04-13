"""
Form Manager API routes — MSTool-AI-QMS.

Digital versions of TPL-01 through TPL-11 audit templates.
Supports creation, editing, AI auto-fill, signatures, and PDF export.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import uuid

from app.models.schemas import CreateFormRequest, UpdateFormRequest

router = APIRouter(prefix="/forms", tags=["Form Manager"])

# In-memory store (replace with database in production)
_forms_db: dict = {}

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
    """Get template details with field definitions."""
    if template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Template {template_id} not found")
    return {"template_id": template_id, **TEMPLATES[template_id]}


@router.post("/")
async def create_form(request: CreateFormRequest):
    """Create a new form from template."""
    if request.template_id not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")

    form_id = str(uuid.uuid4())[:8]
    form = {
        "id": form_id,
        "template_id": request.template_id,
        "title": request.title or TEMPLATES[request.template_id]["title"],
        "status": "draft",
        "version": 1,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "fields": {},
        "signatures": [],
    }
    _forms_db[form_id] = form
    return form


@router.get("/")
async def list_forms(template_id: Optional[str] = None, status: Optional[str] = None):
    """List all forms with optional filters."""
    forms = list(_forms_db.values())
    if template_id:
        forms = [f for f in forms if f["template_id"] == template_id]
    if status:
        forms = [f for f in forms if f["status"] == status]
    return {"forms": forms, "total": len(forms)}


@router.get("/{form_id}")
async def get_form(form_id: str):
    """Get form details."""
    if form_id not in _forms_db:
        raise HTTPException(status_code=404, detail="Form not found")
    return _forms_db[form_id]


@router.put("/{form_id}")
async def update_form(form_id: str, request: UpdateFormRequest):
    """Update form fields."""
    if form_id not in _forms_db:
        raise HTTPException(status_code=404, detail="Form not found")
    _forms_db[form_id]["fields"].update(request.fields)
    _forms_db[form_id]["updated_at"] = datetime.utcnow().isoformat()
    return _forms_db[form_id]


@router.post("/{form_id}/sign")
async def sign_form(form_id: str, user: str = "admin", role: str = "QMS Manager"):
    """Add electronic signature."""
    if form_id not in _forms_db:
        raise HTTPException(status_code=404, detail="Form not found")
    _forms_db[form_id]["signatures"].append({
        "user": user,
        "role": role,
        "signed_at": datetime.utcnow().isoformat(),
        "signature_type": "approver",
    })
    return _forms_db[form_id]


@router.post("/{form_id}/approve")
async def approve_form(form_id: str):
    """Approve form (changes status to approved)."""
    if form_id not in _forms_db:
        raise HTTPException(status_code=404, detail="Form not found")
    _forms_db[form_id]["status"] = "approved"
    _forms_db[form_id]["updated_at"] = datetime.utcnow().isoformat()
    return _forms_db[form_id]
