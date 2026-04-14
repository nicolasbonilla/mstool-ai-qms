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
        """List all regulatory documents with metadata."""
        documents = []
        for subdir in ["iec62304", "qms", "clinical", "usability", "mdr", "ai-act"]:
            md_files = self._list_md_files(f"docs/{subdir}")
            for md in sorted(md_files, key=lambda x: x["name"]):
                documents.append({
                    "path": md["path"],
                    "doc_id": md["name"].split("_")[0] if "_" in md["name"] else md["name"].replace(".md", ""),
                    "title": md["name"].replace(".md", "").replace("_", " "),
                    "standard": subdir,
                    "lines": md.get("size", 0) // 40,  # Approximate lines from size
                    "freshness": "green",  # Will be computed from git blame later
                })
        return documents

    def get_test_inventory(self) -> List[Dict[str, Any]]:
        """List all test files with metadata."""
        all_files = self._list_dir("backend/tests/unit")
        result = []
        for item in sorted(all_files, key=lambda x: x["name"]):
            if not item["name"].startswith("test_") or not item["name"].endswith(".py"):
                continue
            content = self._read_file(item["path"])
            if content:
                test_count = len(re.findall(r"def test_\w+", content))
                result.append({
                    "file": item["name"],
                    "lines": content.count("\n") + 1,
                    "test_count": test_count,
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