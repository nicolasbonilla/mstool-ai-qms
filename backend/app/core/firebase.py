"""
Firebase Admin SDK initialization for MSTool-AI-QMS.

Project: mstool-ai-qms (separate from MSTool-AI medical device).
Firestore collections prefixed with 'qms_' to avoid collisions.

IMPORTANT: Cloud Run deploys into the brain-mri-476110 project for the
MSTool-AI medical device, but QMS data lives in the mstool-ai-qms Firestore.
We force QMS_FIREBASE_PROJECT to be read explicitly; if it is missing we
fall back to the hard-coded project ID rather than to Cloud Run's default
(which would silently write to the wrong database).
"""

import os
import logging
from typing import Optional
from firebase_admin import credentials, firestore, auth as firebase_auth
import firebase_admin

logger = logging.getLogger(__name__)

# Canonical QMS project — keeps QMS data isolated from the medical device project.
QMS_PROJECT_ID = "mstool-ai-qms"

_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> firebase_admin.App:
    """Get or initialize the Firebase Admin SDK app pointing at the QMS project."""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    # Resolution order: explicit QMS_FIREBASE_PROJECT, then QMS_PROJECT_ID default.
    # We deliberately do NOT use GOOGLE_CLOUD_PROJECT because Cloud Run sets it
    # to the medical device project (brain-mri-476110), which would route writes
    # to the wrong Firestore.
    project_id = os.environ.get("QMS_FIREBASE_PROJECT", QMS_PROJECT_ID)

    cred = None
    service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        logger.info(f"Firebase: using service account from {service_account_path}")
    else:
        cred = credentials.ApplicationDefault()
        logger.info("Firebase: using Application Default Credentials")

    _firebase_app = firebase_admin.initialize_app(cred, {
        "projectId": project_id,
    })

    logger.info(f"Firebase Admin SDK initialized — QMS project: {project_id}")
    return _firebase_app


def get_firestore_client():
    """Get the Firestore client."""
    get_firebase_app()
    return firestore.client()


def get_active_project_id() -> str:
    """Return the project ID the Firebase app is actually pointing at.

    Used by /system health endpoint to prove to an auditor which Firestore
    instance is being read/written.
    """
    app = get_firebase_app()
    return app.project_id


def verify_id_token(token: str) -> dict:
    """Verify a Firebase ID token and return decoded claims."""
    get_firebase_app()
    return firebase_auth.verify_id_token(token)


def set_custom_claims(uid: str, claims: dict):
    """Set custom claims (role, etc.) on a Firebase user."""
    get_firebase_app()
    firebase_auth.set_custom_user_claims(uid, claims)


def get_user(uid: str):
    """Get Firebase user record."""
    get_firebase_app()
    return firebase_auth.get_user(uid)


def list_users(max_results: int = 100):
    """List Firebase users."""
    get_firebase_app()
    return firebase_auth.list_users(max_results=max_results)


class Collections:
    """Firestore collection names for QMS.

    Naming convention: every collection is prefixed with `qms_` so that if this
    service ever shares a Firestore instance with the medical device app, the
    QMS data is unambiguously separable.
    """
    FORMS = "qms_forms"
    AUDIT_TRAIL = "qms_audit_trail"        # Append-only WORM ledger with hash chain
    USERS = "qms_users"
    AUDIT_RUNS = "qms_audit_runs"
    ALERTS = "qms_alerts"                  # Regression sentinel + drift detector alerts
    SETTINGS = "qms_settings"
    SCORE_HISTORY = "qms_score_history"    # Daily snapshots for trend charts
    BASELINES = "qms_baselines"            # Immutable release snapshots (Phase 3)
    AGENT_RUNS = "qms_agent_runs"          # Per-invocation AI agent records (Phase 4)
    AGENT_VALIDATIONS = "qms_agent_validations"  # IQ/OQ/PQ results (Phase 5)
    LEDGER_HEAD = "qms_ledger_head"        # Single-doc collection holding latest hash