"""
DocSync API — full ISO 13485 §4.2.4 / §4.2.5 implementation.

Routes:
  POST /docsync/{doc_path}/review         — record an e-signed review event
  GET  /docsync/{doc_path}/reviews        — list all reviews for a doc
  GET  /docsync/{doc_path}/history        — full git commit history of the file
  GET  /docsync/{doc_path}/diff           — diff vs version at last review
  GET  /docsync/{doc_path}/completeness   — required-section gap analysis
  GET  /docsync/{doc_path}/preview        — markdown content for in-app preview
  POST /docsync/{doc_path}/ai-drift        — invoke Doc Drift agent for this doc
  POST /docsync/{doc_path}/ai-update-draft — Claude proposes update text
  GET  /docsync/export                     — CSV export of all docs + state
  GET  /docsync/timeline                   — commits-per-month + expiry forecast

We use a path-as-base64 trick so doc paths with slashes work cleanly in URLs.
"""

import base64
import csv
import io
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import (
    get_current_user, require_editor, require_qms_manager, CurrentUser,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docsync", tags=["DocSync"])


def _decode_path(b64: str) -> str:
    """Decode URL-safe base64 path. Frontend encodes with btoa(unescape(encodeURIComponent(p)))."""
    try:
        # The padding-friendly variant
        padding = 4 - (len(b64) % 4)
        if padding != 4:
            b64 = b64 + ("=" * padding)
        return base64.urlsafe_b64decode(b64).decode("utf-8")
    except Exception:
        # Fall through: maybe it's already a path
        return b64


class ReviewBody(BaseModel):
    role: str
    meaning: str = "approved"  # approved | reviewed | superseded | rejected
    notes: str = ""


@router.post("/{doc_path_b64}/review")
async def record_doc_review(
    doc_path_b64: str,
    body: ReviewBody,
    user: CurrentUser = Depends(require_editor),
):
    """E-sign a review event for a document (21 CFR Part 11 §11.50)."""
    from app.services.doc_review_service import record_review
    from app.services.github_service import GitHubService

    doc_path = _decode_path(doc_path_b64)
    gh = GitHubService()
    content = gh.get_file_content(doc_path) or ""
    if not content:
        raise HTTPException(status_code=404, detail=f"Document not found: {doc_path}")

    last_commit = gh.get_file_last_commit(doc_path) or {}
    record = record_review(
        doc_path=doc_path,
        reviewer_uid=user.uid,
        reviewer_email=user.email,
        reviewer_role=body.role,
        meaning=body.meaning,
        notes=body.notes,
        document_content=content,
        last_commit_sha=last_commit.get("sha"),
    )
    return record


@router.get("/{doc_path_b64}/reviews")
async def list_doc_reviews(
    doc_path_b64: str,
    limit: int = 50,
    user: CurrentUser = Depends(get_current_user),
):
    """All review events for a document, newest first."""
    from app.services.doc_review_service import list_reviews_for
    doc_path = _decode_path(doc_path_b64)
    return {"doc_path": doc_path, "reviews": list_reviews_for(doc_path, limit=limit)}


@router.get("/{doc_path_b64}/history")
async def doc_change_history(
    doc_path_b64: str,
    limit: int = 30,
    user: CurrentUser = Depends(get_current_user),
):
    """Full git commit history for the document."""
    from app.services.doc_review_service import change_history_for
    doc_path = _decode_path(doc_path_b64)
    return {"doc_path": doc_path, "commits": change_history_for(doc_path, limit=limit)}


@router.get("/{doc_path_b64}/diff")
async def doc_diff_vs_reviewed(
    doc_path_b64: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Unified diff between current file and the version at the last review."""
    from app.services.doc_review_service import diff_against_reviewed
    doc_path = _decode_path(doc_path_b64)
    return diff_against_reviewed(doc_path)


@router.get("/{doc_path_b64}/completeness")
async def doc_completeness(
    doc_path_b64: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Identify missing required sections for this document type."""
    from app.services.doc_review_service import check_completeness
    from app.services.github_service import GitHubService
    doc_path = _decode_path(doc_path_b64)
    content = GitHubService().get_file_content(doc_path) or ""
    return check_completeness(doc_path, content)


@router.get("/{doc_path_b64}/preview")
async def doc_preview(
    doc_path_b64: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Return raw markdown content for in-app preview (rendered client-side)."""
    from app.services.github_service import GitHubService
    doc_path = _decode_path(doc_path_b64)
    content = GitHubService().get_file_content(doc_path)
    if content is None:
        raise HTTPException(status_code=404, detail=f"Document not found: {doc_path}")
    return {"doc_path": doc_path, "content": content,
             "size": len(content), "lines": content.count("\n") + 1}


@router.post("/{doc_path_b64}/ai-drift")
async def doc_ai_drift(
    doc_path_b64: str,
    user: CurrentUser = Depends(require_editor),
):
    """Run the Doc Drift agent scoped to this document."""
    from app.agents.registry import get_agent
    doc_path = _decode_path(doc_path_b64)
    agent = get_agent("doc_drift")
    return agent.run(
        context={"doc_path": doc_path},
        invoked_by_uid=user.uid,
        invoked_by_email=user.email,
    )


@router.post("/{doc_path_b64}/ai-update-draft")
async def doc_ai_update_draft(
    doc_path_b64: str,
    user: CurrentUser = Depends(require_editor),
):
    """Claude drafts proposed update text for the document.

    Reads the current content + recent commits in the relevant code paths
    and proposes a markdown patch the human can review/apply.
    """
    from app.agents.base_agent import get_anthropic_client, MODEL_TIER_MAP
    from app.services.github_service import GitHubService

    doc_path = _decode_path(doc_path_b64)
    gh = GitHubService()
    content = gh.get_file_content(doc_path) or ""
    if not content:
        raise HTTPException(status_code=404, detail=f"Document not found: {doc_path}")

    # Recent commits on the parent dir (rough proxy for "what changed")
    parent = "/".join(doc_path.split("/")[:-1])
    sibling_commits = []
    try:
        data = gh._get("commits", params={"path": parent, "per_page": 10})
        if data and isinstance(data, list):
            sibling_commits = [{
                "sha": c["sha"][:7],
                "msg": c["commit"]["message"].split("\n")[0],
                "date": c["commit"]["author"]["date"],
            } for c in data]
    except Exception:
        pass

    client = get_anthropic_client()
    if client is None:
        return {"doc_path": doc_path,
                 "draft": "(set ANTHROPIC_API_KEY for AI drafts)",
                 "model_used": "stub"}

    system = (
        "You are the Document Update Drafter for a Class C medical-device "
        "QMS. Read the document content and recent commits in the related "
        "directory; propose ONE small, surgical markdown change the user can "
        "review. Output: a brief summary line then a fenced ```diff block "
        "showing only the lines to change. Never invent REQ-IDs or HAZ-IDs."
    )
    user_prompt = (
        f"Document path: {doc_path}\n\n"
        f"Recent commits in {parent}:\n"
        + "\n".join(f"- {c['sha']} {c['date']}: {c['msg']}" for c in sibling_commits[:8])
        + f"\n\nCurrent document (first 6000 chars):\n{content[:6000]}\n\n"
        "Propose the surgical change."
    )

    try:
        message = client.messages.create(
            model=MODEL_TIER_MAP["sonnet"],
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = message.content[0].text if message.content else ""
        return {"doc_path": doc_path, "draft": text,
                 "model_used": MODEL_TIER_MAP["sonnet"],
                 "drafted_at": datetime.now(timezone.utc).isoformat(),
                 "input_tokens": getattr(message.usage, "input_tokens", 0),
                 "output_tokens": getattr(message.usage, "output_tokens", 0)}
    except Exception as e:
        return {"doc_path": doc_path, "draft": f"(error: {e})",
                 "model_used": "error_fallback"}


@router.get("/export")
async def export_doc_inventory_csv(
    user: CurrentUser = Depends(get_current_user),
):
    """CSV export of every document + state (review status, owner, last commit)."""
    from app.services.compliance_service import ComplianceService
    from app.services.doc_review_service import (
        all_latest_reviews, derive_review_status,
    )

    docs = ComplianceService().get_document_inventory()
    reviews = all_latest_reviews()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "doc_id", "title", "path", "standard", "owner",
        "last_modified", "days_since_modified",
        "next_review_due", "days_until_review",
        "freshness_status",
        "last_reviewed_at", "last_reviewer", "review_event_status",
        "lines", "github_url",
    ])
    for d in docs:
        latest = reviews.get(d["path"])
        status = derive_review_status(d, latest, None)
        writer.writerow([
            d.get("doc_id"), d.get("title"), d.get("path"),
            d.get("standard_label"), d.get("owner"),
            d.get("last_modified"), d.get("days_since_modified"),
            d.get("next_review_due"), d.get("days_until_review"),
            d.get("review_status"),
            status.get("last_reviewed_at"), status.get("last_reviewer_email"),
            status.get("review_status"),
            d.get("lines"), d.get("github_url"),
        ])

    return Response(
        content=output.getvalue().encode("utf-8"),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=qms-document-inventory.csv",
        },
    )


@router.get("/timeline")
async def doc_timeline(
    user: CurrentUser = Depends(get_current_user),
):
    """Aggregate timeline: commits-per-month + expiry forecast.

    Returns:
      monthly_commits: [{month: 'YYYY-MM', count}]   ← last 12 months
      expiry_forecast: {0_30: N, 31_60: N, 61_90: N, 91_365: N, overdue: N}
    """
    from app.services.compliance_service import ComplianceService
    docs = ComplianceService().get_document_inventory()

    # Monthly commits (group by last_modified month)
    monthly: Dict[str, int] = {}
    now = datetime.now(timezone.utc)
    for i in range(12):
        d = now - timedelta(days=30 * i)
        key = d.strftime("%Y-%m")
        monthly[key] = 0

    for doc in docs:
        ts = doc.get("last_modified")
        if not ts:
            continue
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            key = t.strftime("%Y-%m")
            if key in monthly:
                monthly[key] += 1
        except Exception:
            pass

    # Expiry forecast buckets
    buckets = {"overdue": 0, "0_30": 0, "31_60": 0, "61_90": 0, "91_365": 0}
    for doc in docs:
        d = doc.get("days_until_review")
        if d is None:
            continue
        if d < 0:
            buckets["overdue"] += 1
        elif d <= 30:
            buckets["0_30"] += 1
        elif d <= 60:
            buckets["31_60"] += 1
        elif d <= 90:
            buckets["61_90"] += 1
        else:
            buckets["91_365"] += 1

    monthly_list = sorted([{"month": k, "count": v} for k, v in monthly.items()],
                            key=lambda x: x["month"])
    return {"monthly_commits": monthly_list,
             "expiry_forecast": buckets,
             "total_docs": len(docs)}
