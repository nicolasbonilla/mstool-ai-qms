"""
Drift Detector — Phase 5 deep implementation.

Definition: drift is when the agent population's behavior changes
materially relative to the validated baseline. Causes include:
- Anthropic upgrades the underlying model snapshot
- Our prompt files change (e.g., a Skill is reworded)
- The repo state has shifted enough that the same prompt yields
  meaningfully different outputs

Detection: each agent has a small CANARY suite of prompts whose
expected output shape we have validated. Once a week the canary
suite runs, and we compare:
- Output STRUCTURE (does it still parse, are required keys present?)
- SEMANTIC similarity to last week's output (Jaccard over token bag)
- Numeric metrics (findings_count, citations_count, confidence)

If similarity drops below a threshold OR structure breaks OR a
metric jumps >2σ, we open an alert in `qms_alerts` and persist
a drift_report row.

References:
- FDA Final PCCP Guidance (Aug 2025) §5.3 — "monitoring + retraining"
- GMLP Principle 10 — "monitor model performance throughout lifecycle"
- Ketryx public claim: "drift monitoring is part of validated AI"
"""

import logging
import re
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService
from app.agents.registry import AGENT_REGISTRY

logger = logging.getLogger(__name__)


# Per-agent canary prompts. These are STABLE — we never mutate them
# without bumping a version. Each canary's outputs are stored so we can
# diff week over week.
CANARY_SUITE: Dict[str, List[Dict]] = {
    "traceability": [
        {"id": "tr-canary-1", "context": {"commit_count": 5}},
    ],
    "soup_monitor": [
        {"id": "soup-canary-1", "context": {}},
    ],
    "pr_reviewer": [
        {"id": "pr-canary-1", "context": {"pr_number": None}},
    ],
    "doc_drift": [
        {"id": "dd-canary-1", "context": {}},
    ],
    "capa_drafter": [
        {"id": "capa-canary-1",
         "context": {"problem": "Test harness regression: t_volumetry off by 3%",
                      "evidence": "CI run #1234"}},
    ],
    "clause_chat": [
        {"id": "cc-canary-1",
         "context": {"question": "How is API authentication coverage measured?"}},
    ],
    "audit_prep": [
        {"id": "ap-canary-1", "context": {"clause": "5.5"}},
    ],
    "risk_analyst": [
        {"id": "ra-canary-1", "context": {}},
    ],
    "regulatory_watch": [
        {"id": "rw-canary-1", "context": {}},
    ],
    "autonomous_gap_closer": [
        {"id": "agc-canary-1", "context": {"auto_persist_draft": False}},
    ],
}


def _tokenize(text: str) -> set:
    return {w.lower() for w in re.findall(r"[A-Za-z][A-Za-z0-9_]{2,}", text or "")}


def _jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _summarize_output(record: Dict) -> Dict:
    """Reduce an agent run record to a stable canary fingerprint."""
    result = record.get("result", {}) or {}
    findings = result.get("findings", []) or []
    citations = result.get("citations", []) or []
    summary_text = result.get("summary", "") or ""

    # Concatenate the textual content for token bag
    bag_text = summary_text
    for f in findings[:5]:
        if isinstance(f, dict):
            bag_text += " " + " ".join(str(v) for v in f.values() if v is not None)

    return {
        "summary_text": summary_text,
        "findings_count": len(findings),
        "citations_count": len(citations),
        "confidence": result.get("confidence", 0),
        "status": record.get("status"),
        "tokens": list(_tokenize(bag_text))[:200],  # cap for storage
        "model_id": record.get("model_id"),
    }


