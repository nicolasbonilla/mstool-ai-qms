"""
In-process scheduler — runs cron-like jobs inside the FastAPI worker.

Cloud Run can scale up to N instances per Cloud Run config. Each instance
would naively run the cron, causing N executions per scheduled time. Most
of our jobs are idempotent by design (per-hour bucket overwrite for
snapshots) but a few are NOT idempotent (creating an alert + sending
notifications). To prevent dup execution we implement a Firestore-backed
LEADER LOCK: only the instance that wins the lease for a given job-name
runs the job; the others see the lease and return.

Lease semantics:
- Per job_name, doc at qms_settings/scheduler_leases.<job_name>
- Lease holder writes (instance_id, expires_at). Lease length = 5 min.
- A challenger sees an expired lease and overwrites it (last-writer-wins).
  That can race with another instance also detecting expiration — accept-
  able because Firestore writes are serialized per-doc and the loser of
  the race will see a newer expires_at on its next attempt.
- The leader runs the job, then writes a `last_run_at` field for visibility.

Why not a true distributed lock? Cloud Run instances are short-lived,
job durations are seconds, and the cost of a duplicate run for the
non-idempotent jobs (alert creation) is bounded — Firestore .add() is
acceptable to dedupe further by job_name + bucket if we want. For now
we keep this implementation simple and observable.
"""

import asyncio
import logging
import os
import socket
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Stable instance identifier — preferred from Cloud Run env var, fallback
# to hostname + uuid so two local processes still differ.
INSTANCE_ID = (
    os.environ.get("K_REVISION")
    and f"{os.environ['K_REVISION']}:{uuid.uuid4().hex[:6]}"
    or f"{socket.gethostname()}:{uuid.uuid4().hex[:6]}"
)

LEASE_TTL_SECONDS = 300  # 5 minutes

_scheduler = None  # type: Optional[object]


def _try_acquire_leader(job_name: str) -> bool:
    """Best-effort Firestore-backed leader election for a single job.

    Returns True if THIS instance owns the lease and should run the job.
    Returns False if a valid lease is already held by someone else.
    """
    try:
        from app.core.firebase import get_firestore_client, Collections
        db = get_firestore_client()
        doc_ref = (
            db.collection(Collections.SETTINGS)
            .document("scheduler_leases")
            .collection("jobs")
            .document(job_name)
        )
        now = datetime.now(timezone.utc)
        snap = doc_ref.get()
        existing = snap.to_dict() if snap.exists else None
        if existing and existing.get("expires_at"):
            try:
                expires = datetime.fromisoformat(
                    existing["expires_at"].replace("Z", "+00:00")
                )
                if expires > now and existing.get("instance_id") != INSTANCE_ID:
                    # Lease still valid and held by someone else — yield.
                    return False
            except Exception:
                pass

        new_lease = {
            "job_name": job_name,
            "instance_id": INSTANCE_ID,
            "acquired_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=LEASE_TTL_SECONDS)).isoformat(),
        }
        doc_ref.set(new_lease)
        return True
    except Exception as e:
        # If we can't reach Firestore the safest fallback is to RUN the job
        # — better duplicate work than silently skip critical compliance cron.
        logger.warning(f"Leader-lease check failed for {job_name}: {e} — running anyway")
        return True


def _record_run_completion(job_name: str, status: str, details: Optional[dict] = None) -> None:
    """Persist last_run metadata for observability."""
    try:
        from app.core.firebase import get_firestore_client, Collections
        db = get_firestore_client()
        doc_ref = (
            db.collection(Collections.SETTINGS)
            .document("scheduler_leases")
            .collection("jobs")
            .document(job_name)
        )
        doc_ref.update({
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "last_run_instance": INSTANCE_ID,
            "last_run_status": status,
            "last_run_details": details or {},
        })
    except Exception as e:
        logger.warning(f"Could not record run completion for {job_name}: {e}")


async def _hourly_snapshot():
    """Capture a compliance score snapshot every hour."""
    if not _try_acquire_leader("hourly_snapshot"):
        return
    try:
        from app.services.compliance_service import ComplianceService
        from app.services.firestore_service import FirestoreService

        result = ComplianceService().compute_full_score()
        snapshot = FirestoreService.store_score_snapshot(
            result["scores"], result["breakdown"], granularity="hour"
        )
        logger.info(f"hourly_snapshot OK bucket={snapshot.get('bucket_id')}")
        _record_run_completion("hourly_snapshot", "ok",
                                 {"bucket": snapshot.get("bucket_id")})
    except Exception as e:
        logger.error(f"hourly_snapshot failed: {e}")
        _record_run_completion("hourly_snapshot", "error", {"error": str(e)})


