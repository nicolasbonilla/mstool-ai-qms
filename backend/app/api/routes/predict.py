"""
Predictive API — Phase 6.

Three endpoints powering the "predictive layer" UX:
- /predict/clauses     → clause-level audit pass/fail probabilities
- /predict/impact      → change impact of recent commits
- /predict/explain     → SHAP-inspired gap attribution
"""

from fastapi import APIRouter, Depends
from typing import Optional

from app.core.auth import get_current_user, CurrentUser
from app.services.predictive_service import (
    predict_clause_outcomes, analyze_commit_impact, explain_gap,
)

router = APIRouter(prefix="/predict", tags=["Predictive"])


@router.get("/clauses")
async def get_clause_predictions(user: CurrentUser = Depends(get_current_user)):
    """Return P(fail) per IEC 62304 / cybersecurity / doc clause."""
    return predict_clause_outcomes()


@router.get("/impact")
async def get_impact(commit_count: int = 5,
                      commit_sha: Optional[str] = None,
                      user: CurrentUser = Depends(get_current_user)):
    """Change impact analysis for recent commits."""
    return analyze_commit_impact(commit_sha=commit_sha, commit_count=commit_count)


@router.get("/explain")
async def get_explanation(user: CurrentUser = Depends(get_current_user)):
    """SHAP-inspired waterfall — what's costing the compliance score."""
    return explain_gap()


@router.get("/suspect-links")
async def get_suspect_links(user: CurrentUser = Depends(get_current_user)):
    """Trace nodes whose underlying code/tests changed recently."""
    from app.services.suspect_links_service import detect_suspect_links
    return detect_suspect_links()


@router.get("/missing-links")
async def get_missing_links(top_k: int = 25, min_score: float = 0.18,
                              user: CurrentUser = Depends(get_current_user)):
    """REQ↔test pairs that look related but have no explicit trace."""
    from app.services.suspect_links_service import predict_missing_trace_links
    return predict_missing_trace_links(top_k=top_k, min_score=min_score)


@router.get("/samd-scan")
async def get_samd_scan(user: CurrentUser = Depends(get_current_user)):
    """Imaging/SaMD-specific Semgrep-style scan (NIfTI, DICOM, voxel bounds…)."""
    from app.services.samd_scanner import scan_samd_repo
    return scan_samd_repo()
