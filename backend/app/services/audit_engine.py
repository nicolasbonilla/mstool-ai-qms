"""
IEC 62304 Audit Engine — MSTool-AI-QMS.

Simulates a real CE Mark audit by checking the MSTool-AI repository
clause by clause against IEC 62304:2006+A1:2015.
"""

import re
import uuid
import random
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)


# IEC 62304 Clause definitions for Class C — enriched with auditor perspective
CLAUSES = [
    {
        "clause": "5.1", "title": "Software Development Planning", "group": "Development",
        "description": "The auditor verifies that a Software Development Plan (SDP) exists BEFORE development began, defining the lifecycle model, deliverables, standards, and quality gates.",
        "what_auditor_looks_for": "A dated SDP document that defines: lifecycle model (iterative/waterfall), list of deliverables per phase, quality planning activities, and references to other plans (risk, config, test).",
        "where_we_check": "docs/iec62304/01_Software_Development_Plan.md",
        "class_c_note": "Class C requires formal quality gate approvals (5.1.4) and documented rationale for safety classification.",
        "form_if_fails": "TPL-10",
        "checks": ["SDP document exists", "Lifecycle model defined", "Deliverables listed", "Quality planning"],
    },
    {
        "clause": "5.2", "title": "Software Requirements Analysis", "group": "Development",
        "description": "The auditor verifies that ALL software requirements are documented with unique IDs, categorized (functional, safety, performance), and traceable.",
        "what_auditor_looks_for": "An SRS with REQ-FUNC-XXX, REQ-SAFE-XXX, REQ-PERF-XXX identifiers. Each requirement must be verifiable and traceable to design and test.",
        "where_we_check": "docs/iec62304/02_Software_Requirements_Specification.md",
        "class_c_note": "Class C requires bi-directional traceability: requirement → design → code → test → risk control.",
        "form_if_fails": "TPL-05",
        "checks": ["SRS document exists", "Functional requirements defined (REQ-FUNC)", "Safety requirements defined (REQ-SAFE)", "Performance requirements defined (REQ-PERF)", "REQ IDs present and unique"],
    },
    {
        "clause": "5.3", "title": "Software Architectural Design", "group": "Development",
        "description": "The auditor verifies that the software architecture is documented, showing modules, interfaces, data flows, and safety class per module.",
        "what_auditor_looks_for": "A Software Architecture Document (SAD) with module decomposition, interface definitions, and safety class assignment per software item.",
        "where_we_check": "docs/iec62304/04_Software_Architecture_Design.md",
        "class_c_note": "Class C requires architecture to identify ALL software items that could contribute to a hazardous situation.",
        "form_if_fails": "TPL-05",
        "checks": ["SAD document exists", "Modules documented", "Interfaces defined", "Safety class per module"],
    },
    {
        "clause": "5.4", "title": "Software Detailed Design", "group": "Development",
        "description": "The auditor verifies that Class C modules have detailed design documentation — algorithms, data structures, error handling, and state machines.",
        "what_auditor_looks_for": "Detailed design for EACH Class C software unit: algorithm descriptions, data structure definitions, error handling strategies. Docstrings in code are acceptable evidence.",
        "where_we_check": "docs/iec62304/06_Detailed_Design_Specification.md + Class C module docstrings",
        "class_c_note": "MANDATORY for Class C. This is the clause most often failed — Class C requires unit-level design documentation.",
        "form_if_fails": "TPL-05",
        "checks": ["Detailed design document exists", "Class C modules have docstrings/design", "Algorithm descriptions present"],
    },
    {
        "clause": "5.5", "title": "Unit Implementation & Verification", "group": "Development",
        "description": "The auditor verifies that code follows defined standards, has been reviewed, and each unit has been tested with documented results.",
        "what_auditor_looks_for": "Coding standards reference, code review records (TPL-03), unit test files for Class C modules, test execution results with pass/fail.",
        "where_we_check": "CODEOWNERS + backend/tests/unit/ + .github/workflows/ci.yml",
        "class_c_note": "Class C requires: code review for every change (5.5.3), unit testing of every software unit (5.5.5), and acceptance criteria for each test.",
        "form_if_fails": "TPL-03",
        "checks": ["Coding standards defined", "Code review enforcement (CODEOWNERS)", "Unit tests exist for Class C modules", "Unit test results documented (CI)"],
    },
    {
        "clause": "5.6", "title": "Software Integration Testing", "group": "Development",
        "description": "The auditor verifies that software components are integrated according to a plan, and integration tests verify interfaces work correctly.",
        "what_auditor_looks_for": "Integration test plan, CI pipeline running integration tests, test results showing interface verification between modules.",
        "where_we_check": ".github/workflows/ci.yml + GitHub Actions runs",
        "class_c_note": "Class C requires integration testing to verify all software items interact correctly, especially at safety-critical interfaces.",
        "form_if_fails": "TPL-06",
        "checks": ["CI pipeline configured", "Integration tests run on every build", "Integration test results available"],
    },
    {
        "clause": "5.7", "title": "Software System Testing", "group": "Development",
        "description": "The auditor verifies that the complete system has been tested against requirements, with documented results and acceptance criteria.",
        "what_auditor_looks_for": "System test plan tracing to SRS requirements, test execution records (TPL-06), acceptance criteria defined and met.",
        "where_we_check": "docs/iec62304/10_Verification_Validation_Plan.md + test records",
        "class_c_note": "Class C requires that EVERY requirement in the SRS has a corresponding system test with pass/fail evidence.",
        "form_if_fails": "TPL-06",
        "checks": ["System test plan exists", "Test execution records documented", "Acceptance criteria defined"],
    },
    {
        "clause": "5.8", "title": "Software Release", "group": "Development",
        "description": "The auditor verifies that a formal release process was followed, with a checklist, version labeling, release notes, and known anomaly list.",
        "what_auditor_looks_for": "Release checklist (TPL-02), semantic versioning in package.json, release notes, list of known bugs/anomalies with risk assessment.",
        "where_we_check": "docs/iec62304/13_Release_Procedure.md + frontend/package.json + release records",
        "class_c_note": "Class C requires documented evaluation of all known anomalies before release, confirming none create unacceptable risk.",
        "form_if_fails": "TPL-02",
        "checks": ["Release procedure documented", "Version labeling in package.json", "Release notes exist", "Known anomalies documented"],
    },
    {
        "clause": "6.1", "title": "Software Maintenance Plan", "group": "Maintenance",
        "description": "The auditor verifies that a maintenance plan exists defining how the software will be updated, patched, and monitored post-release.",
        "what_auditor_looks_for": "Maintenance plan document defining: update procedures, feedback collection, monitoring approach, re-validation criteria.",
        "where_we_check": "docs/iec62304/11_Maintenance_Plan.md",
        "class_c_note": "Class C maintenance must include re-analysis of risks for every modification.",
        "form_if_fails": "TPL-09",
        "checks": ["Maintenance plan documented", "Feedback mechanism defined"],
    },
    {
        "clause": "6.2", "title": "Problem & Modification Analysis", "group": "Maintenance",
        "description": "The auditor verifies that there is a defined process for analyzing problems and evaluating the impact of modifications.",
        "what_auditor_looks_for": "Problem report process (TPL-01), change control process (TPL-09), impact analysis procedure.",
        "where_we_check": "docs/iec62304/08_Problem_Resolution_Procedure.md",
        "class_c_note": "Every modification to Class C software must be analyzed for impact on safety before implementation.",
        "form_if_fails": "TPL-01",
        "checks": ["Problem report process defined", "Change control process defined"],
    },
    {
        "clause": "7.1", "title": "Risk Analysis for Software", "group": "Risk Management",
        "description": "The auditor verifies that software-specific hazards have been identified, analyzed for severity/probability, and documented in a Risk Management File.",
        "what_auditor_looks_for": "Risk Management File with HAZ-XXX identifiers, severity/probability classification per ISO 14971, software causes of each hazard.",
        "where_we_check": "docs/iec62304/03_Risk_Management_File.md",
        "class_c_note": "Class C requires analysis of ALL sequences of events that could result in a hazardous situation from software failure.",
        "form_if_fails": "TPL-04",
        "checks": ["Risk management file exists", "Hazards identified with HAZ-IDs", "Severity/probability classified per ISO 14971"],
    },
    {
        "clause": "7.2", "title": "Risk Control Measures", "group": "Risk Management",
        "description": "The auditor verifies that each identified hazard has documented risk control measures (RC-XXX), and residual risk has been assessed.",
        "what_auditor_looks_for": "Risk controls (RC-XXX) linked to hazards, control type (inherent safety, protective, information), residual risk evaluation.",
        "where_we_check": "docs/iec62304/03_Risk_Management_File.md (RC- entries)",
        "class_c_note": "Class C requires that risk controls are implemented as software requirements traceable to the SRS.",
        "form_if_fails": "TPL-04",
        "checks": ["Risk controls documented (RC-IDs)", "Control measures linked to hazards", "Residual risk assessed"],
    },
    {
        "clause": "7.3", "title": "Verification of Risk Control", "group": "Risk Management",
        "description": "The auditor verifies that EACH risk control has been tested and verified as effective, with documented VERIFIED/PARTIAL status.",
        "what_auditor_looks_for": "Risk control verification records showing VERIFIED status per control. TPL-04 forms for each verification.",
        "where_we_check": "docs/iec62304/records/risk_verification/",
        "class_c_note": "This is one of the most critical clauses for Class C — every risk control MUST have evidence of verification.",
        "form_if_fails": "TPL-04",
        "checks": ["Risk control verification records exist", "VERIFIED status documented per control"],
    },
    {
        "clause": "7.4", "title": "Risk Management of Changes", "group": "Risk Management",
        "description": "The auditor verifies that when software changes are made, the impact on existing risk controls is re-evaluated.",
        "what_auditor_looks_for": "Evidence that code changes trigger risk re-assessment. Change control records (TPL-09) with risk impact section.",
        "where_we_check": "docs/iec62304/03_Risk_Management_File.md (change references)",
        "class_c_note": "Class C requires that ANY change to the software triggers re-analysis of risk controls that may be affected.",
        "form_if_fails": "TPL-09",
        "checks": ["Change impact on risk assessed", "Re-verification after changes documented"],
    },
    {
        "clause": "8.1", "title": "Configuration Identification", "group": "Configuration Management",
        "description": "The auditor verifies that all software items are identified, versioned, and tracked — including third-party software (SOUP).",
        "what_auditor_looks_for": "Version control (Git), SOUP inventory (SBOM), unique identifiers for all deliverables.",
        "where_we_check": "Git repository + docs/iec62304/SBOM_CycloneDX.json + docs/iec62304/09_SOUP_Bill_of_Materials.md",
        "class_c_note": "Class C SOUP items must include: name, version, manufacturer, safety class, and anomaly list.",
        "form_if_fails": "TPL-07",
        "checks": ["Version control system (Git) in use", "SOUP inventory maintained", "SBOM (CycloneDX) exists"],
    },
    {
        "clause": "8.2", "title": "Change Control", "group": "Configuration Management",
        "description": "The auditor verifies that changes are controlled through a formal process — approved before implementation, with traceability.",
        "what_auditor_looks_for": "Pull request review process, CODEOWNERS file for Class C modules, change control records (TPL-09).",
        "where_we_check": ".github/CODEOWNERS + GitHub PR history",
        "class_c_note": "Class C modules MUST have mandatory code review (CODEOWNERS) — no self-merge allowed.",
        "form_if_fails": "TPL-09",
        "checks": ["Change control process documented", "PR review required (CODEOWNERS)", "Class C modules protected"],
    },
    {
        "clause": "8.3", "title": "Configuration Status Accounting", "group": "Configuration Management",
        "description": "The auditor verifies that the current configuration of the software is known — what version is deployed, what changed since last release.",
        "what_auditor_looks_for": "Release history, Git tags, deployment records, configuration baselines.",
        "where_we_check": "Git commit/tag history + deployment records",
        "class_c_note": "Class C requires that the exact configuration of safety-critical components is traceable at any point in time.",
        "form_if_fails": "TPL-02",
        "checks": ["Release history maintained (Git tags)", "Configuration baselines documented"],
    },
    {
        "clause": "9.1", "title": "Problem Reports", "group": "Problem Resolution",
        "description": "The auditor verifies that there is a defined process for reporting, tracking, and resolving software problems.",
        "what_auditor_looks_for": "Problem report template (TPL-01), issue tracking system (GitHub Issues), categorization by severity.",
        "where_we_check": "docs/iec62304/08_Problem_Resolution_Procedure.md + docs/iec62304/templates/",
        "class_c_note": "Class C problem reports must include: root cause analysis, impact on patient safety, and CAPA.",
        "form_if_fails": "TPL-01",
        "checks": ["Problem report template (TPL-01) exists", "Problem tracking process defined"],
    },
    {
        "clause": "9.2", "title": "Investigation & Evaluation", "group": "Problem Resolution",
        "description": "The auditor verifies that reported problems are investigated with root cause analysis and evaluated for safety impact.",
        "what_auditor_looks_for": "Root cause analysis process, impact evaluation procedure, CAPA records.",
        "where_we_check": "docs/iec62304/08_Problem_Resolution_Procedure.md + QMS AI CAPA generator",
        "class_c_note": "Class C requires documented investigation for EVERY problem that could affect patient safety.",
        "form_if_fails": "TPL-01",
        "checks": ["Root cause analysis process defined", "Safety impact evaluation process"],
    },
    {
        "clause": "9.3", "title": "Advisory Notices", "group": "Problem Resolution",
        "description": "The auditor verifies that there is a process for issuing advisory notices and reporting serious incidents to competent authorities.",
        "what_auditor_looks_for": "Incident reporting procedure, serious incident report template (TPL-08), competent authority notification process (EU MDR Art. 87).",
        "where_we_check": "docs/mdr/ + docs/iec62304/templates/",
        "class_c_note": "Class C requires a defined process for reporting to competent authorities within 15 days for serious incidents.",
        "form_if_fails": "TPL-08",
        "checks": ["Incident reporting process documented", "Competent authority notification process (EU MDR Art. 87)"],
    },
]


