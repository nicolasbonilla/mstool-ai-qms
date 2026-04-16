"""
SaMD-specific safety pattern scanner — Phase 6 (our white-space #3).

The competitors above are device-agnostic. Our medical device IS a brain
MRI segmentation pipeline. We can write rules that competitors physically
cannot ship, because their tools don't know NIfTI from DICOM from voxels.

Approach: regex-based static checks (Semgrep-style) over the medical
device repo, focused on patterns that have been root-cause for actual
medical-imaging incidents:

1) NIfTI/DICOM input read without exception handling around malformed files
2) Voxel index access without bounds checking
3) Float division on segmentation masks without zero-check
4) DICOM PHI access without de-identification call upstream
5) ONNX model load without hash verification (supply-chain integrity)
6) Numpy operations on Class C path that lack dtype assertion

Each rule cites the IEC 62304 / ISO 14971 clause it satisfies and the
hazard ID(s) it relates to in our existing RMF.

Reference: Snyk DeepCode AI Fix; GitHub Copilot Autofix; Semgrep AI;
plus medical-imaging incident reports from FDA MAUDE database.
"""

import re
from datetime import datetime, timezone
from typing import Dict, List

from app.services.github_service import GitHubService


CLASS_C_PATHS = [
    "backend/app/services/ai_segmentation_service.py",
    "backend/app/services/brain_volumetry_service.py",
    "backend/app/services/brain_report_service.py",
    "backend/app/services/lesion_analysis_service.py",
    "backend/app/services/ms_region_classifier.py",
    "backend/app/utils/nifti_utils.py",
    "backend/app/utils/dicom_utils.py",
]


# Each rule: (name, pattern, severity, standard, why, fix)
# Patterns are intentionally lenient — false positives are reviewed by humans.
RULES: List[Dict] = [
    {
        "name": "nifti_load_without_try",
        "pattern": r"nib\.load\(",
        "exclude_pattern": r"try:.{0,500}nib\.load",
        "multiline": True,
        "severity": "warning",
        "standard": "IEC 62304 §5.3.6",
        "why": "Reading a malformed NIfTI must not crash the process; wrap in try/except",
        "fix": "Surround with try/except and log to RMF anomaly tracker (HAZ-002)",
    },
    {
        "name": "dicom_read_without_try",
        "pattern": r"pydicom\.dcmread\(",
        "exclude_pattern": r"try:.{0,500}pydicom\.dcmread",
        "multiline": True,
        "severity": "warning",
        "standard": "IEC 62304 §5.3.6",
        "why": "Malformed DICOM must not crash the process",
        "fix": "Wrap in try/except + raise a controlled DICOMReadError",
    },
    {
        "name": "voxel_index_without_bounds_check",
        "pattern": r"\[\s*[a-z_]+\s*,\s*[a-z_]+\s*,\s*[a-z_]+\s*\]",
        "exclude_pattern": r"if\s+0\s*<=",
        "multiline": False,
        "severity": "info",
        "standard": "REQ-SAFE-005",
        "why": "Direct 3-D voxel indexing should be bounds-checked when index source is dynamic",
        "fix": "Add `if not (0 <= x < shape[0] and ...): raise ValueError` upstream",
    },
    {
        "name": "division_no_zero_guard",
        "pattern": r"\bnumerator\b.+/\s*\bdenominator\b|/\s*np\.sum\(",
        "exclude_pattern": r"if\s+np\.sum",
        "multiline": False,
        "severity": "warning",
        "standard": "IEC 62304 §5.3 + ISO 14971",
        "why": "Empty mask sums lead to NaN volumetry — patient-relevant bug",
        "fix": "Guard with if denominator == 0: return 0.0",
    },
    {
        "name": "onnx_load_without_hash_check",
        "pattern": r"InferenceSession\(",
        "exclude_pattern": r"sha256|hashlib",
        "multiline": True,
        "severity": "warning",
        "standard": "IEC 81001-5-1 §5.7",
        "why": "Loading an ONNX model without integrity check exposes supply-chain risk",
        "fix": "Verify SHA-256 of the .onnx file against a pinned hash before loading",
    },
    {
        "name": "phi_field_accessed_without_deid",
        "pattern": r"\.PatientName|\.PatientID|\.PatientBirthDate",
        "exclude_pattern": r"deidentif|anonymiz",
        "multiline": True,
        "severity": "warning",
        "standard": "21 CFR Part 11 §11.10(d) + GDPR Art. 32",
        "why": "PHI access must be downstream of de-identification",
        "fix": "Route PHI access through the de-identification helper",
    },
    {
        "name": "numpy_op_no_dtype_check",
        "pattern": r"np\.(zeros|ones|empty)\(",
        "exclude_pattern": r"dtype\s*=",
        "multiline": False,
        "severity": "info",
        "standard": "IEC 62304 §5.3 (defensive Class C coding)",
        "why": "Implicit dtype may differ across numpy versions; pin explicitly",
        "fix": "Pass dtype= explicitly (uint8 for masks, float32 for volumes)",
    },
]


def _scan_file(path: str, content: str) -> List[Dict]:
    """Apply every rule to a single file's content."""
    findings = []
    for rule in RULES:
        flags = re.MULTILINE | re.DOTALL if rule.get("multiline") else 0
        for m in re.finditer(rule["pattern"], content, flags):
            # Get line number
            line_num = content[:m.start()].count("\n") + 1
            line_text = content.splitlines()[line_num - 1].strip() if line_num <= len(content.splitlines()) else ""
            # Apply exclude window (±200 chars)
            if rule.get("exclude_pattern"):
                window_start = max(0, m.start() - 250)
                window_end = min(len(content), m.end() + 250)
                window = content[window_start:window_end]
                if re.search(rule["exclude_pattern"], window, flags):
                    continue
            findings.append({
                "rule": rule["name"],
                "severity": rule["severity"],
                "standard": rule["standard"],
                "why": rule["why"],
                "fix": rule["fix"],
                "file": path,
                "line": line_num,
                "snippet": line_text[:200],
            })
    return findings


def scan_samd_repo() -> Dict:
    """Scan all Class C paths in the medical device repo for safety patterns."""
    gh = GitHubService()
    all_findings: List[Dict] = []
    files_scanned = 0

    for path in CLASS_C_PATHS:
        content = gh.get_file_content(path)
        if not content:
            continue
        files_scanned += 1
        all_findings.extend(_scan_file(path, content))

    by_severity = {"warning": 0, "info": 0}
    for f in all_findings:
        by_severity[f["severity"]] = by_severity.get(f["severity"], 0) + 1

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "files_scanned": files_scanned,
        "rules_applied": len(RULES),
        "findings_count": len(all_findings),
        "by_severity": by_severity,
        "findings": all_findings[:200],
    }
