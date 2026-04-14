"""
AI Intelligence Service — MSTool-AI-QMS.

Uses Claude API to provide intelligent analysis, recommendations, and autonomous actions
for IEC 62304 compliance. This is the core AI brain of the QMS.

Capabilities:
- Audit analysis with actionable recommendations
- Auto-fill regulatory forms from code analysis
- CAPA generation from bug reports
- Code review automation (TPL-03)
- Risk detection in code changes
- Document drift detection
"""

import logging
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from app.core.config import get_settings
from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)
settings = get_settings()

# Lazy-load Anthropic client
_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


SYSTEM_PROMPT = """You are an expert IEC 62304 / ISO 13485 regulatory compliance AI assistant for MSTool-AI,
a Class C medical device software for brain MRI analysis. You work inside the MSTool-AI-QMS platform.

Your role:
- Analyze compliance data and provide specific, actionable recommendations
- Generate content for regulatory forms (TPL-01 to TPL-11) based on real code and data
- Perform root cause analysis and generate CAPAs
- Review code for safety and compliance issues
- Detect risks in code changes

Rules:
- Always reference specific IEC 62304 clauses, ISO 13485 sections, or EU MDR articles
- Be specific — name files, requirement IDs, hazard IDs
- Prioritize patient safety above all else
- When recommending actions, be concrete: "Create TPL-04 for HAZ-003" not "consider reviewing risks"
- Format output as structured JSON when requested
- Use severity levels: CRITICAL, HIGH, MEDIUM, LOW
"""


