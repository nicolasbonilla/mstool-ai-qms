"""
SOUP review record drafter — AI-generates IEC 62304 §8.1.2 SOUP review
markdown for any dependency.

Each draft includes:
- Purpose of inclusion
- Evaluation of risk (safety class, anomalies count, license check)
- Verification approach (how we confirm the SOUP behaves as expected)
- Maintenance plan (update cadence, responsible party)

Drafts go into qms_soup_review_drafts and are surfaced on the Forms page
with the same '✨ AI-drafted' badge as other autonomous outputs. A QMS
Manager signs to convert into a final review record committed to the
medical-device repo at docs/iec62304/records/soup_reviews/.

This is what closes the 1.1% review coverage gap → ~100% draft coverage,
human-signed as time permits.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DRAFT_COLLECTION = "qms_soup_review_drafts"


def _system_prompt() -> str:
    return (
        "You are the SOUP Review Drafter for a Class C medical device QMS. "
        "Given a single dependency's metadata, produce a structured IEC 62304 "
        "§8.1.2 SOUP review record in markdown. Sections required:\n"
        "1) Purpose of Inclusion — why this package is necessary\n"
        "2) Risk Evaluation — based on safety_class + anomalies + license\n"
        "3) Verification Approach — how we confirm correct behavior\n"
        "4) Maintenance Plan — update cadence, responsible role\n"
        "5) Anomaly Tracking — link to issue tracker + monitoring cadence\n\n"
        "Use only the metadata provided — never fabricate vendor names, "
        "version numbers, or hazard IDs. If a field is missing, say so "
        "explicitly so the human reviewer fills it in."
    )


def _stub_review(dep: Dict) -> str:
    """Markdown stub used when ANTHROPIC_API_KEY is not configured."""
    return (
        f"# SOUP Review — {dep.get('name')} v{dep.get('version')}\n\n"
        f"**Stub draft** — set `ANTHROPIC_API_KEY` for AI-generated content.\n\n"
        f"- Source: {dep.get('source')}\n"
        f"- Safety class: {dep.get('safety_class', '?')}\n"
        f"- Pinned: {dep.get('pinned')}\n"
        f"- Manufacturer: {dep.get('manufacturer', 'unknown')}\n"
        f"- License: {dep.get('license', 'unknown')}\n"
        f"- Anomaly tracker: {dep.get('anomaly_url', 'TODO')}\n\n"
        "## TODO sections (humans fill in)\n"
        "- Purpose of Inclusion: …\n"
        "- Risk Evaluation: …\n"
        "- Verification Approach: …\n"
        "- Maintenance Plan: …\n"
    )


def draft_review_for(dep: Dict[str, Any]) -> Dict[str, Any]:
    """Produce an AI-drafted SOUP review markdown for a single dependency."""
    from app.agents.base_agent import get_anthropic_client, MODEL_TIER_MAP
    client = get_anthropic_client()

    if client is None:
        markdown = _stub_review(dep)
        return {
            "dep_name": dep.get("name"),
            "dep_version": dep.get("version"),
            "markdown": markdown,
            "model_used": "stub",
            "drafted_at": datetime.now(timezone.utc).isoformat(),
        }

    user_prompt = (
        "Dependency metadata:\n"
        f"- name: {dep.get('name')}\n"
        f"- version: {dep.get('version')}\n"
        f"- source: {dep.get('source')}\n"
        f"- safety_class: {dep.get('safety_class', '?')}\n"
        f"- pinned: {dep.get('pinned')}\n"
        f"- manufacturer: {dep.get('manufacturer', 'unknown')}\n"
        f"- license: {dep.get('license', 'unknown')}\n"
        f"- purpose: {dep.get('purpose', '')}\n"
        f"- homepage: {dep.get('homepage', '')}\n"
        f"- anomaly_url: {dep.get('anomaly_url', '')}\n\n"
        "Produce the markdown review record."
    )

    try:
        message = client.messages.create(
            model=MODEL_TIER_MAP["haiku"],
            max_tokens=1500,
            system=_system_prompt(),
            messages=[{"role": "user", "content": user_prompt}],
        )
        markdown = message.content[0].text if message.content else _stub_review(dep)
        return {
            "dep_name": dep.get("name"),
            "dep_version": dep.get("version"),
            "markdown": markdown,
            "model_used": MODEL_TIER_MAP["haiku"],
            "drafted_at": datetime.now(timezone.utc).isoformat(),
            "input_tokens": getattr(message.usage, "input_tokens", 0),
            "output_tokens": getattr(message.usage, "output_tokens", 0),
        }
    except Exception as e:
        logger.warning(f"SOUP review draft failed for {dep.get('name')}: {e}")
        return {
            "dep_name": dep.get("name"),
            "dep_version": dep.get("version"),
            "markdown": _stub_review(dep),
            "model_used": "error_fallback",
            "drafted_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
        }


def persist_drafts(drafts: List[Dict[str, Any]],
                    invoked_by: str = "system") -> List[str]:
    """Save drafts to qms_soup_review_drafts; return list of created doc IDs."""
    from app.core.firebase import get_firestore_client
    db = get_firestore_client()
    ids: List[str] = []
    for d in drafts:
        d["status"] = "draft"
        d["source"] = "soup_review_drafter"
        d["invoked_by"] = invoked_by
        _, ref = db.collection(DRAFT_COLLECTION).add(d)
        ids.append(ref.id)
    return ids


def list_drafts(limit: int = 100) -> List[Dict[str, Any]]:
    from app.core.firebase import get_firestore_client
    db = get_firestore_client()
    q = (
        db.collection(DRAFT_COLLECTION)
        .order_by("drafted_at", direction="DESCENDING")
        .limit(limit)
    )
    out = []
    for doc in q.stream():
        d = doc.to_dict() or {}
        d["id"] = doc.id
        out.append(d)
    return out


def draft_for_class_c(deps: List[Dict[str, Any]],
                       invoked_by: str = "system") -> Dict[str, Any]:
    """Bulk: draft a review for every Class C dep that doesn't already have one.

    Idempotent — reads existing drafts first and skips duplicates by name.
    """
    existing_names = {d.get("dep_name") for d in list_drafts(limit=500)}
    targets = [d for d in deps
                if d.get("safety_class") == "C"
                and d.get("name") not in existing_names]

    if not targets:
        return {"drafted": 0, "skipped": "all class C already drafted",
                 "ids": []}

    drafts = [draft_review_for(d) for d in targets]
    ids = persist_drafts(drafts, invoked_by=invoked_by)
    return {"drafted": len(ids), "ids": ids,
             "targets": [t.get("name") for t in targets]}
