"""
BaseAgent — common abstraction for all MSTool-AI-QMS AI agents.

Every agent inherits from BaseAgent so that:
- Model version pinning is declared in code (SOUP identification).
- Each invocation is recorded in qms_agent_runs + qms_audit_trail.
- Citations are required on every output so Notified Bodies can verify.
- Tier selection (Haiku / Sonnet / Opus) is explicit per agent role.
- Timeouts + retry + prompt caching are handled uniformly.

Subclasses implement `_run()` returning an AgentResult. The public `run()`
method wraps it with telemetry, logging, and cost accounting.

Reference: Ketryx validated-agent pattern — model version pin + regression
suite + drift detection + HITL checkpoints + immutable audit log.
https://www.ketryx.com/blog/ketryx-wants-its-validated-ai-agents-to-accelerate-compliance-workflows
"""

import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional

from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)


# Tier → Anthropic model ID mapping. These values are pinned SOUP versions
# per IEC 62304 §5.3.3. When Anthropic releases a new version and we want
# to adopt it, we bump here AND generate a PCCP entry (Phase 5).
MODEL_TIER_MAP = {
    "haiku":  os.environ.get("AGENT_MODEL_HAIKU",  "claude-haiku-4-5"),
    "sonnet": os.environ.get("AGENT_MODEL_SONNET", "claude-sonnet-4-5"),
    "opus":   os.environ.get("AGENT_MODEL_OPUS",   "claude-opus-4-6"),
}


@dataclass
class Citation:
    """A single verifiable citation on an AI output.

    `source` identifies the evidence type (e.g. "commit", "requirement",
    "clause", "test_function"). `reference` is the machine-readable pointer
    (e.g. commit SHA, REQ-ID, clause number). `url` is the human-clickable
    link back to the evidence location.
    """
    source: str
    reference: str
    url: str = ""
    excerpt: str = ""


@dataclass
class AgentResult:
    """The structured output of every agent invocation."""
    # Primary content — each element can be a finding, recommendation, or draft.
    findings: list[dict] = field(default_factory=list)
    # Structured citations supporting each finding
    citations: list[Citation] = field(default_factory=list)
    # Short human-readable summary the UI can show without drill-down
    summary: str = ""
    # Does this result require a human to sign before action is taken?
    requires_human_signoff: bool = True
    # Confidence 0-1 (self-reported; should be combined with evaluator metrics)
    confidence: float = 0.0
    # Raw Claude response text for debugging / Langfuse-style tracing
    raw: str = ""
    # Token usage for cost accounting
    usage: dict = field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract base for every specialized QMS agent.

    Subclasses declare:
        name, description, tier, system_prompt, requires_role
    And implement _run(context) -> AgentResult.
    """

    # Unique agent identifier (e.g. "traceability", "soup_monitor")
    name: str = ""
    # One-line human description surfaced in the UI
    description: str = ""
    # Model tier used by this agent ("haiku", "sonnet", "opus")
    tier: str = "sonnet"
    # System prompt — loaded from a skill file in a later phase; for MVP inline.
    system_prompt: str = ""
    # Minimum role that can invoke this agent. `None` = any authenticated user.
    requires_role: Optional[str] = None
    # Whether human sign-off is required by default on this agent's output.
    # Class-C-impacting agents must always be True.
    default_requires_signoff: bool = True

    @property
    def model_id(self) -> str:
        return MODEL_TIER_MAP.get(self.tier, MODEL_TIER_MAP["sonnet"])

    @abstractmethod
    def _run(self, context: dict) -> AgentResult:
        """Subclass implementation — no logging, no persistence, just work."""
        ...

    def run(self, context: dict, invoked_by_uid: str = "system",
            invoked_by_email: str = "system@mstool-ai-qms") -> dict:
        """Public entrypoint — wraps _run with telemetry + persistence."""
        start = time.monotonic()
        started_at = datetime.now(timezone.utc).isoformat()
        run_id_doc = None
        try:
            result = self._run(context)
            status = "ok"
            error = None
        except Exception as e:
            logger.exception(f"Agent {self.name} failed")
            result = AgentResult(
                summary=f"Agent failed: {e}",
                requires_human_signoff=True,
                confidence=0.0,
            )
            status = "error"
            error = str(e)

        duration_ms = int((time.monotonic() - start) * 1000)
        completed_at = datetime.now(timezone.utc).isoformat()

        record = {
            "agent_name": self.name,
            "model_id": self.model_id,
            "tier": self.tier,
            "invoked_by_uid": invoked_by_uid,
            "invoked_by_email": invoked_by_email,
            "started_at": started_at,
            "completed_at": completed_at,
            "duration_ms": duration_ms,
            "status": status,
            "error": error,
            "context": {k: v for k, v in context.items() if _is_json_safe(v)},
            "result": {
                "summary": result.summary,
                "findings_count": len(result.findings),
                "citations_count": len(result.citations),
                "confidence": result.confidence,
                "requires_human_signoff": result.requires_human_signoff,
                "usage": result.usage,
                "findings": result.findings[:20],  # cap size
                "citations": [asdict(c) for c in result.citations[:40]],
            },
            "approved": False,
            "approved_by": None,
            "approved_at": None,
        }

        # Persist the run
        try:
            db = get_firestore_client()
            _, run_id_doc = db.collection(Collections.AGENT_RUNS).add(record)
            record["id"] = run_id_doc.id
        except Exception as e:
            logger.warning(f"Failed to persist agent run: {e}")
            record["id"] = None

        # Record in WORM ledger (separate event type)
        FirestoreService.log_action(
            user_uid=invoked_by_uid,
            user_email=invoked_by_email,
            action=f"run_agent_{self.name}",
            resource_type="ai",
            resource_id=record.get("id") or self.name,
            severity="info" if status == "ok" else "warning",
            details={
                "model": self.model_id,
                "tier": self.tier,
                "duration_ms": duration_ms,
                "findings": len(result.findings),
            },
        )

        return record


def _is_json_safe(v: Any) -> bool:
    """Cheap check so we don't crash persisting random Python objects."""
    return isinstance(v, (str, int, float, bool, list, dict, type(None)))


def get_anthropic_client():
    """Lazy-load Anthropic SDK. Returns None if not configured so callers
    can short-circuit gracefully during local dev without API keys."""
    try:
        import anthropic  # type: ignore
    except ImportError:
        logger.warning("anthropic package not installed — AI agents disabled")
        return None
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — AI agents will return stubs")
        return None
    return anthropic.Anthropic(api_key=api_key)
