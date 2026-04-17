"""
Compliance Dashboard API routes — MSTool-AI-QMS.

Real-time compliance scoring via GitHub API analysis.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from app.core.auth import get_current_user, CurrentUser

router = APIRouter(prefix="/compliance", tags=["Compliance Dashboard"])


def _get_service():
    from app.services.compliance_service import ComplianceService
    return ComplianceService()


def _snapshot_from_full_score(result: dict) -> None:
    """Persist a per-hour snapshot. Idempotent within the hour bucket."""
    try:
        from app.services.firestore_service import FirestoreService
        FirestoreService.store_score_snapshot(
            result["scores"], result["breakdown"], granularity="hour"
        )
    except Exception:
        # Snapshot must never block the hot dashboard path.
        pass


@router.get("/score")
async def get_compliance_score(user: CurrentUser = Depends(get_current_user)):
    """Compute and return real-time compliance score with breakdown."""
    try:
        service = _get_service()
        result = service.compute_full_score()
        _snapshot_from_full_score(result)
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/score-detailed")
async def get_detailed_compliance_score(user: CurrentUser = Depends(get_current_user)):
    """Compute compliance score with full evidence per check — for dashboard.

    Side effect: also persists a per-hour snapshot so the Dashboard charts
    populate from the very first time anyone opens the page (without
    waiting for the APScheduler hourly tick).
    """
    try:
        service = _get_service()
        result = service.compute_detailed_score()
        # The detailed endpoint shape carries `scores` and a list of `checks`.
        # Convert checks → breakdown dict for the snapshot store.
        try:
            breakdown = {c["id"]: c["score"] for c in result.get("checks", [])
                          if isinstance(c, dict) and "id" in c}
            from app.services.firestore_service import FirestoreService
            FirestoreService.store_score_snapshot(
                result.get("scores", {}), breakdown, granularity="hour"
            )
        except Exception:
            pass
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/check/{check_id}/evidence")
async def get_check_evidence(check_id: str, user: CurrentUser = Depends(get_current_user)):
    """Get deep evidence with code snippets for a specific compliance check."""
    try:
        service = _get_service()
        return service.get_check_evidence(check_id)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/score-history")
async def get_score_history(days: int = 30, user: CurrentUser = Depends(get_current_user)):
    """Get compliance score trend data for sparklines."""
    from app.services.firestore_service import FirestoreService
    return {"history": FirestoreService.get_score_history(days)}


@router.get("/auth-coverage")
async def get_auth_coverage(user: CurrentUser = Depends(get_current_user)):
    """Detailed authentication coverage per route file."""
    service = _get_service()
    return service.get_auth_coverage_detail()


@router.get("/documents")
async def list_documents(standard: Optional[str] = None,
                          user: CurrentUser = Depends(get_current_user)):
    """List all regulatory documents with freshness AND review-state indicators.

    Each doc is augmented with the latest review record from
    qms_doc_reviews so the page can distinguish 'fresh / never_reviewed /
    modified_since_review / overdue_review' (ISO 13485 §4.2.4).
    """
    from app.services.doc_review_service import (
        all_latest_reviews, derive_review_status,
    )
    service = _get_service()
    docs = service.get_document_inventory()
    if standard:
        docs = [d for d in docs if d["standard"] == standard]

    # One Firestore scan for all reviews — fast, cached server-side
    reviews_by_path = all_latest_reviews()

    for d in docs:
        latest = reviews_by_path.get(d["path"])
        # Fetch current content hash lazily — only if there IS a prior
        # review so we can detect drift. For never-reviewed docs, no need.
        current_hash = None
        if latest and latest.get("reviewed_content_hash"):
            try:
                content = service.github.get_file_content(d["path"]) or ""
                from app.services.doc_review_service import _content_hash
                current_hash = _content_hash(content)
            except Exception:
                pass

        status_info = derive_review_status(d, latest, current_hash)
        d["review_event_status"] = status_info["review_status"]
        d["review_event_reason"] = status_info["reason"]
        d["last_reviewed_at"] = status_info["last_reviewed_at"]
        d["last_reviewer_email"] = status_info["last_reviewer_email"]
        d["content_unchanged_since_review"] = status_info["hash_match"]

    return {"documents": docs, "total": len(docs)}


@router.get("/tests")
async def list_tests(user: CurrentUser = Depends(get_current_user)):
    """List all test files with metadata."""
    service = _get_service()
    tests = service.get_test_inventory()
    return {"tests": tests, "total": len(tests)}


@router.get("/commits")
async def get_commits(count: int = 30, user: CurrentUser = Depends(get_current_user)):
    """Get recent commits from the monitored repository."""
    service = _get_service()
    return {"commits": service.get_commits(count)}


@router.get("/pull-requests")
async def get_pull_requests(state: str = "all", count: int = 30, user: CurrentUser = Depends(get_current_user)):
    """Get pull requests from the monitored repository."""
    service = _get_service()
    return {"pull_requests": service.get_pull_requests(state, count)}


@router.get("/ci-runs")
async def get_ci_runs(count: int = 10, user: CurrentUser = Depends(get_current_user)):
    """Get CI workflow runs from the monitored repository."""
    service = _get_service()
    return {"ci_runs": service.get_ci_runs(count)}