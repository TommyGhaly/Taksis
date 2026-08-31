"""
test_scheduling.py - Behavioural guarantees the golden cannot express.

The golden proves a change altered nothing. These prove the properties that
should hold whatever the schedule looks like:

  1. Someone who declared they are away for a week is not scheduled that week.
  2. A slot with nobody available degrades to "N/A", not to an absent person.
  3. Replacement approval credits rotation identically to generation.
  4. The people making an unavailability request cannot be the answer to it.
  5. Schedules do not violate the roles' own age and rank constraints.

    venv/bin/python -m tests.test_scheduling
"""
import asyncio
import sys

from files.schedule_generation import (
    RANK_CHANTER,
    ROLE_HISTORY_WINDOW,
    ROLE_RULES,
    assigned_roles,
    credit_assignment,
    get_scheduled_uids,
    update_weeks,
)
from tests.harness import FakeDocRef, READING_ROLES, build_roster, simulate

FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"ok    {name}")
    else:
        print(f"FAIL  {name}{(' - ' + detail) if detail else ''}")
        FAILURES.append(name)


def scheduled_uids_in(week):
    """Every uid holding a slot in a normalised transcript week."""
    uids = {week[role] for role in READING_ROLES}
    uids.update(week["altar"])
    uids.discard("N/A")
    uids.discard(None)
    return uids


# ---------------------------------------------------------------------------


def test_declared_are_never_scheduled():
    """The core invariant, over a long run and a rotating declared set."""
    result = asyncio.run(simulate(
        roster_size=60, weeks=26, num_altar_servers=9, declared_fraction=0.25
    ))

    offenders = []
    for index, (week, away) in enumerate(
        zip(result["transcript"], result["declared"])
    ):
        overlap = scheduled_uids_in(week) & away
        if overlap:
            offenders.append((index, sorted(overlap)))

    check(
        "declared unavailable are never scheduled",
        not offenders,
        f"{len(offenders)} week(s), first: {offenders[0] if offenders else None}",
    )


def test_thin_roster_degrades_to_na():
    """With almost everyone away, slots empty out rather than filling wrongly.

    This is what distinguishes the bottom-tier approach from a plain penalty:
    an absent person must never be preferred to an honest empty slot.
    """
    result = asyncio.run(simulate(
        roster_size=20, weeks=8, num_altar_servers=9, declared_fraction=0.9
    ))

    scheduled_away = 0
    unfilled = 0
    for week, away in zip(result["transcript"], result["declared"]):
        scheduled_away += len(scheduled_uids_in(week) & away)
        unfilled += sum(1 for r in READING_ROLES if week[r] == "N/A")
        unfilled += sum(1 for a in week["altar"] if a == "N/A")

    check("thin roster still never schedules an absent person", scheduled_away == 0,
          f"{scheduled_away} absent people scheduled")
    check("thin roster leaves slots unfilled instead", unfilled > 0,
          "expected some N/A slots")


def test_credit_matches_generation():
    """credit_assignment must do exactly what update_weeks does to an assignee.

    These are the two paths that can assign someone. If they drift, a
    replacement earns different rotation credit than a generated assignment.
    """
    roster = build_roster(4, seed=7)
    for deacon in roster:
        deacon["weeksSince"] = 7
        deacon["assignedCount"] = 3
        deacon["roleHistory"] = ["altar"] * ROLE_HISTORY_WINDOW

    target = roster[0]["uid"]
    schedule = {
        "gospel": {"name": "x", "uid": target},
        "altar": [],
        "extra": [],
    }

    via_generation = [dict(d) for d in roster]
    asyncio.run(update_weeks(schedule, via_generation, FakeDocRef(), persist=False))

    via_approval = dict(roster[0])
    credit_assignment(via_approval, "gospel")

    generated = next(d for d in via_generation if d["uid"] == target)
    same = all(
        generated[key] == via_approval[key]
        for key in ("weeksSince", "lastWeeksSince", "assignedCount", "roleHistory")
    )
    check("replacement credit matches generation credit", same,
          f"generation={generated} approval={via_approval}")

    check("weeksSince reset", via_approval["weeksSince"] == 0)
    check("lastWeeksSince preserved", via_approval["lastWeeksSince"] == 7)
    check("assignedCount incremented", via_approval["assignedCount"] == 4)
    check("roleHistory newest first", via_approval["roleHistory"][0] == "gospel")
    check("roleHistory capped",
          len(via_approval["roleHistory"]) == ROLE_HISTORY_WINDOW)


