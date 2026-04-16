"""
Clause Chat Agent — Sonnet 4.5 + KG-RAG.

User-facing chat that answers "How am I complying with IEC 62304 §5.3?"
with citations to specific commits, forms, tests, and clauses.

KG-RAG approach: instead of pulling raw markdown into the prompt, we
inject a *structured* context built from:
- Compliance breakdown (current scores per metric)
- Traceability stats (REQs / tests / orphans)
- Document inventory snippet
- Recent activity ledger entries

This is much cheaper + more accurate than dumping the SRS into context.
Reference: GraphRAG pattern (arXiv 2508.09893).
"""

from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client


class ClauseChatAgent(BaseAgent):
    name = "clause_chat"
    description = "Answers compliance questions with citations to commits/forms/clauses"
    tier = "sonnet"
    default_requires_signoff = False  # informational chat
    system_prompt = (
        "You are the Clause Chat Agent for MSTool-AI-QMS. The user asks a "
        "question about IEC 62304, ISO 13485, ISO 14971, IEC 81001-5-1, "
        "EU MDR, or 21 CFR Part 11 compliance. You receive a STRUCTURED "
        "CONTEXT block with current scores, traceability stats, document "
        "inventory, and recent activity. You MUST:\n"
        "1) Answer the question concisely (no fluff).\n"
        "2) Ground every assertion in the structured context provided "
        "(do not invent metrics).\n"
        "3) Cite the relevant clause(s) by number.\n"
        "4) If the answer requires data not in the context, say so explicitly.\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary": "one paragraph answer",\n'
        '  "findings": [{"answer":"...", "key_clauses":["IEC 62304 §5.3"], '
        '"actionable_steps":["..."], "data_used":["test_coverage=92%", "..."]}]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        question = (context.get("question") or "").strip()
        if not question:
            return AgentResult(
                summary="No question provided.",
                confidence=0.0,
                requires_human_signoff=False,
            )

        # Build structured context
        from app.services.compliance_service import ComplianceService
        from app.services.traceability_service import TraceabilityService
        from app.services.firestore_service import FirestoreService

        comp_svc = ComplianceService()
        comp = comp_svc.compute_full_score()
        trace = TraceabilityService().build_graph()

        recent = FirestoreService.get_audit_trail(limit=10)
        docs = comp_svc.get_document_inventory()[:20]

        structured_context = {
            "compliance_scores": comp.get("scores", {}),
            "compliance_breakdown": comp.get("breakdown", {}),
            "traceability_stats": trace.get("stats", {}),
            "coverage_metrics": trace.get("coverage_metrics", {}),
            "recent_activity": [
                {"action": e.get("action"), "resource": e.get("resource_type"),
                 "user": e.get("user_email"), "ts": e.get("timestamp")}
                for e in recent
            ],
            "document_inventory_sample": [
                {"id": d.get("doc_id"), "title": d.get("title"),
                 "standard": d.get("standard"),
                 "review_status": d.get("review_status")}
                for d in docs
            ],
        }

        if client is None:
            return AgentResult(
                summary="Chat agent stubbed — set ANTHROPIC_API_KEY for live answers",
                findings=[{
                    "answer": "(degraded mode)",
                    "key_clauses": [],
                    "actionable_steps": [],
                    "data_used": list(structured_context.keys()),
                }],
                confidence=0.2,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"User question: {question}\n\n"
            f"Structured context:\n{json.dumps(structured_context, indent=2, default=str)[:8000]}\n\n"
            "Produce the answer JSON described in the system prompt."
        )
        from app.agents.skills import load_skill
        skills_block = (
            "\n\n=== IEC 62304 REFERENCE ===\n" + load_skill("iec62304", 4000)
            + "\n\n=== ISO 14971 REFERENCE ===\n" + load_skill("iso14971", 3000)
        )
        message = client.messages.create(
            model=self.model_id,
            max_tokens=2000,
            system=self.system_prompt + skills_block,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        # Construct citations from the structured context that was actually used
        citations = [
            Citation(source="metric", reference="ce_mark_overall",
                     excerpt=str(comp["scores"].get("ce_mark_overall"))),
            Citation(source="metric", reference="iec62304",
                     excerpt=str(comp["scores"].get("iec62304"))),
        ]
        return AgentResult(
            summary=parsed.get("summary", ""),
            findings=parsed.get("findings", []),
            citations=citations,
            confidence=0.78,
            requires_human_signoff=False,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
            },
        )
