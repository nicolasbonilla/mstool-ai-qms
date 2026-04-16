"""
Documentation Drift Agent — Sonnet 4.5.

Trigger: daily or on commits touching /backend.
Goal: Detect when the SRS / SDS / RMF markdown documents have drifted
from the code (new Class C module added but not documented; renamed
function still referenced by old name; missing hazard for new feature).

Output: surgical edit proposals (NOT wholesale rewrites). Proposed edits
are presented diff-style; a human must accept.
"""

from datetime import datetime, timezone
from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.github_service import GitHubService


class DocDriftAgent(BaseAgent):
    name = "doc_drift"
    description = "Finds drift between code and SRS/SDS/RMF; proposes surgical doc edits"
    tier = "sonnet"
    default_requires_signoff = True
    system_prompt = (
        "You are the Documentation Drift Agent. For each backend service module, "
        "compare its docstring / behavior (provided as excerpts) to the SRS and RMF "
        "content. Report drift as structured findings. For each drift, propose a "
        "minimal edit (a few sentences, not a rewrite). Never hallucinate new "
        "requirement IDs — use only IDs present in the source docs.\n\n"
        "Output JSON:\n"
        '{\n'
        '  "summary": "N drifts found",\n'
        '  "findings": [\n'
        '    {"doc":"SRS", "section":"3.2.1", "module":"brain_volumetry_service.py", '
        '"drift":"function renamed from X to Y", "proposed_edit":"...", "severity":"high"}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        gh = GitHubService()

        srs = gh.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md") or ""
        rmf = gh.get_file_content("docs/iec62304/03_Risk_Management_File.md") or ""

        # Pull a small sample of Class C service docstrings
        module_excerpts = []
        for path in ("backend/app/services/ai_segmentation_service.py",
                     "backend/app/services/brain_volumetry_service.py",
                     "backend/app/services/lesion_analysis_service.py",
                     "backend/app/services/ms_region_classifier.py"):
            content = gh.get_file_content(path) or ""
            # Take first 40 lines — cheap module fingerprint
            excerpt = "\n".join(content.split("\n")[:40])
            if excerpt.strip():
                module_excerpts.append({"path": path, "excerpt": excerpt})

        if client is None:
            return AgentResult(
                summary="Doc drift analysis stubbed (no Anthropic key)",
                findings=[],
                confidence=0.2,
                requires_human_signoff=False,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        # Keep context bounded; we rely on RAG later. For MVP send truncated text.
        def trunc(s: str, n: int) -> str:
            return s if len(s) <= n else s[:n] + "\n...[truncated]"

        user_prompt = (
            "SRS (truncated to 6000 chars):\n"
            f"{trunc(srs, 6000)}\n\n"
            "RMF (truncated to 4000 chars):\n"
            f"{trunc(rmf, 4000)}\n\n"
            "Module excerpts:\n"
            + "\n\n".join(f"=== {m['path']} ===\n{trunc(m['excerpt'], 1500)}" for m in module_excerpts)
            + "\n\nProduce the drift JSON."
        )

        message = client.messages.create(
            model=self.model_id,
            max_tokens=3500,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "Parse failed", "findings": []}

        citations = [Citation(source="document", reference="SRS",
                              url=f"https://github.com/{gh.repo}/blob/main/docs/iec62304/02_Software_Requirements_Specification.md"),
                     Citation(source="document", reference="RMF",
                              url=f"https://github.com/{gh.repo}/blob/main/docs/iec62304/03_Risk_Management_File.md")]
        for m in module_excerpts:
            citations.append(Citation(source="code", reference=m["path"].split("/")[-1],
                                       url=f"https://github.com/{gh.repo}/blob/main/{m['path']}"))

        findings = parsed.get("findings", [])
        return AgentResult(
            summary=parsed.get("summary", f"{len(findings)} drifts found"),
            findings=findings,
            citations=citations,
            confidence=0.7,
            requires_human_signoff=len(findings) > 0,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
                "checked_at": datetime.now(timezone.utc).isoformat(),
            },
        )
