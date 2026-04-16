"""
Suspect Links + Missing Trace Link Predictor — Phase 6.

Two related capabilities the auditor expects from a modern QMS:

A) **Suspect links**: when a recently committed file touches a function
   that's referenced by REQ-XXX in code or tests, mark all downstream
   trace edges as "suspect" until a human re-verifies. Pattern from
   Polarion Suspects + Codebeamer Suspected Links.

B) **Missing trace link predictor**: lexical + semantic similarity
   between requirements and tests/code; surface high-similarity pairs
   that lack an explicit trace edge so a reviewer can accept them.
   Pattern from HGNNLink (2025) + T-BERT (FSE 2021), simplified to
   lexical + jaccard for the first iteration. Replaceable with BGE
   embeddings once we wire pgvector.
"""

import re
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Set

from app.services.github_service import GitHubService
from app.services.traceability_service import TraceabilityService

# Window: a commit is considered "recent enough to mark suspects" if it
# landed within the last N days. Most Notified Bodies want re-verification
# triggered by changes in the last review cycle (we use 14 days = 2 sprints).
SUSPECT_WINDOW_DAYS = 14


def _tokenize(text: str) -> Set[str]:
    """Produce a simple word-set for jaccard similarity."""
    return set(
        w.lower()
        for w in re.findall(r"[A-Za-z][A-Za-z0-9_]{2,}", text or "")
        if len(w) > 2
    )


def _jaccard(a: Set[str], b: Set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def detect_suspect_links() -> Dict:
    """Walk recent commits; mark trace edges whose endpoints were touched.

    Returns the suspect set with reasons. The frontend overlays a 🟡 badge
    on graph nodes / RTM rows whose ID is in `suspect_node_ids`.
    """
    gh = GitHubService()
    trace = TraceabilityService().build_graph()

    cutoff = (datetime.now(timezone.utc) - timedelta(days=SUSPECT_WINDOW_DAYS)).isoformat()
    commits = gh.get_recent_commits(50)
    recent_commits = [c for c in commits if (c.get("date") or "") >= cutoff]

    # Build the index: which CODE node IDs match each commit's path/keywords?
    code_nodes = [n for n in trace["nodes"] if n["type"] == "code"]
    suspect_code_ids: Set[str] = set()
    suspect_reasons: Dict[str, List[Dict]] = {}

    for c in recent_commits:
        msg = (c.get("message") or "").lower()
        for cn in code_nodes:
            mod_name = (cn.get("metadata") or {}).get("module_name", "").lower()
            if not mod_name or len(mod_name) < 3:
                continue
            if mod_name in msg:
                suspect_code_ids.add(cn["id"])
                suspect_reasons.setdefault(cn["id"], []).append({
                    "commit": c["sha"],
                    "message": c["message"],
                    "date": c["date"],
                })

    # Propagate: any REQ that traces to a suspect code node is also suspect
    # (because its implementation may have changed). Same for tests.
    suspect_req_ids: Set[str] = set()
    suspect_test_ids: Set[str] = set()
    for e in trace["edges"]:
        if e["type"] == "implemented_by" and e["target"] in suspect_code_ids:
            suspect_req_ids.add(e["source"])
        if e["type"] == "tested_by" and e["source"] in suspect_code_ids:
            suspect_test_ids.add(e["target"])

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_days": SUSPECT_WINDOW_DAYS,
        "commits_in_window": len(recent_commits),
        "suspect_code_ids": sorted(suspect_code_ids),
        "suspect_req_ids": sorted(suspect_req_ids),
        "suspect_test_ids": sorted(suspect_test_ids),
        "reasons": suspect_reasons,
    }


def predict_missing_trace_links(top_k: int = 25, min_score: float = 0.18) -> Dict:
    """Suggest REQ↔test pairs that look related but have no edge yet.

    Uses the semantic_search backend: real embeddings (sentence-transformers
    MiniLM or fine-tuned BGE) when available, falls back to jaccard tokens
    otherwise. The active backend is reported in the response so the UI can
    show whether the user is seeing semantic or lexical results.
    """
    from app.services.semantic_search import similarity_pairs, get_active_backend
    gh = GitHubService()  # noqa: F841 - kept to ensure consistent caching
    trace = TraceabilityService().build_graph()

    # Existing REQ → test pairs (transitive via code)
    edges = trace["edges"]
    existing_req_test_pairs: Set[tuple] = set()
    for e in edges:
        if e["type"] == "implemented_by" and e["source"].startswith("REQ"):
            for e2 in edges:
                if e2["type"] == "tested_by" and e2["source"] == e["target"]:
                    existing_req_test_pairs.add((e["source"], e2["target"]))

    reqs = [n for n in trace["nodes"] if n["type"] == "requirement"]
    tests = [n for n in trace["nodes"] if n["type"] == "test"]

    # Build text payload per node for the semantic backend
    left = [{
        "id": r["id"],
        "text": (r.get("metadata") or {}).get("description", "") + " " + r["id"],
    } for r in reqs]
    right = [{
        "id": t["id"],
        "text": (t.get("metadata") or {}).get("tests_module", "") + " " + t["id"],
    } for t in tests]

    pairs = similarity_pairs(
        left, right,
        left_text_key="text", right_text_key="text",
        min_score=min_score, top_k=top_k * 4,  # over-fetch then drop existing
    )

    candidates = []
    for p in pairs:
        if (p["left_id"], p["right_id"]) in existing_req_test_pairs:
            continue
        candidates.append({
            "req_id": p["left_id"],
            "test_id": p["right_id"],
            "similarity": p["similarity"],
            "method": p["method"],
            "rationale": "Semantic similarity suggests these may be related; verify and add explicit trace.",
        })
        if len(candidates) >= top_k:
            break

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": get_active_backend(),
        "predictions": candidates,
        "considered_pairs": len(reqs) * len(tests),
    }
