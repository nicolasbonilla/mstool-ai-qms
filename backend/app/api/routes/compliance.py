"""
Compliance Dashboard API routes — MSTool-AI-QMS.

Real-time compliance scoring, auth coverage analysis,
document inventory, and test coverage reporting.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.core.config import get_settings

router = APIRouter(prefix="/compliance", tags=["Compliance Dashboard"])

settings = get_settings()


def _get_service():
    from app.services.compliance_service import ComplianceService
    return ComplianceService(settings.MSTOOL_AI_REPO_PATH)


@router.get("/score")
async def get_compliance_score():
    """Compute and return real-time compliance score with breakdown."""
    try:
        service = _get_service()
        return service.compute_full_score()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/auth-coverage")
async def get_auth_coverage():
    """Detailed authentication coverage per route file."""
    service = _get_service()
    return service.get_auth_coverage_detail()


@router.get("/documents")
async def list_documents(standard: Optional[str] = None):
    """List all regulatory documents with freshness indicators."""
    service = _get_service()
    docs = service.get_document_inventory()
    if standard:
        docs = [d for d in docs if d["standard"] == standard]
    return {"documents": docs, "total": len(docs)}


@router.get("/tests")
async def list_tests():
    """List all test files with metadata."""
    service = _get_service()
    tests = service.get_test_inventory()
    return {"tests": tests, "total": len(tests)}
