"""
CAPA Drafter Agent — Sonnet 4.5.

Trigger: CI failure, bug report, anomaly detected.
Goal: Draft a 5-whys root-cause analysis + Corrective Action + Preventive
Action per 21 CFR 820.100 / ISO 13485 §8.5.2. Human QA signs.
"""

from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client


class CAPADrafterAgent(BaseAgent):
    name = "capa_drafter"
    description = "Drafts 5-whys + corrective + preventive action per 21 CFR 820.100"
    tier = "sonnet"
    default_requires_signoff = True
    system_prompt = (
        "You are the CAPA Drafter Agent. Given a problem description (bug, "
        "CI failure, anomaly), draft a formal CAPA record with:\n"
        "- 5-whys chain (5 consecutive 'why' questions, each grounded in evidence)\n"
        "- Root Cause (single sentence, from the 5th why)\n"
        "- Corrective Action (fixes THIS incident)\n"
        "- Preventive Action (prevents RECURRENCE of this class of issue)\n"
        "- Effectiveness Check criteria (how to verify the fix works)\n\n"
        "Cite 21 CFR 820.100 and ISO 13485 §8.5.2 implicitly through your structure.\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary": "one-line",\n'
        '  "findings": [{\n'
        '     "five_whys":["why1","why2","why3","why4","why5"],\n'
        '     "root_cause":"...",\n'
        '     "corrective_action":"...",\n'
        '     "preventive_action":"...",\n'
        '     "effectiveness_check":"..."\n'
        '  }]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        problem = context.get("problem", "").strip()
        evidence = context.get("evidence", "").strip()

        if not problem:
            return AgentResult(
                summary="No problem description provided.",
                confidence=0.0,
                requires_human_signoff=False,
            )

        if client is None:
            return AgentResult(
                summary="CAPA draft stubbed — configure ANTHROPIC_API_KEY",
                findings=[{
                    "five_whys": ["<requires AI>"] * 5,
                    "root_cause": "<requires AI>",
                    "corrective_action": "<requires AI>",
                    "preventive_action": "<requires AI>",
                    "effectiveness_check": "<requires AI>",
                }],
                confidence=0.2,
                requires_human_signoff=True,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"Problem:\n{problem}\n\n"
            f"Evidence:\n{evidence if evidence else '(none provided)'}\n\n"
            "Draft the CAPA as JSON described in the system prompt."
        )
        message = client.messages.create(
            model=self.model_id,
            max_tokens=1800,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        return AgentResult(
            summary=parsed.get("summary", "CAPA draft ready"),
            findings=parsed.get("findings", []),
            citations=[
                Citation(source="regulation", reference="21 CFR 820.100",
                         url="https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820/subpart-J/section-820.100"),
                Citation(source="regulation", reference="ISO 13485 §8.5.2",
                         url="https://www.iso.org/standard/59752.html"),
            ],
            confidence=0.72,
            requires_human_signoff=True,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
            },
        )