async def _daily_sentinel():
    """Run regression sentinel against the last 14 days of snapshots."""
    if not _try_acquire_leader("daily_sentinel"):
        return
    try:
        from app.services.firestore_service import FirestoreService
        from app.services.regression_sentinel import scan_snapshots

        history = FirestoreService.get_score_history(days=14)
        result = scan_snapshots(history)
        logger.info(
            f"daily_sentinel OK alerts_created={result.get('alerts_created')} "
            f"scanned={result.get('scanned')}"
        )
        _record_run_completion("daily_sentinel", "ok",
                                 {"alerts_created": result.get("alerts_created")})
    except Exception as e:
        logger.error(f"daily_sentinel failed: {e}")
        _record_run_completion("daily_sentinel", "error", {"error": str(e)})


async def _daily_soup_monitor():
    """Run the SOUP Monitor agent in cron mode (Haiku, low cost)."""
    if not _try_acquire_leader("daily_soup_monitor"):
        return
    try:
        from app.agents.registry import get_agent
        agent = get_agent("soup_monitor")
        agent.run(context={}, invoked_by_uid="system",
                   invoked_by_email="scheduler@mstool-ai-qms")
        logger.info("daily_soup_monitor OK")
        _record_run_completion("daily_soup_monitor", "ok")
    except Exception as e:
        logger.error(f"daily_soup_monitor failed: {e}")
        _record_run_completion("daily_soup_monitor", "error", {"error": str(e)})


async def _weekly_regulatory_watch():
    """Run the Regulatory Watch agent weekly (Sonnet for the digest)."""
    if not _try_acquire_leader("weekly_regulatory_watch"):
        return
    try:
        from app.agents.registry import get_agent
        try:
            agent = get_agent("regulatory_watch")
        except KeyError:
            return
        agent.run(context={}, invoked_by_uid="system",
                   invoked_by_email="scheduler@mstool-ai-qms")
        logger.info("weekly_regulatory_watch OK")
        _record_run_completion("weekly_regulatory_watch", "ok")
    except Exception as e:
        logger.error(f"weekly_regulatory_watch failed: {e}")
        _record_run_completion("weekly_regulatory_watch", "error", {"error": str(e)})


async def _weekly_drift_canary():
    """Run the canary prompt suite once a week to detect AI drift."""
    if not _try_acquire_leader("weekly_drift_canary"):
        return
    try:
        from app.services.drift_detector import run_canary_suite
        result = run_canary_suite()
        logger.info(f"weekly_drift_canary OK divergences={result.get('divergences')}")
        _record_run_completion("weekly_drift_canary", "ok",
                                 {"divergences": result.get("divergences", 0)})
    except Exception as e:
        logger.error(f"weekly_drift_canary failed: {e}")
        _record_run_completion("weekly_drift_canary", "error", {"error": str(e)})


def start_scheduler():
    """Start the in-process scheduler. Called from FastAPI lifespan."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.warning("apscheduler not installed — scheduled jobs disabled")
        return None

    sched = AsyncIOScheduler(timezone="UTC")

    # Every hour at minute 5 — gives the previous hour time to finalize
    sched.add_job(_hourly_snapshot, CronTrigger(minute=5),
                   id="hourly_snapshot", replace_existing=True,
                   coalesce=True, max_instances=1)

    # Daily at 02:30 UTC — sentinel after enough hourly snapshots accumulated
    sched.add_job(_daily_sentinel, CronTrigger(hour=2, minute=30),
                   id="daily_sentinel", replace_existing=True,
                   coalesce=True, max_instances=1)

    # Daily at 03:00 UTC — SOUP scan via NVD (rate-limit friendly window)
    sched.add_job(_daily_soup_monitor, CronTrigger(hour=3, minute=0),
                   id="daily_soup_monitor", replace_existing=True,
                   coalesce=True, max_instances=1)

    # Mondays at 06:00 UTC — weekly regulatory digest
    sched.add_job(_weekly_regulatory_watch, CronTrigger(day_of_week="mon", hour=6),
                   id="weekly_regulatory_watch", replace_existing=True,
                   coalesce=True, max_instances=1)

    # Mondays at 07:00 UTC — weekly canary suite for AI drift detection
    sched.add_job(_weekly_drift_canary, CronTrigger(day_of_week="mon", hour=7),
                   id="weekly_drift_canary", replace_existing=True,
                   coalesce=True, max_instances=1)

    sched.start()
    _scheduler = sched
    logger.info(f"Scheduler started with {len(sched.get_jobs())} jobs")

    # Run snapshot once on boot so trend chart populates immediately
    asyncio.create_task(_hourly_snapshot())

    return sched


def shutdown_scheduler():
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
        except Exception:
            pass
        _scheduler = None
