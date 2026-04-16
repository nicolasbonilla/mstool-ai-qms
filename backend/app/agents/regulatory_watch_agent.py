"""
Regulatory Watch Agent — Haiku 4.5 daily + Sonnet 4.5 weekly summary.

Watches FDA.gov, EUR-Lex, ISO updates, EU MDR / IVDR. When a relevant
update lands, drafts an "impact memo" tailored to MSTool-AI's scope
(Class C SaMD, brain MRI, EU + US markets).

In production this would consume RSS feeds; for the MVP we feed it a
curated list of recent regulatory updates and let Claude reason about
applicability.
"""

from datetime import datetime, timezone
from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client


# Curated list of recent updates the agent should always consider.
# In a future iteration this becomes a Firestore-backed feed updated
# by a separate cron that polls regulatory body RSS feeds.
RECENT_REGULATORY_UPDATES = [
    {
        "date": "2025-08-01",
        "source": "FDA",
        "title": "PCCP Final Guidance for AI/ML-enabled medical devices",
        "url": "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence",
        "summary": "Finalizes the Predetermined Change Control Plan framework for ML-enabled SaMD",
    },
    {
        "date": "2026-09-01",
        "source": "IEC",
        "title": "IEC 62304 Edition 2",
        "url": "https://www.iec.ch/",
        "summary": "Replaces software safety classes A/B/C with software process rigour levels",
    },
    {
        "date": "2026-01-11",
        "source": "Anthropic+Microsoft",
        "title": "Claude in Microsoft Foundry for healthcare",
        "url": "https://www.microsoft.com/en-us/microsoft-cloud/blog/healthcare/2026/01/11/bridging-the-gap-between-ai-and-medicine-claude-in-microsoft-foundry-advances-capabilities-for-healthcare-and-life-sciences-customers/",
        "summary": "HIPAA-ready Claude integration removes procurement friction for regulated customers",
    },
    {
        "date": "2026-08-02",
        "source": "EU",
        "title": "EU AI Act compliance deadline for high-risk AI systems",
        "url": "https://artificialintelligenceact.eu/",
        "summary": "Article 9 requires risk management integrated with ISO 14971 for medical AI",
    },
]


class RegulatoryWatchAgent(BaseAgent):
    name = "regulatory_watch"
    description = "Monitors FDA/EU/ISO updates; drafts impact memos for our SaMD scope"
    tier = "sonnet"
    default_requires_signoff = False  # informational digest
    system_prompt = (
        "You are the Regulatory Watch Agent for MSTool-AI-QMS. The medical "
        "device under management is a Class C SaMD for brain MRI (FreeSurfer "
        "/ SynthSeg segmentation, lesion analysis, MAGNIMS/MS classification). "
        "Markets: EU (CE Mark via MDR 2017/745), US (FDA 510(k) / De Novo).\n\n"
        "Given a list of recent regulatory updates, produce an IMPACT MEMO "
        "telling the team:\n"
        "- Which updates are RELEVANT to our scope (skip irrelevant ones)\n"
        "- For each relevant update: scope of change, our exposure, and a "
        "concrete next step (e.g., 'update SAD §3.2 to reference PCCP')\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary":"N relevant updates",\n'
        '  "findings":[\n'
        '    {"date":"2026-...", "source":"FDA", "title":"...", "relevance":"high|medium|low",'
        '"our_exposure":"...", "next_step":"...", "deadline":"YYYY-MM-DD or null"}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        # Allow context to inject extra updates (e.g., from a future RSS feed)
        updates = list(RECENT_REGULATORY_UPDATES)
        for u in context.get("updates", []) or []:
            updates.append(u)

        if client is None:
            return AgentResult(
                summary=f"Regulatory watch stubbed ({len(updates)} updates seen)",
                findings=[{
                    "date": u["date"],
                    "source": u["source"],
                    "title": u["title"],
                    "relevance": "?",
                    "our_exposure": "(requires AI)",
                    "next_step": "(requires AI)",
                    "deadline": None,
                } for u in updates],
                confidence=0.2,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            "Recent regulatory updates to evaluate:\n"
            f"{json.dumps(updates, indent=2)}\n\n"
            "Produce the impact memo JSON."
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

        citations = [
            Citation(source="regulatory_update", reference=u["source"] + " " + u["title"][:30],
                     url=u["url"])
            for u in updates
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
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
