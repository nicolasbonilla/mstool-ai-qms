"""
In-process scheduler — runs cron-like jobs inside the FastAPI worker.

Why not Cloud Scheduler? Cloud Scheduler API isn't enabled on the GCP
project and enabling it requires console intervention. APScheduler runs
inside our Cloud Run instance and is sufficient because:

- We're a single Cloud Run service with min_instances=1, so the scheduler
  is always alive.
- Jobs are idempotent (snapshot per-hour bucket, sentinel scan reuses
  the latest snapshots).
- For higher reliability we can migrate to Cloud Scheduler later by
  pointing it at the existing /system/snapshot/trigger endpoints.

Reference: APScheduler docs https://apscheduler.readthedocs.io/
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

_scheduler = None  # type: Optional[object]


async def _hourly_snapshot():
    """Capture a compliance score snapshot every hour."""
    try:
        from app.services.compliance_service import ComplianceService
        from app.services.firestore_service import FirestoreService

        result = ComplianceService().compute_full_score()
        snapshot = FirestoreService.store_score_snapshot(
            result["scores"], result["breakdown"], granularity="hour"
        )
        logger.info(f"hourly_snapshot OK bucket={snapshot.get('bucket_id')}")
    except Exception as e:
        logger.error(f"hourly_snapshot failed: {e}")


async def _daily_sentinel():
    """Run regression sentinel against the last 14 days of snapshots."""
    try:
        from app.services.firestore_service import FirestoreService
        from app.services.regression_sentinel import scan_snapshots

        history = FirestoreService.get_score_history(days=14)
        result = scan_snapshots(history)
        logger.info(
            f"daily_sentinel OK alerts_created={result.get('alerts_created')} "
            f"scanned={result.get('scanned')}"
        )
    except Exception as e:
        logger.error(f"daily_sentinel failed: {e}")


async def _daily_soup_monitor():
    """Run the SOUP Monitor agent in cron mode (Haiku, low cost)."""
    try:
        from app.agents.registry import get_agent
        agent = get_agent("soup_monitor")
        agent.run(context={}, invoked_by_uid="system",
                   invoked_by_email="scheduler@mstool-ai-qms")
        logger.info("daily_soup_monitor OK")
    except Exception as e:
        logger.error(f"daily_soup_monitor failed: {e}")


async def _weekly_regulatory_watch():
    """Run the Regulatory Watch agent weekly (Sonnet for the digest)."""
    try:
        from app.agents.registry import get_agent
        # Defensive: agent may not exist yet during partial deploys
        try:
            agent = get_agent("regulatory_watch")
        except KeyError:
            return
        agent.run(context={}, invoked_by_uid="system",
                   invoked_by_email="scheduler@mstool-ai-qms")
        logger.info("weekly_regulatory_watch OK")
    except Exception as e:
        logger.error(f"weekly_regulatory_watch failed: {e}")


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
