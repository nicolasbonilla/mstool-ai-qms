"""
Document review & approval service — closes the audit gap on DocSync.

Covers ISO 13485 §4.2.4 (Control of Documents) requirements that the
prior DocSync page only DISPLAYED but never EXECUTED:

- §4.2.4(b): Review documents and update as necessary, AND RE-APPROVE.
- §4.2.4(c): Identify the current revision status of documents.
- §4.2.5  : Records of review/approval retained.

Plus 21 CFR Part 11 §11.50 e-signatures bound to the document state
at the moment of review (so a later modification breaks the signature).

Storage:
- qms_doc_reviews          → one record per (doc_path, review_event)
- qms_doc_completeness     → cached completeness check results

The reviewed-content-hash binds the e-signature to the exact bytes of
the document at the moment of review. If anyone edits the doc later,
the hash diverges and the page surfaces "modified since last review."
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.firebase import get_firestore_client
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

REVIEW_COLLECTION = "qms_doc_reviews"
COMPLETENESS_COLLECTION = "qms_doc_completeness"


def _doc_id_for_path(path: str) -> str:
    """Firestore-safe document key derived from the file path."""
    return path.replace("/", "__").replace(".", "_")[:480]


def _content_hash(content: str) -> str:
    return hashlib.sha256((content or "").encode("utf-8")).hexdigest()


# ─────────────────────────────────────────────────────────────────────────
# Reviews
# ─────────────────────────────────────────────────────────────────────────

def record_review(
    doc_path: str,
    reviewer_uid: str,
    reviewer_email: str,
    reviewer_role: str,
    meaning: str = "approved",
    notes: str = "",
    document_content: Optional[str] = None,
    last_commit_sha: Optional[str] = None,
) -> Dict[str, Any]:
    """Append an immutable review event for a document.

    The review record carries:
    - reviewer identity + role
    - meaning (approved / reviewed / superseded / rejected)
    - timestamp
    - reviewed_content_hash (SHA-256 of the doc content at review time)
    - reviewed_at_commit (git SHA of the doc at review time)
    - signature record from esign_service (Cloud KMS or HMAC fallback)
    """
    from app.services.esign_service import sign_payload

    db = get_firestore_client()
    now = datetime.now(timezone.utc)

    content_hash = _content_hash(document_content or "")
    payload_for_sig = {
        "doc_path": doc_path,
        "reviewer_uid": reviewer_uid,
        "reviewer_role": reviewer_role,
        "meaning": meaning,
        "reviewed_at": now.isoformat(),
        "content_sha256": content_hash,
        "reviewed_at_commit": last_commit_sha,
    }
    signature = sign_payload(
        payload=payload_for_sig,
        signer_uid=reviewer_uid,
        signer_email=reviewer_email,
        signer_role=reviewer_role,
        meaning=meaning,
    )

    record = {
        "doc_path": doc_path,
        "doc_key": _doc_id_for_path(doc_path),
        "reviewed_at": now.isoformat(),
        "reviewer_uid": reviewer_uid,
        "reviewer_email": reviewer_email,
        "reviewer_role": reviewer_role,
        "meaning": meaning,
        "notes": notes,
        "reviewed_content_hash": content_hash,
        "reviewed_at_commit": last_commit_sha,
        "signature": signature,
    }
    _, ref = db.collection(REVIEW_COLLECTION).add(record)
    record["id"] = ref.id

    FirestoreService.log_action(
        user_uid=reviewer_uid,
        user_email=reviewer_email,
        action=f"doc_review_{meaning}",
        resource_type="docsync",
        resource_id=doc_path,
        severity="info",
        details={
            "meaning": meaning,
            "reviewer_role": reviewer_role,
            "content_sha256": content_hash[:16],
            "review_id": ref.id,
        },
    )
    return record


def list_reviews_for(doc_path: str, limit: int = 50) -> List[Dict[str, Any]]:
    db = get_firestore_client()
    q = (
        db.collection(REVIEW_COLLECTION)
        .where("doc_path", "==", doc_path)
        .order_by("reviewed_at", direction="DESCENDING")
        .limit(limit)
    )
    out = []
    for doc in q.stream():
        d = doc.to_dict() or {}
        d["id"] = doc.id
        out.append(d)
    return out


def latest_review_for(doc_path: str) -> Optional[Dict[str, Any]]:
    items = list_reviews_for(doc_path, limit=1)
    return items[0] if items else None


def all_latest_reviews() -> Dict[str, Dict[str, Any]]:
    """{doc_path: latest_review} — one Firestore scan, fast for dashboard load."""
    db = get_firestore_client()
    by_doc: Dict[str, Dict[str, Any]] = {}
    # Scan in descending-time chunks; first-seen wins per doc_path
    q = (
        db.collection(REVIEW_COLLECTION)
        .order_by("reviewed_at", direction="DESCENDING")
        .limit(500)
    )
    for doc in q.stream():
        d = doc.to_dict() or {}
        path = d.get("doc_path")
        if not path or path in by_doc:
            continue
        d["id"] = doc.id
        by_doc[path] = d
    return by_doc


# ─────────────────────────────────────────────────────────────────────────
# Combined status — modified-vs-reviewed distinction (Audit Gap #1.4)
# ─────────────────────────────────────────────────────────────────────────

def derive_review_status(
    doc: Dict[str, Any],
    latest_review: Optional[Dict[str, Any]],
    current_content_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute the AUTHORITATIVE review status for a document.

    Returns a dict with:
      review_status: 'fresh' | 'modified_since_review' | 'never_reviewed' |
                     'overdue_review' | 'unknown'
      reason: human-readable explanation
      last_reviewed_at, last_reviewer_email
      hash_match: bool — does current content match what was reviewed?
    """
    # Never reviewed → "never_reviewed", regardless of when modified
    if not latest_review:
        days_since_modified = doc.get("days_since_modified")
        if days_since_modified is None:
            return {"review_status": "unknown",
                     "reason": "no commit history available",
                     "last_reviewed_at": None,
                     "last_reviewer_email": None,
                     "hash_match": None}
        return {"review_status": "never_reviewed",
                 "reason": "Document has commit history but no review record yet",
                 "last_reviewed_at": None,
                 "last_reviewer_email": None,
                 "hash_match": None}

    last_reviewed_at = latest_review.get("reviewed_at")
    last_reviewer = latest_review.get("reviewer_email")
    reviewed_hash = latest_review.get("reviewed_content_hash")

    # Hash-mismatch → content changed since last review
    if current_content_hash and reviewed_hash and current_content_hash != reviewed_hash:
        return {"review_status": "modified_since_review",
                 "reason": "Document content has changed since the last review — re-review required",
                 "last_reviewed_at": last_reviewed_at,
                 "last_reviewer_email": last_reviewer,
                 "hash_match": False}

    # Time-based check — was the review within the cycle?
    try:
        if last_reviewed_at:
            from datetime import timedelta
            cycle = doc.get("review_cycle_days", 365)
            reviewed_dt = datetime.fromisoformat(
                last_reviewed_at.replace("Z", "+00:00")
            )
            if reviewed_dt + timedelta(days=cycle) < datetime.now(timezone.utc):
                return {"review_status": "overdue_review",
                         "reason": f"Last review was over {cycle} days ago — annual cycle exceeded",
                         "last_reviewed_at": last_reviewed_at,
                         "last_reviewer_email": last_reviewer,
                         "hash_match": True}
    except Exception:
        pass

    return {"review_status": "fresh",
             "reason": "Reviewed within cycle and content unchanged since",
             "last_reviewed_at": last_reviewed_at,
             "last_reviewer_email": last_reviewer,
             "hash_match": True}


