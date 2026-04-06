"""
upload_pascha_schedule.py

Reads PaschaSchedule.json from the same directory and uploads the structure
(shell only — no assignees) to Firestore at:
  churches/{churchId}/pascha/schedule_config   ← structural shell (this script)
  churches/{churchId}/pascha/schedule          ← assignees + metadata (app writes, untouched)
  churches/{churchId}/pascha/config            ← legacy config (untouched)

This script is idempotent — re-running resets the shell without touching
the live schedule or config docs.

Usage:
  pip install firebase-admin
  python upload_pascha_schedule.py --church <churchId> [--creds path/to/serviceAccount.json]
"""

import argparse
import json
import sys
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore


# ── Helpers ────────────────────────────────────────────────────────────────────

def strip_assignees(obj):
    """
    Recursively remove assignee fields so the uploaded shell contains only
    structural data (references, labels, languages, easterOffset, etc.).
    """
    ASSIGNEE_KEYS = {
        "assignee", "coptic_assignee",
        "psalm_readers", "psalm_coptic_readers",
    }
    if isinstance(obj, dict):
        return {
            k: strip_assignees(v)
            for k, v in obj.items()
            if k not in ASSIGNEE_KEYS
        }
    if isinstance(obj, list):
        return [strip_assignees(i) for i in obj]
    return obj


def build_shell(raw: dict) -> dict:
    return strip_assignees(raw)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Upload Pascha schedule shell to Firestore.")
    parser.add_argument("--church", required=True, help="Firestore church document ID")
    parser.add_argument(
        "--creds",
        default=None,
        help="Path to Firebase service account JSON (omit to use GOOGLE_APPLICATION_CREDENTIALS)",
    )
    parser.add_argument(
        "--input",
        default=None,
        help="Path to PaschaSchedule.json (default: PaschaSchedule.json next to this script)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the shell that would be uploaded without writing to Firestore",
    )
    args = parser.parse_args()

    # ── Load JSON ──────────────────────────────────────────────────────────────
    json_path = Path(args.input) if args.input else Path(__file__).parent / "PaschaSchedule.json"
    if not json_path.exists():
        print(f"ERROR: Cannot find schedule file at {json_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, encoding="utf-8") as f:
        raw = json.load(f)

    shell = build_shell(raw)

    if args.dry_run:
        print(json.dumps(shell, indent=2, ensure_ascii=False))
        print(f"\n[dry-run] Would upload to churches/{args.church}/pascha/schedule_config")
        print("          churches/{args.church}/pascha/schedule   ← NOT touched")
        print("          churches/{args.church}/pascha/config     ← NOT touched")
        return

    # ── Init Firebase ──────────────────────────────────────────────────────────
    if not firebase_admin._apps:
        if args.creds:
            cred = credentials.Certificate(args.creds)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

    db = firestore.client()

    # ── Upload to schedule_config only ────────────────────────────────────────
    # pascha/schedule and pascha/config are NOT touched — they hold live data.
    ref = (
        db.collection("churches")
          .document(args.church)
          .collection("pascha")
          .document("schedule_config")
    )

    ref.set(shell)  # full overwrite of the shell doc only

    day_count  = len(shell.get("days", []))
    hour_count = sum(len(d.get("hours", [])) for d in shell.get("days", []))
    print(f"✓ Uploaded schedule shell: {day_count} days, {hour_count} hours")
    print(f"  → churches/{args.church}/pascha/schedule_config")
    print(f"  pascha/schedule and pascha/config were NOT modified.")


if __name__ == "__main__":
    main()