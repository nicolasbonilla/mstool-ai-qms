"""
Activity Feed API — Phase 1 (21 CFR Part 11 §11.10(e)).

The activity feed is the user-facing view over the WORM audit trail. It's
how the QMS proves to itself — and to an auditor — that every mutation is
attributed, timestamped, and verifiable.

Endpoints:
- GET /activity/feed   — paginated mutation history with filters
- GET /activity/summary — counts by type/user/day for the activity page header
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user, CurrentUser
from app.services.firestore_service import FirestoreService

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("/feed")
async def get_activity_feed(
    limit: int = Query(50, ge=1, le=500),
    resource_type: Optional[str] = None,
    action: Optional[str] = None,
    user_uid: Optional[str] = None,
    days: Optional[int] = Query(None, ge=1, le=365, description="Only entries within last N days"),
    user: CurrentUser = Depends(get_current_user),
):
    """Return recent audit trail entries with optional filtering."""
    since_iso = None
    if days:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        since_iso = since.isoformat()

    entries = FirestoreService.get_audit_trail(
        limit=limit,
        resource_type=resource_type,
        action=action,
        user_uid=user_uid,
        since_iso=since_iso,
    )
    return {
        "count": len(entries),
        "entries": entries,
    }


@router.get("/summary")
async def get_activity_summary(
    days: int = Query(7, ge=1, le=90),
    user: CurrentUser = Depends(get_current_user),
):
    """Aggregate counts for the activity page header.

    Returns per-day, per-type, per-user counts for the given window so the
    UI can render a timeline summary without pulling every entry.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    entries = FirestoreService.get_audit_trail(
        limit=500,
        since_iso=since.isoformat(),
    )

    by_day: dict[str, int] = {}
    by_type: dict[str, int] = {}
    by_user: dict[str, int] = {}
    by_severity = {"info": 0, "warning": 0, "error": 0}

    for e in entries:
        ts = e.get("timestamp", "")
        day = ts[:10] if len(ts) >= 10 else "unknown"
        by_day[day] = by_day.get(day, 0) + 1
        rtype = e.get("resource_type", "unknown")
        by_type[rtype] = by_type.get(rtype, 0) + 1
        uemail = e.get("user_email", "unknown")
        by_user[uemail] = by_user.get(uemail, 0) + 1
        sev = e.get("severity", "info")
        by_severity[sev] = by_severity.get(sev, 0) + 1

    return {
        "window_days": days,
        "total_entries": len(entries),
        "by_day": by_day,
        "by_type": by_type,
        "by_user": by_user,
        "by_severity": by_severity,
    }
