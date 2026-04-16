"""
Rate limiting — protects Claude API spend on /agents/*/invoke.

Three layers:
1) PER-USER soft limit — slowapi (in-memory) caps per-IP / per-token requests
   per minute. Configurable per route.
2) GLOBAL hard cap — a Firestore-backed counter resets hourly. If the global
   call count crosses MAX_CLAUDE_CALLS_PER_HOUR we refuse all agent invocations
   for the rest of the hour, regardless of who's calling.
3) PER-USER per-day budget — limits individual users to N agent invocations
   per UTC day to prevent one user from burning the team budget.

Why both: in-memory slowapi protects against bursts from any single client;
the Firestore counters defend the team budget across all Cloud Run instances
(slowapi is per-instance and Cloud Run can scale to N).

Configurable via env vars:
- RATE_LIMIT_AGENT_PER_MIN     (default 10/minute per user)
- MAX_CLAUDE_CALLS_PER_HOUR    (default 100 globally)
- MAX_AGENT_CALLS_PER_USER_DAY (default 80)
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional, Tuple

from fastapi import HTTPException, Request

try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    _SLOWAPI_AVAILABLE = True
except ImportError:
    _SLOWAPI_AVAILABLE = False
    Limiter = None  # type: ignore

    def get_remote_address(request):  # type: ignore
        return request.client.host if request.client else "unknown"

logger = logging.getLogger(__name__)

RATE_LIMIT_AGENT_PER_MIN = os.environ.get("RATE_LIMIT_AGENT_PER_MIN", "10/minute")
MAX_CLAUDE_CALLS_PER_HOUR = int(os.environ.get("MAX_CLAUDE_CALLS_PER_HOUR", "100"))
MAX_AGENT_CALLS_PER_USER_DAY = int(os.environ.get("MAX_AGENT_CALLS_PER_USER_DAY", "80"))


def _user_key(request: Request) -> str:
    """Slowapi key function: prefer user UID from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        # Cheap fingerprint of the token without decoding (decode is expensive
        # in middleware path). For real attribution we use the route-level
        # CurrentUser. This key only needs to be stable per user.
        token = auth.split("Bearer ", 1)[1]
        return f"tok:{token[-24:]}"
    return get_remote_address(request)


if _SLOWAPI_AVAILABLE:
    limiter = Limiter(key_func=_user_key, default_limits=[])
else:
    # No-op stub so route decorators still resolve in dev environments
    # without slowapi installed.
    class _NoopLimiter:
        def limit(self, *_args, **_kwargs):
            def deco(fn):
                return fn
            return deco
    limiter = _NoopLimiter()  # type: ignore


def _hour_bucket() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")


def _day_bucket() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_global_and_user_budget(user_uid: str) -> Tuple[bool, Optional[str]]:
    """Increment counters and return (allowed, reason_if_denied).

    The two counters live in qms_settings/rate_limits/. They use a sentinel
    `_meta` doc to make it possible to inspect current usage from the UI.
    Both writes are best-effort; on Firestore failure we log and ALLOW the
    call (failing-open is correct here — refusing would block legitimate
    users in case of a transient outage and add no real safety, since the
    in-memory slowapi limit still applies).
    """
    try:
        from app.core.firebase import get_firestore_client, Collections
        from google.cloud import firestore as gcf
        db = get_firestore_client()

        hour_ref = (
            db.collection(Collections.SETTINGS).document("rate_limits")
            .collection("global_hourly").document(_hour_bucket())
        )
        user_ref = (
            db.collection(Collections.SETTINGS).document("rate_limits")
            .collection(f"user_daily_{_day_bucket()}").document(user_uid)
        )

        # Read current counters BEFORE incrementing so we can refuse cleanly.
        hour_snap = hour_ref.get()
        user_snap = user_ref.get()
        hour_count = (hour_snap.to_dict() or {}).get("count", 0) if hour_snap.exists else 0
        user_count = (user_snap.to_dict() or {}).get("count", 0) if user_snap.exists else 0

        if hour_count >= MAX_CLAUDE_CALLS_PER_HOUR:
            return False, (
                f"Global hourly cap reached ({hour_count}/{MAX_CLAUDE_CALLS_PER_HOUR}). "
                "Try again next hour."
            )
        if user_count >= MAX_AGENT_CALLS_PER_USER_DAY:
            return False, (
                f"Per-user daily cap reached ({user_count}/"
                f"{MAX_AGENT_CALLS_PER_USER_DAY}). Try again tomorrow."
            )

        # Increment both atomically.
        hour_ref.set({"count": gcf.Increment(1),
                       "last_hit_at": datetime.now(timezone.utc).isoformat()},
                      merge=True)
        user_ref.set({"count": gcf.Increment(1),
                       "last_hit_at": datetime.now(timezone.utc).isoformat()},
                      merge=True)
        return True, None
    except Exception as e:
        logger.warning(f"Rate-limit Firestore check failed (failing open): {e}")
        return True, None


def enforce_agent_budget(user_uid: str) -> None:
    """FastAPI dependency-friendly enforcement; raises 429 if denied."""
    allowed, reason = check_global_and_user_budget(user_uid)
    if not allowed:
        raise HTTPException(status_code=429, detail=reason)


def get_current_usage() -> dict:
    """Snapshot of current rate-limit counters for the /system/usage UI."""
    try:
        from app.core.firebase import get_firestore_client, Collections
        db = get_firestore_client()
        hour_doc = (
            db.collection(Collections.SETTINGS).document("rate_limits")
            .collection("global_hourly").document(_hour_bucket()).get()
        )
        hour_count = (hour_doc.to_dict() or {}).get("count", 0) if hour_doc.exists else 0
        return {
            "hour_bucket": _hour_bucket(),
            "global_hourly_used": hour_count,
            "global_hourly_max": MAX_CLAUDE_CALLS_PER_HOUR,
            "per_user_daily_max": MAX_AGENT_CALLS_PER_USER_DAY,
            "per_user_per_minute": RATE_LIMIT_AGENT_PER_MIN,
        }
    except Exception as e:
        return {"error": str(e)}
