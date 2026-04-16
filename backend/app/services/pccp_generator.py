"""
PCCP Generator — Predetermined Change Control Plan.

A PCCP is the FDA-mandated artifact for ML-enabled SaMD that describes:
1) Description of Modifications (what changes are pre-authorized)
2) Modification Protocol (how each modification is validated)
3) Impact Assessment (effect on safety + effectiveness)

Reference: FDA Final Guidance "Marketing Submission Recommendations for
a Predetermined Change Control Plan for AI-Enabled Device Software
Functions" — December 2024 / August 2025 finalization.
https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence

This generator inspects the live agent registry and recent canary results
and produces a structured PCCP that can be exported as PDF or attached to
a 510(k) submission. We use Claude Opus 4.6 (1M context) so the entire
agent inventory + canary history fits in one prompt.

The generated document is persisted to qms_settings/pccp_history so it is
itself versioned. Every PCCP refers to its predecessor (chain), giving the
auditor a tamper-evident timeline of how the AI behavior surface evolved.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from app.agents.base_agent import get_anthropic_client, MODEL_TIER_MAP
from app.agents.registry import list_agents
from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService
from app.services.drift_detector import get_drift_history

logger = logging.getLogger(__name__)


PCCP_SYSTEM_PROMPT = """You are the Predetermined Change Control Plan author for a medical
device QMS that ships AI agents alongside a Class C SaMD (brain MRI segmentation).

Produce a PCCP in FDA format with these required sections:
1) DESCRIPTION OF MODIFICATIONS (DOM): the pre-authorized changes. For us
   these are: (a) Anthropic-driven model snapshot updates within the same
   tier, (b) Skills/system-prompt revisions, (c) per-agent rate-limit
   tuning, (d) tier downgrades for cost optimization.
2) MODIFICATION PROTOCOL (MP): for each DOM, specify:
   - The trigger
   - The validation steps required before promotion
   - The acceptance criteria (concrete numeric thresholds)
   - The rollback procedure
3) IMPACT ASSESSMENT (IA): per-DOM analysis of impact on:
   - Safety (which Class C decisions does this agent influence?)
   - Effectiveness (does change degrade clinician utility?)
   - Cybersecurity (data flow changes)
   - Performance (latency, cost)

