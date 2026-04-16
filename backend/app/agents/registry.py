"""
Agent registry — single source of truth for which agents exist.

Adding an agent: import the class + add to AGENT_REGISTRY. The UI picks
them up automatically via /ai/agents.
"""

from typing import Dict, List

from app.agents.base_agent import BaseAgent
from app.agents.traceability_agent import TraceabilityAgent
from app.agents.soup_monitor_agent import SOUPMonitorAgent
from app.agents.pr_reviewer_agent import PRReviewerAgent
from app.agents.doc_drift_agent import DocDriftAgent
from app.agents.capa_drafter_agent import CAPADrafterAgent
from app.agents.clause_chat_agent import ClauseChatAgent
from app.agents.audit_prep_agent import AuditPreparationAgent
from app.agents.risk_analyst_agent import RiskAnalystAgent
from app.agents.regulatory_watch_agent import RegulatoryWatchAgent
from app.agents.autonomous_gap_closer_agent import AutonomousGapCloserAgent

AGENT_REGISTRY: Dict[str, BaseAgent] = {
    "traceability":          TraceabilityAgent(),
    "soup_monitor":          SOUPMonitorAgent(),
    "pr_reviewer":           PRReviewerAgent(),
    "doc_drift":             DocDriftAgent(),
    "capa_drafter":          CAPADrafterAgent(),
    "clause_chat":           ClauseChatAgent(),
    "audit_prep":            AuditPreparationAgent(),
    "risk_analyst":          RiskAnalystAgent(),
    "regulatory_watch":      RegulatoryWatchAgent(),
    "autonomous_gap_closer": AutonomousGapCloserAgent(),
}


def get_agent(name: str) -> BaseAgent:
    if name not in AGENT_REGISTRY:
        raise KeyError(f"Unknown agent: {name}")
    return AGENT_REGISTRY[name]


def list_agents() -> List[dict]:
    """Return lightweight metadata for every registered agent."""
    return [
        {
            "name": a.name,
            "description": a.description,
            "tier": a.tier,
            "model": a.model_id,
            "requires_signoff_default": a.default_requires_signoff,
        }
        for a in AGENT_REGISTRY.values()
    ]
