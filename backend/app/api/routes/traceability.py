"""
Traceability API routes — MSTool-AI-QMS.

Real requirement-to-evidence traceability from the MSTool-AI repository.
"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/compliance", tags=["Traceability"])


@router.get("/traceability")
async def get_traceability_graph(user: CurrentUser = Depends(get_current_user)):
    """Build and return the full traceability graph."""
    from app.services.traceability_service import TraceabilityService
    service = TraceabilityService()
    return service.build_graph()