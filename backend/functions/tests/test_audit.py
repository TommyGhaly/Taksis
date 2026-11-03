"""
test_audit.py - The schedule audit's diffing and entry keys.

  1. The endpoint and the trigger derive the same entry id from one commit.
  2. Diffs are about people, not slot positions.
  3. A bare status write is read as that person's own answer.

    venv/bin/python -m tests.test_audit
"""
import sys

from google.cloud.firestore_v1.types import write
from google.events.cloud.firestore_v1.types import data as event_data
from google.protobuf.timestamp_pb2 import Timestamp

from files.audit import diff_schedule, entry_id, infer_action

FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"ok    {name}")
    else:
        print(f"FAIL  {name}{(' - ' + detail) if detail else ''}")
        FAILURES.append(name)


def person(uid, status=None):
    slot = {"uid": uid, "name": uid.title()}
    if status:
        slot["status"] = status
    return slot


NA = {"name": "N/A", "uid": "0b6c-placeholder"}


def week(**overrides):
    base = {
        "gospel": person("gabe"),
        "pauline": person("paul"),
        "altar": [person("andy"), person("abe")],
        "extra": [person("ezra"), person("eli")],
    }
    base.update(overrides)
    return base


def test_entry_ids_agree():
    ts = Timestamp(seconds=1793750400, nanos=123456789)
    from_write = write.WriteResult(update_time=ts).update_time
    from_trigger = event_data.Document(update_time=ts).update_time
    check(
        "endpoint and trigger key the same commit identically",
        entry_id("11-08-26", from_write) == entry_id("11-08-26", from_trigger)
        == "11-08-26_1793750400123456789",
    )


def test_swap():
    after = week(gospel=person("ezra"), extra=[person("gabe"), person("eli")])
    changes = {c["uid"]: (c["from"], c["to"]) for c in diff_schedule(week(), after)}
    check("swap records both people", changes == {
        "gabe": ("gospel", "extra"), "ezra": ("extra", "gospel"),
    }, str(changes))


def test_altar_shift_is_not_a_change():
    # andy leaves; abe moves from index 1 to 0. Only andy changed.
    after = week(altar=[person("abe")], extra=[person("andy"), person("ezra"), person("eli")])
    changes = diff_schedule(week(), after)
    check("index shift within altar is ignored",
          [c["uid"] for c in changes] == ["andy"], str(changes))


def test_vacated_slot():
    after = week(gospel=dict(NA))
    changes = diff_schedule(week(), after)
    check("vacating to N/A shows the person leaving, no phantom arrival",
          [(c["uid"], c["from"], c["to"]) for c in changes] == [("gabe", "gospel", None)],
          str(changes))


def test_status_answer():
    after = week(gospel=person("gabe", "unsure"))
    changes = diff_schedule(week(), after)
    check("status change is recorded with before and after",
          changes == [{"uid": "gabe", "name": "Gabe", "from": "gospel", "to": "gospel",
                       "statusBefore": None, "statusAfter": "unsure"}], str(changes))
    action, actor = infer_action(week(), after, changes)
    check("a lone status write is the person's own answer",
          action == "availability_response" and actor["uid"] == "gabe" and actor["inferred"])


def test_creation_lists_lineup_only():
    changes = diff_schedule(None, week())
    check("new week lists who was scheduled, not the extra pool",
          sorted(c["uid"] for c in changes) == ["abe", "andy", "gabe", "paul"], str(changes))
    check("new week is attributed to generation",
          infer_action(None, week(), changes)[0] == "schedule_created")


def test_noop_write():
    renamed = week(gospel={"uid": "gabe", "name": "Gabriel"})
    check("a rename moves nobody", diff_schedule(week(), renamed) == [])


def main():
    test_entry_ids_agree()
    test_swap()
    test_altar_shift_is_not_a_change()
    test_vacated_slot()
    test_status_answer()
    test_creation_lists_lineup_only()
    test_noop_write()

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
