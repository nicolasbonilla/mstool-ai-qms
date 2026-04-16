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

AGENT_REGISTRY: Dict[str, BaseAgent] = {
    "traceability":  TraceabilityAgent(),
    "soup_monitor":  SOUPMonitorAgent(),
    "pr_reviewer":   PRReviewerAgent(),
    "doc_drift":     DocDriftAgent(),
    "capa_drafter":  CAPADrafterAgent(),
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
