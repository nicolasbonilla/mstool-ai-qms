"""
Firebase Admin SDK initialization for MSTool-AI-QMS.

Project: mstool-ai-qms (separate from MSTool-AI medical device).
Firestore collections prefixed with 'qms_' to avoid collisions.
"""

import os
import logging
from typing import Optional
from firebase_admin import credentials, firestore, auth as firebase_auth
import firebase_admin

logger = logging.getLogger(__name__)

_firebase_app: Optional[firebase_admin.App] = None


def get_firebase_app() -> firebase_admin.App:
    """Get or initialize the Firebase Admin SDK app."""
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    cred = None
    service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        logger.info(f"Firebase: using service account from {service_account_path}")
    else:
        cred = credentials.ApplicationDefault()
        logger.info("Firebase: using Application Default Credentials")

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "mstool-ai-qms")

    _firebase_app = firebase_admin.initialize_app(cred, {
        "projectId": project_id,
    })

    logger.info(f"Firebase Admin SDK initialized (project: {project_id})")
    return _firebase_app


def get_firestore_client():
    """Get the Firestore client."""
    get_firebase_app()
    return firestore.client()


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
    """Firestore collection names for QMS."""
    FORMS = "qms_forms"
    AUDIT_TRAIL = "qms_audit_trail"
    USERS = "qms_users"
    AUDIT_RUNS = "qms_audit_runs"
    ALERTS = "qms_alerts"
    SETTINGS = "qms_settings"