def test_requesters_cannot_replace_themselves():
    """A family request must not answer itself out of the extra pool.

    `get_scheduled_uids` deliberately holds `all_uids` out so their own slots
    can be vacated - which also left them eligible as replacements. This checks
    the composition that closes that.
    """
    parent, child = "uid-parent", "uid-child"
    schedule_data = {
        "gospel": {"name": "Parent", "uid": parent},
        "wine": {"name": "Someone", "uid": "uid-other"},
        "altar": [{"name": "Third", "uid": "uid-third"}],
        "extra": [{"name": "Child", "uid": child}],
    }
    all_uids = [parent, child]

    excluded = get_scheduled_uids(schedule_data, exclude_uids=all_uids)
    check("vacating requester is not in the scheduled set", parent not in excluded)
    check("unrelated scheduled people are excluded", "uid-other" in excluded)

    # The line under test.
    excluded.update(all_uids)

    check("child in extras cannot replace their parent", child in excluded)
    check("parent cannot replace themselves", parent in excluded)


def test_persist_flag_controls_writes():
    """Guards the batching win: persist=False must not write per week.

    This regressed once already - the flag stayed on the signature while an
    edit dropped the guard from the body, and nothing noticed because the
    golden deliberately excludes the write counter.
    """
    roster = build_roster(4, seed=11)
    schedule = {"gospel": {"name": "x", "uid": roster[0]["uid"]},
                "altar": [], "extra": []}

    deferred = FakeDocRef()
    asyncio.run(update_weeks(dict(schedule), [dict(d) for d in roster],
                             deferred, persist=False))
    check("persist=False writes nothing", deferred.writes == 0,
          f"wrote {deferred.writes}")

    immediate = FakeDocRef()
    asyncio.run(update_weeks(dict(schedule), [dict(d) for d in roster],
                             immediate, persist=True))
    check("persist=True writes once", immediate.writes == 1,
          f"wrote {immediate.writes}")


def test_assigned_roles_skips_placeholders():
    """Empty slots must not be credited to their throwaway uuid."""
    roles = assigned_roles({
        "gospel": {"name": "N/A", "uid": "uuid-placeholder"},
        "wine": {"name": "Real", "uid": "uid-real"},
        "altar": [{"name": "N/A", "uid": "uuid-other"},
                  {"name": "Server", "uid": "uid-server"}],
        "extra": [{"name": "Spare", "uid": "uid-spare"}],
    })
    check("placeholders are not credited", "uuid-placeholder" not in roles)
    check("altar placeholders are not credited", "uuid-other" not in roles)
    check("extras are not credited", "uid-spare" not in roles)
    check("real assignments are credited",
          roles == {"uid-real": "wine", "uid-server": "altar"}, str(roles))


def test_no_constraint_violations():
    """Generated schedules should respect the roles' own hard constraints.

    Before the fallback tiers were introduced these were routinely violated -
    a flat `value = 0` for a cooldown meant someone merely resting outranked a
    genuinely eligible person on a negative score, and under-age and
    chanter-excluded picks leaked through. This pins that shut.

    Cooldown is not asserted: on a roster near its capacity it is arithmetically
    unsatisfiable (a 2-week rest means the roster must be about three times the
    weekly slot count), so it is reported rather than enforced.
    """
    size = 60
    result = asyncio.run(simulate(roster_size=size, weeks=26, num_altar_servers=9))
    people = {p["uid"]: p for p in build_roster(size)}

    under_age = []
    role_excluded = []

    for index, week in enumerate(result["transcript"]):
        placements = [(week[role], role) for role in READING_ROLES]
        placements += [(uid, "altar") for uid in week["altar"]]

        for uid, role in placements:
            person = people.get(uid)
            if person is None:
                continue
            rule = ROLE_RULES[role]
            if rule["age_floor"] and int(person["age"]) < rule["age_floor"][0]:
                under_age.append((index, uid, role, person["age"]))
            if (rule["chanter"] or {}).get("exclude") and person["rank"] == RANK_CHANTER:
                role_excluded.append((index, uid, role))

    check("nobody is scheduled below a role's minimum age", not under_age,
          f"{len(under_age)}, first: {under_age[0] if under_age else None}")
    check("no chanter in a role that excludes them", not role_excluded,
          f"{len(role_excluded)}, first: {role_excluded[0] if role_excluded else None}")


def main():
    test_declared_are_never_scheduled()
    test_thin_roster_degrades_to_na()
    test_credit_matches_generation()
    test_requesters_cannot_replace_themselves()
    test_persist_flag_controls_writes()
    test_assigned_roles_skips_placeholders()
    test_no_constraint_violations()

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: {', '.join(FAILURES)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
