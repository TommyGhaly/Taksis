#!/usr/bin/env python3
"""
backfill_manual_people.py - give pre-existing manual servants a registry entry

Manual servants predate `churches/{c}/ManualPeople`. They were created straight
into `churches/{c}/Servants Meeting` with a `manual_`-prefixed id and nothing
else — see the old add flow in screens/ServantsMeeting/ServantsAttendance.js.

Those people now need the layer that utils/manualPeople.js expects:

    churches/{c}/ManualPeople/{manual_id}                 <- created here
    churches/{c}/Servants Meeting/{manual_id}             <- already exists
    churches/{c}/Sunday School/Servants/Servants/{manual_id}  <- created here

Without a registry entry they still appear in Servants Meeting attendance (that
collection is read directly), but Servants Management cannot list them, edit
them, assign them classes, or sync them to an account.

Attendance is never touched. The Sunday School projection is created with every
class flag false, so a backfilled person appears in nobody's class list until an
admin assigns them one — the same state a newly added manual person starts in.

Usage:
  python backfill_manual_people.py --dry-run        # report, write nothing
  python backfill_manual_people.py                  # every church
  python backfill_manual_people.py --church Wayland # one church

Safe to re-run: every write is a merge, and people who already have a registry
entry are skipped. Requires firebase_admin.json in this directory.
"""

import argparse
import sys
import time

import firebase_admin
from firebase_admin import credentials, firestore

CREDENTIALS_PATH = "firebase_admin.json"

MANUAL_PREFIX = "manual_"

# Keep in step with GRADE_FIELD_BY_LABEL in utils/manualPeople.js.
GRADE_FIELDS = [
    "preSchoolAge3",
    "preSchoolAge4",
    "kindergarten",
    "1", "2", "3", "4", "5", "6",
    "7", "8", "9", "10", "11", "12",
    "college",
]


def log(message=""):
    print(message)
    sys.stdout.flush()


def backfill_church(db, church_ref, church_name, dry_run):
    """Returns (created, skipped) for one church."""
    servants_meeting = church_ref.collection("Servants Meeting")
    registry = church_ref.collection("ManualPeople")
    sunday_school = (
        church_ref.collection("Sunday School")
        .document("Servants")
        .collection("Servants")
    )

    # One read of the registry rather than a get() per candidate. Churches have
    # tens of manual people at most, so holding the ids is free.
    existing = {doc.id for doc in registry.stream()}

    created = 0
    skipped = 0

    for doc in servants_meeting.stream():
        if not doc.id.startswith(MANUAL_PREFIX):
            continue

        if doc.id in existing:
            skipped += 1
            continue

        data = doc.to_dict() or {}
        name = data.get("name") or ""

        # An attendance-only doc with no name cannot be matched to anyone later,
        # and would show up in Servants Management as a blank row. Flag it rather
        # than inventing a name.
        if not name.strip():
            log("    ! %s has no name - skipped, needs a look" % doc.id)
            skipped += 1
            continue

        log("    + %s  (%s)" % (name, doc.id))
        if dry_run:
            created += 1
            continue

        now = int(time.time() * 1000)
        registry.document(doc.id).set(
            {
                "id": doc.id,
                "name": name,
                # The old add flow collected a phone on some records but never an
                # email. Carried over where present so it can help an admin tell
                # two people apart in the sync picker.
                "phone": data.get("phone", ""),
                "email": "",
                "ssGrades": [],
                "manual": True,
                "createdAt": now,
                "updatedAt": now,
                "backfilled": True,
            },
            merge=True,
        )

        ss_doc = {"uid": doc.id, "name": name, "manual": True}
        for field in GRADE_FIELDS:
            ss_doc[field] = False
        # merge=True so a Sunday School doc that somehow already exists keeps its
        # attendance; the class flags are all False either way at this point.
        sunday_school.document(doc.id).set(ss_doc, merge=True)

        created += 1

    return created, skipped


def main():
    parser = argparse.ArgumentParser(
        description="Give pre-existing manual servants a ManualPeople registry entry.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--church", metavar="NAME",
                        help="Only process churches whose id contains NAME "
                             "(case-insensitive).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would be created without writing.")
    args = parser.parse_args()

    cred = credentials.Certificate(CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()

    if args.dry_run:
        log("DRY RUN - nothing will be written.\n")

    total_created = 0
    total_skipped = 0
    churches = 0

    for church in db.collection("churches").stream():
        if args.church and args.church.lower() not in church.id.lower():
            continue
        churches += 1
        log("%s" % church.id)
        created, skipped = backfill_church(
            db, church.reference, church.id, args.dry_run
        )
        if created == 0 and skipped == 0:
            log("    no manual servants")
        total_created += created
        total_skipped += skipped

    log("")
    log("%d church(es): %d %s, %d already registered or skipped." % (
        churches,
        total_created,
        "would be created" if args.dry_run else "created",
        total_skipped,
    ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