# ─────────────────────────────────────────────────────────────────────────
# Completeness check — required sections per IEC 62304 §5.1.7
# ─────────────────────────────────────────────────────────────────────────

# Heuristic per common doc type — keys are SUBSTRINGS that should appear
# in a Markdown heading (case-insensitive). If a heading is missing,
# the doc is incomplete. Add new doc types here as the project grows.
_REQUIRED_SECTIONS_BY_TYPE: Dict[str, List[str]] = {
    "Software_Requirements_Specification": [
        "Introduction", "Functional Requirements", "Safety Requirements",
        "Performance Requirements", "Security Requirements", "Traceability",
    ],
    "Software_Architecture": [
        "Architecture", "Modules", "Interfaces", "Safety Class",
        "Hazard", "Dependencies",
    ],
    "Risk_Management_File": [
        "Hazard", "Risk Control", "Verification", "Residual Risk",
        "Risk-Benefit", "Post-Market",
    ],
    "Software_Development_Plan": [
        "Lifecycle", "Deliverables", "Quality", "Configuration Management",
        "Risk Management",
    ],
    "Verification_Validation_Plan": [
        "Test Strategy", "Acceptance Criteria", "Coverage", "Verification",
        "Validation",
    ],
    "Cybersecurity": [
        "Threat Model", "Security Controls", "Vulnerability Management",
        "Incident Response",
    ],
    "Quality_Manual": [
        "Scope", "Responsibilities", "Process", "Resources", "Measurement",
    ],
}


