"""
seed_app_config.py - Initialize the Firestore app config document

Creates (or updates) the config/app document that drives:
  - minVersion: minimum native build version required to use the app.
    Bumping this will show the ForceUpdateModal to users on older builds,
    directing them to the App Store / Play Store.

Usage:
  python seed_app_config.py

Requires firebase_admin credentials (uses firebase_admin.json in the same dir).
"""

import firebase_admin
from firebase_admin import credentials, firestore

CREDENTIALS_PATH = "firebase_admin.json"

# ── Config values ─────────────────────────────────────────────────────────────
# Set to the lowest native build version you want to still allow.
# Users on versions below this will be blocked with a force-update screen.
# Current app version is 4.0.1 — set to a previous version to avoid
# immediately blocking anyone already on the latest build.
MIN_VERSION = "4.0.1"

# ── Seed ──────────────────────────────────────────────────────────────────────
cred = credentials.Certificate(CREDENTIALS_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()

doc_ref = db.collection("config").document("app")
doc_ref.set({
    "minVersion": MIN_VERSION,
}, merge=True)

print(f"config/app.minVersion set to {MIN_VERSION}")
