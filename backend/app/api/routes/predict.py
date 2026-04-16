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
