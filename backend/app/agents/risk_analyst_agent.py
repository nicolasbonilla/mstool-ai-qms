"""
Risk Analyst Agent — Sonnet 4.5 + extended thinking.

Trigger: on Class C code changes.
Goal: read the diff, propose new hazards per ISO 14971, draft risk
control measures, flag existing hazards needing re-evaluation.

References:
- ISO 14971:2019 §7 (risk control)
- IEC 62304 §5.3 (architectural design considering hazards)
- Greenlight Guru Risk Intelligence (FDA MAUDE-driven hazard suggestions)
"""

import re
from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.github_service import GitHubService

CLASS_C_PATHS = [
    "backend/app/services/ai_segmentation_service.py",
    "backend/app/services/brain_volumetry_service.py",
    "backend/app/services/brain_report_service.py",
    "backend/app/services/lesion_analysis_service.py",
    "backend/app/services/ms_region_classifier.py",
    "backend/app/utils/nifti_utils.py",
    "backend/app/utils/dicom_utils.py",
    "frontend/src/workers/edgeAI.worker.ts",
]


class RiskAnalystAgent(BaseAgent):
    name = "risk_analyst"
    description = "Proposes new hazards + risk controls per ISO 14971 from code diffs"
    tier = "sonnet"
    default_requires_signoff = True
    system_prompt = (
        "You are the Risk Analyst Agent. Given recent commits affecting Class C "
        "modules, propose new hazards in ISO 14971 §7 format and existing hazards "
        "that may need re-evaluation. NEVER invent hazard IDs that already exist; "
        "use the next-available HAZ-NN.\n\n"
        "For each hazard: hazardous situation, harm, severity (negligible/minor/"
        "serious/critical/catastrophic), probability (low/medium/high), and a "
        "control measure mapped to a software requirement.\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary":"N hazards proposed, M needing re-evaluation",\n'
        '  "findings":[\n'
        '    {"haz_id":"HAZ-NN", "type":"new|reevaluate", "module":"...", '
        '"hazardous_situation":"...", "harm":"...", "severity":"serious", '
        '"probability":"low", "control_measure":"...", "linked_req":"REQ-SAFE-NN"}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        gh = GitHubService()

        # Pull recent commits affecting Class C
        commits = gh.get_recent_commits(20)
        class_c_commits = [
            c for c in commits
            if any(p.split("/")[-1] in c["message"] for p in CLASS_C_PATHS)
        ]

        # Existing HAZ IDs (to avoid duplicates)
        rmf = gh.get_file_content("docs/iec62304/03_Risk_Management_File.md") or ""
        existing_haz = sorted(set(re.findall(r"HAZ-\d+", rmf)))
        max_haz_num = max(
            (int(h.split("-")[1]) for h in existing_haz),
            default=0,
        )

        if not class_c_commits:
            return AgentResult(
                summary="No recent Class C commits — no new hazards proposed.",
                confidence=1.0,
                requires_human_signoff=False,
            )

        if client is None:
            return AgentResult(
                summary=f"Risk analyst stubbed — {len(class_c_commits)} Class C commits would be analyzed",
                findings=[{
                    "haz_id": f"HAZ-{max_haz_num + 1:02d}",
                    "type": "new",
                    "module": "?",
                    "hazardous_situation": "<requires AI>",
                    "harm": "<requires AI>",
                    "severity": "?",
                    "probability": "?",
                    "control_measure": "<requires AI>",
                    "linked_req": "?",
                }],
                confidence=0.2,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"Existing HAZ IDs to avoid: {', '.join(existing_haz)}\n"
            f"Next available ID starts at: HAZ-{max_haz_num + 1:02d}\n\n"
            f"Class C touching commits:\n"
            + "\n".join(f"- {c['sha'][:7]}: {c['message']}" for c in class_c_commits[:10])
            + "\n\nProduce the JSON."
        )

        message = client.messages.create(
            model=self.model_id,
            max_tokens=2500,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        citations = [
            Citation(source="standard", reference="ISO 14971:2019",
                     url="https://www.iso.org/standard/72704.html"),
            Citation(source="document", reference="Risk Management File",
                     url=f"https://github.com/{gh.repo}/blob/main/docs/iec62304/03_Risk_Management_File.md"),
        ]
        for c in class_c_commits[:5]:
            citations.append(Citation(
                source="commit", reference=c["sha"],
                url=f"https://github.com/{gh.repo}/commit/{c['sha']}",
                excerpt=c["message"]))

        return AgentResult(
            summary=parsed.get("summary", ""),
            findings=parsed.get("findings", []),
            citations=citations,
            confidence=0.75,
            requires_human_signoff=True,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
            },
        )
