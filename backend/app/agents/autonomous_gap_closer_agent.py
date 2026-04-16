"""
Autonomous Gap-Closer Agent — Opus 4.6 supervisor.

OUR UNIQUE MOAT. Ketryx stops at "suggest." We close the loop:

1) Detect a gap (orphan REQ, missing form, expired risk control, doc drift)
2) Choose the right form template
3) Draft the form contents using project context
4) Persist as a DRAFT form
5) Route to a human for e-signature (21 CFR Part 11 §11.50)
6) On signature, mark gap as closed in the WORM ledger

The agent NEVER modifies signed records. It only creates drafts.
This keeps us inside EU AI Act minimal-risk classification — every
action that affects a Class C deliverable requires human sign-off.

Reference: Ketryx 5-step validated loop (we add step 6: persistence
as draft + autonomous routing).
"""

from datetime import datetime, timezone
from typing import Dict, List

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.firestore_service import FirestoreService
from app.core.firebase import get_firestore_client, Collections


# Map gap types to form templates (re-used from PredictiveService.explain_gap)
GAP_TO_TEMPLATE = {
    "orphan_requirements":     "TPL-04",  # Test Protocol
    "orphan_risks":            "TPL-08",  # Risk Verification Record
    "class_c_low_coverage":    "TPL-04",  # Test Protocol
    "low_auth_coverage":       "TPL-11",  # Security Review
    "missing_validation":      "TPL-05",  # SRS update
    "missing_codeowners":      "TPL-03",  # Code Review setup
    "doc_missing":             "TPL-10",  # Document creation
    "doc_drift":               "TPL-10",  # Document update
    "soup_vuln":               "TPL-09",  # SOUP Review record
}


class AutonomousGapCloserAgent(BaseAgent):
    name = "autonomous_gap_closer"
    description = "Closes gaps end-to-end: detect → draft form → route for e-sign"
    tier = "opus"
    default_requires_signoff = True  # the resulting form needs human sign
    system_prompt = (
        "You are the Autonomous Gap-Closer Agent. You receive (1) the current "
        "gap waterfall and (2) a target gap. You produce a DRAFT FORM that "
        "would close that gap when signed. The draft must be:\n"
        "- Specific to the actual project state (use real REQ-IDs, real "
        "module names, real numbers from the gap data)\n"
        "- Compliant with the form template's expected sections\n"
        "- Honest about what evidence is missing — better to say 'TODO: "
        "attach test results' than to fabricate them\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary":"Drafted form X to close gap Y",\n'
        '  "findings":[{\n'
        '     "gap_key":"...", "template_id":"TPL-NN", "form_title":"...",\n'
        '     "form_body_markdown":"...", "estimated_score_lift":"+N pts",\n'
        '     "next_human_action":"who_should_sign + what_to_review"\n'
        '  }]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        target_gap_key = context.get("gap_key")
        auto_persist = bool(context.get("auto_persist_draft", True))

        # Fetch the current waterfall
        from app.services.predictive_service import explain_gap
        waterfall = explain_gap()
        gaps: List[Dict] = waterfall.get("items", [])

        if not gaps:
            return AgentResult(
                summary="No gaps detected — nothing to close.",
                confidence=1.0,
                requires_human_signoff=False,
            )

        # Pick the target — explicit if provided, otherwise the most expensive gap
        if target_gap_key:
            target = next((g for g in gaps if g["key"] == target_gap_key), None)
            if target is None:
                return AgentResult(
                    summary=f"Gap key {target_gap_key} not found in current waterfall.",
                    confidence=0.0,
                    requires_human_signoff=False,
                )
        else:
            target = gaps[0]

        template_id = GAP_TO_TEMPLATE.get(target["key"], target.get("form_id", "TPL-10"))

        if client is None:
            draft_body = (
                f"# {target['description']}\n\n"
                f"**Standard:** {target['standard']}\n"
                f"**Current value:** {target['current_value']}%\n"
                f"**Cost:** -{target['cost_pts']} pts\n\n"
                f"## Proposed action\n{target['fix_action']}\n\n"
                f"## Evidence checklist\n- [ ] (configure ANTHROPIC_API_KEY for AI-drafted body)\n"
            )
            findings = [{
                "gap_key": target["key"],
                "template_id": template_id,
                "form_title": f"Closes: {target['description']}",
                "form_body_markdown": draft_body,
                "estimated_score_lift": f"+{target['cost_pts']} pts",
                "next_human_action": "QMS Manager review + e-sign",
            }]
            persisted = self._maybe_persist(findings, auto_persist, source="stub")
            return AgentResult(
                summary=f"Draft prepared (stub) for {target['key']} → {template_id}",
                findings=findings,
                citations=[Citation(source="standard", reference=target["standard"])],
                confidence=0.4,
                requires_human_signoff=True,
                usage={"persisted_form_ids": persisted},
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"Current gap waterfall (top items):\n{json.dumps(gaps[:5], indent=2)}\n\n"
            f"Target gap to close:\n{json.dumps(target, indent=2)}\n\n"
            f"Template to fill: {template_id}\n\n"
            "Produce the draft form JSON."
        )

        message = client.messages.create(
            model=self.model_id,
            max_tokens=3000,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        findings = parsed.get("findings", [])
        persisted = self._maybe_persist(findings, auto_persist, source="ai")

        return AgentResult(
            summary=parsed.get("summary", f"Drafted form for {target['key']}"),
            findings=findings,
            citations=[
                Citation(source="standard", reference=target["standard"]),
                Citation(source="gap", reference=target["key"], excerpt=target["description"]),
                Citation(source="regulation", reference="21 CFR Part 11 §11.50",
                         url="https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-C/section-11.50"),
            ],
            confidence=0.80,
            requires_human_signoff=True,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
                "persisted_form_ids": persisted,
            },
        )

    @staticmethod
    def _maybe_persist(findings: List[Dict], auto_persist: bool, source: str) -> List[str]:
        """Persist each draft as a qms_forms record so a human can review it.

        We only persist when auto_persist=True (default). Each draft is
        marked status='draft', source='autonomous_gap_closer' so the Forms
        page can clearly distinguish AI-drafted forms from human-drafted.
        """
        if not auto_persist:
            return []
        persisted_ids: List[str] = []
        try:
            db = get_firestore_client()
            now_iso = datetime.now(timezone.utc).isoformat()
            for f in findings:
                doc_payload = {
                    "template_id": f.get("template_id"),
                    "title": f.get("form_title", "Auto-drafted form"),
                    "body_markdown": f.get("form_body_markdown", ""),
                    "status": "draft",
                    "source": "autonomous_gap_closer",
                    "source_meta": {
                        "gap_key": f.get("gap_key"),
                        "estimated_score_lift": f.get("estimated_score_lift"),
                        "next_human_action": f.get("next_human_action"),
                        "drafted_by_model": "claude-opus-4-6",
                        "draft_method": source,
                    },
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
                _, ref = db.collection(Collections.FORMS).add(doc_payload)
                persisted_ids.append(ref.id)
                # Audit-log the draft creation as a non-human-attributable mutation
                FirestoreService.log_action(
                    user_uid="agent:autonomous_gap_closer",
                    user_email="agent@mstool-ai-qms",
                    action="auto_draft_form",
                    resource_type="forms",
                    resource_id=ref.id,
                    severity="info",
                    details={"gap_key": f.get("gap_key"),
                             "template_id": f.get("template_id")},
                )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"AutonomousGapCloser persist failed: {e}"
            )
        return persisted_ids
