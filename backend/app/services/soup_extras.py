"""
SOUP extras — features that don't belong inside SOUPService itself but
build on top of it: scan history persistence, anomaly tracker, EOL data.

References:
- IEC 62304 §7.1.3: SOUP anomaly tracking
- endoflife.date API for product EOL data: https://endoflife.date/docs/api
- GitHub REST API for issues: https://docs.github.com/en/rest/issues/issues
"""

import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

_SCAN_HISTORY_COLLECTION = "qms_soup_scans"
_ANOMALY_CACHE: Dict[str, tuple] = {}
_ANOMALY_TTL_S = 3600
_HTTP_TIMEOUT = 5.0

# Map of common packages → endoflife.date product slug (when applicable).
# Most libraries don't have an EOL doc; we only enrich the ones that do.
_ENDOFLIFE_SLUGS: Dict[str, str] = {
    "python": "python",
    "fastapi": "",  # not tracked
    "react": "react",
    "node": "nodejs",
    "django": "django",
    "ruby": "ruby",
    "postgresql": "postgresql",
    "redis": "redis",
}


# ─────────────────────────────────────────────────────────────────────────
# 1) Scan history persistence
# ─────────────────────────────────────────────────────────────────────────

def persist_scan_result(scan: Dict[str, Any], invoked_by_email: str = "system") -> str:
    """Save a CVE scan result to Firestore so we can show timeline + diff."""
    db = get_firestore_client()
    record = {
        "scanned_at": scan.get("scanned_at") or datetime.now(timezone.utc).isoformat(),
        "total_dependencies": scan.get("total_dependencies", 0),
        "scanned": scan.get("scanned", 0),
        "errors": scan.get("errors", 0),
        "vulnerability_count": len(scan.get("vulnerabilities", [])),
        "summary": scan.get("summary", {}),
        # Store top-20 CVEs only to keep doc size < 1MB Firestore limit
        "vulnerabilities": (scan.get("vulnerabilities") or [])[:20],
        "invoked_by": invoked_by_email,
    }
    _, ref = db.collection(_SCAN_HISTORY_COLLECTION).add(record)
    FirestoreService.log_action(
        user_uid="system" if invoked_by_email == "system" else invoked_by_email,
        user_email=invoked_by_email,
        action="soup_scan_persisted",
        resource_type="soup",
        resource_id=ref.id,
        severity="info",
        details={"vulnerability_count": record["vulnerability_count"]},
    )
    return ref.id


def list_scan_history(limit: int = 30) -> List[Dict[str, Any]]:
    """Return recent scans newest-first."""
    db = get_firestore_client()
    q = (
        db.collection(_SCAN_HISTORY_COLLECTION)
        .order_by("scanned_at", direction="DESCENDING")
        .limit(limit)
    )
    try:
        out = []
        for doc in q.stream():
            d = doc.to_dict() or {}
            d["id"] = doc.id
            out.append(d)
        return out
    except Exception as e:
        logger.warning(f"list_scan_history query failed (missing index?): {e}")
        return []


def latest_scan() -> Optional[Dict[str, Any]]:
    items = list_scan_history(limit=1)
    return items[0] if items else None


# ─────────────────────────────────────────────────────────────────────────
# 2) Anomaly tracker — fetch latest "bug" issues per package
# ─────────────────────────────────────────────────────────────────────────

def _parse_github_repo(url: str) -> Optional[tuple]:
    """Extract (owner, repo) from a GitHub URL."""
    if not url or "github.com" not in url:
        return None
    m = re.search(r"github\.com/([^/]+)/([^/#?]+)", url)
    if not m:
        return None
    owner = m.group(1)
    repo = m.group(2).rstrip(".git")
    return owner, repo