class AIService:
    """Claude-powered AI for QMS intelligence."""

    def __init__(self):
        self.github = GitHubService()

    def _call_claude(self, user_prompt: str, max_tokens: int = 4096) -> str:
        """Call Claude API with the QMS system prompt."""
        if not settings.ANTHROPIC_API_KEY:
            return json.dumps({"error": "ANTHROPIC_API_KEY not configured"})

        client = _get_client()
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=max_tokens,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text

    # ─── 1. AI Audit Analysis ───

    def analyze_audit(self, audit_result: Dict) -> Dict[str, Any]:
        """Analyze audit results and generate actionable recommendations."""
        prompt = f"""Analyze this IEC 62304 audit result and provide specific, actionable recommendations.

AUDIT DATA:
- Readiness Score: {audit_result.get('readiness_score', 0)}%
- Mode: {audit_result.get('mode', 'full')}
- Summary: {json.dumps(audit_result.get('summary', {}), indent=2)}

GAPS FOUND:
{json.dumps(audit_result.get('gaps', []), indent=2)}

PER-CLAUSE RESULTS:
{json.dumps([{{'clause': q['clause'], 'question': q['question'], 'score': q['score']}} for q in audit_result.get('questions', [])], indent=2)}

Respond with JSON:
{{
  "overall_assessment": "brief 2-sentence assessment",
  "risk_level": "CRITICAL|HIGH|MEDIUM|LOW",
  "recommendations": [
    {{
      "priority": 1,
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "clause": "5.x",
      "title": "short title",
      "description": "detailed description of what to do",
      "action_type": "create_form|update_document|write_test|create_pr|run_audit",
      "action_details": {{"template_id": "TPL-XX", "fields_to_fill": {{}}}},
      "effort_hours": 2,
      "deadline_days": 7
    }}
  ],
  "quick_wins": ["list of things that can be fixed in <1 hour"],
  "blocker_risks": ["things that would BLOCK a CE Mark audit"]
}}"""

        response = self._call_claude(prompt)
        try:
            # Try to extract JSON from response
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"overall_assessment": response, "recommendations": [], "quick_wins": [], "blocker_risks": []}

    # ─── 2. AI Form Auto-Fill ───

    def autofill_form(self, template_id: str, context: Dict = None) -> Dict[str, Any]:
        """Auto-fill a regulatory form by analyzing the actual codebase."""
        # Gather context based on template type
        code_context = self._gather_context_for_template(template_id)

        prompt = f"""Auto-fill the regulatory form {template_id} for MSTool-AI based on the actual codebase analysis.

TEMPLATE: {template_id}
ADDITIONAL CONTEXT: {json.dumps(context or {{}}, indent=2)}

CODEBASE ANALYSIS:
{code_context}

Generate realistic, accurate field values based on the REAL code and documentation you see above.
For dates, use today: {datetime.now(timezone.utc).strftime('%Y-%m-%d')}.

Respond with JSON:
{{
  "fields": {{"field_name": "field_value", ...}},
  "confidence": {{"field_name": 0.95, ...}},
  "sources": {{"field_name": "where this data came from", ...}},
  "notes": "any important notes about the auto-fill"
}}"""

        response = self._call_claude(prompt)
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"fields": {}, "confidence": {}, "sources": {}, "notes": response}

    # ─── 3. AI CAPA Generator ───

    def generate_capa(self, problem_description: str, affected_module: str = "",
                      affected_requirements: str = "") -> Dict[str, Any]:
        """Generate CAPA (Corrective and Preventive Action) from a problem description."""
        # Get module code if specified
        module_code = ""
        if affected_module:
            code = self.github.get_file_content(f"backend/app/services/{affected_module}.py")
            if code:
                module_code = code[:3000]

        prompt = f"""Generate a complete CAPA (Corrective and Preventive Action) analysis for this problem
in the MSTool-AI medical device software (IEC 62304 Class C).

PROBLEM DESCRIPTION:
{problem_description}

AFFECTED MODULE: {affected_module or 'Not specified'}
AFFECTED REQUIREMENTS: {affected_requirements or 'Not specified'}

MODULE CODE (first 3000 chars):
{module_code}

Perform thorough root cause analysis and generate corrective + preventive actions.
Consider patient safety implications for a Class C medical device.

Respond with JSON:
{{
  "root_cause_analysis": {{
    "category": "software_defect|design_flaw|requirements_gap|process_failure|human_error",
    "description": "detailed root cause",
    "contributing_factors": ["factor1", "factor2"],
    "five_whys": ["why1", "why2", "why3", "why4", "why5"]
  }},
  "risk_assessment": {{
    "severity": "Catastrophic|Critical|Serious|Minor|Negligible",
    "probability": "Frequent|Probable|Occasional|Remote|Improbable",
    "risk_level": "Unacceptable|ALARP|Acceptable",
    "patient_safety_impact": "description"
  }},
  "corrective_actions": [
    {{"id": "CA-001", "description": "what to fix", "assignee_role": "developer|qa|qms_manager",
      "deadline_days": 7, "verification_method": "how to verify"}}
  ],
  "preventive_actions": [
    {{"id": "PA-001", "description": "what to prevent", "type": "process|technical|training",
      "implementation": "specific steps"}}
  ],
  "effectiveness_check": {{
    "method": "how to verify CAPA worked",
    "timeline_days": 30,
    "metrics": ["metric1", "metric2"]
  }},
  "forms_to_create": [
    {{"template_id": "TPL-XX", "reason": "why this form is needed"}}
  ]
}}"""

        response = self._call_claude(prompt)
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"root_cause_analysis": {"description": response}, "corrective_actions": [], "preventive_actions": []}

    # ─── 4. AI Code Review ───

    def review_code(self, file_path: str) -> Dict[str, Any]:
        """AI-powered code review for IEC 62304 compliance (auto-fills TPL-03)."""
        content = self.github.get_file_content(file_path)
        if not content:
            return {"error": f"File not found: {file_path}"}

        prompt = f"""Review this code file from MSTool-AI (IEC 62304 Class C medical device) for compliance.
Fill in a TPL-03 Code Review Checklist.

FILE: {file_path}
CODE:
{content[:8000]}

Evaluate each category and respond with JSON:
{{
  "file": "{file_path}",
  "overall_verdict": "PASS|PASS_WITH_COMMENTS|FAIL",
  "coding_standards": "Pass|Fail|N/A",
  "error_handling": "Pass|Fail|N/A",
  "input_validation": "Pass|Fail|N/A",
  "owasp_review": "Pass|Fail|N/A",
  "no_hardcoded_creds": "Pass|Fail|N/A",
  "proper_logging": "Pass|Fail|N/A",
  "requirement_traceability": "Pass|Fail|N/A",
  "risk_control_impl": "Pass|Fail|N/A",
  "no_memory_leaks": "Pass|Fail|N/A",
  "resource_cleanup": "Pass|Fail|N/A",
  "issues": [
    {{"severity": "Critical|Major|Minor", "line": 42, "description": "issue description", "recommendation": "how to fix"}}
  ],
  "requirement_ids_found": ["REQ-FUNC-XXX"],
  "safety_concerns": ["concern1"],
  "summary": "2-sentence summary"
}}"""

        response = self._call_claude(prompt)
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"summary": response, "issues": []}

    # ─── 5. AI Risk Detection ───

    def detect_risks(self, commit_sha: str = None) -> Dict[str, Any]:
        """Analyze recent code changes for new risks."""
        commits = self.github.get_recent_commits(5)
        if not commits:
            return {"risks": [], "summary": "No recent commits found"}

        commit_info = json.dumps(commits[:5], indent=2)

        # Check which Class C modules were recently modified
        class_c_modules = [
            "backend/app/services/ai_segmentation_service.py",
            "backend/app/services/brain_volumetry_service.py",
            "backend/app/services/brain_report_service.py",
            "backend/app/services/lesion_analysis_service.py",
            "backend/app/services/ms_region_classifier.py",
            "backend/app/utils/nifti_utils.py",
            "backend/app/utils/dicom_utils.py",
        ]

        prompt = f"""Analyze recent commits to MSTool-AI (Class C medical device) and identify potential risks.

RECENT COMMITS:
{commit_info}

CLASS C MODULES (highest safety):
{json.dumps(class_c_modules, indent=2)}

Based on the commit messages, identify:
1. Any changes to Class C modules (patient safety risk)
2. Missing risk controls or verifications
3. Changes that should trigger a TPL-09 Change Control Record

Respond with JSON:
{{
  "risks_detected": [
    {{
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "title": "risk title",
      "description": "detailed description",
      "affected_module": "module name",
      "related_hazards": ["HAZ-XXX"],
      "recommended_action": "what to do",
      "forms_needed": ["TPL-XX"]
    }}
  ],
  "class_c_changes_detected": true/false,
  "change_control_needed": true/false,
  "summary": "brief summary"
}}"""

        response = self._call_claude(prompt)
        try:
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            return json.loads(response)
        except json.JSONDecodeError:
            return {"risks_detected": [], "summary": response}

    # ─── 6. AI Compliance Chat ───

    def chat(self, message: str, context: Dict = None) -> str:
        """General compliance chat — ask anything about IEC 62304, ISO 13485, EU MDR."""
        ctx = ""
        if context:
            ctx = f"\nCURRENT CONTEXT:\n{json.dumps(context, indent=2)}"

        prompt = f"""User question about QMS/compliance for MSTool-AI:{ctx}

QUESTION: {message}

Provide a helpful, specific answer. Reference IEC 62304 clauses, ISO 13485 sections,
or EU MDR articles when relevant. If the question relates to an action, suggest which
TPL template to use and which page in the QMS to go to."""

        return self._call_claude(prompt, max_tokens=2048)

    # ─── Private helpers ───

    def _gather_context_for_template(self, template_id: str) -> str:
        """Gather relevant codebase context for form auto-fill."""
        context_parts = []

        if template_id in ("TPL-01", "TPL-09"):
            # Problem report / Change control — recent commits and CI
            commits = self.github.get_recent_commits(5)
            context_parts.append(f"Recent commits:\n{json.dumps(commits, indent=2)}")

        if template_id == "TPL-02":
            # Release checklist — test results, CI, version info
            ci = self.github.get_ci_runs(3)
            tests = self.github.list_directory("backend/tests/unit")
            pkg = self.github.get_file_content("frontend/package.json") or ""
            context_parts.append(f"CI Runs:\n{json.dumps(ci, indent=2)}")
            context_parts.append(f"Test files: {len(tests or [])} files")
            context_parts.append(f"Package.json version info:\n{pkg[:500]}")

        if template_id == "TPL-03":
            # Code review — recent PRs
            prs = self.github.get_pull_requests("closed", 3)
            context_parts.append(f"Recent PRs:\n{json.dumps(prs, indent=2)}")

        if template_id == "TPL-04":
            # Risk verification — risk management file
            rmf = self.github.get_file_content("docs/iec62304/03_Risk_Management_File.md")
            context_parts.append(f"Risk Management File (first 3000 chars):\n{(rmf or '')[:3000]}")

        if template_id == "TPL-06":
            # Test execution — test files and results
            test_files = self.github.list_directory("backend/tests/unit") or []
            context_parts.append(f"Test files: {json.dumps([f['name'] for f in test_files], indent=2)}")
            ci = self.github.get_ci_runs(3)
            context_parts.append(f"CI results:\n{json.dumps(ci, indent=2)}")

        if template_id == "TPL-07":
            # SOUP review — dependencies
            reqs = self.github.get_file_content("backend/requirements.txt") or ""
            context_parts.append(f"Python dependencies:\n{reqs[:2000]}")

        if template_id == "TPL-11":
            # Document approval — list docs
            docs = self.github.list_files_recursive("docs/iec62304", ".md")
            context_parts.append(f"IEC 62304 documents:\n{json.dumps([d['name'] for d in docs], indent=2)}")

        if not context_parts:
            # Default: basic repo info
            info = self.github.get_repo_info()
            context_parts.append(f"Repo info:\n{json.dumps(info, indent=2)}")

        return "\n\n".join(context_parts)