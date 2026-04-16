"""
Cron endpoints — invoked by Cloud Scheduler (or any external scheduler).

These bypass the Firebase ID token check and instead trust:
1) Google-issued OIDC JWT (when CRON_OIDC_AUDIENCE env var is set), OR
2) A shared secret header (X-Cron-Secret) matching CRON_SECRET env var.

Why this design: Cloud Scheduler attaches an OIDC token signed by Google
on every invocation. We verify it with google-auth. If the env var isn't
configured (e.g. local dev), we fall back to the shared secret so tests
can still drive the endpoints.

Why endpoints instead of in-process APScheduler: we removed the
in-process scheduler to allow Cloud Run to scale to zero. Cloud Scheduler
HTTP targets are billed only on invocation (~$0 at our volume) and they
WAKE UP the Cloud Run instance when needed. Net result: ~$45/month
savings vs always-on min-instances=1.

Security note: the cron endpoints are read+execute, never delete or
mutate user data outside their normal idempotent operations.
"""

import logging
import os
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["Cron"])


def _verify_invoker(request: Request) -> Dict[str, Any]:
    """Authorize a cron request via OIDC or shared secret."""
    # Path 1: Google OIDC — Cloud Scheduler attaches one when configured.
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth.split("Bearer ", 1)[1]
        audience = os.environ.get("CRON_OIDC_AUDIENCE", "")
        if audience:
            try:
                from google.oauth2 import id_token
                from google.auth.transport import requests as ga_requests
                claims = id_token.verify_oauth2_token(
                    token, ga_requests.Request(), audience
                )
                return {"method": "oidc", "subject": claims.get("email", "unknown")}
            except Exception as e:
                logger.warning(f"OIDC verify failed: {e}")

    # Path 2: shared secret fallback (dev / smoke tests)
    expected = os.environ.get("CRON_SECRET", "")
    provided = request.headers.get("X-Cron-Secret", "")
    if expected and provided and provided == expected:
        return {"method": "shared_secret", "subject": "scheduler"}

    raise HTTPException(status_code=401,
                          detail="Unauthorized: missing valid OIDC or X-Cron-Secret")


@router.post("/snapshot")
async def cron_snapshot(request: Request):
    """Hourly compliance snapshot — replaces APScheduler hourly_snapshot."""
    invoker = _verify_invoker(request)
    from app.services.compliance_service import ComplianceService
    from app.services.firestore_service import FirestoreService
    result = ComplianceService().compute_full_score()
    snapshot = FirestoreService.store_score_snapshot(
        result["scores"], result["breakdown"], granularity="hour"
    )
    return {"ok": True, "invoker": invoker, "bucket": snapshot.get("bucket_id")}


@router.post("/sentinel")
async def cron_sentinel(request: Request):
    """Daily regression sentinel — replaces APScheduler daily_sentinel."""
    _verify_invoker(request)
    from app.services.firestore_service import FirestoreService
    from app.services.regression_sentinel import scan_snapshots
    history = FirestoreService.get_score_history(days=14)
    return scan_snapshots(history)


@router.post("/soup-monitor")
async def cron_soup_monitor(request: Request):
    """Daily SOUP scan via the SOUP Monitor agent."""
    _verify_invoker(request)
    from app.agents.registry import get_agent
    return get_agent("soup_monitor").run(
        context={}, invoked_by_uid="cron:soup_monitor",
        invoked_by_email="cron@mstool-ai-qms",
    )


@router.post("/regulatory-watch")
async def cron_regulatory_watch(request: Request):
    """Weekly regulatory digest via the Regulatory Watch agent."""
    _verify_invoker(request)
    from app.agents.registry import get_agent
    return get_agent("regulatory_watch").run(
        context={}, invoked_by_uid="cron:regulatory_watch",
        invoked_by_email="cron@mstool-ai-qms",
    )


@router.post("/drift-canary")
async def cron_drift_canary(request: Request):
    """Weekly canary suite for AI drift detection."""
    _verify_invoker(request)
    from app.services.drift_detector import run_canary_suite
    return run_canary_suite()


@router.post("/firestore-ttl-sweep")
async def cron_firestore_ttl_sweep(request: Request):
    """Daily housekeeping: collapse old hourly snapshots into daily averages
    and prune anything past the retention window. Big cost saver over time.
    """
    _verify_invoker(request)
    from app.services.firestore_service import FirestoreService
    return FirestoreService.cost_saver_sweep()
