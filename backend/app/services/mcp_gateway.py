"""
MCP-style gateway — exposes the QMS knowledge surface to external IDE agents.

What this is: a small JSON-RPC-shaped HTTP gateway that any MCP-aware
client (Claude Desktop, Claude Code, Cursor, Windsurf) can hit. It
implements the JSON-RPC 2.0 envelope MCP uses for `tools/list` and
`tools/call`, exposing a curated set of read-only QMS operations.

Why this matters: Ketryx shipped their MCP server in March 2026 and is
positioning it as the integration moat. Our differentiation is the
WORM-ledgered audit trail — every IDE-agent call is logged into the same
hash chain as direct UI actions, so a Notified Body can prove an external
AI tool didn't mutate compliance state outside the QMS.

Tools exposed (all read-only):
- compliance.score          — current Health Score breakdown
- traceability.stats        — node + orphan counts
- baselines.latest          — last signed release baseline
- soup.summary              — SOUP inventory + CVE counts
- gaps.top                  — top compliance gaps (waterfall)
- audit.run-status          — last audit verdict + clause breakdown
- predict.clauses           — clause-level P(fail) forecast

Authentication: bearer Firebase ID token in `Authorization` header,
exactly like the rest of the API. Every call is recorded in the WORM
ledger with the calling user's UID + the tool name + arguments.

Reference: MCP 2026 roadmap (audit trails as enterprise priority)
https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
"""

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def _tool_compliance_score(_args: Dict) -> Dict:
    from app.services.compliance_service import ComplianceService
    res = ComplianceService().compute_full_score()
    return {
        "scores": res["scores"],
        "breakdown": res["breakdown"],
    }


def _tool_traceability_stats(_args: Dict) -> Dict:
    from app.services.traceability_service import TraceabilityService
    g = TraceabilityService().build_graph()
    return {"stats": g.get("stats", {}),
            "coverage_metrics": g.get("coverage_metrics", {})}


def _tool_baselines_latest(_args: Dict) -> Dict:
    from app.services.baseline_service import BaselineService
    items = BaselineService.list_baselines(limit=1)
    if not items:
        return {"latest": None}
    item = items[0]
    return {
        "version_tag": item.get("version_tag"),
        "status": item.get("status"),
        "hash": item.get("hash"),
        "ce_mark_overall": item.get("compliance", {})
                              .get("scores", {}).get("ce_mark_overall"),
        "signatures": len(item.get("signatures", [])),
    }


def _tool_soup_summary(_args: Dict) -> Dict:
    from app.services.soup_service import SOUPService
    return SOUPService().get_summary()


def _tool_gaps_top(args: Dict) -> Dict:
    from app.services.predictive_service import explain_gap
    g = explain_gap()
    n = int(args.get("limit", 5))
    return {"top": g.get("items", [])[:n], "total_cost_pts": g.get("total_cost_pts")}


def _tool_audit_run_status(_args: Dict) -> Dict:
    from app.services.firestore_service import FirestoreService
    runs = FirestoreService.get_audit_trail(limit=10, resource_type="audit")
    last = next((r for r in runs
                  if r.get("details", {}).get("readiness_score") is not None), None)
    if not last:
        return {"last_audit": None}
    return {
        "last_audit": {
            "ran_at": last.get("timestamp"),
            "readiness_score": last["details"].get("readiness_score"),
            "mode": last["details"].get("mode"),
        }
    }


def _tool_predict_clauses(_args: Dict) -> Dict:
    from app.services.predictive_service import predict_clause_outcomes
    out = predict_clause_outcomes()
    return {
        "at_risk_count": out["at_risk_count"],
        "predictions": out["predictions"],
    }


# Registry of MCP tools — kept as a dict so we can advertise them via
# `tools/list` without hardcoding twice.
TOOLS: Dict[str, Dict] = {
    "compliance.score": {
        "description": "Current QMS Health Score breakdown (live).",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_compliance_score,
    },
    "traceability.stats": {
        "description": "Requirement traceability stats + bidirectional coverage.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_traceability_stats,
    },
    "baselines.latest": {
        "description": "Most recent release baseline with status + hash.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_baselines_latest,
    },
    "soup.summary": {
        "description": "SOUP inventory: total deps, safety class breakdown, CVE counts.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_soup_summary,
    },
    "gaps.top": {
        "description": "Top compliance gaps (waterfall) with cost in score points.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 20}},
            "additionalProperties": False,
        },
        "handler": _tool_gaps_top,
    },
    "audit.run-status": {
        "description": "Verdict + readiness_score from the most recent audit run.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_audit_run_status,
    },
    "predict.clauses": {
        "description": "Clause-level P(fail) forecast. Returns list of risk per IEC 62304 clause.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
        "handler": _tool_predict_clauses,
    },
}


def list_tools() -> Dict[str, Any]:
    """MCP `tools/list` response shape."""
    return {
        "tools": [
            {"name": name, "description": meta["description"],
             "input_schema": meta["input_schema"]}
            for name, meta in TOOLS.items()
        ]
    }


def call_tool(name: str, arguments: Dict) -> Dict[str, Any]:
    """MCP `tools/call` dispatcher."""
    tool = TOOLS.get(name)
    if not tool:
        raise KeyError(f"Unknown tool: {name}")
    handler = tool["handler"]
    result = handler(arguments or {})
    return {"content": [{"type": "json", "json": result}], "isError": False}
