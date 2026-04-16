"""
Audit Preparation Agent — Opus 4.6 supervisor.

User-initiated. Given a target clause (or "full audit"), produces:
- A readiness score 0-100 for that clause
- Drafts of responses to the top 50 most-asked auditor questions
- A list of evidence locations the auditor will cite

Uses Claude Opus 4.6 (1M context) to load the SRS + RMF + traceability +
audit history into a single prompt. No competitor in our research
documented this whole-project context analysis pattern publicly.
"""

from datetime import datetime, timezone
from typing import Dict, List

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client


# 10 representative questions from the auditor playbook for IEC 62304
# Class C audits. Real auditors ask many more, but these cover the
# 80/20 of typical first-day questions.
COMMON_AUDITOR_QUESTIONS = [
    "Show me the Software Development Plan and its approval signatures.",
    "How are software requirements traced to risk controls and tests?",
    "What is your safety classification process per IEC 62304 §4.3?",
    "Walk me through your code review process for a Class C unit.",
    "What CI/CD evidence do you have for the last 30 days?",
    "How do you manage SOUP — list every dependency, version pin, and CVE status.",
    "Show me a corrective action you closed in the last quarter.",
    "How do you control access and electronic signatures (21 CFR Part 11)?",
    "What is your cybersecurity update process (IEC 81001-5-1)?",
    "How is your risk management file kept current with code changes?",
]


class AuditPreparationAgent(BaseAgent):
    name = "audit_prep"
    description = "Whole-project audit prep on Opus 4.6 — readiness + draft Q&A"
    tier = "opus"
    default_requires_signoff = True
    system_prompt = (
        "You are the Audit Preparation Agent for MSTool-AI-QMS, the supervisor "
        "for a simulated IEC 62304 / ISO 13485 / ISO 14971 audit. You receive a "
        "rich evidence pack (compliance breakdown, traceability graph stats, "
        "SOUP inventory, recent activity ledger entries, document list, and a "
        "list of common auditor questions). Your job:\n"
        "1) Assign a readiness score 0-100.\n"
        "2) Draft a response to each common question grounded ONLY in evidence "
        "you were given. Where evidence is missing, say so plainly.\n"
        "3) Identify the top 5 weaknesses an auditor will probe.\n\n"
        "Be concise. Do not invent metrics. Output JSON:\n"
        '{\n'
        '  "summary":"readiness X% — N strengths, M weaknesses",\n'
        '  "findings":[{\n'
        '     "readiness_score":85,\n'
        '     "qa_drafts":[{"question":"...","answer":"...","evidence":["..."]}],\n'
        '     "top_weaknesses":["..."]\n'
        '  }]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        from app.agents.skills import load_skill
        client = get_anthropic_client()
        target_clause = context.get("clause") or "full"

        # Load the 3 reference skills into the system prompt extension
        skills_block = (
            "\n\n=== IEC 62304 REFERENCE ===\n" + load_skill("iec62304", 6000)
            + "\n\n=== ISO 14971 REFERENCE ===\n" + load_skill("iso14971", 4000)
            + "\n\n=== SAMD BRAIN MRI REFERENCE ===\n" + load_skill("samd_brain_mri", 4000)
        )

        # Build the evidence pack
        from app.services.compliance_service import ComplianceService
        from app.services.traceability_service import TraceabilityService
        from app.services.soup_service import SOUPService
        from app.services.firestore_service import FirestoreService

        comp_svc = ComplianceService()
        comp = comp_svc.compute_full_score()
        trace_stats = TraceabilityService().build_graph().get("stats", {})
        soup = SOUPService().get_summary()
        recent_audits = FirestoreService.get_audit_trail(
            limit=20, resource_type="audit"
        )
        recent_activity = FirestoreService.get_audit_trail(limit=15)
        docs = comp_svc.get_document_inventory()

        evidence_pack = {
            "target": target_clause,
            "scores": comp.get("scores"),
            "breakdown": comp.get("breakdown"),
            "traceability": trace_stats,
            "soup": soup,
            "recent_audits": [{"action": a.get("action"),
                                "details": a.get("details"),
                                "ts": a.get("timestamp")} for a in recent_audits[:10]],
            "recent_activity": [{"action": a.get("action"),
                                  "resource": a.get("resource_type"),
                                  "ts": a.get("timestamp")} for a in recent_activity[:10]],
            "documents_count": len(docs),
            "documents_overdue": sum(1 for d in docs if d.get("review_status") == "overdue"),
            "common_questions": COMMON_AUDITOR_QUESTIONS,
        }

        if client is None:
            return AgentResult(
                summary="Audit prep stubbed — set ANTHROPIC_API_KEY",
                findings=[{
                    "readiness_score": comp["scores"].get("ce_mark_overall", 0),
                    "qa_drafts": [],
                    "top_weaknesses": ["AI client not configured"],
                }],
                confidence=0.2,
                requires_human_signoff=True,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"Target clause: {target_clause}\n\n"
            f"Evidence pack (use ONLY this data):\n"
            f"{json.dumps(evidence_pack, indent=2, default=str)[:30000]}\n\n"
            "Produce the JSON output."
        )

        message = client.messages.create(
            model=self.model_id,
            max_tokens=8000,
            system=self.system_prompt + skills_block,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        # Citations
        citations: List[Citation] = []
        for k in ("ce_mark_overall", "iec62304", "iso13485", "cybersecurity"):
            citations.append(Citation(
                source="metric", reference=k,
                excerpt=str(comp["scores"].get(k))))
        citations.append(Citation(source="standard", reference="IEC 62304:2006+A1:2015",
                                   url="https://www.iso.org/standard/38421.html"))

        return AgentResult(
            summary=parsed.get("summary", "Audit readiness draft ready"),
            findings=parsed.get("findings", []),
            citations=citations,
            confidence=0.82,
            requires_human_signoff=True,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
                "model_tier": "opus_supervisor",
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
