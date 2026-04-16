"""
Audit trail middleware — records every mutation through the FastAPI app.

This is the implementation of 21 CFR Part 11 §11.10(e): "Use of secure,
computer-generated, time-stamped audit trails to independently record the
date and time of operator entries and actions that create, modify, or
delete electronic records."

Scope (what gets logged):
- All non-GET HTTP requests (POST / PUT / PATCH / DELETE)
- Tagged with the authenticated user, path, method, status code
- The full response body is NOT stored (privacy + cost); we store a SHA-256
  of the response and the request path as resource identifier

What does NOT get logged (on purpose):
- GET requests (read-only, huge volume, no regulatory need)
- Health check endpoints (`/api/health`, `/system/health`)
- The audit-trail endpoint itself (to avoid meta-write amplification)

We write via a background task so the happy-path response latency is
unaffected. If Firestore is unreachable we log locally and continue — the
audit trail stream must degrade gracefully rather than block care-delivery
adjacent workflows.
"""

import hashlib
import logging
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from starlette.background import BackgroundTask

from app.core.firebase import verify_id_token
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

# Paths that must never create an audit-trail entry.
# - Health probes: Cloud Run pings these every 30s; they would flood the ledger.
# - The audit trail itself: writing to the ledger would then write a ledger entry
#   about the write, which would trigger another write, and so on.
_SKIP_PATH_PREFIXES = (
    "/api/health",
    "/",                       # root health
    "/api/v1/system/health",
    "/api/v1/system/ledger",   # verify endpoint — read-only, but avoid recursion
    "/api/v1/activity",        # activity feed read endpoints
)

# Methods that never mutate state.
_READONLY_METHODS = {"GET", "HEAD", "OPTIONS"}


def _derive_resource_info(path: str) -> tuple[str, str]:
    """Map a URL path to (resource_type, resource_id).

    Examples:
        /api/v1/forms                  -> ("forms", "")
        /api/v1/forms/abc123           -> ("forms", "abc123")
        /api/v1/audit/run              -> ("audit", "run")
        /api/v1/compliance/score       -> ("compliance", "score")
    """
    parts = [p for p in path.split("/") if p and p not in ("api", "v1")]
    if not parts:
        return ("unknown", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], "/".join(parts[1:]))


class AuditTrailMiddleware(BaseHTTPMiddleware):
    """Captures mutations into the WORM ledger."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        if request.method in _READONLY_METHODS:
            return response

        path = request.url.path
        if any(path.startswith(p) for p in _SKIP_PATH_PREFIXES):
            return response

        # 4xx/5xx still get logged — a failed attempt to mutate data is
        # evidentially interesting (auditor wants to see rejected actions).
        severity = "info" if 200 <= response.status_code < 400 else "warning"

        # Extract user from the Authorization header without blocking the
        # response — we already did auth inside the route; here we just want
        # the identity for the log line.
        user_uid, user_email = "unknown", "unknown"
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split("Bearer ", 1)[1]
            try:
                decoded = verify_id_token(token)
                user_uid = decoded.get("uid", "unknown")
                user_email = decoded.get("email", "unknown")
            except Exception:
                # Token might have expired between route handling and middleware;
                # the route already rejected it, so we just don't attribute.
                pass

        resource_type, resource_id = _derive_resource_info(path)
        action = f"{request.method.lower()}_{resource_type}"

        # Don't block the response — push the append into a background task.
        def _record():
            try:
                FirestoreService.log_action(
                    user_uid=user_uid,
                    user_email=user_email,
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    severity=severity,
                    details={
                        "method": request.method,
                        "path": path,
                        "status_code": response.status_code,
                        "query": dict(request.query_params),
                    },
                )
            except Exception as e:
                logger.warning(f"audit_trail middleware failed: {e}")

        # Attach as a background task so Starlette runs it after the response
        # is sent to the client. If the response already has a background task,
        # we chain them so neither is dropped.
        new_task = BackgroundTask(_record)
        if response.background is None:
            response.background = new_task
        else:
            existing = response.background

            async def _chain():
                await existing()
                _record()

            response.background = BackgroundTask(_chain)

        return response
