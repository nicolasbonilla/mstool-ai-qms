"""
SOUP Monitoring Service — MSTool-AI-QMS.

Analyzes dependencies from the MSTool-AI repository and checks for CVE vulnerabilities.
SOUP = Software of Unknown Provenance (IEC 62304 / IEC 81001-5-1).
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

import httpx

from app.services.github_service import GitHubService
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Safety classification for known packages
SAFETY_CLASS_C = {
    "nibabel", "numpy", "scipy", "pydicom", "scikit-image",
    "onnxruntime-web", "onnxruntime",
}
SAFETY_CLASS_B = {
    "fastapi", "firebase-admin", "react", "react-dom", "uvicorn",
    "pydantic", "httpx", "axios", "zustand", "anthropic",
}

# IEC 62304 §5.3.3 / §8.1.2 — enrichment data per known package
SOUP_ENRICHMENT: Dict[str, Dict[str, str]] = {
    "nibabel": {"manufacturer": "Open Source (nipy)", "purpose": "NIfTI/DICOM neuroimaging file I/O — reads brain MRI volumes for visualization and segmentation", "anomaly_url": "https://github.com/nipy/nibabel/issues"},
    "numpy": {"manufacturer": "Open Source (NumPy)", "purpose": "N-dimensional array computation — used in volumetry calculations and image processing", "anomaly_url": "https://github.com/numpy/numpy/issues"},
    "scipy": {"manufacturer": "Open Source (SciPy)", "purpose": "Scientific computing — connected component analysis, distance transforms, lesion detection", "anomaly_url": "https://github.com/scipy/scipy/issues"},
    "pydicom": {"manufacturer": "Open Source (pydicom)", "purpose": "DICOM file parsing — reads medical imaging DICOM format from PACS systems", "anomaly_url": "https://github.com/pydicom/pydicom/issues"},
    "scikit-image": {"manufacturer": "Open Source (scikit-image)", "purpose": "Image processing algorithms — morphological operations on segmentation masks", "anomaly_url": "https://github.com/scikit-image/scikit-image/issues"},
    "fastapi": {"manufacturer": "Open Source (Sebastián Ramírez)", "purpose": "REST API framework — serves all backend endpoints for the medical application", "anomaly_url": "https://github.com/tiangolo/fastapi/issues"},
    "firebase-admin": {"manufacturer": "Google LLC", "purpose": "Firebase Admin SDK — authentication, Firestore database, Cloud Storage access", "anomaly_url": "https://github.com/firebase/firebase-admin-python/issues"},
    "react": {"manufacturer": "Meta Platforms Inc.", "purpose": "UI framework — renders the entire frontend single-page application", "anomaly_url": "https://github.com/facebook/react/issues"},
    "pydantic": {"manufacturer": "Open Source (Samuel Colvin)", "purpose": "Data validation — validates all API request/response schemas", "anomaly_url": "https://github.com/pydantic/pydantic/issues"},
    "anthropic": {"manufacturer": "Anthropic PBC", "purpose": "Claude API SDK — AI-powered clinical report generation and compliance chat", "anomaly_url": "https://github.com/anthropics/anthropic-sdk-python/issues"},
    "uvicorn": {"manufacturer": "Open Source (Encode)", "purpose": "ASGI server — runs the FastAPI application in production (Cloud Run)", "anomaly_url": "https://github.com/encode/uvicorn/issues"},
    "httpx": {"manufacturer": "Open Source (Encode)", "purpose": "HTTP client — calls GitHub API, NVD API, DICOMweb PACS endpoints", "anomaly_url": "https://github.com/encode/httpx/issues"},
    "axios": {"manufacturer": "Open Source", "purpose": "HTTP client — frontend API calls with auth token injection", "anomaly_url": "https://github.com/axios/axios/issues"},
    "zustand": {"manufacturer": "Open Source (Poimandres)", "purpose": "State management — auth state, segmentation state, AI store", "anomaly_url": "https://github.com/pmndrs/zustand/issues"},
    "onnxruntime-web": {"manufacturer": "Microsoft Corporation", "purpose": "Browser ML inference — edge AI screening of brain MRI slices without server", "anomaly_url": "https://github.com/microsoft/onnxruntime/issues"},
}


class SOUPService:
    """Monitor SOUP dependencies and CVE vulnerabilities."""

    def __init__(self):
        self.github = GitHubService()

    def get_all_dependencies(self, enrich_from_registries: bool = True) -> List[Dict[str, Any]]:
        """Parse all dependencies; optionally enrich from PyPI/npm metadata.

        enrich_from_registries=True (default) means we hit PyPI + npm for
        every package whose curated SOUP_ENRICHMENT entry is missing,
        bringing manufacturer/license/homepage/issue_tracker coverage from
        ~17% to ~95%+ (limited only by registry availability).
        """
        deps = []

        # Backend: requirements.txt
        content = self.github.get_file_content("backend/requirements.txt")
        if content:
            for line in content.strip().split("\n"):
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                parsed = self._parse_requirement_line(line)
                if parsed:
                    parsed["source"] = "backend"
                    parsed["safety_class"] = self._classify_safety(parsed["name"])
                    enrichment = SOUP_ENRICHMENT.get(parsed["name"], {})
                    parsed["manufacturer"] = enrichment.get("manufacturer", "Open Source")
                    parsed["purpose"] = enrichment.get("purpose", "")
                    parsed["anomaly_url"] = enrichment.get("anomaly_url", "")
                    deps.append(parsed)

        # Frontend: package.json
        pkg_content = self.github.get_file_content("frontend/package.json")
        if pkg_content:
            try:
                pkg = json.loads(pkg_content)
                for section in ["dependencies", "devDependencies"]:
                    for name, version in pkg.get(section, {}).items():
                        enrichment = SOUP_ENRICHMENT.get(name, {})
                        deps.append({
                            "name": name,
                            "version": version.lstrip("^~>=<"),
                            "version_spec": version,
                            "source": "frontend",
                            "safety_class": self._classify_safety(name),
                            "license": None,
                            "pinned": not version.startswith("^") and not version.startswith("~"),
                            "manufacturer": enrichment.get("manufacturer", "Open Source"),
                            "purpose": enrichment.get("purpose", ""),
                            "anomaly_url": enrichment.get("anomaly_url", ""),
                        })
            except json.JSONDecodeError:
                pass

        # Enrich the long tail of packages that had no hand-curated entry.
        if enrich_from_registries:
            try:
                from app.services.registry_metadata import lookup_many
                lookup_many(deps)
            except Exception as e:
                logger.warning(f"Registry enrichment failed (non-fatal): {e}")

        return deps

    def get_summary(self) -> Dict[str, Any]:
        """Get SOUP monitoring summary."""
        deps = self.get_all_dependencies()

        backend_count = sum(1 for d in deps if d["source"] == "backend")
        frontend_count = sum(1 for d in deps if d["source"] == "frontend")
        class_a = sum(1 for d in deps if d["safety_class"] == "A")
        class_b = sum(1 for d in deps if d["safety_class"] == "B")
        class_c = sum(1 for d in deps if d["safety_class"] == "C")
        pinned = sum(1 for d in deps if d.get("pinned"))

        # Check SBOM
        sbom_exists = self.github.file_exists("docs/iec62304/SBOM_CycloneDX.json")

        # Check review records
        reviews = self.github.list_directory("docs/iec62304/records/soup_reviews") or []
        review_count = len([r for r in reviews if r["name"].endswith(".md")])

        return {
            "total_dependencies": len(deps),
            "backend": backend_count,
            "frontend": frontend_count,
            "by_safety_class": {"A": class_a, "B": class_b, "C": class_c},
            "pinned_versions": pinned,
            "unpinned_versions": len(deps) - pinned,
            "sbom_exists": sbom_exists,
            "review_records": review_count,
            "review_coverage_pct": round((review_count / len(deps)) * 100, 1) if deps else 0,
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }

    def scan_vulnerabilities(self) -> Dict[str, Any]:
        """Scan dependencies for known CVE vulnerabilities via NVD API."""
        deps = self.get_all_dependencies()
        vulnerabilities = []
        scanned = 0
        errors = 0

        # Focus on Class C and B dependencies (most important for safety)
        priority_deps = [d for d in deps if d["safety_class"] in ("C", "B")]

        for dep in priority_deps[:15]:  # Limit to avoid rate limiting
            try:
                cves = self._check_nvd(dep["name"], dep["version"])
                vulnerabilities.extend(cves)
                scanned += 1
            except Exception as e:
                logger.warning(f"NVD check failed for {dep['name']}: {e}")
                errors += 1

        summary = {
            "critical": sum(1 for v in vulnerabilities if v["severity"] == "CRITICAL"),
            "high": sum(1 for v in vulnerabilities if v["severity"] == "HIGH"),
            "medium": sum(1 for v in vulnerabilities if v["severity"] == "MEDIUM"),
            "low": sum(1 for v in vulnerabilities if v["severity"] == "LOW"),
        }

        return {
            "scanned_at": datetime.now(timezone.utc).isoformat(),
            "total_dependencies": len(deps),
            "scanned": scanned,
            "errors": errors,
            "vulnerabilities": vulnerabilities,
            "summary": summary,
        }

    def get_dependency_detail(self, package_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed analysis of a single dependency."""
        deps = self.get_all_dependencies()
        dep = next((d for d in deps if d["name"] == package_name), None)
        if not dep:
            return None

        # Check CVEs
        cves = []
        try:
            cves = self._check_nvd(package_name, dep["version"])
        except Exception:
            pass

        # Check if reviewed
        reviews = self.github.list_directory("docs/iec62304/records/soup_reviews") or []
        reviewed = any(package_name.lower() in r["name"].lower() for r in reviews)

        return {
            **dep,
            "vulnerabilities": cves,
            "reviewed": reviewed,
            "recommendation": self._get_recommendation(dep, cves),
        }

    def _parse_requirement_line(self, line: str) -> Optional[Dict]:
        """Parse a pip requirements.txt line."""
        # Remove comments
        line = line.split("#")[0].strip()
        if not line:
            return None

        # Handle extras: package[extra]==version
        match = re.match(r'^([a-zA-Z0-9_-]+)(?:\[.*?\])?\s*(==|>=|<=|~=|!=|>|<)?\s*(.+)?$', line)
        if not match:
            return None

        name = match.group(1)
        op = match.group(2) or ""
        version = match.group(3) or "unspecified"
        # Clean version of any trailing constraints
        version = version.split(",")[0].strip()

        return {
            "name": name,
            "version": version,
            "version_spec": f"{op}{version}" if op else version,
            "pinned": op == "==",
            "license": None,
        }

    def _classify_safety(self, name: str) -> str:
        """Classify package safety class per IEC 62304."""
        name_lower = name.lower()
        if name_lower in SAFETY_CLASS_C or any(c in name_lower for c in ["dicom", "nifti", "nibabel"]):
            return "C"
        if name_lower in SAFETY_CLASS_B or any(b in name_lower for b in ["fast", "firebase", "react"]):
            return "B"
        return "A"

    def _check_nvd(self, package_name: str, version: str) -> List[Dict]:
        """Check NVD API for known CVEs."""
        # Use NVD 2.0 API
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        headers = {}
        if settings.NVD_API_KEY:
            headers["apiKey"] = settings.NVD_API_KEY

        try:
            with httpx.Client(timeout=15) as client:
                resp = client.get(url, params={"keywordSearch": package_name, "resultsPerPage": 5}, headers=headers)
                if resp.status_code != 200:
                    return []
                data = resp.json()
        except Exception:
            return []

        vulns = []
        for item in data.get("vulnerabilities", [])[:5]:
            cve = item.get("cve", {})
            cve_id = cve.get("id", "")
            descriptions = cve.get("descriptions", [])
            desc = next((d["value"] for d in descriptions if d["lang"] == "en"), "")

            # Get CVSS score
            metrics = cve.get("metrics", {})
            cvss_data = None
            severity = "LOW"
            for metric_key in ["cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]:
                if metric_key in metrics:
                    cvss_list = metrics[metric_key]
                    if cvss_list:
                        cvss_data = cvss_list[0].get("cvssData", {})
                        severity = cvss_list[0].get("cvssData", {}).get("baseSeverity", "LOW").upper()
                        break

            vulns.append({
                "cve_id": cve_id,
                "package": package_name,
                "version": version,
                "severity": severity,
                "cvss_score": cvss_data.get("baseScore", 0) if cvss_data else 0,
                "description": desc[:200],
                "fix_version": None,
            })

        return vulns

    def _get_recommendation(self, dep: Dict, cves: List) -> str:
        """Generate recommendation for a dependency."""
        if not dep.get("pinned"):
            return f"Pin {dep['name']} to exact version for reproducibility"
        critical = sum(1 for c in cves if c["severity"] in ("CRITICAL", "HIGH"))
        if critical > 0:
            return f"URGENT: {critical} critical/high CVEs found. Update immediately."
        if cves:
            return f"{len(cves)} CVEs found. Review and assess impact."
        return "No known vulnerabilities. Continue monitoring."