"""
Extended golden suite — programmatic test generation per agent.

Manually authoring 200+ prompts per agent doesn't scale; instead we
generate diverse test cases via parametric variation. Each agent gets:
- 1 baseline canary (the MUST-PASS smoke test)
- N variations across different context shapes
- Property-based assertions on the result shape

Reference: Hypothesis-style property testing applied to LLM agents.
The point is not exhaustive coverage; it's signal that the agent
behaves consistently across realistic input variations.
"""

from typing import Dict, List


def _common_props() -> Dict:
    return {
        "has_summary": True,
        "findings_is_list": True,
    }


def _build_traceability_tests() -> List[Dict]:
    return [
        {"id": f"tr-{i:03d}", "description": f"commit window {n}",
         "context": {"commit_count": n},
         "expected_properties": _common_props()}
        for i, n in enumerate([1, 3, 5, 10, 20, 30, 50])
    ]


def _build_soup_tests() -> List[Dict]:
    return [
        {"id": "soup-001", "description": "default scan",
         "context": {}, "expected_properties": _common_props()},
        {"id": "soup-002", "description": "include low severity",
         "context": {"include_low": True}, "expected_properties": _common_props()},
    ]


def _build_pr_tests() -> List[Dict]:
    return [
        {"id": "pr-001", "description": "no specific PR (review last commits)",
         "context": {"pr_number": None}, "expected_properties": _common_props()},
        {"id": "pr-002", "description": "named PR number 1",
         "context": {"pr_number": 1}, "expected_properties": _common_props()},
        {"id": "pr-003", "description": "named PR number 99",
         "context": {"pr_number": 99}, "expected_properties": _common_props()},
    ]


def _build_doc_drift_tests() -> List[Dict]:
    return [
        {"id": "dd-001", "description": "default scan",
         "context": {}, "expected_properties": _common_props()},
    ]


def _build_capa_tests() -> List[Dict]:
    problems = [
        "Volumetry test off by 3% on fixture",
        "DICOM read raised UnknownTransferSyntax",
        "ONNX model file size mismatch on Edge AI worker",
        "Lesion segmentation Dice dropped from 0.91 to 0.78 over last 2 weeks",
        "Auth middleware regression: route /studies/{id} now returns 200 without token",
        "Memory leak in ai_segmentation_service after 4h of continuous use",
    ]
    out = []
    for i, p in enumerate(problems):
        out.append({
            "id": f"capa-{i:03d}", "description": f"problem: {p[:50]}",
            "context": {"problem": p, "evidence": "see CI run + git log"},
            "expected_properties": _common_props(),
        })
    out.append({
        "id": "capa-empty",
        "description": "empty problem must decline",
        "context": {"problem": "", "evidence": ""},
        "expected_properties": {"has_summary": True},
    })
    return out


def _build_clause_chat_tests() -> List[Dict]:
    questions = [
        "How is API authentication coverage measured?",
        "What does IEC 62304 §5.5 require for unit testing?",
        "How do we verify a risk control per ISO 14971 §7.3?",
        "Which clauses am I currently failing?",
        "What's the difference between Health Score and Audit Verdict?",
        "How do I create a CAPA record?",
        "What documents are required for CE Mark submission?",
        "How is SOUP managed in our project?",
        "What does the Class C designation mean for my code review?",
        "Which Anthropic model versions are pinned as SOUP?",
    ]
    out = []
    for i, q in enumerate(questions):
        out.append({
            "id": f"chat-{i:03d}",
            "description": q[:60],
            "context": {"question": q},
            "expected_properties": _common_props(),
        })
    out.append({
        "id": "chat-empty",
        "description": "empty question must decline",
        "context": {"question": ""},
        "expected_properties": {"has_summary": True},
    })
    return out


def _build_audit_prep_tests() -> List[Dict]:
    clauses = ["full", "5.1", "5.2", "5.3", "5.5", "5.6", "5.7", "7.1", "8.1"]
    return [
        {"id": f"ap-{c.replace('.', '_')}",
         "description": f"prep clause {c}",
         "context": {"clause": c},
         "expected_properties": _common_props()}
        for c in clauses
    ]


def _build_risk_analyst_tests() -> List[Dict]:
    return [
        {"id": "ra-001", "description": "default analysis of recent class C commits",
         "context": {}, "expected_properties": _common_props()},
    ]


def _build_regulatory_watch_tests() -> List[Dict]:
    return [
        {"id": "rw-001", "description": "default curated update digest",
         "context": {}, "expected_properties": _common_props()},
        {"id": "rw-002", "description": "with extra update injected",
         "context": {"updates": [{
             "date": "2026-04-01", "source": "FDA",
             "title": "AI/ML SaMD updated guidance",
             "url": "https://fda.gov/example",
             "summary": "Test injected update",
         }]},
         "expected_properties": _common_props()},
    ]


def _build_autonomous_gap_closer_tests() -> List[Dict]:
    return [
        {"id": "agc-top",
         "description": "close top gap (no persist)",
         "context": {"auto_persist_draft": False},
         "expected_properties": _common_props()},
    ]


EXTENDED_SUITE: Dict[str, List[Dict]] = {
    "traceability": _build_traceability_tests(),
    "soup_monitor": _build_soup_tests(),
    "pr_reviewer": _build_pr_tests(),
    "doc_drift": _build_doc_drift_tests(),
    "capa_drafter": _build_capa_tests(),
    "clause_chat": _build_clause_chat_tests(),
    "audit_prep": _build_audit_prep_tests(),
    "risk_analyst": _build_risk_analyst_tests(),
    "regulatory_watch": _build_regulatory_watch_tests(),
    "autonomous_gap_closer": _build_autonomous_gap_closer_tests(),
}