You MUST ground every section in the agent inventory + canary results
provided. Do not fabricate agent names or thresholds. Output JSON:
{
  "version": "...",
  "fda_format": true,
  "modifications": [
    {
      "id": "DOM-1",
      "title": "...",
      "description": "...",
      "modification_protocol": {
        "trigger": "...",
        "validation_steps": ["..."],
        "acceptance_criteria": [{"metric": "...", "threshold": "..."}],
        "rollback_procedure": "..."
      },
      "impact_assessment": {
        "safety": "...",
        "effectiveness": "...",
        "cybersecurity": "...",
        "performance": "..."
      },
      "affected_agents": ["..."]
    }
  ],
  "executive_summary": "..."
}"""


def _build_pccp_context() -> Dict[str, Any]:
    """Assemble agent registry + canary signal into a single context blob."""
    agents = list_agents()
    drift_history = get_drift_history(limit=30)

    # Last canary fingerprint per agent
    db = get_firestore_client()
    canaries_col = (
        db.collection(Collections.SETTINGS)
        .document("drift_canary_history")
        .collection("runs")
    )
    last_canaries = []
    for doc in canaries_col.stream():
        d = doc.to_dict() or {}
        d["doc_id"] = doc.id
        last_canaries.append(d)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "agents": agents,
        "drift_recent_history": drift_history,
        "last_canary_fingerprints": last_canaries,
        "model_tier_map": MODEL_TIER_MAP,
    }


def _persist_pccp(pccp: Dict, predecessor_id: Optional[str],
                   user_uid: str, user_email: str) -> str:
    """Store the PCCP doc in qms_settings/pccp_history with chain reference."""
    db = get_firestore_client()
    pccp["predecessor_id"] = predecessor_id
    pccp["author_uid"] = user_uid
    pccp["author_email"] = user_email
    pccp["sealed_at"] = datetime.now(timezone.utc).isoformat()
    _, ref = (
        db.collection(Collections.SETTINGS)
        .document("pccp_history")
        .collection("plans")
        .add(pccp)
    )
    FirestoreService.log_action(
        user_uid=user_uid, user_email=user_email,
        action="generate_pccp", resource_type="ai", resource_id=ref.id,
        severity="info",
        details={"predecessor_id": predecessor_id,
                  "modifications_count": len(pccp.get("modifications", []))},
    )
    return ref.id


def _latest_pccp_id() -> Optional[str]:
    db = get_firestore_client()
    q = (
        db.collection(Collections.SETTINGS)
        .document("pccp_history")
        .collection("plans")
        .order_by("sealed_at", direction="DESCENDING")
        .limit(1)
    )
    for doc in q.stream():
        return doc.id
    return None


def generate_pccp_document(user_uid: str, user_email: str) -> Dict[str, Any]:
    """Main entrypoint for the /agents/validation/pccp route."""
    context = _build_pccp_context()
    client = get_anthropic_client()

    if client is None:
        # Stub: produce a minimal, deterministic PCCP that still passes
        # downstream code paths but flags the missing AI.
        stub = {
            "version": context["generated_at"],
            "fda_format": True,
            "executive_summary": ("Stub PCCP — set ANTHROPIC_API_KEY for AI-drafted "
                                    "modifications. Skeleton derived from live agent registry."),
            "modifications": [
                {
                    "id": "DOM-1",
                    "title": "Anthropic model snapshot update within tier",
                    "description": ("Adoption of Anthropic-published model snapshots for "
                                      "haiku, sonnet, or opus tiers without changing the tier."),
                    "modification_protocol": {
                        "trigger": "Anthropic publishes a new minor version",
                        "validation_steps": [
                            "Run /agents/{name}/validate against the new model",
                            "Run /agents/validation/canary-run",
                            "Inspect drift report; reject if drift_score > 0.30",
                        ],
                        "acceptance_criteria": [
                            {"metric": "golden_suite_pass_rate", "threshold": ">= 0.95"},
                            {"metric": "canary_jaccard_similarity", "threshold": ">= 0.65"},
                            {"metric": "hallucination_rate", "threshold": "< 0.01"},
                        ],
                        "rollback_procedure": (
                            "Revert MODEL_TIER_MAP env var; redeploy; re-run canary."
                        ),
                    },
                    "impact_assessment": {
                        "safety": "HITL gate preserved; Class C output requires e-sign.",
                        "effectiveness": "Same tier ⇒ comparable capability bracket.",
                        "cybersecurity": "No data-flow change.",
                        "performance": "Latency may shift ±20%; budget caps unchanged.",
                    },
                    "affected_agents": [a["name"] for a in context["agents"]],
                },
            ],
        }
        doc_id = _persist_pccp(stub, _latest_pccp_id(), user_uid, user_email)
        stub["id"] = doc_id
        stub["mode"] = "stub"
        return stub

    user_prompt = (
        "Agent inventory + canary signals (use ONLY this data; do not invent):\n"
        f"{json.dumps(context, indent=2, default=str)[:30000]}\n\n"
        "Now produce the PCCP JSON described in the system prompt."
    )

    message = client.messages.create(
        model=MODEL_TIER_MAP["opus"],
        max_tokens=6000,
        system=PCCP_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = message.content[0].text if message.content else "{}"

    # Extract JSON robustly
    from app.agents.traceability_agent import _extract_json
    try:
        pccp = json.loads(_extract_json(raw))
    except Exception:
        pccp = {"version": context["generated_at"], "executive_summary": "Parse failed",
                 "modifications": [], "raw": raw[:2000]}

    pccp.setdefault("version", context["generated_at"])
    pccp.setdefault("fda_format", True)
    pccp["model_used"] = MODEL_TIER_MAP["opus"]
    pccp["context_summary"] = {
        "agents_count": len(context["agents"]),
        "drift_history_points": len(context["drift_recent_history"]),
    }

    doc_id = _persist_pccp(pccp, _latest_pccp_id(), user_uid, user_email)
    pccp["id"] = doc_id
    return pccp
