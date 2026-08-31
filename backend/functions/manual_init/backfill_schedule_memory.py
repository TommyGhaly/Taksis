"""
backfill_schedule_memory.py - Give the scheduling memory a history.

The scoring memory added to schedule_generation.py reads three fields on
churches/{id}.deacons[]: assignedCount, declinedCount and roleHistory. Without
a backfill every servant looks brand new, so the reliability term has nothing
to say for months and the famine term treats a ten-year veteran as a newcomer.

All three can be reconstructed from data already stored:

  * churches/{id}/archive/{MM-DD-YY} - past schedules, so who actually served,
    in what role, and in what order.
  * users/{uid}.unavailableWeeks     - weeks they marked themselves unavailable.
  * users/{uid}.switched_weeks       - weeks an admin swapped them off.

Someone who declines is replaced before the week is archived, so the archive
holds who *served* and the two user arrays hold who *dropped out*. Hence:

    declinedCount = declines
    assignedCount = served + declines      (they were assigned either way)

Dry run by default - prints what it would write and changes nothing:

    venv/bin/python -m manual_init.backfill_schedule_memory
    venv/bin/python -m manual_init.backfill_schedule_memory --commit
    venv/bin/python -m manual_init.backfill_schedule_memory --church <id>
"""
import argparse
import datetime
import os
import sys

from firebase_admin import initialize_app, firestore, credentials

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Keep the window in step with the scheduler.
ROLE_HISTORY_WINDOW = 8

# Roles that hold a single person; `altar` is a list. `extra` is not a role.
SINGLE_ROLES = {
    "wine", "gospel", "water", "praxis", "catholic",
    "pauline", "sixth", "third", "matins",
}


def week_key(week_id):
    """MM-DD-YY -> sortable date. Unparseable ids sort first and are ignored."""
    try:
        return datetime.datetime.strptime(week_id, "%m-%d-%y")
    except ValueError:
        return datetime.datetime.min


def appearances_from_archive(church_ref):
    """uid -> list of (date, role), most recent first."""
    history = {}
    for doc in church_ref.collection("archive").stream():
        when = week_key(doc.id)
        if when == datetime.datetime.min:
            continue
        data = doc.to_dict() or {}
        for role, value in data.items():
            if role == "extra":
                continue
            entries = value if isinstance(value, list) else [value]
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                uid = entry.get("uid")
                if uid and entry.get("name") not in (None, "N/A"):
                    history.setdefault(uid, []).append((when, role))

    for uid in history:
        history[uid].sort(key=lambda pair: pair[0], reverse=True)
    return history


def declines_by_uid(client, uids):
    """uid -> number of weeks they dropped out of, from the user documents."""
    result = {}
    users = client.collection("users")
    # get_all takes references; chunk to keep the request size sane.
    refs = [users.document(uid) for uid in uids]
    for start in range(0, len(refs), 300):
        for doc in client.get_all(refs[start:start + 300]):
            if not doc.exists:
                continue
            data = doc.to_dict() or {}
            weeks = set(data.get("unavailableWeeks") or [])
            weeks.update(data.get("switched_weeks") or [])
            result[doc.id] = len(weeks)
    return result


def backfill_church(client, church_doc, commit):
    church_ref = church_doc.reference
    deacons = (church_doc.to_dict() or {}).get("deacons", [])
    if not deacons:
        return 0

    history = appearances_from_archive(church_ref)
    declines = declines_by_uid(client, [d["uid"] for d in deacons if d.get("uid")])

    changed = 0
    for deacon in deacons:
        uid = deacon.get("uid")
        if not uid:
            continue

        served = history.get(uid, [])
        declined = declines.get(uid, 0)

        assigned_count = len(served) + declined
        role_history = [role for _, role in served[:ROLE_HISTORY_WINDOW]]

        before = (
            deacon.get("assignedCount"),
            deacon.get("declinedCount"),
            deacon.get("roleHistory"),
        )
        after = (assigned_count, declined, role_history)
        if before == after:
            continue

        deacon["assignedCount"] = assigned_count
        deacon["declinedCount"] = declined
        deacon["roleHistory"] = role_history
        changed += 1

        print(
            f"    {deacon.get('name', uid):<28} "
            f"served={len(served):>3} declined={declined:>3} "
            f"assigned={assigned_count:>3}  {role_history}"
        )

    if changed and commit:
        church_ref.update({"deacons": deacons})
    return changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true",
                        help="actually write; omit for a dry run")
    parser.add_argument("--church", help="limit to one church id")
    args = parser.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    initialize_app(credential=credentials.Certificate(
        os.path.join(here, "..", "credentials.json")
    ))
    client = firestore.client()

    if args.church:
        churches = [client.collection("churches").document(args.church).get()]
    else:
        churches = list(client.collection("churches").stream())

    total = 0
    for church_doc in churches:
        if not church_doc.exists:
            print(f"church {church_doc.id}: not found")
            continue
        print(f"\nchurch {church_doc.id}")
        total += backfill_church(client, church_doc, args.commit)

    mode = "written" if args.commit else "would change (dry run)"
    print(f"\n{total} roster entries {mode}")
    if not args.commit:
        print("re-run with --commit to apply")


if __name__ == "__main__":
    main()
