"""
upload_pascha_schedule.py

Reads PaschaSchedule.json from the same directory and uploads the structure
(shell only — no assignees) to Firestore at:
  churches/{churchId}/pascha/schedule_config   ← structural shell (this script)
  churches/{churchId}/pascha/schedule          ← assignees + metadata (app writes, untouched)
  churches/{churchId}/pascha/config            ← legacy config (untouched)

Automatically finds all churches that already have a pascha collection and
uploads to each one. This script is idempotent — re-running resets the shell
without touching the live schedule or config docs.

Run from the same directory as PaschaSchedule.json:
    source venv/bin/activate
    python upload_pascha_schedule.py
"""

import datetime
import json
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("../credentials.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()


# ── Helpers ────────────────────────────────────────────────────────────────────

def strip_assignees(obj):
    ASSIGNEE_KEYS = {
        "assignee", "coptic_assignee",
        "psalm_readers", "psalm_coptic_readers",
    }
    if isinstance(obj, dict):
        return {k: strip_assignees(v) for k, v in obj.items() if k not in ASSIGNEE_KEYS}
    if isinstance(obj, list):
        return [strip_assignees(i) for i in obj]
    return obj


def process_church(church_doc, shell):
    church_id = church_doc.id
    pascha_ref = church_doc.reference.collection("pascha")

    pascha_docs = list(pascha_ref.limit(1).stream())
    if not pascha_docs:
        print(f"  {church_id} — no pascha collection, skipping")
        return False

    pascha_ref.document("schedule_config").set(shell)
    print(f"  {church_id} — ✓ uploaded schedule_config")
    return True


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    json_path = Path(__file__).parent / "PaschaSchedule.json"
    if not json_path.exists():
        print(f"ERROR: Cannot find {json_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    shell = strip_assignees(raw)
    day_count = len(shell.get("days", []))
    hour_count = sum(len(d.get("hours", [])) for d in shell.get("days", []))

    print("Upload Pascha Schedule Shell")
    print(f"Running at: {datetime.datetime.now()}\n")
    print(f"Schedule: {day_count} days, {hour_count} hours")
    print("Will upload schedule_config to all churches with a pascha collection.")
    print("pascha/schedule and pascha/config will NOT be touched.\n")

    response = input("Proceed? (yes/no): ").strip().lower()
    if response != "yes":
        print("Aborted.")
        return

    churches = list(db.collection("churches").stream())
    print(f"\nFound {len(churches)} churches total\n")

    success, skipped = 0, 0
    for church_doc in churches:
        if process_church(church_doc, shell):
            success += 1
        else:
            skipped += 1

    print(f"\nDone. {success} uploaded, {skipped} skipped (no pascha collection).")


if __name__ == "__main__":
    main()