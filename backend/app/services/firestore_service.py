"""
Firestore persistence service for MSTool-AI-QMS.

Replaces in-memory storage with real Firestore persistence.
All QMS data survives server restarts.
"""

import logging
from typing import Optional
from datetime import datetime, timezone

from app.core.firebase import get_firestore_client, Collections

logger = logging.getLogger(__name__)


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

    # ─── Audit Trail ───

    @staticmethod
    def log_action(user_uid: str, user_email: str, action: str, resource_type: str,
                   resource_id: str = "", details: dict = None):
        """Log an immutable audit trail entry."""
        db = FirestoreService._db()
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_uid": user_uid,
            "user_email": user_email,
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
        }
        db.collection(Collections.AUDIT_TRAIL).add(entry)
        return entry

    @staticmethod
    def get_audit_trail(limit: int = 100, resource_type: Optional[str] = None) -> list:
        """Get recent audit trail entries."""
        db = FirestoreService._db()
        query = db.collection(Collections.AUDIT_TRAIL)
        if resource_type:
            query = query.where("resource_type", "==", resource_type)
        query = query.order_by("timestamp", direction="DESCENDING").limit(limit)
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(data)
        return results

    # ─── Score History ───

    @staticmethod
    def store_score_snapshot(scores: dict, breakdown: dict):
        """Store a compliance score snapshot for trend tracking."""
        db = FirestoreService._db()
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        doc_ref = db.collection(Collections.SCORE_HISTORY).document(today)
        doc_ref.set({
            "date": today,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scores": scores,
            "breakdown": breakdown,
        })

    @staticmethod
    def get_score_history(days: int = 30) -> list:
        """Get score snapshots for the last N days."""
        db = FirestoreService._db()
        query = db.collection(Collections.SCORE_HISTORY).order_by("date", direction="DESCENDING").limit(days)
        results = []
        for doc in query.stream():
            data = doc.to_dict()
            results.append(data)
        return list(reversed(results))

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