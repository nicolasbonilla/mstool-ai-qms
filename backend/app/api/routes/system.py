"""
System health + audit ledger verification.

Exposes configuration state and WORM ledger integrity so an auditor (or the
Dashboard health card) can prove which Firestore project is wired up and
confirm that the hash chain is unbroken.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_admin, CurrentUser
from app.core.firebase import get_active_project_id, QMS_PROJECT_ID
from app.core.config import get_settings
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/system", tags=["System"])

settings = get_settings()


@router.get("/health")
async def system_health(user: CurrentUser = Depends(get_current_user)):
    """Return configuration + last-write state.

    Surfaces the Firestore project the backend is actually connected to so
    we never again have the "writing to one project, reading from another"
    class of bug. Also returns the ledger head (sequence + hash + last
    timestamp) as a quick liveness check.
    """
    project_id = get_active_project_id()
    head = FirestoreService.get_ledger_head()
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "version": settings.APP_VERSION,
        "firestore": {
            "active_project": project_id,
            "expected_project": QMS_PROJECT_ID,
            "match": project_id == QMS_PROJECT_ID,
        },
        "ledger": head or {"status": "empty"},
    }


@router.get("/ledger/verify")
async def verify_ledger(limit: int = 500,
                         user: CurrentUser = Depends(require_admin)):
    """Walk the WORM ledger forward and verify every hash link.

    A corrupt entry appears as `valid: false` with the sequence number of
    the first break. Admin only — the verifier reads every entry.
    """
    return FirestoreService.verify_ledger_chain(limit=limit)


@router.post("/snapshot/trigger")
async def trigger_snapshot(user: CurrentUser = Depends(require_admin)):
    """Manually trigger a compliance-score snapshot.

    Cloud Scheduler hits this hourly in production via a service-account token
    so the trend charts have continuous data even when no human logged in.
    Admin role required to run it on demand (e.g. to verify Firestore wiring).
    """
    from app.services.compliance_service import ComplianceService
    svc = ComplianceService()
    result = svc.compute_full_score()
    snapshot = FirestoreService.store_score_snapshot(
        result["scores"], result["breakdown"], granularity="hour"
    )
    return {
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        "snapshot_id": snapshot["bucket_id"],
        "scores": snapshot["scores"],
    }


@router.post("/sentinel/scan")
async def sentinel_scan(days: int = 14,
                          user: CurrentUser = Depends(require_admin)):
    """Run the regression sentinel across recent snapshots.

    Cloud Scheduler hits this hourly; creates alerts in qms_alerts when any
    tracked metric falls below its Prophet 95% prediction interval (or 2σ
    heuristic if Prophet is not available / not enough data).
    """
    from app.services.regression_sentinel import scan_snapshots
    history = FirestoreService.get_score_history(days=days)
    return scan_snapshots(history)


@router.get("/alerts")
async def list_alerts(only_open: bool = True,
                       user: CurrentUser = Depends(get_current_user)):
    """Open alerts for the Dashboard 'Requires Attention' section."""
    return {"alerts": FirestoreService.list_alerts(only_open=only_open)}


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str,
                              user: CurrentUser = Depends(get_current_user)):
    """Acknowledge an alert so it disappears from the open queue."""
    result = FirestoreService.acknowledge_alert(alert_id, user.email)
    if result is None:
        return {"ok": False, "reason": "not found"}
    return {"ok": True, "alert": result}
