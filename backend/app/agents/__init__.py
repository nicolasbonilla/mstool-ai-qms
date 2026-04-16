"""
AI Agent Platform — Phase 4.

Ten specialized agents built on Claude (Anthropic) that act as validated
SOUP components under IEC 62304 §5.3. Each agent:

- Pins a specific Claude model version (SOUP identification)
- Has a defined input/output contract (IQ/OQ/PQ evidence)
- Runs with hallucination guardrails (Constitutional Classifiers boundary)
- Logs every invocation into the WORM audit trail + qms_agent_runs
- Produces sentence-level citations back to (commit, line, clause)
- Requires human e-signature before committing any Class C impact

Design references:
- Anthropic "When to use multi-agent systems":
  https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
- Cognition "Don't Build Multi-Agents" (single-threaded supervisor):
  https://cognition.ai/blog/dont-build-multi-agents
- Ketryx 5-step validated loop (Prompt → Analysis → Recommendations →
  Human Review → Sync)
- FDA PCCP Final Guidance (Aug 2025) for change management of the agents.
"""

from app.agents.base_agent import BaseAgent, AgentResult
from app.agents.registry import AGENT_REGISTRY, get_agent, list_agents

__all__ = [
    "BaseAgent",
    "AgentResult",
    "AGENT_REGISTRY",
    "get_agent",
    "list_agents",
]
