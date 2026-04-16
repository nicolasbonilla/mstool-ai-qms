"""
Traceability Agent — Haiku 4.5.

Trigger: PR opened/updated, or on-demand user invocation.
Goal: Flag commits whose message / diff lack REQ-ID references, and
propose which existing requirements the commit likely implements.

Not the same as the static TraceabilityService: that builds the graph
from already-tagged code. THIS agent looks at untagged commits and
suggests the trace links that should be added.

Reference: Jama Smart Suggestions (NLP-based trace link suggestion) +
LiSSA ICSE 2025 (RAG-based traceability link recovery).
"""

import re
from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.github_service import GitHubService


class TraceabilityAgent(BaseAgent):
    name = "traceability"
    description = "Flags commits missing REQ-ID references; proposes trace links"
    tier = "haiku"
    default_requires_signoff = False  # advisory only
    system_prompt = (
        "You are the Traceability Agent for MSTool-AI-QMS, a medical device "
        "Quality Management System operating under IEC 62304 §5.1.1 (bidirectional "
        "traceability) and ISO 14971 §7. Your job is to inspect recent commits "
        "and identify which existing requirements (REQ-FUNC-XXX, REQ-SAFE-XXX, "
        "REQ-PERF-XXX, REQ-SEC-XXX) each commit likely implements, even when the "
        "commit message does not cite them.\n\n"
        "You MUST ground every suggestion in an actual requirement from the list "
        "provided. Respond in strict JSON as:\n"
        '{\n'
        '  "summary": "...",\n'
        '  "findings": [\n'
        '    {"commit_sha": "abc123", "message": "...", "suggested_reqs": ["REQ-FUNC-040"], '
        '"rationale": "explains why"}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        gh = GitHubService()

        # Inputs
        commit_count = int(context.get("commit_count", 10))
        commits = gh.get_recent_commits(commit_count)

        # Pull known requirement IDs from SRS (cheap, cached)
        srs = gh.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md") or ""
        req_ids = sorted(set(re.findall(r"REQ-[A-Z]+-\d+", srs)))

        # Find untagged commits — skip commits whose message already cites a REQ-ID
        untagged = []
        for c in commits:
            if not re.search(r"REQ-[A-Z]+-\d+", c["message"]):
                untagged.append(c)

        if not untagged:
            return AgentResult(
                summary=f"All {len(commits)} recent commits already reference a requirement.",
                confidence=1.0,
                requires_human_signoff=False,
            )

        if client is None:
            # Degraded mode: return the untagged commits without AI suggestions
            findings = [{
                "commit_sha": c["sha"],
                "message": c["message"],
                "suggested_reqs": [],
                "rationale": "Anthropic client not configured — manual review required",
            } for c in untagged]
            return AgentResult(
                summary=f"{len(untagged)}/{len(commits)} commits lack REQ-IDs (AI stub mode)",
                findings=findings,
                citations=[Citation(source="commit", reference=c["sha"],
                                    url=f"https://github.com/{gh.repo}/commit/{c['sha']}",
                                    excerpt=c["message"]) for c in untagged[:20]],
                confidence=0.3,
            )

        # Call Claude
        user_prompt = (
            f"Known requirement IDs (choose from these only): {', '.join(req_ids[:100])}\n\n"
            f"Untagged commits to analyze:\n"
            + "\n".join(f"- {c['sha'][:7]}: {c['message']}" for c in untagged[:30])
            + "\n\nProduce the JSON described in the system prompt."
        )

        import json
        message = client.messages.create(
            model=self.model_id,
            max_tokens=2000,
            system=self.system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw = message.content[0].text if message.content else "{}"
        try:
            parsed = json.loads(_extract_json(raw))
        except Exception:
            parsed = {"summary": "AI output could not be parsed as JSON", "findings": []}

        citations = [
            Citation(source="commit", reference=c["sha"],
                     url=f"https://github.com/{gh.repo}/commit/{c['sha']}",
                     excerpt=c["message"])
            for c in untagged[:20]
        ]
        return AgentResult(
            summary=parsed.get("summary", ""),
            findings=parsed.get("findings", []),
            citations=citations,
            confidence=0.75,
            requires_human_signoff=False,  # advisory
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
            },
        )


def _extract_json(text: str) -> str:
    """Extract the first balanced-brace JSON block from a string."""
    start = text.find("{")
    if start == -1:
        return "{}"
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    return text[start:]
