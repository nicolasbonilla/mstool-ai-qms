"""
Predictive Service — Phase 6.

Predicts audit outcomes and change impact BEFORE they happen:

1) Clause-Level Failure Predictor — for each IEC 62304 clause, estimate
   P(fail) based on current repo features (test coverage, REQ density,
   CODEOWNERS, recency of documentation, etc.). Uses a simple interpretable
   logistic-like rule set for now (and is designed to be replaced with an
   XGBoost model once we have training labels from real audit history).

2) Change Impact Analyzer — given a commit or a set of commits, identifies
   which requirements, hazards, tests, and docs are transitively affected.
   Uses the existing traceability graph + file-path matching.

3) Feature attribution — every "gap penalty" on the dashboard carries an
   explanation: "Class C module touched: -8.2pts; missing REQ-ID in commit
   msg: -3.1pts." (SHAP-inspired, not full Shapley values — interpretable
   rule-based decomposition is auditable without the TreeExplainer layer.)

Research references:
- LApredict / JIT-BERT (bug-prediction baselines) — ISSTA'21
- ProReFiCIA (arXiv 2511.00262) — LLM change-impact analysis
- HGNNLink (2025) — heterogeneous GNN for traceability link recovery
- DORA 2025 — DevOps reliability metrics
- SHAP (Lundberg & Lee, 2017) — used conceptually for waterfall UX
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.services.github_service import GitHubService
from app.services.compliance_service import ComplianceService
from app.services.traceability_service import TraceabilityService

logger = logging.getLogger(__name__)


# Class C paths (duplicated from agents.pr_reviewer_agent for auditability).
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


# ═══════════════════════════════════════════════════════════════
# 1) Clause-level failure prediction
# ═══════════════════════════════════════════════════════════════

# Feature-weighted rules. Each clause has heuristics that push P(fail) up
# or down. The coefficients are hand-tuned; they're replaceable with a
# trained logistic regression once we have audit labels.
CLAUSE_RULES: List[Dict[str, Any]] = [
    # 5.5 Unit Implementation & Verification
    {
        "clause": "5.5", "title": "Unit Implementation & Verification",
        "inputs": ["test_coverage", "codeowners_coverage"],
        "threshold_pass": 85.0,
        "weights": {"test_coverage": 0.7, "codeowners_coverage": 0.3},
    },
    # 5.6 Software Integration Testing
    {
        "clause": "5.6", "title": "Software Integration Testing",
        "inputs": ["test_coverage"],
        "threshold_pass": 80.0,
        "weights": {"test_coverage": 1.0},
    },
    # 5.7 Software System Testing
    {
        "clause": "5.7", "title": "Software System Testing",
        "inputs": ["test_coverage", "doc_completeness"],
        "threshold_pass": 80.0,
        "weights": {"test_coverage": 0.6, "doc_completeness": 0.4},
    },
    # 7.1 Risk Management
    {
        "clause": "7.1", "title": "Risk Management Process",
        "inputs": ["risk_verification", "doc_completeness"],
        "threshold_pass": 85.0,
        "weights": {"risk_verification": 0.7, "doc_completeness": 0.3},
    },
    # 8.1 Configuration Management
    {
        "clause": "8.1", "title": "Configuration Management",
        "inputs": ["codeowners_coverage", "doc_freshness"],
        "threshold_pass": 80.0,
        "weights": {"codeowners_coverage": 0.5, "doc_freshness": 0.5},
    },
    # Cybersecurity (IEC 81001-5-1 layered on top of 62304)
    {
        "clause": "CYB.1", "title": "API Authentication Coverage",
        "inputs": ["auth_coverage"],
        "threshold_pass": 95.0,
        "weights": {"auth_coverage": 1.0},
    },
    {
        "clause": "CYB.2", "title": "Input Validation for Class C Modules",
        "inputs": ["input_validation"],
        "threshold_pass": 90.0,
        "weights": {"input_validation": 1.0},
    },
    {
        "clause": "CYB.3", "title": "SOUP Vulnerability Exposure",
        "inputs": ["soup_vulnerability"],
        "threshold_pass": 90.0,
        "weights": {"soup_vulnerability": 1.0},
    },
    # Documentation
    {
        "clause": "DOC.1", "title": "Document Completeness",
        "inputs": ["doc_completeness"],
        "threshold_pass": 85.0,
        "weights": {"doc_completeness": 1.0},
    },
]


def predict_clause_outcomes() -> Dict[str, Any]:
    """Predict pass/fail probability per clause based on current metrics."""
    comp = ComplianceService()
    full = comp.compute_full_score()
    breakdown: Dict[str, float] = full.get("breakdown", {})

    predictions: List[Dict[str, Any]] = []
    for rule in CLAUSE_RULES:
        # Compute weighted score using inputs that exist
        weights = rule["weights"]
        score = 0.0
        weight_total = 0.0
        for key, w in weights.items():
            val = breakdown.get(key)
            if val is None:
                continue
            score += val * w
            weight_total += w
        if weight_total == 0:
            continue
        score /= weight_total

        threshold = rule["threshold_pass"]
        # P(fail) ≈ monotonic drop from threshold. Linear for interpretability.
        margin = score - threshold
        if margin >= 10:
            p_fail = 0.02
        elif margin >= 0:
            p_fail = 0.10 + (10 - margin) / 10 * 0.10  # 10-20%
        elif margin >= -10:
            p_fail = 0.30 + (abs(margin) / 10) * 0.30  # 30-60%
        else:
            p_fail = 0.80
        verdict = "pass_likely" if p_fail < 0.25 else ("at_risk" if p_fail < 0.60 else "fail_likely")

        predictions.append({
            "clause": rule["clause"],
            "title": rule["title"],
            "score": round(score, 1),
            "threshold_pass": threshold,
            "margin": round(margin, 1),
            "p_fail": round(p_fail, 3),
            "verdict": verdict,
            "inputs": {k: breakdown.get(k) for k in rule["inputs"]},
        })

    predictions.sort(key=lambda p: p["p_fail"], reverse=True)
    at_risk = [p for p in predictions if p["verdict"] != "pass_likely"]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "interpretable rule-based (replaceable with logistic regression)",
        "source": "ComplianceService.compute_full_score breakdown",
        "predictions": predictions,
        "at_risk_count": len(at_risk),
        "pass_likely_count": len(predictions) - len(at_risk),
    }


# ═══════════════════════════════════════════════════════════════
# 2) Change impact analysis
# ═══════════════════════════════════════════════════════════════

def _requirement_keywords_from_srs(srs: str) -> Dict[str, List[str]]:
    """Very light REQ-ID → keywords map from the SRS."""
    result: Dict[str, List[str]] = {}
    for m in re.finditer(r"(REQ-[A-Z]+-\d+)\s*[:\|]\s*(.+?)(?:\n|$)", srs):
        req_id = m.group(1)
        text = m.group(2).lower()
        words = [w.strip(".,:;|") for w in text.split() if len(w) > 4][:6]
        result[req_id] = words
    return result


def analyze_commit_impact(commit_sha: Optional[str] = None, commit_count: int = 5) -> Dict[str, Any]:
    """For each recent commit, compute likely impact set.

    Outputs per commit:
      - class_c_touched: list of Class C paths referenced
      - suggested_reqs: REQ-IDs whose keywords match the commit message
      - impact_severity: low / medium / high
    """
    gh = GitHubService()
    commits = gh.get_recent_commits(count=commit_count) if commit_sha is None else [
        c for c in gh.get_recent_commits(50) if c["sha"].startswith(commit_sha)
    ]

    srs = gh.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md") or ""
    req_keywords = _requirement_keywords_from_srs(srs)

    trace = TraceabilityService().build_graph()
    orphan_reqs = {o["id"] if isinstance(o, dict) else o for o in trace["orphans"].get("requirements_without_tests", [])}

    findings = []
    for c in commits:
        msg_lower = c["message"].lower()
        class_c_hits = [p for p in CLASS_C_PATHS if p.split("/")[-1] in c["message"]]
        suggested_reqs = [
            req for req, kws in req_keywords.items()
            if any(k in msg_lower for k in kws)
        ][:5]

        # Heuristic severity
        severity = "low"
        if class_c_hits:
            severity = "high"
        elif any(r in orphan_reqs for r in suggested_reqs):
            severity = "medium"

        findings.append({
            "commit_sha": c["sha"],
            "commit_message": c["message"],
            "author": c["author"],
            "date": c["date"],
            "class_c_touched": class_c_hits,
            "suggested_reqs": suggested_reqs,
            "orphan_reqs_touched": [r for r in suggested_reqs if r in orphan_reqs],
            "impact_severity": severity,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "commits_analyzed": len(commits),
        "findings": findings,
        "any_high": any(f["impact_severity"] == "high" for f in findings),
    }


# ═══════════════════════════════════════════════════════════════
# 3) Gap attribution — SHAP-inspired waterfall
# ═══════════════════════════════════════════════════════════════

GAP_CONTRIBUTIONS = [
    # (gap_key, max_cost_pts, description)
    ("orphan_requirements",   8.0, "Requirements without test evidence (IEC 62304 §5.5)"),
    ("orphan_risks",          6.0, "Risk controls without verification (ISO 14971 §7.3)"),
    ("class_c_low_coverage",  5.0, "Class C module missing unit tests"),
    ("unpinned_soup",         3.0, "SOUP dependency not pinned to exact version"),
    ("missing_codeowners",    3.0, "Class C path without CODEOWNERS entry"),
    ("doc_drift",             2.5, "Document freshness < 30% (ISO 13485 §4.2.4)"),
    ("low_auth_coverage",     4.0, "API endpoint without authentication (IEC 81001-5-1)"),
]


def explain_gap(metric_id: Optional[str] = None) -> Dict[str, Any]:
    """Return a SHAP-inspired waterfall of what's hurting the score the most.

    The 'attribution' here is not strict Shapley — it's a rule-based
    decomposition based on current breakdown values. Auditable and
    interpretable is worth more than theoretical elegance in this context.
    """
    comp = ComplianceService()
    full = comp.compute_full_score()
    breakdown: Dict[str, float] = full.get("breakdown", {})

    # Compute cost per gap using current values
    items = []

    # auth
    auth_pct = breakdown.get("auth_coverage", 100.0)
    if auth_pct < 100.0:
        missing_pct = (100.0 - auth_pct) / 100.0
        cost = round(missing_pct * 4.0, 2)
        items.append({
            "key": "low_auth_coverage",
            "description": "API endpoint without authentication",
            "standard": "IEC 81001-5-1",
            "cost_pts": cost,
            "current_value": auth_pct,
            "fix_action": "Add get_current_active_user dependency to every FastAPI route",
            "form_id": "TPL-11",
        })

    # input validation
    iv_pct = breakdown.get("input_validation", 100.0)
    if iv_pct < 100.0:
        cost = round((100 - iv_pct) / 100 * 5.0, 2)
        items.append({
            "key": "missing_validation",
            "description": "Class C module missing raise-ValueError input checks",
            "standard": "IEC 62304 §5.3 + REQ-SAFE-005",
            "cost_pts": cost,
            "current_value": iv_pct,
            "fix_action": "Add defensive bounds checking on NIfTI/DICOM input",
            "form_id": "TPL-05",
        })

    # test coverage
    tc_pct = breakdown.get("test_coverage", 100.0)
    if tc_pct < 100.0:
        cost = round((100 - tc_pct) / 100 * 6.0, 2)
        items.append({
            "key": "class_c_low_coverage",
            "description": "Class C module missing unit tests",
            "standard": "IEC 62304 §5.5.5",
            "cost_pts": cost,
            "current_value": tc_pct,
            "fix_action": "Create test_<module>.py for each Class C service",
            "form_id": "TPL-04",
        })

    # risk verification
    rv_pct = breakdown.get("risk_verification", 100.0)
    if rv_pct < 100.0:
        cost = round((100 - rv_pct) / 100 * 6.0, 2)
        items.append({
            "key": "orphan_risks",
            "description": "Risk controls without verification",
            "standard": "ISO 14971 §7.3",
            "cost_pts": cost,
            "current_value": rv_pct,
            "fix_action": "Complete VERIFIED entries in Risk Management File",
            "form_id": "TPL-08",
        })

    # codeowners
    co_pct = breakdown.get("codeowners_coverage", 100.0)
    if co_pct < 100.0:
        cost = round((100 - co_pct) / 100 * 3.0, 2)
        items.append({
            "key": "missing_codeowners",
            "description": "Class C path without CODEOWNERS entry",
            "standard": "IEC 62304 §5.1.6 (code review)",
            "cost_pts": cost,
            "current_value": co_pct,
            "fix_action": "Add path → reviewer mapping in .github/CODEOWNERS",
            "form_id": "TPL-03",
        })

    # doc completeness
    dc_pct = breakdown.get("doc_completeness", 100.0)
    if dc_pct < 100.0:
        cost = round((100 - dc_pct) / 100 * 4.0, 2)
        items.append({
            "key": "doc_missing",
            "description": "Regulatory document missing",
            "standard": "ISO 13485 §4.2.4",
            "cost_pts": cost,
            "current_value": dc_pct,
            "fix_action": "Create missing document under docs/iec62304/ or docs/qms/",
            "form_id": "TPL-10",
        })

    # doc freshness
    df_pct = breakdown.get("doc_freshness", 100.0)
    if df_pct < 80.0:
        cost = round((80 - df_pct) / 80 * 2.5, 2)
        items.append({
            "key": "doc_drift",
            "description": "Document freshness below target (stale docs)",
            "standard": "ISO 13485 §4.2.4",
            "cost_pts": cost,
            "current_value": df_pct,
            "fix_action": "Review and update documents older than 365 days",
            "form_id": "TPL-10",
        })

    # SOUP
    soup_pct = breakdown.get("soup_vulnerability", 100.0)
    if soup_pct < 100.0:
        cost = round((100 - soup_pct) / 100 * 5.0, 2)
        items.append({
            "key": "soup_vuln",
            "description": "Known CVEs in dependencies",
            "standard": "IEC 62304 §7.1.3",
            "cost_pts": cost,
            "current_value": soup_pct,
            "fix_action": "Upgrade vulnerable packages or document mitigation",
            "form_id": "TPL-09",
        })

    items.sort(key=lambda x: x["cost_pts"], reverse=True)
    total_cost = round(sum(i["cost_pts"] for i in items), 2)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "rule-based attribution (SHAP-inspired waterfall)",
        "score": full["scores"]["ce_mark_overall"],
        "total_cost_pts": total_cost,
        "items": items,
        "top_3": items[:3],
    }
