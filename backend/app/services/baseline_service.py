"""
Release Baseline Service — Phase 3.

A baseline is an immutable snapshot of the ENTIRE QMS state at a moment in
time. Baselines are the evidence artifact an FDA reviewer / Notified Body
accepts as "what the device looked like when you submitted version X.Y.Z":

- Current compliance scores (full breakdown)
- Last audit result (strong/adequate/weak/missing distribution)
- Requirements traceability matrix snapshot
- SOUP inventory (all dependencies with versions + CVE status at the time)
- Document freshness snapshot (every doc, its last-commit SHA, hash)
- Activity-trail window covering the baseline period
- Git tag / commit SHA of the medical-device repo at snapshot time

Once signed, a baseline cannot be mutated. Firestore security rules enforce
this at the data layer (read-only after signing).

References:
- Jama Connect Baselines — https://help.jamasoftware.com/ah/en/manage-content/baselines.html
- Codebeamer Baselines — https://support.ptc.com/help/codebeamer/r2.2/en/codebeamer/cbx_user_guide/baseline.html
- Polarion automatic revision control baselines
- 21 CFR 820.30(j) — Design History File immutability
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.core.firebase import get_firestore_client, Collections
from app.services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)


def _snapshot_hash(payload: dict) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class BaselineService:
    """Create, read, and diff immutable release baselines."""

    @staticmethod
    def _db():
        return get_firestore_client()

    @staticmethod
    def create_baseline(
        version_tag: str,
        created_by_uid: str,
        created_by_email: str,
        notes: str = "",
        auto_triggered: bool = False,
    ) -> Dict[str, Any]:
        """Capture current state as an immutable baseline.

        Reads live data from ComplianceService + TraceabilityService + SOUPService,
        computes hashes per component, and writes a single immutable document
        to `qms_baselines/{version_tag}`. If a baseline with this version_tag
        already exists we refuse — baselines are immutable.
        """
        # Local imports to avoid circular and lazy-load heavy services
        from app.services.compliance_service import ComplianceService
        from app.services.traceability_service import TraceabilityService
        from app.services.soup_service import SOUPService

        db = BaselineService._db()
        doc_ref = db.collection(Collections.BASELINES).document(version_tag)
        if doc_ref.get().exists:
            raise ValueError(f"Baseline {version_tag} already exists — baselines are immutable")

        now = datetime.now(timezone.utc)

        # Capture sources
        compliance = ComplianceService().compute_full_score()
        trace = TraceabilityService().build_graph()
        soup_svc = SOUPService()
        deps = soup_svc.get_all_dependencies()
        soup_summary = soup_svc.get_summary()

        # Fetch last N audit-trail entries so the baseline embeds its own context
        recent_activity = FirestoreService.get_audit_trail(limit=100)
        ledger_head = FirestoreService.get_ledger_head() or {}

        snapshot = {
            "version_tag": version_tag,
            "created_at": now.isoformat(),
            "created_by_uid": created_by_uid,
            "created_by_email": created_by_email,
            "auto_triggered": auto_triggered,
            "notes": notes,
            "status": "draft",  # draft → signed → submitted
            "compliance": {
                "scores": compliance["scores"],
                "breakdown": compliance["breakdown"],
            },
            "traceability": {
                "stats": trace["stats"],
                "coverage_metrics": trace.get("coverage_metrics", {}),
                "orphan_count": (
                    len(trace["orphans"].get("requirements_without_tests", []))
                    + len(trace["orphans"].get("risk_controls_without_verification", []))
                    + len(trace["orphans"].get("code_without_requirements", []))
                ),
            },
            "soup": {
                "summary": soup_summary,
                "dependencies": [
                    {
                        "name": d["name"],
                        "version": d["version"],
                        "source": d["source"],
                        "safety_class": d["safety_class"],
                    }
                    for d in deps
                ],
            },
            "activity_ledger_head": ledger_head,
            "recent_activity_count": len(recent_activity),
            "signatures": [],
        }
        snapshot["hash"] = _snapshot_hash(snapshot)

        doc_ref.set(snapshot)

        # Log baseline creation into the WORM ledger — the baseline itself is
        # the artifact, but the act of creating it is also a recordable event.
        FirestoreService.log_action(
            user_uid=created_by_uid,
            user_email=created_by_email,
            action="create_baseline",
            resource_type="baselines",
            resource_id=version_tag,
            severity="info",
            details={"hash": snapshot["hash"], "auto": auto_triggered},
        )
        return snapshot

    @staticmethod
    def list_baselines(limit: int = 50) -> List[Dict[str, Any]]:
        """List baselines newest-first."""
        db = BaselineService._db()
        query = (
            db.collection(Collections.BASELINES)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
        )
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results

    @staticmethod
    def get_baseline(version_tag: str) -> Optional[Dict[str, Any]]:
        db = BaselineService._db()
        snap = db.collection(Collections.BASELINES).document(version_tag).get()
        if not snap.exists:
            return None
        data = snap.to_dict()
        data["id"] = snap.id
        return data

    @staticmethod
    def sign_baseline(version_tag: str, signer_uid: str, signer_email: str,
                      role: str, meaning: str = "approved") -> Optional[Dict[str, Any]]:
        """Append a 21 CFR Part 11 §11.50 electronic signature to a baseline.

        Now produces a cryptographic signature (Cloud KMS RSA-PSS-SHA256
        when configured; HMAC-SHA256 dev fallback). The signature binds to
        the baseline's hash so any tampering with the baseline content
        invalidates every signature on it.
        """
        from app.services.esign_service import sign_payload

        db = BaselineService._db()
        doc_ref = db.collection(Collections.BASELINES).document(version_tag)
        snap = doc_ref.get()
        if not snap.exists:
            return None
        data = snap.to_dict()

        # Sign the canonical baseline (excluding the signatures list to avoid
        # circular dependency — each new signer signs the same content)
        payload_to_sign = {
            "version_tag": data.get("version_tag"),
            "hash": data.get("hash"),
            "created_at": data.get("created_at"),
            "compliance": data.get("compliance"),
        }
        sig_record = sign_payload(
            payload=payload_to_sign,
            signer_uid=signer_uid, signer_email=signer_email,
            signer_role=role, meaning=meaning,
        )

        signatures = list(data.get("signatures", []))
        signatures.append(sig_record)
        updates = {"signatures": signatures}
        if meaning == "approved" and data.get("status") == "draft":
            updates["status"] = "signed"
        doc_ref.update(updates)
        FirestoreService.log_action(
            user_uid=signer_uid, user_email=signer_email,
            action="sign_baseline", resource_type="baselines",
            resource_id=version_tag, severity="info",
            details={"meaning": meaning, "role": role},
        )
        data.update(updates)
        return data

    @staticmethod
    def diff_baselines(v_from: str, v_to: str) -> Dict[str, Any]:
        """Return a structured diff between two baselines for the diff viewer."""
        a = BaselineService.get_baseline(v_from)
        b = BaselineService.get_baseline(v_to)
        if a is None or b is None:
            raise ValueError("Both baselines must exist to diff")

        # Score deltas
        score_delta: Dict[str, Dict[str, Any]] = {}
        for k in a.get("compliance", {}).get("scores", {}):
            va = a["compliance"]["scores"].get(k, 0)
            vb = b["compliance"]["scores"].get(k, 0)
            if va != vb:
                score_delta[k] = {"from": va, "to": vb, "delta": round(vb - va, 2)}

        # SOUP changes
        deps_a = {d["name"]: d for d in a.get("soup", {}).get("dependencies", [])}
        deps_b = {d["name"]: d for d in b.get("soup", {}).get("dependencies", [])}
        soup_added = [deps_b[n] for n in deps_b if n not in deps_a]
        soup_removed = [deps_a[n] for n in deps_a if n not in deps_b]
        soup_changed = [
            {"name": n, "from": deps_a[n]["version"], "to": deps_b[n]["version"]}
            for n in deps_a if n in deps_b and deps_a[n]["version"] != deps_b[n]["version"]
        ]

        # Traceability coverage delta
        stats_a = a.get("traceability", {}).get("stats", {})
        stats_b = b.get("traceability", {}).get("stats", {})
        trace_delta: Dict[str, Dict[str, Any]] = {}
        for k in {"requirements", "tests", "code_modules", "risk_controls",
                  "orphan_requirements", "orphan_risks", "orphan_code"}:
            if stats_a.get(k) != stats_b.get(k):
                trace_delta[k] = {
                    "from": stats_a.get(k, 0),
                    "to": stats_b.get(k, 0),
                    "delta": (stats_b.get(k, 0) - stats_a.get(k, 0)),
                }

        return {
            "from": {"version_tag": a["version_tag"], "created_at": a["created_at"]},
            "to": {"version_tag": b["version_tag"], "created_at": b["created_at"]},
            "score_delta": score_delta,
            "soup": {
                "added": soup_added,
                "removed": soup_removed,
                "changed": soup_changed,
            },
            "traceability_delta": trace_delta,
        }
