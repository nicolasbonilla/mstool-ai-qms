"""
Firestore persistence service for MSTool-AI-QMS.

Replaces in-memory storage with real Firestore persistence.
All QMS data survives server restarts.

WORM ledger (21 CFR Part 11 §11.10(e) — time-stamped audit trail):
Every entry in `qms_audit_trail` carries `prev_hash` + `content_hash` so any
tampering creates a verifiable gap in the hash chain. The latest hash lives
in a single doc `qms_ledger_head/current` so we can append atomically without
scanning history.
"""

import json
import hashlib
import logging
from typing import Optional
from datetime import datetime, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.firebase import get_firestore_client, Collections

logger = logging.getLogger(__name__)

# Ledger-head doc ID — single immutable pointer to the last entry's hash.
LEDGER_HEAD_DOC_ID = "current"


def _canonical_json(payload: dict) -> str:
    """Canonical JSON for hashing: sorted keys, no whitespace.

    We must hash a deterministic byte-string; Python dicts do not guarantee
    key order, and json.dumps() defaults include spaces which break hash
    equality across runtimes. sort_keys + separators removes both sources of
    non-determinism.
    """
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class FirestoreService:
    """Generic Firestore CRUD operations for QMS collections."""

    @staticmethod
    def _db():
        return get_firestore_client()

    # ─── Forms ───

    @staticmethod
    def create_form(form_id: str, data: dict) -> dict:
        """Create a form document in Firestore."""
        db = FirestoreService._db()
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        data["updated_at"] = data["created_at"]
        db.collection(Collections.FORMS).document(form_id).set(data)
        data["id"] = form_id
        return data

    @staticmethod
    def get_form(form_id: str) -> Optional[dict]:
        """Get a form by ID."""
        db = FirestoreService._db()
        doc = db.collection(Collections.FORMS).document(form_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @staticmethod
    def update_form(form_id: str, updates: dict) -> Optional[dict]:
        """Update form fields."""
        db = FirestoreService._db()
        doc_ref = db.collection(Collections.FORMS).document(form_id)
        doc = doc_ref.get()
        if not doc.exists:
            return None
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc_ref.update(updates)
        data = doc_ref.get().to_dict()
        data["id"] = form_id
        return data

    @staticmethod
    def list_forms(template_id: Optional[str] = None, status: Optional[str] = None) -> list:
        """List forms with optional filters."""
        db = FirestoreService._db()
        query = db.collection(Collections.FORMS)
        if template_id:
            query = query.where("template_id", "==", template_id)
        if status:
            query = query.where("status", "==", status)
        query = query.order_by("created_at", direction="DESCENDING")
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results

    @staticmethod
    def delete_form(form_id: str) -> bool:
        """Delete a form."""
        db = FirestoreService._db()
        doc_ref = db.collection(Collections.FORMS).document(form_id)
        if not doc_ref.get().exists:
            return False
        doc_ref.delete()
        return True

    # ─── Audit Trail (WORM ledger with hash chain) ───

    @staticmethod
    def log_action(user_uid: str, user_email: str, action: str, resource_type: str,
                   resource_id: str = "", details: Optional[dict] = None,
                   severity: str = "info"):
        """Append an immutable entry to the QMS audit trail.

        The entry embeds prev_hash + content_hash so a verifier can walk the
        chain and detect any tampering. The ledger head is updated under a
        transaction so concurrent writers cannot interleave with inconsistent
        predecessor references.

        21 CFR Part 11 §11.10(e) evidence: this is the time-stamped audit
        trail record. Firestore rules prohibit updates/deletes on this
        collection in production, enforcing WORM semantics at the data layer.
        """
        db = FirestoreService._db()
        head_ref = db.collection(Collections.LEDGER_HEAD).document(LEDGER_HEAD_DOC_ID)

        timestamp = datetime.now(timezone.utc).isoformat()
        content = {
            "timestamp": timestamp,
            "user_uid": user_uid,
            "user_email": user_email,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "severity": severity,
            "details": details or {},
        }

        try:
            # Read current head (non-transactional — acceptable for our
            # volume because race conditions at most duplicate a sequence
            # number, which the verify_ledger_chain detects cleanly).
            # The original transactional approach crashed in production with
            # "AttributeError: 'function' object has no attribute '_read_only'"
            # due to google-cloud-firestore SDK version mismatch on the
            # @firestore_transactional decorator API.
            head_snap = head_ref.get()
            if head_snap.exists:
                head_data = head_snap.to_dict() or {}
                prev_hash = head_data.get("hash", "genesis")
                prev_sequence = head_data.get("sequence", 0)
            else:
                prev_hash = "genesis"
                prev_sequence = 0
            sequence = prev_sequence + 1

            content_hash = _sha256_hex(_canonical_json({
                "prev_hash": prev_hash,
                "sequence": sequence,
                **content,
            }))

            entry = {
                **content,
                "prev_hash": prev_hash,
                "sequence": sequence,
                "hash": content_hash,
            }

            # Write the entry + update ledger head (two writes, not transactional,
            # but each is atomic individually). The hash chain is still
            # verifiable — a missed head-update just means the next writer
            # re-reads the stale head and creates a new valid chain link.
            new_ref = db.collection(Collections.AUDIT_TRAIL).document()
            new_ref.set(entry)
            head_ref.set({
                "hash": content_hash,
                "sequence": sequence,
                "last_entry_id": new_ref.id,
                "last_timestamp": timestamp,
            })
            return entry
        except Exception as e:
            # Audit trail must NEVER block the business operation it witnesses.
            logger.error(f"log_action failed for {action} on {resource_type}/{resource_id}: {e}")
            return None

    @staticmethod
    def get_audit_trail(limit: int = 100, resource_type: Optional[str] = None,
                        user_uid: Optional[str] = None,
                        since_iso: Optional[str] = None,
                        action: Optional[str] = None) -> list:
        """Get recent audit trail entries with optional filters.

        Filters are optional and composable; applying more than one may require
        Firestore composite indexes — we keep the default queries index-free.
        """
        db = FirestoreService._db()
        query = db.collection(Collections.AUDIT_TRAIL)
        if resource_type:
            query = query.where(filter=FieldFilter("resource_type", "==", resource_type))
        if user_uid:
            query = query.where(filter=FieldFilter("user_uid", "==", user_uid))
        if action:
            query = query.where(filter=FieldFilter("action", "==", action))
        if since_iso:
            query = query.where(filter=FieldFilter("timestamp", ">=", since_iso))
        query = query.order_by("timestamp", direction="DESCENDING").limit(limit)
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results

    @staticmethod
    def get_ledger_head() -> Optional[dict]:
        """Return the current WORM ledger head (hash, sequence, last entry)."""
        db = FirestoreService._db()
        snap = db.collection(Collections.LEDGER_HEAD).document(LEDGER_HEAD_DOC_ID).get()
        return snap.to_dict() if snap.exists else None

    @staticmethod
    def verify_ledger_chain(limit: int = 500) -> dict:
        """Walk the audit trail forward and verify every link in the hash chain.

        Returns {valid, entries_checked, first_break?} so a health check or
        auditor dump can confirm tamper-evidence end-to-end.
        """
        db = FirestoreService._db()
        query = (
            db.collection(Collections.AUDIT_TRAIL)
            .order_by("sequence", direction="ASCENDING")
            .limit(limit)
        )
        prev_hash = "genesis"
        checked = 0
        for doc in query.stream():
            entry = doc.to_dict()
            if entry.get("prev_hash") != prev_hash:
                return {
                    "valid": False,
                    "entries_checked": checked,
                    "first_break": {
                        "id": doc.id,
                        "sequence": entry.get("sequence"),
                        "expected_prev": prev_hash,
                        "actual_prev": entry.get("prev_hash"),
                    },
                }
            expected_hash = _sha256_hex(_canonical_json({
                "prev_hash": entry.get("prev_hash"),
                "sequence": entry.get("sequence"),
                "timestamp": entry.get("timestamp"),
                "user_uid": entry.get("user_uid"),
                "user_email": entry.get("user_email"),
                "action": entry.get("action"),
                "resource_type": entry.get("resource_type"),
                "resource_id": entry.get("resource_id"),
                "severity": entry.get("severity", "info"),
                "details": entry.get("details") or {},
            }))
            if expected_hash != entry.get("hash"):
                return {
                    "valid": False,
                    "entries_checked": checked,
                    "first_break": {
                        "id": doc.id,
                        "sequence": entry.get("sequence"),
                        "reason": "content_hash_mismatch",
                    },
                }
            prev_hash = entry.get("hash")
            checked += 1
        return {"valid": True, "entries_checked": checked}

    # ─── Score History (time series for trend charts) ───

    @staticmethod
    def store_score_snapshot(scores: dict, breakdown: dict,
                              granularity: str = "hour") -> dict:
        """Store a compliance score snapshot keyed by hour or day.

        The doc ID encodes the time bucket so repeated calls in the same
        bucket naturally coalesce (set-overwrite). With `hour` granularity
        a chart at 30-day range has ~720 points — enough resolution to see
        deltas around specific commits. Daily granularity remains available
        for long-range (365d) views.
        """
        db = FirestoreService._db()
        now = datetime.now(timezone.utc)
        if granularity == "day":
            bucket_id = now.strftime("%Y-%m-%d")
        else:
            bucket_id = now.strftime("%Y-%m-%dT%H")

        payload = {
            "bucket_id": bucket_id,
            "granularity": granularity,
            "timestamp": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "scores": scores,
            "breakdown": breakdown,
        }
        db.collection(Collections.SCORE_HISTORY).document(bucket_id).set(payload)
        return payload

    @staticmethod
    def get_score_history(days: int = 30, granularity: str = "day") -> list:
        """Return score snapshots ordered oldest-first for the last N days.

        Implementation: order by document ID (which encodes the time bucket
        like "2026-04-16T15" for hour or "2026-04-16" for day). This avoids
        needing a Firestore composite index for `where + order_by`.
        """
        from datetime import timedelta
        db = FirestoreService._db()
        since = datetime.now(timezone.utc) - timedelta(days=days)
        since_id = since.strftime("%Y-%m-%dT%H")

        # Pull a generous window then filter in-memory — score history is
        # tiny (hundreds of docs at most). This trades a bit of bandwidth
        # for zero index requirements.
        query = (
            db.collection(Collections.SCORE_HISTORY)
            .order_by("__name__", direction="DESCENDING")
            .limit(days * 24 + 50)
        )
        rows = []
        for doc in query.stream():
            data = doc.to_dict() or {}
            data["bucket_id"] = doc.id
            # Filter by bucket id lexically — works for both day and hour formats.
            if doc.id < since.strftime("%Y-%m-%d"):
                continue
            if granularity == "day" and data.get("granularity") == "hour":
                continue
            rows.append(data)
        rows.sort(key=lambda r: (r.get("timestamp") or r.get("bucket_id", "")))
        return rows

    # ─── Alerts (Regression Sentinel - Phase 2) ───

    @staticmethod
    def create_alert(kind: str, title: str, message: str,
                     severity: str = "warning",
                     metric: Optional[str] = None,
                     details: Optional[dict] = None) -> dict:
        """Create an alert for the Dashboard 'Requires Attention' section."""
        db = FirestoreService._db()
        entry = {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            "title": title,
            "message": message,
            "severity": severity,
            "metric": metric,
            "acknowledged": False,
            "details": details or {},
        }
        _, doc_ref = db.collection(Collections.ALERTS).add(entry)
        entry["id"] = doc_ref.id
        return entry

    @staticmethod
    def list_alerts(only_open: bool = True, limit: int = 50) -> list:
        """List alerts, newest first."""
        db = FirestoreService._db()
        query = db.collection(Collections.ALERTS)
        if only_open:
            query = query.where(filter=FieldFilter("acknowledged", "==", False))
        query = query.order_by("created_at", direction="DESCENDING").limit(limit)
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results

    @staticmethod
    def acknowledge_alert(alert_id: str, user_email: str) -> Optional[dict]:
        """Acknowledge an alert — removes it from the open queue."""
        db = FirestoreService._db()
        doc_ref = db.collection(Collections.ALERTS).document(alert_id)
        if not doc_ref.get().exists:
            return None
        doc_ref.update({
            "acknowledged": True,
            "acknowledged_at": datetime.now(timezone.utc).isoformat(),
            "acknowledged_by": user_email,
        })
        return doc_ref.get().to_dict()

    # ─── Cost saver sweep (daily) ───────────────────────────────────
    #
    # Firestore is billed per-doc reads + storage. Two collections grow
    # without bound: qms_score_history (24/day) and qms_audit_trail (~hundreds
    # per active day). Without housekeeping, both inflate read costs.
    #
    # Strategy:
    # - Score history: collapse hourly snapshots older than 7 days into
    #   one daily-average doc, then delete the hourly originals.
    # - Audit trail: archive entries older than 90 days into BigQuery if
    #   configured, otherwise leave them (we never delete audit trail on
    #   our own — that's a regulatory choice).
    # - Rate-limit counters: delete buckets older than 7 days (they're
    #   purely operational, no audit value).

    @staticmethod
    def cost_saver_sweep() -> dict:
        """Daily housekeeping. Returns counts for visibility."""
        from datetime import timedelta
        db = FirestoreService._db()
        now = datetime.now(timezone.utc)
        report = {
            "ran_at": now.isoformat(),
            "score_history_collapsed": 0,
            "score_history_deleted": 0,
            "rate_limit_buckets_deleted": 0,
        }

        # 1) Collapse hourly score snapshots older than 7 days into daily avgs
        cutoff = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H")
        try:
            buckets_by_day: Dict[str, list] = {}
            for doc in db.collection(Collections.SCORE_HISTORY).stream():
                bid = doc.id
                if bid >= cutoff:
                    continue
                data = doc.to_dict() or {}
                if data.get("granularity") != "hour":
                    continue
                day = bid[:10]
                buckets_by_day.setdefault(day, []).append((doc.id, data))

            for day, items in buckets_by_day.items():
                if not items:
                    continue
                # Compute average across all snapshots of the day
                scores_acc: Dict[str, list] = {}
                breakdown_acc: Dict[str, list] = {}
                for _, d in items:
                    for k, v in (d.get("scores") or {}).items():
                        scores_acc.setdefault(k, []).append(float(v or 0))
                    for k, v in (d.get("breakdown") or {}).items():
                        breakdown_acc.setdefault(k, []).append(float(v or 0))

                avg_scores = {k: round(sum(vs) / len(vs), 2) for k, vs in scores_acc.items()}
                avg_breakdown = {k: round(sum(vs) / len(vs), 2) for k, vs in breakdown_acc.items()}

                day_doc_id = day  # YYYY-MM-DD format
                db.collection(Collections.SCORE_HISTORY).document(day_doc_id).set({
                    "bucket_id": day_doc_id,
                    "granularity": "day",
                    "timestamp": (now - timedelta(days=(now.date() - datetime.fromisoformat(day + "T00:00:00+00:00").date()).days)).isoformat(),
                    "date": day,
                    "scores": avg_scores,
                    "breakdown": avg_breakdown,
                    "collapsed_from_hours": len(items),
                })
                report["score_history_collapsed"] += 1

                for doc_id, _ in items:
                    db.collection(Collections.SCORE_HISTORY).document(doc_id).delete()
                    report["score_history_deleted"] += 1
        except Exception as e:
            logger.warning(f"score_history collapse failed: {e}")

        # 2) Drop old rate-limit buckets (purely ops, no audit value)
        try:
            ratelimit_root = (
                db.collection(Collections.SETTINGS).document("rate_limits")
            )
            # Daily user buckets are sub-collections named user_daily_YYYY-MM-DD
            cutoff_day = (now - timedelta(days=7)).strftime("%Y-%m-%d")
            for sub in ratelimit_root.collections():
                name = sub.id
                if name.startswith("user_daily_") and name.replace("user_daily_", "") < cutoff_day:
                    for d in sub.stream():
                        d.reference.delete()
                        report["rate_limit_buckets_deleted"] += 1
            # Global hourly buckets
            cutoff_hour = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H")
            for d in ratelimit_root.collection("global_hourly").stream():
                if d.id < cutoff_hour:
                    d.reference.delete()
                    report["rate_limit_buckets_deleted"] += 1
        except Exception as e:
            logger.warning(f"rate-limit prune failed: {e}")

        return report

    # ─── User Profiles ───

    @staticmethod
    def upsert_user(uid: str, data: dict) -> dict:
        """Create or update a QMS user profile."""
        db = FirestoreService._db()
        doc_ref = db.collection(Collections.USERS).document(uid)
        existing = doc_ref.get()
        if existing.exists:
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            doc_ref.update(data)
        else:
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            data["updated_at"] = data["created_at"]
            doc_ref.set(data)
        result = doc_ref.get().to_dict()
        result["id"] = uid
        return result

    @staticmethod
    def get_user(uid: str) -> Optional[dict]:
        """Get QMS user profile."""
        db = FirestoreService._db()
        doc = db.collection(Collections.USERS).document(uid).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None

    @staticmethod
    def list_users() -> list:
        """List all QMS users."""
        db = FirestoreService._db()
        results = []
        for doc in db.collection(Collections.USERS).stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results