def fetch_anomalies(anomaly_url: str, limit: int = 10) -> Dict[str, Any]:
    """Pull last N bug-labeled issues for a package's GitHub repo.

    Returns {repo, count, items: [{title, url, created_at, state, labels}]}.
    Cached for 1 hour per repo to avoid GitHub rate-limiting.
    """
    parsed = _parse_github_repo(anomaly_url)
    if not parsed:
        return {"items": [], "reason": "non-github tracker — manual review required"}
    owner, repo = parsed
    cache_key = f"{owner}/{repo}"

    # Cache lookup
    cached = _ANOMALY_CACHE.get(cache_key)
    if cached and cached[1] > time.time():
        return cached[0]

    api = (
        f"https://api.github.com/repos/{owner}/{repo}/issues"
        f"?labels=bug&state=open&per_page={limit}&sort=updated"
    )
    headers = {"Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28"}
    # Reuse our backend's GitHub token if present (higher rate limit)
    import os
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        with httpx.Client(timeout=_HTTP_TIMEOUT) as c:
            resp = c.get(api, headers=headers)
        if resp.status_code == 404:
            data = {"repo": cache_key, "items": [],
                     "reason": "repo not found or moved"}
        elif resp.status_code != 200:
            data = {"repo": cache_key, "items": [],
                     "reason": f"github api {resp.status_code}"}
        else:
            issues = resp.json() or []
            # GitHub Issues API returns PRs too — filter them out.
            items = []
            for i in issues:
                if "pull_request" in i:
                    continue
                items.append({
                    "title": i.get("title", "")[:200],
                    "url": i.get("html_url"),
                    "created_at": i.get("created_at"),
                    "updated_at": i.get("updated_at"),
                    "state": i.get("state"),
                    "labels": [l.get("name") for l in (i.get("labels") or [])][:5],
                    "comments": i.get("comments", 0),
                })
            data = {"repo": cache_key, "count": len(items), "items": items[:limit]}
    except Exception as e:
        logger.warning(f"Anomaly fetch failed for {cache_key}: {e}")
        data = {"repo": cache_key, "items": [], "reason": str(e)}

    _ANOMALY_CACHE[cache_key] = (data, time.time() + _ANOMALY_TTL_S)
    return data


# ─────────────────────────────────────────────────────────────────────────
# 3) EOL forecast — using endoflife.date public API
# ─────────────────────────────────────────────────────────────────────────

_EOL_CACHE: Dict[str, tuple] = {}
_EOL_TTL_S = 24 * 3600  # daily refresh is plenty


def fetch_eol_data(package_name: str, version: str) -> Optional[Dict[str, Any]]:
    """Look up support / EOL dates for a known package.

    Returns {cycle, eol_date, support_date, latest, lts} when the package
    appears in endoflife.date, otherwise None (silently skipped on UI).
    """
    slug = _ENDOFLIFE_SLUGS.get(package_name.lower())
    if not slug:
        return None

    # Truncate version to major.minor
    v_norm = ".".join(version.split(".")[:2])
    cache_key = f"{slug}:{v_norm}"
    cached = _EOL_CACHE.get(cache_key)
    if cached and cached[1] > time.time():
        return cached[0]

    try:
        url = f"https://endoflife.date/api/{slug}.json"
        with httpx.Client(timeout=_HTTP_TIMEOUT) as c:
            resp = c.get(url)
        if resp.status_code != 200:
            return None
        cycles = resp.json() or []
        match = next((c for c in cycles if c.get("cycle") == v_norm), None)
        if not match:
            data = None
        else:
            data = {
                "cycle": match.get("cycle"),
                "eol_date": match.get("eol"),
                "support_date": match.get("support"),
                "latest": match.get("latest"),
                "lts": bool(match.get("lts")),
                "released": match.get("releaseDate"),
            }
    except Exception as e:
        logger.debug(f"EOL fetch failed for {package_name}@{version}: {e}")
        data = None

    _EOL_CACHE[cache_key] = (data, time.time() + _EOL_TTL_S)
    return data


# ─────────────────────────────────────────────────────────────────────────
# 4) Cross-reference: find latest SOUP Monitor agent run
# ─────────────────────────────────────────────────────────────────────────

def latest_soup_agent_run() -> Optional[Dict[str, Any]]:
    """Get the most recent SOUP Monitor agent invocation for cross-link."""
    try:
        db = get_firestore_client()
        q = (
            db.collection(Collections.AGENT_RUNS)
            .order_by("started_at", direction="DESCENDING")
            .limit(20)
        )
        for doc in q.stream():
            d = doc.to_dict() or {}
            if d.get("agent_name") != "soup_monitor":
                continue
            d["id"] = doc.id
            return d
    except Exception as e:
        logger.debug(f"latest_soup_agent_run lookup failed: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────
# 5) Unpinned Class C dependencies — IEC 62304 §5.1.7 alert source
# ─────────────────────────────────────────────────────────────────────────

def unpinned_class_c(deps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Subset of deps that are Class C AND not pinned to an exact version.

    These are the highest-risk SOUP items per IEC 62304 §5.1.7 (every
    item must be uniquely identified — exact version pinning is the
    minimum bar).
    """
    return [d for d in deps if d.get("safety_class") == "C" and not d.get("pinned")]
