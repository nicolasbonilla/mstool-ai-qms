"""
Compliance Score Engine — MSTool-AI-QMS.

Analyzes the MSTool-AI repository to compute real-time compliance scores.
Reads code, tests, documents, and configuration from the target repo.

Scores computed:
- IEC 62304 (software lifecycle)
- ISO 13485 (quality management)
- IEC 81001-5-1 (cybersecurity)
- CE Mark overall readiness
"""

import re
import json
from datetime import datetime
from typing import Dict, List, Any
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


class ComplianceService:
    """Compute compliance scores by analyzing the MSTool-AI repo."""

    def __init__(self, repo_path: str = ""):
        self.repo_path = Path(repo_path or settings.MSTOOL_AI_REPO_PATH)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path not found: {self.repo_path}")

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
            "computed_at": datetime.utcnow().isoformat(),
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
        routes_dir = self.repo_path / "backend" / "app" / "api" / "routes"
        if not routes_dir.exists():
            return {"files": [], "total_endpoints": 0, "protected": 0, "coverage_pct": 0}

        files = []
        total = 0
        protected = 0

        for py_file in sorted(routes_dir.glob("*.py")):
            if py_file.name.startswith("__"):
                continue
            content = py_file.read_text(encoding="utf-8")
            endpoints = len(re.findall(r"async def \w+\(", content))
            has_import = "get_current_active_user" in content
            auth_count = max(0, content.count("get_current_active_user") - (1 if has_import else 0))

            files.append({
                "file": py_file.name,
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
        docs_root = self.repo_path / "docs"
        documents = []
        for subdir in ["iec62304", "qms", "clinical", "usability", "mdr", "ai-act"]:
            doc_dir = docs_root / subdir
            if not doc_dir.exists():
                continue
            for md in sorted(doc_dir.glob("*.md")):
                stat = md.stat()
                days_old = (datetime.utcnow() - datetime.fromtimestamp(stat.st_mtime)).days
                freshness = "green" if days_old <= 30 else "yellow" if days_old <= 90 else "red"
                lines = sum(1 for _ in open(md, encoding="utf-8"))
                documents.append({
                    "path": f"docs/{subdir}/{md.name}",
                    "doc_id": md.stem.split("_")[0] if "_" in md.stem else md.stem,
                    "title": md.stem.replace("_", " "),
                    "standard": subdir,
                    "last_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "lines": lines,
                    "freshness": freshness,
                })
        return documents

    def get_test_inventory(self) -> List[Dict[str, Any]]:
        """List all test files with metadata."""
        tests_dir = self.repo_path / "backend" / "tests" / "unit"
        if not tests_dir.exists():
            return []
        result = []
        for tf in sorted(tests_dir.glob("test_*.py")):
            content = tf.read_text(encoding="utf-8")
            test_count = len(re.findall(r"def test_\w+", content))
            result.append({
                "file": tf.name,
                "lines": sum(1 for _ in open(tf, encoding="utf-8")),
                "test_count": test_count,
            })
        return result

    # ─── Private analysis methods ───

    def _check_auth_coverage(self) -> float:
        detail = self.get_auth_coverage_detail()
        return detail["coverage_pct"]

    def _check_input_validation(self) -> float:
        class_c = [
            self.repo_path / "backend" / "app" / "services" / "brain_volumetry_service.py",
            self.repo_path / "backend" / "app" / "services" / "lesion_analysis_service.py",
            self.repo_path / "backend" / "app" / "services" / "ms_region_classifier.py",
            self.repo_path / "backend" / "app" / "utils" / "nifti_utils.py",
            self.repo_path / "backend" / "app" / "utils" / "dicom_utils.py",
        ]
        validated = 0
        for f in class_c:
            if f.exists():
                content = f.read_text(encoding="utf-8")
                if "REQ-SAFE-005" in content or "raise ValueError" in content:
                    validated += 1
        return (validated / len(class_c)) * 100 if class_c else 0

    def _check_test_coverage(self) -> float:
        modules = ["ai_segmentation_service", "brain_volumetry_service", "brain_report_service",
                    "lesion_analysis_service", "ms_region_classifier", "nifti_utils", "dicom_utils", "dicom_seg"]
        tests_dir = self.repo_path / "backend" / "tests" / "unit"
        if not tests_dir.exists():
            return 0
        test_files = [f.stem for f in tests_dir.glob("test_*.py")]
        covered = sum(1 for m in modules if f"test_{m}" in test_files)
        return (covered / len(modules)) * 100

    def _check_risk_verification(self) -> float:
        rcv_dir = self.repo_path / "docs" / "iec62304" / "records" / "risk_verification"
        if not rcv_dir.exists():
            return 0
        records = list(rcv_dir.glob("*.md"))
        if not records:
            return 0
        content = sorted(records)[-1].read_text(encoding="utf-8")
        verified = content.count("VERIFIED")
        partial = content.count("PARTIAL")
        total = verified + partial
        return (verified / total) * 100 if total > 0 else 0

    def _check_doc_completeness(self) -> float:
        expected = {"iec62304": 15, "qms": 8, "clinical": 3, "usability": 1, "mdr": 5, "ai-act": 1}
        total_expected = sum(expected.values())
        total_found = 0
        for subdir, exp in expected.items():
            doc_dir = self.repo_path / "docs" / subdir
            if doc_dir.exists():
                total_found += min(len(list(doc_dir.glob("*.md"))), exp)
        return (total_found / total_expected) * 100

    def _check_doc_freshness(self) -> float:
        total = 0
        fresh = 0
        for subdir in ["iec62304", "qms", "clinical", "usability", "mdr", "ai-act"]:
            doc_dir = self.repo_path / "docs" / subdir
            if not doc_dir.exists():
                continue
            for md in doc_dir.glob("*.md"):
                total += 1
                days = (datetime.utcnow() - datetime.fromtimestamp(md.stat().st_mtime)).days
                if days <= 90:
                    fresh += 1
        return (fresh / total) * 100 if total > 0 else 0

    def _check_soup_status(self) -> float:
        sbom = self.repo_path / "docs" / "iec62304" / "SBOM_CycloneDX.json"
        reviews = self.repo_path / "docs" / "iec62304" / "records" / "soup_reviews"
        if sbom.exists() and reviews.exists() and list(reviews.glob("*.md")):
            return 90.0
        elif sbom.exists():
            return 70.0
        return 50.0

    def _check_codeowners(self) -> float:
        co = self.repo_path / ".github" / "CODEOWNERS"
        if not co.exists():
            return 0
        content = co.read_text(encoding="utf-8")
        modules = ["ai_segmentation_service.py", "brain_volumetry_service.py", "brain_report_service.py",
                    "lesion_analysis_service.py", "ms_region_classifier.py", "nifti_utils.py",
                    "dicom_utils.py", "edgeAI.worker.ts"]
        covered = sum(1 for m in modules if m in content)
        return (covered / len(modules)) * 100
