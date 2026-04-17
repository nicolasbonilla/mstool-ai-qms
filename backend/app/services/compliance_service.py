"""
Compliance Score Engine — MSTool-AI-QMS.

Analyzes the MSTool-AI repository via GitHub API to compute real-time compliance scores.
Works both locally (filesystem) and in production (GitHub API).

Scores computed:
- IEC 62304 (software lifecycle)
- ISO 13485 (quality management)
- IEC 81001-5-1 (cybersecurity)
- CE Mark overall readiness
"""

import re
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)


class ComplianceService:
    """Compute compliance scores by analyzing the MSTool-AI repo via GitHub API."""

    def __init__(self):
        self.github = GitHubService()

    def _read_file(self, path: str) -> Optional[str]:
        """Read file content from GitHub."""
        return self.github.get_file_content(path)

    def _list_dir(self, path: str) -> List[Dict]:
        """List directory contents from GitHub."""
        return self.github.list_directory(path)

    def _list_md_files(self, dir_path: str) -> List[Dict]:
        """List .md files in a directory."""
        return self.github.list_files_recursive(dir_path, ".md")

    def compute_full_score(self) -> Dict[str, Any]:
        """Compute complete compliance score with breakdown."""
        breakdown = {
            "auth_coverage": self._check_auth_coverage(),
            "input_validation": self._check_input_validation(),
            "test_coverage": self._check_test_coverage(),
            "risk_verification": self._check_risk_verification(),
            "doc_completeness": self._check_doc_completeness(),
            "doc_freshness": self._check_doc_freshness(),
            "soup_vulnerability": self._check_soup_status(),
            "codeowners_coverage": self._check_codeowners(),
        }

        iec62304 = (
            breakdown["test_coverage"] * 0.25 +
            breakdown["risk_verification"] * 0.20 +
            breakdown["doc_completeness"] * 0.20 +
            breakdown["input_validation"] * 0.15 +
            breakdown["auth_coverage"] * 0.10 +
            breakdown["codeowners_coverage"] * 0.10
        )
        iso13485 = (
            breakdown["doc_completeness"] * 0.30 +
            breakdown["doc_freshness"] * 0.20 +
            breakdown["risk_verification"] * 0.20 +
            breakdown["test_coverage"] * 0.15 +
            breakdown["codeowners_coverage"] * 0.15
        )
        cybersecurity = (
            breakdown["auth_coverage"] * 0.30 +
            breakdown["input_validation"] * 0.25 +
            breakdown["soup_vulnerability"] * 0.25 +
            breakdown["codeowners_coverage"] * 0.20
        )
        ce_mark = iec62304 * 0.35 + iso13485 * 0.30 + cybersecurity * 0.20 + breakdown["doc_completeness"] * 0.15

        return {
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "scores": {
                "iec62304": round(iec62304, 1),
                "iso13485": round(iso13485, 1),
                "cybersecurity": round(cybersecurity, 1),
                "ce_mark_overall": round(ce_mark, 1),
            },
            "breakdown": {k: round(v, 1) for k, v in breakdown.items()},
        }

    def get_auth_coverage_detail(self) -> Dict[str, Any]:
        """Detailed auth coverage per route file."""
        files_list = self._list_dir("backend/app/api/routes")
        if not files_list:
            return {"files": [], "total_endpoints": 0, "protected": 0, "coverage_pct": 0}

        files = []
        total = 0
        protected = 0

        for item in sorted(files_list, key=lambda x: x["name"]):
            if not item["name"].endswith(".py") or item["name"].startswith("__"):
                continue
            content = self._read_file(item["path"])
            if not content:
                continue

            endpoints = len(re.findall(r"async def \w+\(", content))
            has_import = "get_current_active_user" in content
            auth_count = max(0, content.count("get_current_active_user") - (1 if has_import else 0))

            files.append({
                "file": item["name"],
                "endpoints": endpoints,
                "protected": min(auth_count, endpoints),
                "status": "protected" if min(auth_count, endpoints) >= endpoints else "unprotected",
            })
            total += endpoints
            protected += min(auth_count, endpoints)

        return {
            "files": files,
            "total_endpoints": total,
            "protected": protected,
            "coverage_pct": round((protected / total) * 100, 1) if total > 0 else 0,
        }

    def get_document_inventory(self) -> List[Dict[str, Any]]:
        """List all regulatory documents with full IEC 62304 §5.1.7 / ISO 13485 §4.2.4 metadata.

        Includes: last modification date (from git), days since modified, next review due
        (annual cycle per ISO 13485 industry practice), review status, last author/message.
        Auto-discovers ALL docs/* subdirectories — no hardcoded list.
        """
        from datetime import timedelta

        # ISO 13485 industry practice: annual review cycle for QMS documents
        REVIEW_CYCLE_DAYS = 365
        DUE_SOON_THRESHOLD_DAYS = 30

        # IEC 62304 §5.1.7 — document owner per standard family.
        # Auto-discovered subdirs without an explicit owner default to "Document Owner".
        OWNER_BY_STANDARD = {
            "iec62304": "Software Lead",
            "qms": "QMS Manager",
            "clinical": "Clinical Advisor",
            "clinical-evaluation": "Clinical Advisor",
            "usability": "UX Lead",
            "mdr": "Regulatory Affairs",
            "ai-act": "AI Governance Lead",
            "cybersecurity": "Security Lead",
            "audit-records": "QMS Manager",
            "post-market": "Regulatory Affairs",
            "training": "QMS Manager",
        }

        STANDARD_LABELS = {
            "iec62304": "IEC 62304",
            "qms": "ISO 13485",
            "clinical": "ISO 14155",
            "clinical-evaluation": "MEDDEV 2.7/1 rev. 4",
            "usability": "IEC 62366-1",
            "mdr": "EU MDR 2017/745",
            "ai-act": "EU AI Act",
            "cybersecurity": "IEC 81001-5-1",
            "audit-records": "ISO 13485 §4.2.5",
            "post-market": "ISO 14971 §10",
            "training": "ISO 13485 §6.2.2",
        }

        documents = []
        now = datetime.now(timezone.utc)

        # Auto-discover every subdirectory under docs/ (no hardcoded list).
        try:
            top_level = self._list_dir("docs") or []
            subdirs = [item["name"] for item in top_level if item.get("type") == "dir"]
        except Exception:
            subdirs = ["iec62304", "qms", "clinical", "usability", "mdr", "ai-act"]

        for subdir in subdirs:
            md_files = self._list_md_files(f"docs/{subdir}")
            for md in sorted(md_files, key=lambda x: x["name"]):
                # Pull last commit metadata for review-cycle calculation
                last_commit = self.github.get_file_last_commit(md["path"]) or {}
                last_modified_iso = last_commit.get("date")
                days_since = None
                next_review_due_iso = None
                days_until_review = None
                review_status = "unknown"
                freshness = "yellow"

                if last_modified_iso:
                    try:
                        last_modified = datetime.fromisoformat(last_modified_iso.replace("Z", "+00:00"))
                        days_since = (now - last_modified).days
                        next_review_due = last_modified + timedelta(days=REVIEW_CYCLE_DAYS)
                        next_review_due_iso = next_review_due.isoformat()
                        days_until_review = (next_review_due - now).days
                        if days_until_review < 0:
                            review_status = "overdue"
                            freshness = "red"
                        elif days_until_review <= DUE_SOON_THRESHOLD_DAYS:
                            review_status = "due_soon"
                            freshness = "yellow"
                        else:
                            review_status = "current"
                            freshness = "green"
                    except (ValueError, TypeError):
                        pass

                documents.append({
                    "path": md["path"],
                    "doc_id": md["name"].split("_")[0] if "_" in md["name"] else md["name"].replace(".md", ""),
                    "title": md["name"].replace(".md", "").replace("_", " "),
                    "standard": subdir,
                    "standard_label": STANDARD_LABELS.get(subdir, subdir.replace("-", " ").title()),
                    "owner": OWNER_BY_STANDARD.get(subdir, "Document Owner"),
                    "lines": md.get("size", 0) // 40,
                    "size_bytes": md.get("size", 0),
                    "github_url": f"https://github.com/{self.github.repo}/blob/main/{md['path']}",
                    # ISO 13485 §4.2.4 — review cycle metadata
                    "last_modified": last_modified_iso,
                    "days_since_modified": days_since,
                    "next_review_due": next_review_due_iso,
                    "days_until_review": days_until_review,
                    "review_status": review_status,  # current | due_soon | overdue | unknown
                    "review_cycle_days": REVIEW_CYCLE_DAYS,
                    # IEC 62304 §5.1.7 — change traceability
                    "last_author": last_commit.get("author"),
                    "last_commit_sha": last_commit.get("sha"),
                    "last_commit_message": last_commit.get("message"),
                    "last_commit_url": last_commit.get("github_url"),
                    "freshness": freshness,
                })
        return documents

    def get_test_inventory(self) -> List[Dict[str, Any]]:
        """List all test files with metadata. Uses file size to estimate, reads content from cache."""
        all_files = self._list_dir("backend/tests/unit")
        result = []
        for item in sorted(all_files, key=lambda x: x["name"]):
            if not item["name"].startswith("test_") or not item["name"].endswith(".py"):
                continue
            # Estimate lines from size (avg ~35 bytes/line for Python)
            est_lines = item.get("size", 0) // 35
            # Estimate test count (~1 test per 25 lines for test files)
            est_tests = max(1, est_lines // 25)
            result.append({
                "file": item["name"],
                "lines": est_lines,
                "test_count": est_tests,
            })
        return result

    def get_commits(self, count: int = 30) -> List[Dict]:
        """Get recent commits from GitHub."""
        return self.github.get_recent_commits(count)

    def get_pull_requests(self, state: str = "all", count: int = 30) -> List[Dict]:
        """Get PRs from GitHub."""
        return self.github.get_pull_requests(state, count)

    def get_ci_runs(self, count: int = 10) -> List[Dict]:
        """Get CI workflow runs from GitHub."""
        return self.github.get_ci_runs(count)

    # ─── Deep evidence with code snippets ───

    def get_check_evidence(self, check_id: str) -> Dict[str, Any]:
        """Get deep evidence with actual code snippets for a compliance check."""
        github_base = f"https://github.com/{self.github.repo}/blob/main"

        if check_id == "auth_coverage":
            return self._evidence_auth_coverage(github_base)
        elif check_id == "input_validation":
            return self._evidence_input_validation(github_base)
        elif check_id == "test_coverage":
            return self._evidence_test_coverage(github_base)
        elif check_id == "risk_verification":
            return self._evidence_risk_verification(github_base)
        elif check_id == "doc_completeness":
            return self._evidence_doc_completeness(github_base)
        elif check_id == "codeowners_coverage":
            return self._evidence_codeowners(github_base)
        else:
            return {"check_id": check_id, "evidence": [], "code_snippets": []}

    def _evidence_auth_coverage(self, github_base: str) -> Dict:
        """Deep evidence for auth coverage — shows actual auth decorator lines."""
        files = self.github.list_directory("backend/app/api/routes")
        evidence = []
        for f in (files or []):
            if not f["name"].endswith(".py") or f["name"].startswith("__"):
                continue
            matches = self.github.search_in_file(f["path"], r"get_current_active_user|Depends\(get_current", context=2)
            endpoints = self.github.search_in_file(f["path"], r"async def \w+\(", context=1)
            evidence.append({
                "file": f["name"],
                "path": f["path"],
                "github_url": f"{github_base}/{f['path']}",
                "total_endpoints": len(endpoints),
                "protected_endpoints": len(matches),
                "status": "pass" if len(matches) >= len(endpoints) and len(endpoints) > 0 else "fail",
                "auth_lines": [{"line": m["line_number"], "text": m["text"], "url": m["github_url"], "snippet": m["snippet"]} for m in matches[:5]],
                "endpoint_lines": [{"line": e["line_number"], "text": e["text"], "url": e["github_url"]} for e in endpoints],
            })
        total_ep = sum(e["total_endpoints"] for e in evidence)
        total_protected = sum(e["protected_endpoints"] for e in evidence)
        return {
            "check_id": "auth_coverage",
            "score": round((total_protected / total_ep) * 100, 1) if total_ep > 0 else 0,
            "calculation": f"{total_protected} / {total_ep} endpoints protected = {round((total_protected / total_ep) * 100, 1) if total_ep > 0 else 0}%",
            "evidence": evidence,
        }

    def _evidence_input_validation(self, github_base: str) -> Dict:
        """Deep evidence for input validation — shows actual validation code."""
        paths = [
            "backend/app/services/brain_volumetry_service.py",
            "backend/app/services/lesion_analysis_service.py",
            "backend/app/services/ms_region_classifier.py",
            "backend/app/utils/nifti_utils.py",
            "backend/app/utils/dicom_utils.py",
        ]
        evidence = []
        validated = 0
        for path in paths:
            matches = self.github.search_in_file(path, r"raise ValueError|REQ-SAFE-005", context=3)
            has_validation = len(matches) > 0
            if has_validation:
                validated += 1
            evidence.append({
                "file": path.split("/")[-1],
                "path": path,
                "github_url": f"{github_base}/{path}",
                "status": "pass" if has_validation else "fail",
                "validation_count": len(matches),
                "validation_lines": [{"line": m["line_number"], "text": m["text"], "url": m["github_url"], "snippet": m["snippet"]} for m in matches[:5]],
            })
        score = round((validated / len(paths)) * 100, 1)
        return {
            "check_id": "input_validation",
            "score": score,
            "calculation": f"{validated} / {len(paths)} Class C modules validated = {score}%",
            "evidence": evidence,
        }

    def _evidence_test_coverage(self, github_base: str) -> Dict:
        """Deep evidence for test coverage — shows test function signatures."""
        modules = ["ai_segmentation_service", "brain_volumetry_service", "brain_report_service",
                    "lesion_analysis_service", "ms_region_classifier", "nifti_utils", "dicom_utils", "dicom_seg"]
        test_files = self.github.list_directory("backend/tests/unit")
        test_names = [f["name"].replace(".py", "") for f in (test_files or []) if f["name"].startswith("test_")]

        evidence = []
        covered = 0
        for m in modules:
            has_test = f"test_{m}" in test_names
            if has_test:
                covered += 1
            test_info = {"file": f"{m}.py", "path": f"backend/app/services/{m}.py" if "utils" not in m else f"backend/app/utils/{m}.py",
                         "github_url": f"{github_base}/backend/app/services/{m}.py" if "utils" not in m else f"{github_base}/backend/app/utils/{m}.py",
                         "status": "pass" if has_test else "fail", "test_file": f"test_{m}.py" if has_test else None,
                         "test_url": f"{github_base}/backend/tests/unit/test_{m}.py" if has_test else None, "test_functions": []}
            if has_test:
                funcs = self.github.search_in_file(f"backend/tests/unit/test_{m}.py", r"def test_\w+", context=0)
                test_info["test_functions"] = [{"name": f["text"].strip(), "line": f["line_number"], "url": f["github_url"]} for f in funcs[:10]]
            evidence.append(test_info)

        score = round((covered / len(modules)) * 100, 1)
        return {
            "check_id": "test_coverage",
            "score": score,
            "calculation": f"{covered} / {len(modules)} critical modules with tests = {score}%",
            "evidence": evidence,
        }

    def _evidence_risk_verification(self, github_base: str) -> Dict:
        """Deep evidence for risk verification — shows VERIFIED/PARTIAL lines."""
        records = self.github.list_directory("docs/iec62304/records/risk_verification")
        if not records:
            return {"check_id": "risk_verification", "score": 0, "calculation": "No records found", "evidence": []}

        md_records = [r for r in records if r["name"].endswith(".md")]
        if not md_records:
            return {"check_id": "risk_verification", "score": 0, "calculation": "No records found", "evidence": []}

        latest = sorted(md_records, key=lambda x: x["name"])[-1]
        verified_matches = self.github.search_in_file(latest["path"], r"VERIFIED", context=1)
        partial_matches = self.github.search_in_file(latest["path"], r"PARTIAL", context=1)

        total = len(verified_matches) + len(partial_matches)
        score = round((len(verified_matches) / total) * 100, 1) if total > 0 else 0

        return {
            "check_id": "risk_verification",
            "score": score,
            "calculation": f"{len(verified_matches)} VERIFIED + {len(partial_matches)} PARTIAL = {total} total → {score}%",
            "evidence": [{
                "file": latest["name"],
                "path": latest["path"],
                "github_url": f"{github_base}/{latest['path']}",
                "verified_lines": [{"line": m["line_number"], "text": m["text"], "url": m["github_url"]} for m in verified_matches[:10]],
                "partial_lines": [{"line": m["line_number"], "text": m["text"], "url": m["github_url"]} for m in partial_matches[:10]],
            }],
        }

    def _evidence_doc_completeness(self, github_base: str) -> Dict:
        """Deep evidence for document completeness — shows all docs found."""
        expected = {"iec62304": 15, "qms": 8, "clinical": 3, "usability": 1, "mdr": 5, "ai-act": 1}
        evidence = []
        total_found = 0
        total_expected = sum(expected.values())

        for subdir, exp in expected.items():
            files = self.github.list_directory(f"docs/{subdir}")
            md_files = [f for f in files if f["name"].endswith(".md")]
            found = min(len(md_files), exp)
            total_found += found
            evidence.append({
                "standard": subdir,
                "expected": exp,
                "found": len(md_files),
                "status": "pass" if len(md_files) >= exp else "fail",
                "documents": [{"name": f["name"], "url": f"{github_base}/docs/{subdir}/{f['name']}"} for f in md_files],
            })

        score = round((total_found / total_expected) * 100, 1)
        return {
            "check_id": "doc_completeness",
            "score": score,
            "calculation": f"{total_found} / {total_expected} required documents = {score}%",
            "evidence": evidence,
        }

    def _evidence_codeowners(self, github_base: str) -> Dict:
        """Deep evidence for CODEOWNERS — shows which modules are covered."""
        content = self.github.get_file_content(".github/CODEOWNERS")
        modules = ["ai_segmentation_service.py", "brain_volumetry_service.py", "brain_report_service.py",
                    "lesion_analysis_service.py", "ms_region_classifier.py", "nifti_utils.py", "dicom_utils.py", "edgeAI.worker.ts"]

        if not content:
            return {"check_id": "codeowners_coverage", "score": 0, "calculation": "CODEOWNERS file not found", "evidence": []}

        lines = content.split('\n')
        evidence = []
        covered = 0
        for m in modules:
            found_line = None
            for i, line in enumerate(lines):
                if m in line:
                    found_line = {"number": i + 1, "text": line.strip(), "url": f"{github_base}/.github/CODEOWNERS#L{i + 1}"}
                    break
            is_covered = found_line is not None
            if is_covered:
                covered += 1
            evidence.append({
                "module": m,
                "status": "pass" if is_covered else "fail",
                "codeowners_line": found_line,
            })

        score = round((covered / len(modules)) * 100, 1)
        return {
            "check_id": "codeowners_coverage",
            "score": score,
            "calculation": f"{covered} / {len(modules)} Class C modules in CODEOWNERS = {score}%",
            "codeowners_url": f"{github_base}/.github/CODEOWNERS",
            "evidence": evidence,
        }

    # ─── Detailed score with evidence ───

    def compute_detailed_score(self) -> Dict[str, Any]:
        """Compute compliance scores with full evidence for each check."""
        checks = []
        github_base = f"https://github.com/{self.github.repo}/blob/main"

        # 1. Auth Coverage
        auth = self.get_auth_coverage_detail()
        auth_files = auth.get("files", [])
        checks.append({
            "id": "auth_coverage",
            "title": "API Authentication Coverage",
            "standard": "IEC 81001-5-1 Clause 5.3.2",
            "description": "Every API endpoint must require authentication to prevent unauthorized access to medical data.",
            "score": auth["coverage_pct"],
            "status": "pass" if auth["coverage_pct"] >= 80 else "warn" if auth["coverage_pct"] >= 60 else "fail",
            "evidence": [
                {
                    "file": f["file"],
                    "github_url": f"{github_base}/backend/app/api/routes/{f['file']}",
                    "detail": f"{f['protected']}/{f['endpoints']} endpoints protected",
                    "status": f["status"],
                }
                for f in auth_files
            ],
            "summary": f"{auth['protected']}/{auth['total_endpoints']} endpoints protected ({auth['coverage_pct']}%)",
            "action": None if auth["coverage_pct"] == 100 else "Add get_current_active_user dependency to unprotected endpoints",
        })

        # 2. Input Validation
        class_c_paths = [
            "backend/app/services/brain_volumetry_service.py",
            "backend/app/services/lesion_analysis_service.py",
            "backend/app/services/ms_region_classifier.py",
            "backend/app/utils/nifti_utils.py",
            "backend/app/utils/dicom_utils.py",
        ]
        validation_evidence = []
        validated = 0
        for path in class_c_paths:
            content = self._read_file(path)
            has_validation = content and ("REQ-SAFE-005" in content or "raise ValueError" in content)
            if has_validation:
                validated += 1
            validation_evidence.append({
                "file": path.split("/")[-1],
                "github_url": f"{github_base}/{path}",
                "detail": "Has input validation (raise ValueError or REQ-SAFE-005)" if has_validation else "Missing input validation",
                "status": "protected" if has_validation else "unprotected",
            })
        val_pct = (validated / len(class_c_paths)) * 100
        checks.append({
            "id": "input_validation",
            "title": "Class C Input Validation",
            "standard": "IEC 62304 Clause 5.5.3 + REQ-SAFE-005",
            "description": "All Class C modules must validate inputs to prevent incorrect medical calculations from malformed data.",
            "score": val_pct,
            "status": "pass" if val_pct >= 80 else "warn" if val_pct >= 60 else "fail",
            "evidence": validation_evidence,
            "summary": f"{validated}/{len(class_c_paths)} Class C modules have input validation",
            "action": None if val_pct == 100 else "Add raise ValueError checks for invalid inputs in unprotected modules",
        })

        # 3. Test Coverage
        modules = [
            "ai_segmentation_service", "brain_volumetry_service", "brain_report_service",
            "lesion_analysis_service", "ms_region_classifier", "nifti_utils", "dicom_utils", "dicom_seg",
        ]
        test_files = self._list_dir("backend/tests/unit")
        test_names = [f["name"].replace(".py", "") for f in (test_files or []) if f["name"].startswith("test_")]
        test_evidence = []
        covered = 0
        for m in modules:
            has_test = f"test_{m}" in test_names
            if has_test:
                covered += 1
            test_evidence.append({
                "file": f"{m}.py",
                "github_url": f"{github_base}/backend/app/services/{m}.py" if "utils" not in m else f"{github_base}/backend/app/utils/{m}.py",
                "detail": f"Test file: test_{m}.py" if has_test else "No test file found",
                "status": "protected" if has_test else "unprotected",
                "test_url": f"{github_base}/backend/tests/unit/test_{m}.py" if has_test else None,
            })
        test_pct = (covered / len(modules)) * 100
        checks.append({
            "id": "test_coverage",
            "title": "Class C Module Test Coverage",
            "standard": "IEC 62304 Clause 5.5.5",
            "description": "Every safety-critical module must have unit tests verifying correct behavior.",
            "score": test_pct,
            "status": "pass" if test_pct >= 80 else "warn" if test_pct >= 60 else "fail",
            "evidence": test_evidence,
            "summary": f"{covered}/{len(modules)} critical modules have unit tests",
            "action": None if test_pct == 100 else f"Create test files for: {', '.join(m for m in modules if f'test_{m}' not in test_names)}",
        })

        # 4. Risk Verification
        records = self._list_dir("docs/iec62304/records/risk_verification")
        risk_evidence = []
        risk_pct = 0
        if records:
            md_records = [r for r in records if r["name"].endswith(".md")]
            if md_records:
                latest = sorted(md_records, key=lambda x: x["name"])[-1]
                content = self._read_file(latest["path"]) or ""
                verified_count = content.count("VERIFIED")
                partial_count = content.count("PARTIAL")
                total = verified_count + partial_count
                risk_pct = round((verified_count / total) * 100, 1) if total > 0 else 0
                risk_evidence.append({
                    "file": latest["name"],
                    "github_url": f"{github_base}/{latest['path']}",
                    "detail": f"{verified_count} VERIFIED, {partial_count} PARTIAL out of {total} risk controls",
                    "status": "protected" if risk_pct >= 90 else "unprotected",
                })
        checks.append({
            "id": "risk_verification",
            "title": "Risk Control Verification",
            "standard": "ISO 14971 Clause 7.3 + IEC 62304 Clause 7.3",
            "description": "Every identified hazard must have a verified risk control measure to ensure patient safety.",
            "score": risk_pct,
            "status": "pass" if risk_pct >= 80 else "warn" if risk_pct >= 60 else "fail",
            "evidence": risk_evidence,
            "summary": f"{risk_pct:.0f}% of risk controls verified",
            "action": None if risk_pct >= 95 else "Complete verification for PARTIAL risk controls in Risk Management File",
        })

        # 5. Document Completeness
        expected = {"iec62304": 15, "qms": 8, "clinical": 3, "usability": 1, "mdr": 5, "ai-act": 1}
        doc_evidence = []
        total_expected = sum(expected.values())
        total_found = 0
        for subdir, exp in expected.items():
            files = self._list_dir(f"docs/{subdir}")
            md_count = len([f for f in files if f["name"].endswith(".md")])
            found = min(md_count, exp)
            total_found += found
            doc_evidence.append({
                "file": f"docs/{subdir}/",
                "github_url": f"{github_base}/docs/{subdir}",
                "detail": f"{md_count} documents found (expected {exp})",
                "status": "protected" if md_count >= exp else "unprotected",
            })
        doc_pct = (total_found / total_expected) * 100
        checks.append({
            "id": "doc_completeness",
            "title": "Regulatory Document Completeness",
            "standard": "IEC 62304 Clause 5.1 + ISO 13485 Clause 4.2",
            "description": "All required regulatory documents must exist: SDP, SRS, SAD, RMF, test plans, SOUP list, release procedures, and more.",
            "score": doc_pct,
            "status": "pass" if doc_pct >= 80 else "warn" if doc_pct >= 60 else "fail",
            "evidence": doc_evidence,
            "summary": f"{total_found}/{total_expected} required documents present",
            "action": None if doc_pct == 100 else "Create missing regulatory documents",
        })

        # 6. Doc Freshness
        freshness_pct = self._check_doc_freshness()
        checks.append({
            "id": "doc_freshness",
            "title": "Document Freshness",
            "standard": "ISO 13485 Clause 4.2.4",
            "description": "Regulatory documents must be kept current. Documents older than 90 days may not reflect the current state of the software.",
            "score": freshness_pct,
            "status": "pass" if freshness_pct >= 80 else "warn" if freshness_pct >= 60 else "fail",
            "evidence": [{"file": "Commit history", "github_url": f"https://github.com/{self.github.repo}/commits/main", "detail": f"Documentation activity score: {freshness_pct:.0f}%", "status": "protected" if freshness_pct >= 80 else "unprotected"}],
            "summary": f"Documentation activity: {freshness_pct:.0f}% (based on recent doc-related commits)",
            "action": None if freshness_pct >= 80 else "Review and update documents older than 90 days",
        })

        # 7. SOUP Vulnerability
        soup_pct = self._check_soup_status()
        sbom_exists = self.github.file_exists("docs/iec62304/SBOM_CycloneDX.json")
        reviews = self._list_dir("docs/iec62304/records/soup_reviews")
        has_reviews = any(r["name"].endswith(".md") for r in reviews) if reviews else False
        checks.append({
            "id": "soup_vulnerability",
            "title": "SOUP / Dependency Security",
            "standard": "IEC 81001-5-1 Clause 5.3.11-12 + IEC 62304 Clause 8",
            "description": "All third-party software (SOUP) must be inventoried, version-pinned, and monitored for known vulnerabilities (CVEs).",
            "score": soup_pct,
            "status": "pass" if soup_pct >= 80 else "warn" if soup_pct >= 60 else "fail",
            "evidence": [
                {"file": "SBOM_CycloneDX.json", "github_url": f"{github_base}/docs/iec62304/SBOM_CycloneDX.json", "detail": "SBOM exists" if sbom_exists else "SBOM missing", "status": "protected" if sbom_exists else "unprotected"},
                {"file": "soup_reviews/", "github_url": f"{github_base}/docs/iec62304/records/soup_reviews", "detail": "SOUP reviews exist" if has_reviews else "No SOUP review records", "status": "protected" if has_reviews else "unprotected"},
            ],
            "summary": f"SOUP management: {soup_pct:.0f}% (SBOM: {'yes' if sbom_exists else 'no'}, Reviews: {'yes' if has_reviews else 'no'})",
            "action": None if soup_pct >= 90 else "Generate SBOM and complete SOUP vulnerability reviews",
        })

        # 8. CODEOWNERS
        co_content = self._read_file(".github/CODEOWNERS")
        co_modules = ["ai_segmentation_service.py", "brain_volumetry_service.py", "brain_report_service.py",
                       "lesion_analysis_service.py", "ms_region_classifier.py", "nifti_utils.py", "dicom_utils.py", "edgeAI.worker.ts"]
        co_evidence = []
        co_covered = 0
        for m in co_modules:
            found = co_content and m in co_content
            if found:
                co_covered += 1
            co_evidence.append({
                "file": m,
                "github_url": f"{github_base}/backend/app/services/{m}" if ".py" in m else f"{github_base}/frontend/src/workers/{m}",
                "detail": "Listed in CODEOWNERS (code review required)" if found else "Not in CODEOWNERS",
                "status": "protected" if found else "unprotected",
            })
        co_pct = (co_covered / len(co_modules)) * 100
        checks.append({
            "id": "codeowners_coverage",
            "title": "CODEOWNERS Code Review Enforcement",
            "standard": "IEC 62304 Clause 5.5.3 + Clause 8.2",
            "description": "Class C modules must be listed in CODEOWNERS to enforce mandatory code review before any change can be merged.",
            "score": co_pct,
            "status": "pass" if co_pct >= 80 else "warn" if co_pct >= 60 else "fail",
            "evidence": co_evidence,
            "github_url": f"{github_base}/.github/CODEOWNERS",
            "summary": f"{co_covered}/{len(co_modules)} Class C modules in CODEOWNERS",
            "action": None if co_pct == 100 else "Add missing modules to .github/CODEOWNERS",
        })

        # Compute scores
        breakdown = {c["id"]: c["score"] for c in checks}
        iec62304 = breakdown["test_coverage"]*0.25 + breakdown["risk_verification"]*0.20 + breakdown["doc_completeness"]*0.20 + breakdown["input_validation"]*0.15 + breakdown["auth_coverage"]*0.10 + breakdown["codeowners_coverage"]*0.10
        iso13485 = breakdown["doc_completeness"]*0.30 + breakdown["doc_freshness"]*0.20 + breakdown["risk_verification"]*0.20 + breakdown["test_coverage"]*0.15 + breakdown["codeowners_coverage"]*0.15
        cybersecurity = breakdown["auth_coverage"]*0.30 + breakdown["input_validation"]*0.25 + breakdown["soup_vulnerability"]*0.25 + breakdown["codeowners_coverage"]*0.20
        ce_mark = iec62304*0.35 + iso13485*0.30 + cybersecurity*0.20 + breakdown["doc_completeness"]*0.15

        return {
            "computed_at": datetime.now(timezone.utc).isoformat(),
            "scores": {
                "iec62304": round(iec62304, 1),
                "iso13485": round(iso13485, 1),
                "cybersecurity": round(cybersecurity, 1),
                "ce_mark_overall": round(ce_mark, 1),
            },
            "breakdown": {c["id"]: round(c["score"], 1) for c in checks},
            "checks": checks,
            "repo": f"https://github.com/{self.github.repo}",
        }

    # ─── Private analysis methods ───

    def _check_auth_coverage(self) -> float:
        detail = self.get_auth_coverage_detail()
        return detail["coverage_pct"]

    def _check_input_validation(self) -> float:
        class_c_paths = [
            "backend/app/services/brain_volumetry_service.py",
            "backend/app/services/lesion_analysis_service.py",
            "backend/app/services/ms_region_classifier.py",
            "backend/app/utils/nifti_utils.py",
            "backend/app/utils/dicom_utils.py",
        ]
        validated = 0
        for path in class_c_paths:
            content = self._read_file(path)
            if content and ("REQ-SAFE-005" in content or "raise ValueError" in content):
                validated += 1
        return (validated / len(class_c_paths)) * 100 if class_c_paths else 0

    def _check_test_coverage(self) -> float:
        modules = [
            "ai_segmentation_service", "brain_volumetry_service", "brain_report_service",
            "lesion_analysis_service", "ms_region_classifier", "nifti_utils", "dicom_utils", "dicom_seg",
        ]
        test_files = self._list_dir("backend/tests/unit")
        if not test_files:
            return 0
        test_names = [f["name"].replace(".py", "") for f in test_files if f["name"].startswith("test_")]
        covered = sum(1 for m in modules if f"test_{m}" in test_names)
        return (covered / len(modules)) * 100

    def _check_risk_verification(self) -> float:
        records = self._list_dir("docs/iec62304/records/risk_verification")
        if not records:
            return 0
        md_records = [r for r in records if r["name"].endswith(".md")]
        if not md_records:
            return 0
        latest = sorted(md_records, key=lambda x: x["name"])[-1]
        content = self._read_file(latest["path"])
        if not content:
            return 0
        verified = content.count("VERIFIED")
        partial = content.count("PARTIAL")
        total = verified + partial
        return (verified / total) * 100 if total > 0 else 0

    def _check_doc_completeness(self) -> float:
        expected = {"iec62304": 15, "qms": 8, "clinical": 3, "usability": 1, "mdr": 5, "ai-act": 1}
        total_expected = sum(expected.values())
        total_found = 0
        for subdir, exp in expected.items():
            files = self._list_dir(f"docs/{subdir}")
            md_count = len([f for f in files if f["name"].endswith(".md")])
            total_found += min(md_count, exp)
        return (total_found / total_expected) * 100

    def _check_doc_freshness(self) -> float:
        # With GitHub API we can't easily get file modification times
        # Use commits API to check recent doc changes
        commits = self.github.get_recent_commits(100)
        if not commits:
            return 50.0  # Default if no access

        recent_doc_commits = 0
        for c in commits:
            msg = c["message"].lower()
            if "doc" in msg or "compliance" in msg or "iec" in msg or "iso" in msg:
                recent_doc_commits += 1

        # Score based on documentation activity
        if recent_doc_commits >= 10:
            return 90.0
        elif recent_doc_commits >= 5:
            return 75.0
        elif recent_doc_commits >= 2:
            return 60.0
        return 40.0

    def _check_soup_status(self) -> float:
        sbom_exists = self.github.file_exists("docs/iec62304/SBOM_CycloneDX.json")
        reviews = self._list_dir("docs/iec62304/records/soup_reviews")
        has_reviews = any(r["name"].endswith(".md") for r in reviews) if reviews else False

        if sbom_exists and has_reviews:
            return 90.0
        elif sbom_exists:
            return 70.0
        return 50.0

    def _check_codeowners(self) -> float:
        content = self._read_file(".github/CODEOWNERS")
        if not content:
            return 0
        modules = [
            "ai_segmentation_service.py", "brain_volumetry_service.py", "brain_report_service.py",
            "lesion_analysis_service.py", "ms_region_classifier.py", "nifti_utils.py",
            "dicom_utils.py", "edgeAI.worker.ts",
        ]
        covered = sum(1 for m in modules if m in content)
        return (covered / len(modules)) * 100