"""
SOUP Monitoring API routes — MSTool-AI-QMS.

Software of Unknown Provenance — dependency tracking and CVE scanning.
Extended with: registry-enriched metadata, persisted scan history, real
anomaly tracker, EOL forecast, AI-drafted review records, CycloneDX SBOM
export, and cross-link to SOUP Monitor agent runs.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.core.auth import get_current_user, require_editor, require_qms_manager, CurrentUser

router = APIRouter(prefix="/soup", tags=["SOUP Monitor"])


@router.get("/dependencies")
async def list_dependencies(user: CurrentUser = Depends(get_current_user)):
    """List all SOUP dependencies — enriched with PyPI/npm metadata."""
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
async def scan_vulnerabilities(user: CurrentUser = Depends(require_editor)):
    """Scan all dependencies for known CVE vulnerabilities + persist history."""
    from app.services.soup_service import SOUPService
    from app.services.soup_extras import persist_scan_result
    service = SOUPService()
    scan = service.scan_vulnerabilities()
    try:
        scan["persisted_id"] = persist_scan_result(scan, invoked_by_email=user.email)
    except Exception:
        pass  # never fail the scan response on persistence error
    return scan


@router.get("/scan/history")
async def scan_history(limit: int = 30,
                        user: CurrentUser = Depends(get_current_user)):
    """Recent CVE scans newest-first (for the timeline UI)."""
    from app.services.soup_extras import list_scan_history
    return {"scans": list_scan_history(limit=limit)}


@router.get("/scan/latest")
async def scan_latest(user: CurrentUser = Depends(get_current_user)):
    """Most recent CVE scan, full payload."""
    from app.services.soup_extras import latest_scan
    return latest_scan() or {}


@router.get("/dependency/{package_name}")
async def get_dependency_detail(package_name: str,
                                  user: CurrentUser = Depends(get_current_user)):
    """Detailed analysis: dep metadata + CVEs + recent anomalies + EOL data."""
    from app.services.soup_service import SOUPService
    from app.services.soup_extras import fetch_anomalies, fetch_eol_data
    service = SOUPService()
    detail = service.get_dependency_detail(package_name)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Package {package_name} not found")
    # Enrich on demand: fetch latest issues + EOL info
    anomaly_url = detail.get("anomaly_url")
    if anomaly_url:
        detail["anomalies"] = fetch_anomalies(anomaly_url, limit=10)
    detail["eol"] = fetch_eol_data(package_name, detail.get("version", ""))
    return detail


@router.get("/sbom")
async def export_sbom(user: CurrentUser = Depends(get_current_user)):
    """Download a CycloneDX 1.5 JSON SBOM of all dependencies.

    The SBOM is the format FDA accepts in 510(k) submissions per the
    September 2023 cybersecurity guidance for medical devices. Each
    component carries supplier, license, package URL, and our internal
    safety_class as a CycloneDX property.
    """
    from app.services.soup_service import SOUPService
    from app.services.sbom_generator import cyclonedx_bytes
    deps = SOUPService().get_all_dependencies()
    blob = cyclonedx_bytes(deps)
    return Response(
        content=blob,
        media_type="application/vnd.cyclonedx+json",
        headers={
            "Content-Disposition": "attachment; filename=mstool-ai-sbom.cdx.json",
        },
    )


@router.get("/agent-run/latest")
async def latest_agent_run(user: CurrentUser = Depends(get_current_user)):
    """Most recent SOUP Monitor agent invocation (for the cross-link panel)."""
    from app.services.soup_extras import latest_soup_agent_run
    run = latest_soup_agent_run()
    return run or {}


@router.get("/anomalies/{package_name}")
async def package_anomalies(package_name: str,
                              limit: int = 10,
                              user: CurrentUser = Depends(get_current_user)):
    """Fetch latest open bug-labeled issues from the package's repo."""
    from app.services.soup_service import SOUPService
    from app.services.soup_extras import fetch_anomalies
    detail = SOUPService().get_dependency_detail(package_name)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Package {package_name} not found")
    anomaly_url = detail.get("anomaly_url")
    if not anomaly_url:
        return {"items": [], "reason": "no anomaly tracker URL on this package"}
    return fetch_anomalies(anomaly_url, limit=limit)


@router.get("/unpinned-class-c")
async def unpinned_class_c_route(user: CurrentUser = Depends(get_current_user)):
    """Class C dependencies that are NOT pinned to an exact version.

    These are IEC 62304 §5.1.7 violations — every SOUP item must be
    uniquely identified. Surfaced in a separate banner on the SOUP page.
    """
    from app.services.soup_service import SOUPService
    from app.services.soup_extras import unpinned_class_c
    deps = SOUPService().get_all_dependencies()
    return {"items": unpinned_class_c(deps)}


@router.post("/review-drafts/generate")
async def generate_review_drafts(user: CurrentUser = Depends(require_qms_manager)):
    """AI-draft SOUP §8.1.2 review records for every Class C dep that lacks one.

    QMS Manager role required because this can spawn many agent runs and
    consume Claude budget.
    """
    from app.services.soup_service import SOUPService
    from app.services.soup_review_drafter import draft_for_class_c
    deps = SOUPService().get_all_dependencies()
    return draft_for_class_c(deps, invoked_by=user.email)


@router.post("/review-drafts/single/{package_name}")
async def generate_single_review_draft(
    package_name: str,
    user: CurrentUser = Depends(require_editor),
):
    """Draft a SOUP review for a specific package on demand."""
    from app.services.soup_service import SOUPService
    from app.services.soup_review_drafter import draft_review_for, persist_drafts
    detail = SOUPService().get_dependency_detail(package_name)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Package {package_name} not found")
    draft = draft_review_for(detail)
    ids = persist_drafts([draft], invoked_by=user.email)
    draft["id"] = ids[0] if ids else None
    return draft


@router.get("/review-drafts")
async def list_review_drafts(limit: int = 100,
                               user: CurrentUser = Depends(get_current_user)):
    """List existing AI-drafted SOUP review records pending human signature."""
    from app.services.soup_review_drafter import list_drafts
    return {"drafts": list_drafts(limit=limit)}