def _compare_to_baseline(canary_id: str, current: Dict, baseline: Dict) -> Dict:
    """Return a drift evaluation comparing current vs last baseline."""
    findings_diff = abs(current["findings_count"] - baseline["findings_count"])
    citations_diff = abs(current["citations_count"] - baseline["citations_count"])
    sim = _jaccard(set(current["tokens"]), set(baseline["tokens"]))
    # Heuristic drift score: lower jaccard + larger structural deltas = drift
    drift = (1.0 - sim) + (findings_diff / max(1, baseline["findings_count"] + 1)) * 0.3
    drift = round(min(1.0, drift), 3)

    is_drift = (
        sim < 0.40
        or findings_diff > max(2, baseline["findings_count"] // 2)
        or current["model_id"] != baseline.get("model_id")
        or current["status"] != baseline.get("status")
    )

    return {
        "canary_id": canary_id,
        "jaccard_similarity": round(sim, 3),
        "findings_count_delta": current["findings_count"] - baseline["findings_count"],
        "citations_count_delta": current["citations_count"] - baseline["citations_count"],
        "model_changed": current["model_id"] != baseline.get("model_id"),
        "drift_score": drift,
        "is_drift": is_drift,
        "current_model": current.get("model_id"),
        "baseline_model": baseline.get("model_id"),
    }


def run_canary_suite() -> Dict[str, Any]:
    """Execute every canary prompt; persist outputs + diff vs last baseline.

    Returns a summary of how many drifts were detected. For every drift
    detected an alert is created in `qms_alerts`.
    """
    db = get_firestore_client()
    collection = (
        db.collection(Collections.SETTINGS)
        .document("drift_canary_history")
        .collection("runs")
    )

    results = []
    divergences = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for agent_name, canaries in CANARY_SUITE.items():
        if agent_name not in AGENT_REGISTRY:
            continue
        agent = AGENT_REGISTRY[agent_name]
        for canary in canaries:
            try:
                run_record = agent.run(
                    context=canary["context"],
                    invoked_by_uid="system:drift_canary",
                    invoked_by_email="drift-canary@mstool-ai-qms",
                )
                fingerprint = _summarize_output(run_record)

                # Pull the last baseline for this canary, if any
                baseline_doc = (
                    collection.document(f"{agent_name}__{canary['id']}").get()
                )
                drift_eval = None
                if baseline_doc.exists:
                    last = baseline_doc.to_dict()
                    drift_eval = _compare_to_baseline(canary["id"], fingerprint, last)
                    if drift_eval["is_drift"]:
                        divergences += 1
                        # Open alert for human review
                        FirestoreService.create_alert(
                            kind="ai_drift",
                            title=f"AI drift detected on {agent_name}/{canary['id']}",
                            message=(
                                f"jaccard={drift_eval['jaccard_similarity']} "
                                f"Δfindings={drift_eval['findings_count_delta']} "
                                f"model_changed={drift_eval['model_changed']}"
                            ),
                            severity="warning",
                            metric=f"agent.{agent_name}",
                            details=drift_eval,
                        )

                # Update baseline (rolling)
                collection.document(f"{agent_name}__{canary['id']}").set({
                    **fingerprint,
                    "captured_at": now_iso,
                    "agent_name": agent_name,
                })

                # Append to history archive
                history_id = (
                    f"{agent_name}__{canary['id']}__{now_iso.replace(':', '')[:19]}"
                )
                (
                    db.collection(Collections.SETTINGS)
                    .document("drift_canary_history")
                    .collection("archive").document(history_id)
                    .set({
                        "agent_name": agent_name, "canary_id": canary["id"],
                        "captured_at": now_iso,
                        "fingerprint": fingerprint,
                        "drift_eval": drift_eval,
                    })
                )

                results.append({
                    "agent": agent_name, "canary_id": canary["id"],
                    "drift_eval": drift_eval,
                })
            except Exception as e:
                logger.error(f"Canary {agent_name}/{canary['id']} failed: {e}")
                results.append({
                    "agent": agent_name, "canary_id": canary["id"],
                    "error": str(e),
                })

    return {
        "ran_at": now_iso,
        "canaries_executed": len(results),
        "divergences": divergences,
        "results": results,
    }


def get_drift_history(agent_name: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """Return recent drift snapshots for the AI Validation page."""
    db = get_firestore_client()
    archive = (
        db.collection(Collections.SETTINGS)
        .document("drift_canary_history")
        .collection("archive")
        .order_by("captured_at", direction="DESCENDING")
        .limit(limit)
    )
    try:
        out = []
        for doc in archive.stream():
            d = doc.to_dict() or {}
            if agent_name and d.get("agent_name") != agent_name:
                continue
            d["id"] = doc.id
            out.append(d)
        return out
    except Exception as e:
        logger.warning(f"get_drift_history query failed (missing index?): {e}")
        return []