def check_completeness(doc_path: str, content: str) -> Dict[str, Any]:
    """Find required sections missing from a document; return structured diff.

    Detection: scan markdown headings (#, ##, ###) and check that each
    required substring appears in at least one heading. The list of
    requirements is keyed by doc type (matched against the file name).
    """
    if not content:
        return {"applicable": False,
                 "reason": "no content"}

    # Identify doc type by filename substring
    doc_type = None
    fname = doc_path.split("/")[-1]
    for key in _REQUIRED_SECTIONS_BY_TYPE:
        if key.lower() in fname.lower():
            doc_type = key
            break

    if doc_type is None:
        return {"applicable": False,
                 "reason": f"No completeness rules for this document type ({fname})"}

    required = _REQUIRED_SECTIONS_BY_TYPE[doc_type]
    headings = []
    for line in content.split("\n"):
        s = line.strip()
        if s.startswith("#"):
            headings.append(s.lstrip("# ").strip().lower())
    headings_text = " | ".join(headings)

    missing = [req for req in required if req.lower() not in headings_text]
    return {
        "applicable": True,
        "doc_type": doc_type,
        "required_sections": required,
        "missing": missing,
        "headings_found": headings[:30],
        "completeness_pct": round(
            (len(required) - len(missing)) / len(required) * 100, 1
        ) if required else 100.0,
    }


# ─────────────────────────────────────────────────────────────────────────
# Change history — full commit list per doc
# ─────────────────────────────────────────────────────────────────────────

def change_history_for(doc_path: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Return all commits that touched this document, newest first."""
    from app.services.github_service import GitHubService
    gh = GitHubService()
    try:
        data = gh._get("commits", params={"path": doc_path, "per_page": limit})
        if not data or not isinstance(data, list):
            return []
        return [{
            "sha": c["sha"][:7],
            "full_sha": c["sha"],
            "message": c["commit"]["message"].split("\n")[0],
            "author": c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
            "github_url": f"https://github.com/{gh.repo}/commit/{c['sha']}",
        } for c in data]
    except Exception as e:
        logger.warning(f"change_history_for failed for {doc_path}: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────
# Diff between reviewed version and current
# ─────────────────────────────────────────────────────────────────────────

def diff_against_reviewed(doc_path: str) -> Dict[str, Any]:
    """Compare current content to the version at the last review's commit.

    Returns a unified-diff-shaped summary plus the GitHub compare URL.
    """
    from app.services.github_service import GitHubService
    gh = GitHubService()

    latest = latest_review_for(doc_path)
    if not latest or not latest.get("reviewed_at_commit"):
        return {"available": False,
                 "reason": "No prior review with a commit reference"}

    reviewed_sha = latest["reviewed_at_commit"]
    # Get current file
    current = gh.get_file_content(doc_path) or ""

    # Get content at the reviewed commit
    try:
        raw_url = (
            f"https://raw.githubusercontent.com/{gh.repo}/{reviewed_sha}/{doc_path}"
        )
        import httpx
        with httpx.Client(timeout=8) as c:
            resp = c.get(raw_url)
        reviewed_content = resp.text if resp.status_code == 200 else ""
    except Exception:
        reviewed_content = ""

    if not reviewed_content:
        return {"available": False,
                 "reason": "Reviewed-version content could not be fetched"}

    # Compute line-level diff stats
    import difflib
    a_lines = reviewed_content.splitlines()
    b_lines = current.splitlines()
    diff_text = "\n".join(difflib.unified_diff(
        a_lines, b_lines,
        fromfile=f"reviewed@{reviewed_sha[:7]}",
        tofile="current",
        lineterm="",
    ))
    additions = sum(1 for l in diff_text.split("\n")
                     if l.startswith("+") and not l.startswith("+++"))
    deletions = sum(1 for l in diff_text.split("\n")
                     if l.startswith("-") and not l.startswith("---"))
    return {
        "available": True,
        "reviewed_at_commit": reviewed_sha,
        "reviewed_at": latest["reviewed_at"],
        "additions": additions,
        "deletions": deletions,
        "diff": diff_text[:50000],  # cap to keep payload bounded
        "compare_url": f"https://github.com/{gh.repo}/compare/{reviewed_sha}...HEAD",
    }
