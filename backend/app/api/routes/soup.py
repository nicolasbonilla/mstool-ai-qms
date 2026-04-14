"""
SOUP Monitoring API routes — MSTool-AI-QMS.

Software of Unknown Provenance — dependency tracking and CVE scanning.
"""

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/soup", tags=["SOUP Monitor"])


@router.get("/dependencies")
async def list_dependencies(user: CurrentUser = Depends(get_current_user)):
    """List all SOUP dependencies from the monitored repository."""
    from app.services.soup_service import SOUPService
    service = SOUPService()
    return {"dependencies": service.get_all_dependencies()}


@router.get("/summary")
async def get_soup_summary(user: CurrentUser = Depends(get_current_user)):
    """Get SOUP monitoring summary."""
    from app.services.soup_service import SOUPService
    service = SOUPService()
    return service.get_summary()


@router.post("/scan")
async def scan_vulnerabilities(user: CurrentUser = Depends(get_current_user)):
    """Scan all dependencies for known CVE vulnerabilities."""
    from app.services.soup_service import SOUPService
    service = SOUPService()
    return service.scan_vulnerabilities()


@router.get("/dependency/{package_name}")
async def get_dependency_detail(package_name: str, user: CurrentUser = Depends(get_current_user)):
    """Get detailed analysis of a single dependency."""
    from app.services.soup_service import SOUPService
    service = SOUPService()
    detail = service.get_dependency_detail(package_name)
    if not detail:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Package {package_name} not found")
    return detail