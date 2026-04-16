"""
Registry metadata fetcher — pulls manufacturer / license / homepage / EOL
from public package registries.

Why: hardcoded SOUP_ENRICHMENT only covered 16/92 dependencies (17%).
An IEC 62304 §8.1.2 audit requires manufacturer + purpose for EVERY SOUP
item. This module fetches that metadata at runtime from authoritative
sources, with aggressive caching so we don't hammer the registries.

Sources:
- Python deps  → PyPI JSON API: https://pypi.org/pypi/{name}/json
- JS/TS deps   → npm registry:   https://registry.npmjs.org/{name}
- EOL dates    → endoflife.date: https://endoflife.date/api/{product}.json

Each lookup is cached in-memory for 1 hour. The cache survives within
a single Cloud Run instance lifetime; fresh instances re-fetch.

Failure mode: every external call has a short timeout and a graceful
fallback to {"manufacturer": "Open Source", "license": null, ...}.
The SOUP page never blocks on a slow registry.
"""

import logging
import time
from typing import Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# {(source, name): (data, expires_at)}
_meta_cache: Dict[Tuple[str, str], Tuple[Dict, float]] = {}
_CACHE_TTL_S = 3600  # 1 hour

# Conservative timeouts so SOUP page never hangs on a slow registry.
_HTTP_TIMEOUT_S = 4.0


def _cached_or_none(source: str, name: str) -> Optional[Dict]:
    key = (source, name)
    hit = _meta_cache.get(key)
    if hit and hit[1] > time.time():
        return hit[0]
    return None


def _store(source: str, name: str, data: Dict) -> Dict:
    _meta_cache[(source, name)] = (data, time.time() + _CACHE_TTL_S)
    return data


def _empty(name: str, source: str) -> Dict:
    return {
        "name": name,
        "source": source,
        "manufacturer": None,
        "license": None,
        "homepage": None,
        "issue_tracker": None,
        "summary": None,
        "fetched": False,
    }


def _pypi_lookup(name: str) -> Dict:
    """Fetch package info from PyPI JSON API."""
    cached = _cached_or_none("pypi", name)
    if cached is not None:
        return cached
    try:
        url = f"https://pypi.org/pypi/{name}/json"
        with httpx.Client(timeout=_HTTP_TIMEOUT_S) as c:
            resp = c.get(url)
            if resp.status_code != 200:
                return _store("pypi", name, _empty(name, "pypi"))
            j = resp.json()
            info = j.get("info", {}) or {}
            project_urls = info.get("project_urls") or {}
            issue_tracker = (
                project_urls.get("Issues")
                or project_urls.get("Bug Tracker")
                or project_urls.get("Tracker")
                or project_urls.get("Source")
            )
            data = {
                "name": name,
                "source": "pypi",
                "manufacturer": info.get("author")
                                 or (info.get("author_email") or "").split("<")[0].strip()
                                 or "Open Source",
                "license": info.get("license") or info.get("license_expression"),
                "homepage": info.get("home_page") or info.get("project_url"),
                "issue_tracker": issue_tracker,
                "summary": info.get("summary"),
                "fetched": True,
            }
            return _store("pypi", name, data)
    except Exception as e:
        logger.debug(f"PyPI lookup failed for {name}: {e}")
        return _store("pypi", name, _empty(name, "pypi"))


def _npm_lookup(name: str) -> Dict:
    """Fetch package info from npm registry."""
    cached = _cached_or_none("npm", name)
    if cached is not None:
        return cached
    try:
        # Use the lightweight metadata endpoint, no full version history needed
        url = f"https://registry.npmjs.org/{name}"
        with httpx.Client(timeout=_HTTP_TIMEOUT_S) as c:
            resp = c.get(url)
            if resp.status_code != 200:
                return _store("npm", name, _empty(name, "npm"))
            j = resp.json()
            latest = (j.get("dist-tags") or {}).get("latest") or ""
            versions = j.get("versions") or {}
            latest_meta = versions.get(latest, {}) or {}
            author = latest_meta.get("author") or j.get("author") or {}
            if isinstance(author, dict):
                manufacturer = author.get("name") or "Open Source"
            else:
                manufacturer = str(author) or "Open Source"
            bugs = latest_meta.get("bugs") or j.get("bugs") or {}
            if isinstance(bugs, dict):
                issue_tracker = bugs.get("url")
            else:
                issue_tracker = bugs

            data = {
                "name": name,
                "source": "npm",
                "manufacturer": manufacturer,
                "license": latest_meta.get("license") or j.get("license"),
                "homepage": latest_meta.get("homepage") or j.get("homepage"),
                "issue_tracker": issue_tracker,
                "summary": latest_meta.get("description") or j.get("description"),
                "fetched": True,
            }
            return _store("npm", name, data)
    except Exception as e:
        logger.debug(f"npm lookup failed for {name}: {e}")
        return _store("npm", name, _empty(name, "npm"))


def lookup_metadata(name: str, source: str) -> Dict:
    """Public entry: source ∈ {'backend' (=pypi), 'frontend' (=npm)}."""
    if source == "backend":
        return _pypi_lookup(name)
    if source == "frontend":
        return _npm_lookup(name)
    return _empty(name, source)


def lookup_many(deps: List[Dict]) -> List[Dict]:
    """Enrich a list of dependency dicts in-place. Returns same list.

    Bulk-friendly: caching makes repeat calls cheap. We do them sequentially
    rather than in a thread pool because (a) ~92 deps × ~50ms = ~5s worst
    case which fits the SOUP page load timeout, and (b) PyPI rate-limits
    aggressive parallel scrapers.
    """
    for d in deps:
        name = d.get("name")
        source = d.get("source")
        if not name or not source:
            continue
        meta = lookup_metadata(name, source)
        # Only override fields when registry has a non-empty value AND the
        # current value is empty/generic. Hardcoded SOUP_ENRICHMENT wins
        # for the 15 packages we curated by hand (more accurate purpose).
        if meta.get("manufacturer") and (
            not d.get("manufacturer") or d.get("manufacturer") == "Open Source"
        ):
            d["manufacturer"] = meta["manufacturer"]
        if meta.get("license") and not d.get("license"):
            d["license"] = meta["license"]
        if meta.get("homepage") and not d.get("homepage"):
            d["homepage"] = meta["homepage"]
        if meta.get("issue_tracker") and not d.get("anomaly_url"):
            d["anomaly_url"] = meta["issue_tracker"]
        if meta.get("summary") and not d.get("purpose"):
            d["purpose"] = meta["summary"][:140]
        d["registry_source"] = source
        d["registry_fetched"] = meta.get("fetched", False)
    return deps


def cache_stats() -> Dict:
    return {
        "entries": len(_meta_cache),
        "ttl_seconds": _CACHE_TTL_S,
    }
