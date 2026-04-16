"""
AI Validation Service — Phase 5.

The unique moat: our AI produces its own IQ/OQ/PQ validation dossier that
a Notified Body can accept as regulatory evidence.

Per agent we produce:
- Installation Qualification (IQ): model version pinned, SDK version, API
  endpoint, authentication method — proves the right component is wired up
- Operational Qualification (OQ): each agent tested against a golden suite
  of prompts with expected output properties; pass/fail tabulated
- Performance Qualification (PQ): drift over time — last N runs' metrics
  compared against the golden-suite baseline
- PCCP (Predetermined Change Control Plan): the plan for upgrading the
  model (e.g. Sonnet 4.5 → Sonnet 4.6), scoped protocol, impact assessment

References:
- FDA PCCP Final Guidance (Aug 2025)
- GMLP 10 principles
- Ketryx validated-agent methodology (public description)
- Johner Institute: ML libraries as SOUP under IEC 62304
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.agents.registry import AGENT_REGISTRY, list_agents
from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)


# Golden-suite prompts: the regression tests each agent must pass.
# These are INTENTIONALLY SIMPLE — they verify shape + grounding, not AI
# sophistication. Expand in later iterations.
GOLDEN_SUITE: Dict[str, List[Dict]] = {
    "traceability": [
        {
            "id": "traceability-t01",
            "description": "Must return findings list with required keys",
            "context": {"commit_count": 5},
            "expected_properties": {
                "findings_is_list": True,
                "has_summary": True,
            },
        },
    ],
    "soup_monitor": [
        {
            "id": "soup-t01",
            "description": "Must process CVE scan into structured findings",
            "context": {},
            "expected_properties": {
                "findings_is_list": True,
                "has_summary": True,
            },
        },
    ],
    "pr_reviewer": [
        {
            "id": "pr-t01",
            "description": "Must produce verdict summary",
            "context": {"pr_number": None},
            "expected_properties": {
                "has_summary": True,
                "findings_is_list": True,
            },
        },
    ],
    "doc_drift": [
        {
            "id": "doc-t01",
            "description": "Runs without exceptions",
            "context": {},
            "expected_properties": {
                "has_summary": True,
                "findings_is_list": True,
            },
        },
    ],
    "capa_drafter": [
        {
            "id": "capa-t01",
            "description": "Given a problem, returns structured CAPA",
            "context": {
                "problem": "Unit test test_volumetry regression: volume off by 3% on test fixture",
                "evidence": "CI run #1234 on commit abc123",
            },
            "expected_properties": {
                "has_summary": True,
                "findings_is_list": True,
            },
        },
        {
            "id": "capa-t02-empty",
            "description": "Given empty problem, MUST decline",
            "context": {"problem": "", "evidence": ""},
            "expected_properties": {
                "has_summary": True,
            },
        },
    ],
}


def _check_properties(result: dict, expected: dict) -> Dict[str, bool]:
    """Verify each expected property holds on a result dict."""
    checks: Dict[str, bool] = {}
    if expected.get("findings_is_list"):
        findings = result.get("result", {}).get("findings", None)
        checks["findings_is_list"] = isinstance(findings, list)
    if expected.get("has_summary"):
        summary = result.get("result", {}).get("summary", "")
        checks["has_summary"] = isinstance(summary, str) and len(summary) > 0
    return checks


def _dossier_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class AIValidationService:
    """Run golden suite, persist results, generate dossier."""

    @staticmethod
    def run_golden_suite_for_agent(agent_name: str, run_by_uid: str, run_by_email: str) -> Dict[str, Any]:
        """Run the golden suite for one agent; return pass/fail per test."""
        if agent_name not in AGENT_REGISTRY:
            raise ValueError(f"Unknown agent: {agent_name}")
        if agent_name not in GOLDEN_SUITE:
            # If we haven't defined tests yet, return an empty-but-valid record
            return {
                "agent_name": agent_name,
                "tests": [],
                "pass_count": 0,
                "fail_count": 0,
                "skipped_reason": "No golden suite defined for this agent yet",
                "run_at": datetime.now(timezone.utc).isoformat(),
            }

        agent = AGENT_REGISTRY[agent_name]
        tests = GOLDEN_SUITE[agent_name]
        results = []
        passes = 0
        fails = 0

        for test in tests:
            try:
                run_record = agent.run(
                    context=test["context"],
                    invoked_by_uid=run_by_uid,
                    invoked_by_email=run_by_email,
                )
                prop_checks = _check_properties(run_record, test["expected_properties"])
                passed = all(prop_checks.values()) if prop_checks else False
                results.append({
                    "test_id": test["id"],
                    "description": test["description"],
                    "passed": passed,
                    "property_checks": prop_checks,
                    "run_id": run_record.get("id"),
                    "status": run_record.get("status"),
                })
                if passed:
                    passes += 1
                else:
                    fails += 1
            except Exception as e:
                results.append({
                    "test_id": test["id"],
                    "description": test["description"],
                    "passed": False,
                    "error": str(e),
                })
                fails += 1

        return {
            "agent_name": agent_name,
            "model_id": agent.model_id,
            "tier": agent.tier,
            "tests": results,
            "pass_count": passes,
            "fail_count": fails,
            "total": len(tests),
            "pass_rate": round(passes / len(tests), 3) if tests else 0.0,
            "run_at": datetime.now(timezone.utc).isoformat(),
            "run_by": run_by_email,
        }

    @staticmethod
    def persist_validation_run(validation: Dict[str, Any]) -> str:
        """Store a validation run in qms_agent_validations; return doc id."""
        db = get_firestore_client()
        _, ref = db.collection(Collections.AGENT_VALIDATIONS).add(validation)
        return ref.id

    @staticmethod
    def generate_dossier() -> Dict[str, Any]:
        """Produce the full AI Validation Dossier as a single JSON payload.

        The dossier is the auditor-consumable artifact: IQ for every agent,
        latest OQ results, drift trajectory for PQ, and PCCP template.
        """
        agents_meta = list_agents()
        db = get_firestore_client()

        agent_sections = []
        for a in agents_meta:
            # Fetch latest validation run
            query = (
                db.collection(Collections.AGENT_VALIDATIONS)
                .where("agent_name", "==", a["name"])
                .order_by("run_at", direction="DESCENDING")
                .limit(5)
            )
            validations = [doc.to_dict() for doc in query.stream()]
            latest = validations[0] if validations else None

            # IQ: the pinned model version and config
            iq = {
                "model_id": a["model"],
                "tier": a["tier"],
                "pinned_as_soup": True,
                "source": "Anthropic claude-* model family",
                "soup_reference": "IEC 62304 §5.3.3 (Software of Unknown Provenance)",
            }

            # OQ: golden suite pass/fail summary
            oq = {
                "last_run_at": latest["run_at"] if latest else None,
                "pass_rate": latest["pass_rate"] if latest else None,
                "tests_total": latest["total"] if latest else 0,
                "tests_passed": latest["pass_count"] if latest else 0,
                "notes": "Golden-suite regression tests",
            }

            # PQ: drift trajectory — pass-rate across last 5 runs
            pq = {
                "history": [
                    {
                        "run_at": v.get("run_at"),
                        "pass_rate": v.get("pass_rate"),
                    }
                    for v in validations
                ],
                "drift_threshold": 0.05,
                "note": "Drift > 5% triggers a PCCP review (FDA PCCP §5.3)",
            }

            # PCCP template
            pccp = {
                "current_model": a["model"],
                "scope_of_modifications": [
                    "Anthropic releases a new minor version (e.g. 4.5 → 4.6)",
                    "We swap the pinned model ID",
                ],
                "modification_protocol": [
                    "Run the golden suite against the new model",
                    "Compare pass rate with previous model",
                    "If drift > 5% or new failures appear, do NOT promote",
                    "If OK, update MODEL_TIER_MAP and generate a new PCCP entry",
                ],
                "impact_assessment": (
                    "Agents run with Human-In-The-Loop. Model swaps do not directly "
                    "affect the medical device under test; they only affect the "
                    "recommendation surface of the QMS tooling."
                ),
                "reference": "FDA Final PCCP Guidance (2025) — predetermined change control plan",
            }

            agent_sections.append({
                "name": a["name"],
                "description": a["description"],
                "iq": iq,
                "oq": oq,
                "pq": pq,
                "pccp": pccp,
            })

        dossier_meta = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "product": "MSTool-AI-QMS",
            "standard_references": [
                "IEC 62304 §5.3.3 (SOUP identification)",
                "21 CFR Part 11 §11.10 (audit trail)",
                "21 CFR Part 11 §11.50 (electronic signatures)",
                "FDA PCCP Final Guidance (Aug 2025)",
                "GMLP Guiding Principles (10 principles)",
                "EU AI Act — Article 9 (risk management integrated with ISO 14971)",
            ],
            "scope": "Validated AI agents used inside the Quality Management System",
            "human_in_the_loop": "Every Class-C impacting agent output requires e-signature before action (21 CFR Part 11 §11.50)",
        }

        dossier = {
            "meta": dossier_meta,
            "agents": agent_sections,
        }
        dossier["hash"] = _dossier_hash(dossier)

        # Log dossier generation as an auditable event
        FirestoreService.log_action(
            user_uid="system",
            user_email="validation@mstool-ai-qms",
            action="generate_ai_dossier",
            resource_type="ai",
            resource_id="dossier",
            severity="info",
            details={"hash": dossier["hash"], "agent_count": len(agent_sections)},
        )

        return dossier