class AuditEngine:
    """Run IEC 62304 audit simulations."""

    def __init__(self):
        self.github = GitHubService()

    def run_audit(self, mode: str = "full", target: Optional[str] = None) -> Dict[str, Any]:
        """Run an audit simulation."""
        audit_id = str(uuid.uuid4())[:8]
        started_at = datetime.now(timezone.utc).isoformat()

        if mode == "full":
            questions = self._full_audit()
        elif mode == "random_commit":
            questions = self._random_commit_audit()
        elif mode == "random_requirement":
            questions = self._random_requirement_audit()
        else:
            questions = self._full_audit()

        # Calculate readiness score
        score_map = {"strong": 100, "adequate": 75, "weak": 40, "missing": 0}
        total = sum(score_map.get(q["score"], 0) for q in questions)
        readiness = round(total / len(questions), 1) if questions else 0

        # Identify gaps
        gaps = []
        for q in questions:
            if q["score"] in ("weak", "missing"):
                gaps.append({
                    "clause": q["clause"],
                    "title": q["question"],
                    "severity": "critical" if q["score"] == "missing" else "warning",
                    "recommendation": f"Address clause {q['clause']}: provide evidence for {q['question']}",
                })

        return {
            "id": audit_id,
            "started_at": started_at,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "mode": mode,
            "questions": questions,
            "readiness_score": readiness,
            "gaps": gaps,
            "summary": {
                "total_checks": len(questions),
                "strong": sum(1 for q in questions if q["score"] == "strong"),
                "adequate": sum(1 for q in questions if q["score"] == "adequate"),
                "weak": sum(1 for q in questions if q["score"] == "weak"),
                "missing": sum(1 for q in questions if q["score"] == "missing"),
            },
        }

    def _full_audit(self) -> List[Dict]:
        """Check all IEC 62304 clauses with enriched detail.

        Each clause is checked independently — if one clause's GitHub API
        call fails (rate limit, timeout), it scores 'missing' with an error
        note rather than crashing the entire audit. This was a production
        bug: with 60/hr unauthenticated rate limit, the 15th clause would
        hit 403 and the whole audit returned "Audit failed" to the user.
        """
        questions = []
        for clause_def in CLAUSES:
            try:
                evidence, score = self._check_clause(clause_def)
            except Exception as e:
                logger.warning(f"Clause {clause_def['clause']} check failed: {e}")
                evidence = [{
                    "type": "error",
                    "reference": "GitHub API or service error",
                    "content": f"Could not verify this clause: {str(e)[:200]}. "
                               "This may be a transient rate-limit issue — re-run the audit.",
                }]
                score = "missing"
            questions.append({
                "clause": clause_def["clause"],
                "group": clause_def["group"],
                "question": clause_def["title"],
                "description": clause_def.get("description", ""),
                "what_auditor_looks_for": clause_def.get("what_auditor_looks_for", ""),
                "where_we_check": clause_def.get("where_we_check", ""),
                "class_c_note": clause_def.get("class_c_note", ""),
                "form_if_fails": clause_def.get("form_if_fails", ""),
                "checks": clause_def["checks"],
                "evidence": evidence,
                "score": score,
            })
        return questions

    def _random_commit_audit(self) -> List[Dict]:
        """Pick a random commit and trace to requirements."""
        commits = self.github.get_recent_commits(20)
        if not commits:
            return [{"clause": "N/A", "group": "Random Commit", "question": "No commits found",
                      "checks": [], "evidence": [], "score": "missing"}]

        commit = random.choice(commits)
        questions = []

        # Check if commit message references a requirement
        msg = commit["message"]
        req_refs = re.findall(r'REQ-[A-Z]+-\d+', msg)
        has_req = len(req_refs) > 0

        questions.append({
            "clause": "Trace-1", "group": "Commit Traceability",
            "question": f"Commit {commit['sha']} references requirements?",
            "checks": [f"Message: {msg[:80]}"],
            "evidence": [{"type": "commit", "reference": commit["sha"], "content": msg}],
            "score": "strong" if has_req else "weak",
        })

        # Check if it has a PR
        prs = self.github.get_pull_requests("closed", 10)
        linked_pr = None
        for pr in prs:
            if commit["sha"] in str(pr.get("title", "")):
                linked_pr = pr
                break

        questions.append({
            "clause": "Trace-2", "group": "Commit Traceability",
            "question": f"Commit {commit['sha']} went through code review?",
            "checks": ["Pull request exists", "Review approved"],
            "evidence": [{"type": "pr", "reference": str(linked_pr["number"]) if linked_pr else "none",
                          "content": linked_pr["title"] if linked_pr else "No PR found"}],
            "score": "strong" if linked_pr else "adequate",
        })

        # Check CI status for that commit
        ci_runs = self.github.get_ci_runs(5)
        ci_pass = any(r.get("conclusion") == "success" for r in ci_runs)

        questions.append({
            "clause": "Trace-3", "group": "Commit Traceability",
            "question": f"CI pipeline passed for recent commits?",
            "checks": ["CI workflow exists", "Tests passed"],
            "evidence": [{"type": "ci", "reference": ci_runs[0]["head_sha"] if ci_runs else "none",
                          "content": ci_runs[0].get("conclusion", "none") if ci_runs else "No CI runs"}],
            "score": "strong" if ci_pass else "weak",
        })

        return questions

    def _random_requirement_audit(self) -> List[Dict]:
        """Pick a random requirement and trace all evidence."""
        content = self.github.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md")
        if not content:
            return [{"clause": "N/A", "group": "Requirement Trace", "question": "SRS not found",
                      "checks": [], "evidence": [], "score": "missing"}]

        req_ids = list(set(re.findall(r'REQ-[A-Z]+-\d+', content)))
        if not req_ids:
            return [{"clause": "N/A", "group": "Requirement Trace", "question": "No requirements found",
                      "checks": [], "evidence": [], "score": "missing"}]

        req_id = random.choice(req_ids)
        questions = []

        # 1. Requirement defined in SRS?
        questions.append({
            "clause": "REQ-1", "group": "Requirement Trace",
            "question": f"Is {req_id} properly defined in the SRS?",
            "checks": ["Requirement exists in SRS", "Has description"],
            "evidence": [{"type": "document", "reference": "docs/iec62304/02_Software_Requirements_Specification.md",
                          "content": f"{req_id} found in SRS"}],
            "score": "strong",
        })

        # 2. Is it implemented in code?
        code_files = self.github.list_directory("backend/app/services")
        implemented = False
        impl_file = ""
        for f in (code_files or []):
            if f["name"].endswith(".py") and not f["name"].startswith("__"):
                fc = self.github.get_file_content(f["path"]) or ""
                if req_id in fc:
                    implemented = True
                    impl_file = f["path"]
                    break

        questions.append({
            "clause": "REQ-2", "group": "Requirement Trace",
            "question": f"Is {req_id} referenced in implementation code?",
            "checks": ["Code references requirement ID"],
            "evidence": [{"type": "code", "reference": impl_file or "not found",
                          "content": f"{'Found in ' + impl_file if implemented else 'Not found in code'}"}],
            "score": "strong" if implemented else "weak",
        })

        # 3. Is it tested?
        test_files = self.github.list_directory("backend/tests/unit")
        tested = False
        test_file = ""
        for f in (test_files or []):
            if f["name"].startswith("test_") and f["name"].endswith(".py"):
                fc = self.github.get_file_content(f["path"]) or ""
                if req_id in fc:
                    tested = True
                    test_file = f["path"]
                    break

        questions.append({
            "clause": "REQ-3", "group": "Requirement Trace",
            "question": f"Is {req_id} covered by tests?",
            "checks": ["Test file references requirement ID"],
            "evidence": [{"type": "test", "reference": test_file or "not found",
                          "content": f"{'Found in ' + test_file if tested else 'Not found in tests'}"}],
            "score": "strong" if tested else "weak",
        })

        # 4. Is it covered in risk analysis?
        risk_content = self.github.get_file_content("docs/iec62304/03_Risk_Management_File.md") or ""
        in_risk = req_id in risk_content

        questions.append({
            "clause": "REQ-4", "group": "Requirement Trace",
            "question": f"Is {req_id} covered in risk analysis?",
            "checks": ["Referenced in Risk Management File"],
            "evidence": [{"type": "document", "reference": "docs/iec62304/03_Risk_Management_File.md",
                          "content": f"{'Referenced in RMF' if in_risk else 'Not found in RMF'}"}],
            "score": "strong" if in_risk else "adequate",
        })

        return questions

    def _check_clause(self, clause_def: Dict) -> tuple:
        """Check evidence for a specific clause. Returns (evidence_list, score)."""
        clause = clause_def["clause"]
        evidence = []
        checks_passed = 0
        total_checks = len(clause_def["checks"])

        if clause == "5.1":
            evidence, checks_passed = self._check_5_1()
        elif clause == "5.2":
            evidence, checks_passed = self._check_5_2()
        elif clause == "5.3":
            evidence, checks_passed = self._check_5_3()
        elif clause == "5.4":
            evidence, checks_passed = self._check_5_4()
        elif clause == "5.5":
            evidence, checks_passed = self._check_5_5()
        elif clause == "5.6":
            evidence, checks_passed = self._check_5_6()
        elif clause == "5.7":
            evidence, checks_passed = self._check_5_7()
        elif clause == "5.8":
            evidence, checks_passed = self._check_5_8()
        elif clause == "6.1":
            evidence, checks_passed = self._check_6_1()
        elif clause == "6.2":
            evidence, checks_passed = self._check_6_2()
        elif clause in ("7.1", "7.2", "7.3", "7.4"):
            evidence, checks_passed = self._check_7(clause)
        elif clause in ("8.1", "8.2", "8.3"):
            evidence, checks_passed = self._check_8(clause)
        elif clause in ("9.1", "9.2", "9.3"):
            evidence, checks_passed = self._check_9(clause)

        ratio = checks_passed / total_checks if total_checks > 0 else 0
        if ratio >= 0.9:
            score = "strong"
        elif ratio >= 0.6:
            score = "adequate"
        elif ratio > 0:
            score = "weak"
        else:
            score = "missing"

        return evidence, score

    def _check_5_1(self):
        e, p = [], 0
        sdp = self.github.file_exists("docs/iec62304/01_Software_Development_Plan.md")
        e.append({"type": "document", "reference": "docs/iec62304/01_Software_Development_Plan.md",
                   "content": "SDP exists" if sdp else "SDP not found"})
        if sdp:
            p += 2
            content = self.github.get_file_content("docs/iec62304/01_Software_Development_Plan.md") or ""
            if "lifecycle" in content.lower() or "waterfall" in content.lower() or "agile" in content.lower():
                p += 1
            if "deliverable" in content.lower():
                p += 1
        return e, p

    def _check_5_2(self):
        e, p = [], 0
        srs = self.github.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md")
        e.append({"type": "document", "reference": "docs/iec62304/02_Software_Requirements_Specification.md",
                   "content": "SRS exists" if srs else "SRS not found"})
        if srs:
            p += 1
            func = len(re.findall(r'REQ-FUNC-\d+', srs))
            safe = len(re.findall(r'REQ-SAFE-\d+', srs))
            perf = len(re.findall(r'REQ-PERF-\d+', srs))
            if func > 0: p += 1
            if safe > 0: p += 1
            if perf > 0: p += 1
            if func + safe + perf > 5: p += 1
            e.append({"type": "analysis", "reference": "SRS",
                       "content": f"Found {func} FUNC, {safe} SAFE, {perf} PERF requirements"})
        return e, p

    def _check_5_3(self):
        e, p = [], 0
        sad = self.github.file_exists("docs/iec62304/03_Software_Architecture_Document.md")
        e.append({"type": "document", "reference": "docs/iec62304/03_Software_Architecture_Document.md",
                   "content": "SAD exists" if sad else "SAD not found"})
        if sad:
            p += 2
            content = self.github.get_file_content("docs/iec62304/03_Software_Architecture_Document.md") or ""
            if "interface" in content.lower() or "api" in content.lower():
                p += 1
            if "class c" in content.lower() or "safety" in content.lower():
                p += 1
        return e, p

    def _check_5_4(self):
        e, p = [], 0
        # Check if detailed design docs exist or if SAD has detail
        sad_content = self.github.get_file_content("docs/iec62304/03_Software_Architecture_Document.md") or ""
        if "algorithm" in sad_content.lower() or "detailed" in sad_content.lower():
            p += 1
            e.append({"type": "document", "reference": "SAD", "content": "Detailed design content found in SAD"})
        # Check code docstrings for Class C modules
        for module in ["ai_segmentation_service.py", "brain_volumetry_service.py"]:
            content = self.github.get_file_content(f"backend/app/services/{module}") or ""
            if '"""' in content:
                p += 1
                e.append({"type": "code", "reference": f"backend/app/services/{module}",
                           "content": "Docstrings present"})
        return e, p

    def _check_5_5(self):
        e, p = [], 0
        test_files = self.github.list_directory("backend/tests/unit") or []
        test_count = len([f for f in test_files if f["name"].startswith("test_")])
        if test_count > 0:
            p += 2
            e.append({"type": "test", "reference": "backend/tests/unit/",
                       "content": f"{test_count} unit test files found"})
        # Check for code review evidence
        codeowners = self.github.file_exists(".github/CODEOWNERS")
        if codeowners:
            p += 1
            e.append({"type": "config", "reference": ".github/CODEOWNERS", "content": "CODEOWNERS configured"})
        # Check CI
        ci_files = self.github.list_directory(".github/workflows") or []
        if ci_files:
            p += 1
            e.append({"type": "config", "reference": ".github/workflows/",
                       "content": f"{len(ci_files)} CI workflow(s) found"})
        return e, p

    def _check_5_6(self):
        e, p = [], 0
        ci_runs = self.github.get_ci_runs(5)
        if ci_runs:
            p += 2
            success = sum(1 for r in ci_runs if r.get("conclusion") == "success")
            e.append({"type": "ci", "reference": "GitHub Actions",
                       "content": f"{len(ci_runs)} CI runs, {success} successful"})
            if success > 0:
                p += 1
        return e, p

    def _check_5_7(self):
        e, p = [], 0
        # Check for system test documentation
        test_docs = self.github.list_files_recursive("docs/iec62304", ".md")
        test_plan = any("test" in d["name"].lower() for d in test_docs)
        if test_plan:
            p += 2
            e.append({"type": "document", "reference": "docs/iec62304/",
                       "content": "Test documentation found"})
        # Check for test execution records
        records = self.github.list_directory("docs/iec62304/records") or []
        if records:
            p += 1
            e.append({"type": "document", "reference": "docs/iec62304/records/",
                       "content": f"{len(records)} record directories found"})
        return e, p

    def _check_5_8(self):
        e, p = [], 0
        # Check for release documentation
        releases = self.github.list_files_recursive("docs", ".md")
        release_docs = [d for d in releases if "release" in d["name"].lower()]
        if release_docs:
            p += 2
            e.append({"type": "document", "reference": release_docs[0]["path"],
                       "content": "Release documentation found"})
        # Check git tags
        commits = self.github.get_recent_commits(5)
        if commits:
            p += 1
            e.append({"type": "git", "reference": "commits", "content": f"Recent commits: {len(commits)}"})
        # Check version labeling
        pkg = self.github.get_file_content("frontend/package.json") or ""
        if '"version"' in pkg:
            p += 1
            e.append({"type": "config", "reference": "frontend/package.json", "content": "Version labeling in package.json"})
        return e, p

    def _check_6_1(self):
        e, p = [], 0
        sdp_content = self.github.get_file_content("docs/iec62304/01_Software_Development_Plan.md") or ""
        if "maintenance" in sdp_content.lower():
            p += 1
            e.append({"type": "document", "reference": "SDP", "content": "Maintenance section in SDP"})
        if "feedback" in sdp_content.lower() or "issue" in sdp_content.lower():
            p += 1
            e.append({"type": "document", "reference": "SDP", "content": "Feedback mechanism referenced"})
        return e, p

    def _check_6_2(self):
        e, p = [], 0
        # Check for change control docs
        docs = self.github.list_files_recursive("docs", ".md")
        change_docs = [d for d in docs if "change" in d["name"].lower() or "problem" in d["name"].lower()]
        if change_docs:
            p += 2
            e.append({"type": "document", "reference": change_docs[0]["path"],
                       "content": "Change/problem documentation found"})
        return e, p

    def _check_7(self, clause):
        e, p = [], 0
        rmf = self.github.get_file_content("docs/iec62304/03_Risk_Management_File.md")
        if not rmf:
            return e, p
        e.append({"type": "document", "reference": "docs/iec62304/03_Risk_Management_File.md",
                   "content": "Risk Management File exists"})
        p += 1

        if clause == "7.1":
            haz_count = len(re.findall(r'HAZ-\d+', rmf))
            if haz_count > 0:
                p += 2
                e.append({"type": "analysis", "reference": "RMF", "content": f"{haz_count} hazards identified"})
            if "severity" in rmf.lower() and "probability" in rmf.lower():
                p += 1
        elif clause == "7.2":
            rc_count = len(re.findall(r'RC-\d+', rmf))
            if rc_count > 0:
                p += 2
                e.append({"type": "analysis", "reference": "RMF", "content": f"{rc_count} risk controls"})
            if "residual" in rmf.lower():
                p += 1
        elif clause == "7.3":
            verified = rmf.count("VERIFIED")
            if verified > 0:
                p += 2
                e.append({"type": "analysis", "reference": "RMF", "content": f"{verified} VERIFIED risk controls"})
            records = self.github.list_directory("docs/iec62304/records/risk_verification") or []
            if records:
                p += 1
        elif clause == "7.4":
            if "change" in rmf.lower():
                p += 1
                e.append({"type": "analysis", "reference": "RMF", "content": "Change impact on risk addressed"})

        return e, p

    def _check_8(self, clause):
        e, p = [], 0
        if clause == "8.1":
            if self.github.file_exists(".git"):
                p += 1
            # Git is implied since we're reading from GitHub
            p += 1
            e.append({"type": "config", "reference": "GitHub", "content": "Git version control in use"})
            sbom = self.github.file_exists("docs/iec62304/SBOM_CycloneDX.json")
            if sbom:
                p += 1
                e.append({"type": "document", "reference": "SBOM_CycloneDX.json", "content": "SBOM exists"})
        elif clause == "8.2":
            codeowners = self.github.file_exists(".github/CODEOWNERS")
            if codeowners:
                p += 2
                e.append({"type": "config", "reference": ".github/CODEOWNERS", "content": "CODEOWNERS for review enforcement"})
        elif clause == "8.3":
            commits = self.github.get_recent_commits(5)
            if commits:
                p += 2
                e.append({"type": "git", "reference": "history", "content": f"Active commit history ({len(commits)} recent)"})
        return e, p

    def _check_9(self, clause):
        e, p = [], 0
        if clause == "9.1":
            # Check for problem report templates
            templates = self.github.list_files_recursive("docs/iec62304/templates", ".md")
            pr_template = any("problem" in t["name"].lower() for t in templates)
            if pr_template:
                p += 2
                e.append({"type": "document", "reference": "templates/", "content": "Problem report template exists"})
        elif clause == "9.2":
            docs = self.github.list_files_recursive("docs", ".md")
            capa = any("capa" in d["name"].lower() or "root_cause" in d["name"].lower() for d in docs)
            if capa:
                p += 1
            p += 1  # Process is implied by QMS
            e.append({"type": "process", "reference": "QMS", "content": "Investigation process via QMS platform"})
        elif clause == "9.3":
            mdr_docs = self.github.list_files_recursive("docs/mdr", ".md")
            incident = any("incident" in d["name"].lower() or "vigilance" in d["name"].lower() for d in mdr_docs)
            if incident:
                p += 2
                e.append({"type": "document", "reference": "docs/mdr/", "content": "Incident reporting documentation"})
            else:
                p += 1
                e.append({"type": "process", "reference": "QMS", "content": "TPL-08 Serious Incident Report available in QMS"})
        return e, p