"""
AI Intelligence API routes — MSTool-AI-QMS.

Claude-powered AI for compliance analysis, auto-fill, CAPA, code review, and risk detection.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.auth import get_current_user, CurrentUser
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/ai", tags=["AI Intelligence"])


class AuditAnalysisRequest(BaseModel):
    audit_result: Dict[str, Any]


class AutoFillRequest(BaseModel):
    template_id: str
    context: Optional[Dict[str, Any]] = None


class CAPARequest(BaseModel):
    problem_description: str
    affected_module: Optional[str] = ""
    affected_requirements: Optional[str] = ""


class CodeReviewRequest(BaseModel):
    file_path: str


class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


def _get_ai():
    from app.services.ai_service import AIService
    return AIService()


@router.post("/analyze-audit")
async def analyze_audit(request: AuditAnalysisRequest, user: CurrentUser = Depends(get_current_user)):
    """AI analysis of audit results with actionable recommendations."""
    ai = _get_ai()
    result = ai.analyze_audit(request.audit_result)

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="ai_analyze_audit", resource_type="ai",
        details={"readiness_score": request.audit_result.get("readiness_score")},
    )

    return result


@router.post("/autofill")
async def autofill_form(request: AutoFillRequest, user: CurrentUser = Depends(get_current_user)):
    """AI auto-fill a regulatory form based on codebase analysis."""
    ai = _get_ai()
    result = ai.autofill_form(request.template_id, request.context)

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="ai_autofill", resource_type="ai",
        details={"template_id": request.template_id},
    )

    return result


@router.post("/generate-capa")
async def generate_capa(request: CAPARequest, user: CurrentUser = Depends(get_current_user)):
    """AI-generated CAPA from a problem description."""
    ai = _get_ai()
    result = ai.generate_capa(
        request.problem_description,
        request.affected_module or "",
        request.affected_requirements or "",
    )

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="ai_generate_capa", resource_type="ai",
        details={"module": request.affected_module},
    )

    return result


@router.post("/review-code")
async def review_code(request: CodeReviewRequest, user: CurrentUser = Depends(get_current_user)):
    """AI code review for IEC 62304 compliance."""
    ai = _get_ai()
    result = ai.review_code(request.file_path)

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="ai_review_code", resource_type="ai",
        details={"file_path": request.file_path},
    )

    return result


@router.get("/detect-risks")
async def detect_risks(user: CurrentUser = Depends(get_current_user)):
    """AI detection of risks in recent code changes."""
    ai = _get_ai()
    result = ai.detect_risks()

    FirestoreService.log_action(
        user_uid=user.uid, user_email=user.email,
        action="ai_detect_risks", resource_type="ai",
    )

    return result


@router.post("/chat")
async def chat(request: ChatRequest, user: CurrentUser = Depends(get_current_user)):
    """General AI compliance chat."""
    ai = _get_ai()
    response = ai.chat(request.message, request.context)
    return {"response": response}