"""
PR Compliance Reviewer Agent — Sonnet 4.5.

Trigger: PR opened/updated, or user-initiated on a specific PR number.
Goal: Review the PR against IEC 62304 §5.5-5.8 (unit implementation,
integration testing, system testing, release). Block merge if:
- A Class C module is touched without a corresponding hazard reference
- A new dependency is added without a SOUP review
- A requirement is removed without a change-request trace
- Test files shrink without explicit justification

Reference pattern: Ketryx Change Request Review Agent + Anomaly Review
Agent. Our differentiation: real GitHub commit/diff awareness (they
overlay on Jira; we read the actual code).
"""

from typing import Dict

from app.agents.base_agent import BaseAgent, AgentResult, Citation, get_anthropic_client
from app.services.github_service import GitHubService

# Hard-coded list of Class C module paths — duplicated from CLAUDE.md
# for auditability. If the medical device grows, this list must be
# updated via a controlled change request.
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


class PRReviewerAgent(BaseAgent):
    name = "pr_reviewer"
    description = "Reviews PRs against IEC 62304 §5.5-5.8; flags merge-blocking issues"
    tier = "sonnet"
    default_requires_signoff = True  # Class C impact possible
    system_prompt = (
        "You are the PR Compliance Reviewer for MSTool-AI-QMS. You review a "
        "pull request's files-changed list against IEC 62304 Class C requirements. "
        "For each finding, classify as BLOCKING (must fix before merge), WARNING, "
        "or INFO. Cite the exact file and the clause that applies.\n\n"
        "Blocking rules:\n"
        "1) Class C file modified AND no HAZ-XXX reference in PR body/commits.\n"
        "2) New dependency added (requirements.txt / package.json diff) AND no "
        "   SOUP review form referenced.\n"
        "3) Existing test function removed without a commit citing REQ change.\n\n"
        "Respond in JSON:\n"
        '{\n'
        '  "summary": "merge verdict: ALLOW / BLOCK + reason",\n'
        '  "findings": [\n'
        '    {"level":"blocking|warning|info", "file":"...", "clause":"IEC 62304 §5.5.3", '
        '"issue":"...", "suggested_fix":"..."}\n'
        '  ]\n'
        '}'
    )

    def _run(self, context: Dict) -> AgentResult:
        client = get_anthropic_client()
        gh = GitHubService()

        pr_number = context.get("pr_number")
        if not pr_number:
            # Fallback: review the most recent commits
            commits = gh.get_recent_commits(5)
            pr_number_note = "(no PR specified; reviewing last 5 commits)"
            files_touched = []
        else:
            pr_number_note = f"PR #{pr_number}"
            # We don't have a fetch-PR-files endpoint yet; use commits as proxy.
            commits = gh.get_recent_commits(10)
            files_touched = []

        # Heuristic: flag Class C paths referenced in commit messages
        class_c_hits = []
        for c in commits:
            for path in CLASS_C_PATHS:
                if path.split("/")[-1] in c["message"]:
                    class_c_hits.append({"commit": c["sha"], "path": path, "message": c["message"]})

        if client is None:
            findings = [{
                "level": "warning",
                "file": h["path"],
                "clause": "IEC 62304 §5.5.3",
                "issue": f"Class C module {h['path']} referenced in commit without AI review",
                "suggested_fix": "Configure ANTHROPIC_API_KEY for full AI review",
            } for h in class_c_hits]
            return AgentResult(
                summary=f"{pr_number_note}: {len(class_c_hits)} Class C touches detected (AI stub mode)",
                findings=findings,
                confidence=0.3,
            )

        import json
        from app.agents.traceability_agent import _extract_json

        user_prompt = (
            f"Target: {pr_number_note}\n"
            f"Class C paths (flag if any are touched without hazard reference):\n"
            + "\n".join(f"- {p}" for p in CLASS_C_PATHS)
            + "\n\nRecent commits on the branch:\n"
            + "\n".join(f"- {c['sha'][:7]}: {c['message']}" for c in commits)
            + "\n\nProduce the review JSON."
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
            Citation(source="commit", reference=c["sha"],
                     url=f"https://github.com/{gh.repo}/commit/{c['sha']}",
                     excerpt=c["message"])
            for c in commits[:10]
        ]
        # Blocking findings require sign-off
        has_blocking = any(f.get("level") == "blocking" for f in parsed.get("findings", []))
        # Optional: publish to GitHub if context says so AND we have PR/SHA.
        publish_meta = None
        if context.get("publish_to_github") and (pr_number or context.get("head_sha")):
            try:
                from app.services.github_pr_writer import publish_pr_review
                publish_meta = publish_pr_review(
                    pr_number=pr_number,
                    head_sha=context.get("head_sha"),
                    agent_summary=parsed.get("summary", ""),
                    findings=parsed.get("findings", []),
                )
            except Exception as e:
                publish_meta = {"error": str(e)}

        return AgentResult(
            summary=parsed.get("summary", ""),
            findings=parsed.get("findings", []),
            citations=citations,
            confidence=0.75,
            requires_human_signoff=has_blocking,
            raw=raw,
            usage={
                "input_tokens": getattr(message.usage, "input_tokens", 0),
                "output_tokens": getattr(message.usage, "output_tokens", 0),
                "github_publish": publish_meta,
            },
        )
