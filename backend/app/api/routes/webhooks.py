"""
GitHub webhook receivers — Phase 5.

Endpoints:
- POST /webhooks/github — receives push/release events. On a tag-push
  event we automatically create a release baseline.

Authentication:
We verify the `X-Hub-Signature-256` header against `GITHUB_WEBHOOK_SECRET`
(set as a Cloud Run env var; must match what's configured in the GitHub
webhook UI). Without a valid signature we reject 401.
"""

import hashlib
import hmac
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from app.services.baseline_service import BaselineService
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _verify_signature(body: bytes, signature_header: Optional[str]) -> bool:
    """Verify GitHub HMAC-SHA256 signature."""
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret or not signature_header:
        return False
    if not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.post("/github")
async def github_webhook(request: Request):
    """Receive GitHub push/release events; auto-create baseline on tag push."""
    body = await request.body()
    sig = request.headers.get("X-Hub-Signature-256")

    if not _verify_signature(body, sig):
        # In dev (no secret configured) we accept but log; in prod the secret
        # must be set so this raises 401.
        if os.environ.get("GITHUB_WEBHOOK_SECRET"):
            raise HTTPException(status_code=401, detail="Invalid signature")
        logger.warning("Webhook accepted without signature (dev mode)")

    event = request.headers.get("X-GitHub-Event", "")
    payload = await request.json()

    response = {"event": event, "actions_taken": []}

    if event == "push":
        ref = payload.get("ref", "")
        if ref.startswith("refs/tags/"):
            tag = ref.replace("refs/tags/", "")
            try:
                snapshot = BaselineService.create_baseline(
                    version_tag=tag,
                    created_by_uid="webhook:github",
                    created_by_email="github-actions@mstool-ai-qms",
                    notes=f"Auto-baseline on git tag {tag}",
                    auto_triggered=True,
                )
                response["actions_taken"].append({
                    "type": "baseline_created",
                    "version_tag": tag,
                    "hash": snapshot.get("hash"),
                })
            except ValueError as e:
                # Tag already has a baseline — idempotent, log and skip
                response["actions_taken"].append({
                    "type": "baseline_skipped",
                    "version_tag": tag,
                    "reason": str(e),
                })

    elif event == "release":
        action = payload.get("action")
        tag = (payload.get("release") or {}).get("tag_name")
        if action == "published" and tag:
            try:
                snapshot = BaselineService.create_baseline(
                    version_tag=tag,
                    created_by_uid="webhook:github",
                    created_by_email="github-actions@mstool-ai-qms",
                    notes=f"Auto-baseline on release {tag}",
                    auto_triggered=True,
                )
                response["actions_taken"].append({
                    "type": "baseline_created_from_release",
                    "version_tag": tag,
                    "hash": snapshot.get("hash"),
                })
            except ValueError as e:
                response["actions_taken"].append({
                    "type": "baseline_skipped",
                    "version_tag": tag,
                    "reason": str(e),
                })

    elif event == "pull_request":
        action = payload.get("action")
        pr = payload.get("pull_request") or {}
        if action in ("opened", "synchronize", "reopened") and pr.get("number"):
            try:
                from app.agents.registry import get_agent
                pr_reviewer = get_agent("pr_reviewer")
                run_record = pr_reviewer.run(
                    context={
                        "pr_number": pr["number"],
                        "head_sha": (pr.get("head") or {}).get("sha"),
                        "publish_to_github": True,
                    },
                    invoked_by_uid="webhook:github",
                    invoked_by_email="github-actions@mstool-ai-qms",
                )
                response["actions_taken"].append({
                    "type": "pr_reviewer_invoked",
                    "pr_number": pr["number"],
                    "agent_run_id": run_record.get("id"),
                    "github_publish": run_record.get("result", {})
                                         .get("usage", {}).get("github_publish"),
                })
            except Exception as e:
                logger.warning(f"PR reviewer auto-invocation failed: {e}")
                response["actions_taken"].append({
                    "type": "pr_reviewer_failed",
                    "pr_number": pr["number"],
                    "reason": str(e),
                })

    # Always log the inbound webhook into the WORM ledger
    FirestoreService.log_action(
        user_uid="webhook:github",
        user_email="github-actions@mstool-ai-qms",
        action=f"github_webhook_{event}",
        resource_type="webhooks",
        resource_id=event,
        severity="info",
        details=response,
    )

    return response
