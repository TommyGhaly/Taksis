"""
schedule.py - Deacon Scheduling System for Taksis Church App

This module implements an automated scheduling algorithm for assigning deacons
to various liturgical roles during Sunday services. The system uses a weighted
scoring algorithm that considers factors like time since last service, age
appropriateness, experience level, and rank.

Key Features:
- Automated weekly schedule generation for all churches
- Role-specific scoring algorithms (different criteria for each liturgical role)
- Support for "full deacon" churches with ordained deacons
- Unavailability handling with automatic replacement assignment
- Family-aware scheduling (parents can mark children unavailable)

Liturgical Roles (in order of priority):
- Wine Bearer: Highest responsibility, requires ordained deacon or experienced server
- Gospel Reader: Reads the Gospel, requires strong reading skills
- Water Bearer: Assists with communion preparation
- Praxis Reader: Reads from Acts of the Apostles
- Catholic Epistle Reader: Reads Catholic epistles
- Pauline Epistle Reader: Reads Pauline epistles
- Sixth Hour Reader: Reads during 6th hour prayers
- Third Hour Reader: Reads during 3rd hour prayers
- Matins Reader: Reads during morning prayers
- Altar Servers: General altar service duties
"""

from typing import *
import asyncio
import uuid
import datetime
import logging
from google.cloud import firestore
import random
from firebase_admin import auth
import requests
logging.info('Attempting to import utility and notification_manager in schedule_generation')
from files.utility import *
from files.notification_manager import *
# Sample-size-aware scoring, shared with the attendance reports: a perfect
# record over 2 weeks must not outrank a strong record over 40.
from attendance_statistics import wilson_lower_bound
logging.info('Successfully imported utility and notification_manager in schedule_generation')
import firebase_functions as https_fn


# ============================================================================
# SCORING ALGORITHM
# ============================================================================
#
# The ten liturgical roles were, until now, ten near-identical 25-line
# functions that differed only in constants. Scoring lives in one place; the
# per-role differences live in ROLE_RULES below, so adding a role or retuning
# one is a table edit rather than another copy-paste.
#
# The arithmetic here is deliberately order-sensitive and reproduces the
# original term-by-term, including two quirks that look like bugs but are
# load-bearing for existing schedules:
#
#   * `experience` is int-truncated, `frequency` is not. An experience of 7.9
#     scores as 7.
#   * For the four roles that exclude chanters, a chanter short-circuits to
#     exactly 0 and never reaches the age floor or the cooldown check. The
#     original expressed this as `continue`; it is `return` here.

RANK_CHANTER = "Chanter (Epsaltos)"

# Weeks since last serving is the dominant term - the rotation driver.
ROTATION_WEIGHT = 4
# Flat bonus for sitting inside a role's ideal age window.
AGE_WINDOW_BONUS = 30

# Fallback tiers, for when a role cannot be filled by anyone properly eligible.
#
# These used to be 0 (cooldown, and chanters in a role that excludes them) and
# -40/-20 (below the minimum age). That is not a ladder: a genuinely eligible
# person can legitimately score negative - a gospel candidate with weeksSince=2
# and zero frequency and experience scores about -37 - so a person merely
# resting outranked someone who was actually available. Explicit tiers, far
# below any real score, keep "last resort" meaning last resort.
#
# Ordering is a judgement about which compromise is least bad when a slot would
# otherwise go unfilled:
#   1. someone who served too recently  (breaks rotation only)
#   2. a chanter in a non-chanter role  (breaks liturgical convention)
#   3. someone below the role's minimum age
#   4. someone who has told us they are away that week
# Everyone stays reachable - nothing is dropped from the pool - so a slot is
# only ever left empty when the roster is genuinely exhausted.
#
# A declared absence sits at the bottom on purpose. The others are judgements
# about suitability; this one is a statement of fact.
#
# Note this tier is the *ranking* signal only. Refusing to fill a slot with an
# absent person is enforced separately, by `add_person`, because leaving the
# slot empty has to beat every remaining candidate and a score cannot say that.
# The tier still matters for `find_replacement`, which returns the top-scored
# candidate and has no empty-slot option of its own.
SCORE_COOLDOWN = -1000
SCORE_ROLE_EXCLUDED = -2000
SCORE_UNDER_AGE = -3000
SCORE_DECLARED_UNAVAILABLE = -4000


# ---------------------------------------------------------------------------
# Scheduling memory
# ---------------------------------------------------------------------------
#
# `weeksSince` alone cannot tell these three situations apart:
#
#   * someone who is repeatedly assigned and repeatedly does not come
#   * someone reliable who is simply never quite the top score
#   * someone who serves often, but always in the same role
#
# In all three cases weeksSince looks identical. These terms add the missing
# history. Each is weighted, and every weight defaults to 0 - with the defaults
# the score is exactly the rotation/age/frequency algorithm, so the memory
# layer is enabled per church and rolled back by setting the weights to 0.
DEFAULT_WEIGHTS = {
    # How much rotation credit an unreliable person forfeits, 0..1.
    #
    # This one is a multiplier on the weeksSince term, not an offset, and that
    # distinction is the whole point. weeksSince grows without bound at +1 a
    # week, so a fixed penalty is always overtaken eventually - a chronic
    # no-show simply waits out any subtraction and returns to the top of the
    # queue. Damping the accrual instead means someone who is assigned and does
    # not come stops building up a claim to the next slot.
    #
    # At 0.8, someone who has never once turned up accrues 20% of normal
    # rotation credit; someone with a spotless record accrues all of it.
    "reliability": 0.0,
    # Additive boost, in score points, for people who have served fewer times
    # than the roster median.
    "famine": 0.0,
    # Additive penalty, in score points, for a role you have held repeatedly.
    "role_repeat": 0.0,
}

# How many past assignments `roleHistory` keeps, and the window the repeat
# penalty is measured over.
ROLE_HISTORY_WINDOW = 8

# Direct score penalty applied to someone with zero reliability, at weight 1.
#
# Damping rotation credit alone is not enough to change who gets picked. The
# age-window bonus is worth 30 points and the rotation term is only about
# 4 x weeksSince, so on a roster with more people than slots the age bonus
# decides the ranking and a chronic no-show in the right age band still wins.
# Set above AGE_WINDOW_BONUS so that never turning up outweighs being an ideal
# age for the role.
RELIABILITY_PENALTY = 40


def resolve_weights(overrides=None):
    """Merge a church's `scheduleWeights` map over the defaults.

    Unknown keys are ignored and non-numeric values fall back to the default,
    so a typo in the Firestore document cannot break generation.
    """
    weights = dict(DEFAULT_WEIGHTS)
    for key, value in (overrides or {}).items():
        if key in weights:
            try:
                weights[key] = float(value)
            except (TypeError, ValueError):
                continue
    return weights


def reliability_score(deacon):
    """0-100 confidence that this person serves when assigned, or None.

    Built from counters maintained on the roster entry rather than a separate
    read: `assignedCount` every time they are put on a schedule,
    `declinedCount` every time they then drop out.

    None means "not enough history to judge" - newcomers are not penalised for
    having no record.
    """
    assigned = deacon.get("assignedCount") or 0
    declined = deacon.get("declinedCount") or 0
    served = max(0, assigned - declined)
    return wilson_lower_bound(served, assigned)


def rotation_multiplier(deacon, context):
    """How much of this person's rotation credit counts, 0..1.

    Someone with no history yet is unaffected - a newcomer must not be damped
    for having nothing on record.
    """
    weight = context["weights"]["reliability"]
    if not weight:
        return 1.0

    score = reliability_score(deacon)
    if score is None:
        return 1.0

    return 1.0 - weight * (1.0 - (score / 100.0))


def memory_bonus(deacon, role, context):
    """The additive history terms. Zero when weights are at their defaults."""
    weights = context["weights"]
    bonus = 0.0

    if weights["reliability"]:
        score = reliability_score(deacon)
        if score is not None:
            # Scales with how much of their record is no-shows. Someone with a
            # clean record pays nothing.
            shortfall = 1.0 - (score / 100.0)
            bonus -= shortfall * weights["reliability"] * RELIABILITY_PENALTY

    if weights["famine"]:
        median = context["median_assigned"]
        if median > 0:
            deficit = median - (deacon.get("assignedCount") or 0)
            if deficit > 0:
                # Capped at 1, so someone who has never served gets the full
                # boost rather than an unbounded one.
                bonus += min(1.0, deficit / median) * weights["famine"]

    if weights["role_repeat"]:
        history = (deacon.get("roleHistory") or [])[:ROLE_HISTORY_WINDOW]
        if history:
            repeats = history.count(role)
            bonus -= (repeats / float(ROLE_HISTORY_WINDOW)) * weights["role_repeat"]

    return bonus


def declared_unavailable_uids(client, uids, week_id):
    """Of `uids`, those who have told us they cannot make `week_id`.

    `users/{uid}.unavailableWeeks` is written by the app whenever someone marks
    themselves (or their family) unavailable. Until now nothing on the backend
    read it, so the scheduler happily assigned - and suggested as replacements -
    people who had already said they would be away.

    Week ids are "MM-DD-YY" on both sides: the app formats them that way and
    they are the schedule document ids, so this is a plain membership test.

    One `get_all` for the whole candidate list, matching the batching used by
    `set_next_week_serve` and `update_last_serve`. This sits on the user-facing
    unavailability path, so it must not become a read per candidate.
    """
    uids = [uid for uid in uids if uid]
    if not uids or not week_id:
        return set()

    users = client.collection("users")
    away = set()
    for start in range(0, len(uids), 300):
        refs = [users.document(uid) for uid in uids[start:start + 300]]
        for doc in client.get_all(refs):
            if not doc.exists:
                continue
            if week_id in ((doc.to_dict() or {}).get("unavailableWeeks") or []):
                away.add(doc.id)
    return away


def build_context(deacons, weights=None, unavailable_uids=None):
    """Roster-level values the per-deacon scoring needs, computed once."""
    counts = [d.get("assignedCount") or 0 for d in deacons]
    counts.sort()
    if counts:
        mid = len(counts) // 2
        median = (
            counts[mid] if len(counts) % 2
            else (counts[mid - 1] + counts[mid]) / 2.0
        )
    else:
        median = 0
    return {
        "weights": resolve_weights(weights),
        "median_assigned": median,
        "unavailable_uids": unavailable_uids or set(),
    }

# Per-role rules. Keys:
#   age_window  (min_inclusive, max_exclusive) for the +30 bonus
#   frequency   (offset, multiplier)
#   experience  (offset, multiplier) or None if the role ignores it
#   chanter     None if rank is ignored, else:
#                 {"exclude": True}            -> chanter scores exactly 0
#                 {"bonus": n}                 -> chanter gets +n
#                 {"non_chanter": n}           -> everyone else gets +n
#   age_floor   (min_age, penalty) or None
#   cooldown    minimum weeksSince to be eligible
ROLE_RULES = {
    "matins": {
        "age_window": (13, 25), "frequency": (3, 0.4), "experience": (4, 0.12),
        "chanter": None, "age_floor": None, "cooldown": 2,
    },
    "third": {
        "age_window": (9, 18), "frequency": (3, 0.4), "experience": None,
        "chanter": {"bonus": 12}, "age_floor": None, "cooldown": 2,
    },
    "sixth": {
        "age_window": (9, 18), "frequency": (3, 0.4), "experience": None,
        "chanter": {"bonus": 12}, "age_floor": None, "cooldown": 2,
    },
    "pauline": {
        "age_window": (14, 45), "frequency": (3, 0.4), "experience": None,
        "chanter": {"exclude": True, "non_chanter": 2.4},
        "age_floor": (12, -40), "cooldown": 2,
    },
    "catholic": {
        "age_window": (14, 45), "frequency": (3, 0.4), "experience": None,
        "chanter": {"exclude": True, "non_chanter": 2.4},
        "age_floor": (12, -40), "cooldown": 2,
    },
    "praxis": {
        "age_window": (16, 45), "frequency": (3, 0.4), "experience": None,
        "chanter": {"exclude": True, "non_chanter": 2.4},
        "age_floor": (12, -40), "cooldown": 3,
    },
    "gospel": {
        "age_window": (18, 55), "frequency": (5, 5), "experience": (5, 5),
        "chanter": {"exclude": True, "non_chanter": 5},
        "age_floor": (15, -20), "cooldown": 3,
    },
    "water": {
        "age_window": (16, 40), "frequency": (6, 0.4), "experience": (7, 0.23),
        "chanter": None, "age_floor": (10, -40), "cooldown": 2,
    },
    "wine": {
        "age_window": (26, 60), "frequency": (7, 0.4), "experience": (8.4, 0.23),
        "chanter": None, "age_floor": (18, -40), "cooldown": 2,
    },
    "altar": {
        "age_window": (11, 25), "frequency": (4, 0.4), "experience": None,
        "chanter": None, "age_floor": None, "cooldown": 2,
    },
}


def sort_values(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts deacons by their calculated 'value' score in descending order.

    Python's sort is stable, so equal scores keep the incoming order - which is
    `sort_deacons`' weeksSince ordering. That tiebreak is relied on: with a
    cooldown the top of a role list is frequently an all-zero block.
    """
    return sorted(deacons, key=lambda deacon: deacon["value"], reverse=True)


def score_for_role(deacon: Dict[str, Any], role: str, context: Dict[str, Any] = None) -> float:
    """Score one deacon for one role. Pure - does not touch the dict.

    `context` carries the memory weights and roster-level aggregates from
    `build_context`. Omitting it scores on rotation/age/frequency alone.
    """
    rule = ROLE_RULES[role]
    age = int(deacon["age"])

    value = 0
    value += (
        deacon["weeksSince"] * ROTATION_WEIGHT
        * (rotation_multiplier(deacon, context) if context is not None else 1.0)
    )

    low, high = rule["age_window"]
    if low <= age < high:
        value += AGE_WINDOW_BONUS

    offset, multiplier = rule["frequency"]
    value += (deacon["frequency"] - offset) * multiplier

    if rule["experience"] is not None:
        offset, multiplier = rule["experience"]
        value += (int(deacon["experience"]) - offset) * multiplier

    chanter = rule["chanter"]
    if chanter is not None:
        if deacon["rank"] == RANK_CHANTER:
            if chanter.get("exclude"):
                return SCORE_ROLE_EXCLUDED
            value += chanter.get("bonus", 0)
        else:
            value += chanter.get("non_chanter", 0)

    if context is not None:
        value += memory_bonus(deacon, role, context)

        if deacon["uid"] in context["unavailable_uids"]:
            return SCORE_DECLARED_UNAVAILABLE

    # Hard constraints last, most severe wins. These override the memory terms
    # deliberately: no amount of being overlooked makes someone old enough.
    if rule["age_floor"] is not None and age < rule["age_floor"][0]:
        return SCORE_UNDER_AGE

    if deacon["weeksSince"] < rule["cooldown"]:
        return SCORE_COOLDOWN

    return value


def score_role(deacons: List[Dict[str, Any]], role: str, context: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Score every deacon for `role` and return them ranked best-first.

    Writes `value` onto each dict for backwards compatibility - callers such as
    `find_replacement` read it. Note the caller owns the copies: scoring the
    same list for two roles overwrites `value`, which is why `create_schedule`
    now captures rankings rather than relying on the field afterwards.
    """
    for deacon in deacons:
        deacon["value"] = score_for_role(deacon, role, context)
    return sort_values(deacons)


# Named per-role wrappers. `main.py` does `from files.schedule_generation
# import *` and `find_replacement` dispatches on these by name, so they stay.
def matins(deacons):   return score_role(deacons, "matins")
def third(deacons):    return score_role(deacons, "third")
def sixth(deacons):    return score_role(deacons, "sixth")
def pauline(deacons):  return score_role(deacons, "pauline")
def catholic(deacons): return score_role(deacons, "catholic")
def praxis(deacons):   return score_role(deacons, "praxis")
def gospel(deacons):   return score_role(deacons, "gospel")
def water(deacons):    return score_role(deacons, "water")
def wine(deacons):     return score_role(deacons, "wine")
def altar(deacons):    return score_role(deacons, "altar")

# ============================================================================
# SCHEDULE GENERATION FUNCTIONS
# ============================================================================

def sort_deacons(deacons: List[Dict]) -> List[Dict]:
    """Order the candidate pool by rotation debt, most overdue first.

    This is the input order every role scorer sees, and because `sort_values`
    is a stable sort it is also the tiebreak between equal scores.

    It used to truncate to the top 25. That was labelled a performance
    optimisation, but ranking 10 roles over even a 200-person roster is
    microseconds - and the cut was made on `weeksSince` *before* any role
    scoring, so a servant who was an ideal fit for a role but only moderately
    overdue was invisible to it. The 30-point age-window bonus outweighs
    several weeks of rotation, so those were exactly the picks worth having.
    """
    return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)


def credit_assignment(deacon: Dict[str, Any], role: str) -> None:
    """Record, on a roster entry, that this person has been put on a schedule.

    Resets their rotation debt and advances the memory counters:
    `assignedCount` is the denominator of the reliability score and the basis of
    the famine boost, and `roleHistory` is what the repeat penalty reads.

    Shared by the two paths that can assign someone - `update_weeks` at
    generation, and the admin approving a replacement in
    `handle_unavailable_requests`. Approval used to write the schedule and
    nothing else, so covering as a replacement earned no rotation credit at all
    and the same obliging people were pulled in week after week.
    """
    deacon["lastWeeksSince"] = deacon["weeksSince"]
    deacon["weeksSince"] = 0
    deacon["assignedCount"] = (deacon.get("assignedCount") or 0) + 1

    history = list(deacon.get("roleHistory") or [])
    history.insert(0, role)
    deacon["roleHistory"] = history[:ROLE_HISTORY_WINDOW]


def assigned_roles(schedule_dict: Dict[str, Any]) -> Dict[str, str]:
    """uid -> the role they hold in this schedule. Skips `extra` and empty slots."""
    roles = {}
    for key, value in schedule_dict.items():
        if key == "extra":
            continue
        entries = value if isinstance(value, list) else [value]
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            uid = entry.get("uid")
            if uid and uid != "N/A" and entry.get("name") != "N/A":
                roles[uid] = key
    return roles


async def update_weeks(schedule_dict: Dict[str, Any], deacons: List[Dict[str, Any]], doc_ref: firestore.DocumentReference, persist: bool = True) -> Dict[str, Any]:
    """
    Updates deacon weeksSince counters after schedule generation.

    Everyone assigned this week resets to 0 (keeping their previous count in
    `lastWeeksSince`); everyone else ages by one. The leftovers become the
    week's `extra` pool, which is what the replacement flow draws from.
    """
    served_roles = assigned_roles(schedule_dict)

    unused_deacons = []
    for deacon in deacons:
        role = served_roles.get(deacon["uid"])
        if role is not None:
            credit_assignment(deacon, role)
        else:
            deacon["weeksSince"] += 1
            unused_deacons.append(deacon)

    # Callers generating several weeks in a row pass persist=False and write
    # once at the end - the roster is mutated in place, so the final state is
    # identical. tests/harness.py asserts the write count to keep it that way.
    if persist:
        await asyncio.to_thread(doc_ref.update, {"deacons": deacons})

    schedule_dict["extra"] = [
        {"name": deacon["name"], "uid": deacon["uid"]} for deacon in unused_deacons
    ]

    return schedule_dict


def add_person(schedule_list: List[Dict], deacon_list: List[Dict], unavailable_uids: set = None) -> List[Dict]:
    """Append the best candidate from `deacon_list` not already in the schedule.

    Appends the string "N/A" when every candidate is taken - which is why the
    callers below guard on `entry != "N/A"` rather than checking for a dict.

    `unavailable_uids` are skipped outright rather than merely ranked last.
    This is the one constraint where an empty slot is the better outcome: the
    other fallback tiers are judgements about suitability, so using a
    cooldown-blocked or under-age person still beats leaving a role unfilled,
    but someone who has said they will not be there produces a slot that is
    silently empty on the day. An "N/A" the admin can see and fill is strictly
    better. A score tier cannot express that, because this function has no
    notion of a score it should refuse.
    """
    unavailable_uids = unavailable_uids or frozenset()
    taken = {
        entry["uid"]
        for entry in schedule_list
        if isinstance(entry, dict) and "uid" in entry
    }

    for candidate in deacon_list:
        uid = candidate["uid"]
        if uid not in taken and uid not in unavailable_uids:
            schedule_list.append(candidate)
            return schedule_list

    schedule_list.append("N/A")
    return schedule_list


def sort_full_deacons(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts ordained (full) deacons by weeksSince for wine bearer selection."""
    return sorted(deacons, key=lambda x: x.get("weeksSince", 0), reverse=True)


# Order the single-person roles are filled in. Highest responsibility first:
# an earlier role gets first pick of the pool, and `add_person` skips anyone
# already placed. This list is also the positional contract for the `schedule`
# working list - it used to be implicit in hardcoded indexes (schedule[0] was
# wine, schedule[1] gospel...), so reordering it silently corrupted every role.
ROLE_FILL_ORDER = [
    "wine", "gospel", "water", "praxis", "catholic",
    "pauline", "sixth", "third", "matins",
]

# Altar picks are appended after the single-person roles, so altar entry `i`
# lives at schedule[len(ROLE_FILL_ORDER) + i]. How many to pick comes from the
# church's `altarServers` setting; it used to be hardcoded to 9 while the slice
# that read it back used the configured number, so a church asking for more
# than 9 silently got 9.


def _slot(entry: Any) -> Dict[str, str]:
    """Render one working-list entry as the {name, uid} pair stored in Firestore.

    Unfilled slots get a throwaway uuid rather than a null uid: the clients key
    list rows off uid, so two empty slots in the same week need distinct ones.
    """
    if entry == "N/A":
        return {"name": "N/A", "uid": str(uuid.uuid4())}
    return {"name": entry["name"], "uid": entry["uid"]}


async def create_schedule(deacons: List[Dict[str, Any]], church_ref: firestore.DocumentReference, num_altar_servers: int, fullDeacons: List[Dict[str, Any]], persist: bool = True, weights: Dict[str, Any] = None, unavailable_uids: set = None) -> Dict[str, Any]:
    """
    Main schedule generation function.

    Ranks the candidate pool once per role, then fills roles greedily in
    ROLE_FILL_ORDER, then fills the altar. Each ranking is independent - every
    role scores the same `sorted_deacons` in the same incoming order - so the
    order the rankings are computed in does not affect the result.

    `unavailable_uids` are people who have declared they cannot make the week
    being generated. They are scored into the bottom tier rather than removed,
    so they are only ever reached if the roster is genuinely exhausted.
    """
    fullDeacon = fullDeacons is not None and len(fullDeacons) > 0

    sorted_deacons = sort_deacons(deacons)
    context = build_context(deacons, weights, unavailable_uids=unavailable_uids)

    rankings = {
        role: score_role(sorted_deacons, role, context) for role in ROLE_FILL_ORDER
    }
    altar_list = score_role(sorted_deacons, "altar", context)

    if fullDeacon:
        # Ordained deacons are ranked purely by rotation, not by the wine score.
        rankings["wine"] = sort_full_deacons(fullDeacons)
        # The best non-ordained wine candidate is not wasted: they go to the
        # front of the altar queue.
        altar_list.insert(0, score_role(sorted_deacons, "wine", context)[0])

    away = context["unavailable_uids"]
    schedule = []
    for role in ROLE_FILL_ORDER:
        schedule = add_person(schedule, rankings[role], away)
    for _ in range(num_altar_servers):
        schedule = add_person(schedule, altar_list, away)

    schedule_dict = {role: _slot(schedule[i]) for i, role in enumerate(ROLE_FILL_ORDER)}

    altar_start = len(ROLE_FILL_ORDER)
    schedule_dict["altar"] = (
        [_slot(entry) for entry in schedule[altar_start:altar_start + num_altar_servers]]
        if len(schedule) > 7
        else [{"name": "N/A", "uid": str(uuid.uuid4())} for _ in range(num_altar_servers)]
    )

    schedule_dict = await update_weeks(schedule_dict, deacons, church_ref, persist=persist)
    return schedule_dict


async def get_deacons(church: str) -> Union[List[Dict[str, Any]], str]:
    """Fetches the deacons list for a given church from Firestore."""
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    doc_ref = collection_ref.document(church)

    doc_snapshot = await asyncio.to_thread(doc_ref.get)

    if doc_snapshot.exists:
        doc_data = doc_snapshot.to_dict()
        return doc_data.get("deacons", [])
    else:
        return "Document does not exist"


async def my_async_scheduled_function():
    """
    Main scheduled function - generates/rotates schedules for all churches.

    Either backfills up to 5 weeks for a church that has fewer, or archives the
    oldest week and generates one new week at the far end.

    The roster is read once per church and threaded through every week
    generated. It used to be re-read inside the backfill loop - 5 reads of a
    document already in memory, each followed by a full rewrite of the deacons
    array. Now: one read, one write.
    """
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = list(churches_ref.stream())

    for church_doc in churches_docs:
        church_data = church_doc.to_dict()
        num_altar_servers = int(church_data.get("altarServers", 0))
        full_deacon_enabled = church_data.get("fullDeacon", None)
        # Per-church memory tuning. Absent means DEFAULT_WEIGHTS, which are all
        # zero - so a church that has not opted in schedules exactly as before.
        weights = church_data.get("scheduleWeights")

        schedule_ref = church_doc.reference.collection("schedule")
        schedules = list(schedule_ref.stream())

        today = datetime.datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        upcoming_sunday = today + datetime.timedelta(days=days_until_sunday)
        upcoming_sunday = upcoming_sunday.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        if today.weekday() == 6:
            first_schedule_date = upcoming_sunday + datetime.timedelta(weeks=1)
        else:
            first_schedule_date = upcoming_sunday

        deacons = await get_deacons(church_doc.id)
        if isinstance(deacons, str):
            logging.error(f"Skipping {church_doc.id}: {deacons}")
            continue

        def ordained():
            """Ordained deacons, re-derived per week off the live roster.

            This must be recomputed each week rather than hoisted: it feeds
            `sort_full_deacons`, which ranks purely on weeksSince. A list
            captured once holds a stale count for every week after the first,
            so the same ordained deacon was picked for wine repeatedly.
            """
            if not full_deacon_enabled:
                return None
            return [
                d for d in deacons
                if d.get("rank") == "Deacon (Full Deacon)"
            ]

        if len(schedules) < 5:
            targets = [
                (first_schedule_date + datetime.timedelta(weeks=i)).strftime("%m-%d-%y")
                for i in range(5)
            ]
        else:
            to_delete = upcoming_sunday.strftime("%m-%d-%y")
            old_schedule = schedule_ref.document(to_delete).get().to_dict()
            if old_schedule:
                cleaned_old_schedule = clean_past_schedules(old_schedule)
                schedule_ref.document(to_delete).delete()

                # save old schedules to 'archive' subcollection
                archive_ref = church_doc.reference.collection("archive")
                archive_ref.document(to_delete).set(cleaned_old_schedule)

            targets = [
                (upcoming_sunday + datetime.timedelta(weeks=5)).strftime("%m-%d-%y")
            ]

        roster_uids = [d.get("uid") for d in deacons]
        for schedule_id in targets:
            # Who has already said they cannot make this particular week. The
            # app only lets people declare five weeks ahead, so the weekly job -
            # which generates the week after those - will usually find nothing.
            # The backfill path below generates the visible weeks, where this
            # does apply, and it is correct if the window is ever widened.
            away = declared_unavailable_uids(
                firestore_client, roster_uids, schedule_id
            )
            schedule = await create_schedule(
                deacons, church_doc.reference, num_altar_servers, ordained(),
                persist=False, weights=weights, unavailable_uids=away,
            )
            schedule_ref.document(schedule_id).set(schedule)

        # One roster write covering every week generated above.
        church_doc.reference.update({"deacons": deacons})

        set_next_week_serve(church_doc.id)


def clean_past_schedules(schedule_data: Dict[str, any]) -> Dict[str, any]:
    """Cleans the schedule for storing in archive by removing 'extra' field."""
    new_data = {}
    for key, value in schedule_data.items():
        if key == 'extra':
            continue
        else:
            new_data[key] = value
    
    return new_data

def generate_test_data(num_people: int) -> List[Dict[str, Any]]:
    """Generates random test deacon data for development/testing."""
    ranks = ["Chanter (Epsaltos)", "Reader", "Subdeacon", "Full Deacon"]
    test_data = []

    for _ in range(num_people):
        person = {
            "age": str(random.randint(5, 60)),
            "experience": random.uniform(0, 10),
            "frequency": random.uniform(0, 10),
            "name": f"Person {random.randint(1, 1000)}",
            "rank": random.choice(ranks),
            "uid": str(uuid.uuid4()),
            "weeksSince": random.randint(0, 5),
        }
        test_data.append(person)

    return test_data


# ============================================================================
# UNAVAILABILITY HANDLING
# ============================================================================

def get_scheduled_uids(schedule_data: Dict[str, Any], exclude_uids: List[str] = None) -> set:
    """
    Extracts all UIDs currently scheduled (not in extras).
    Optionally excludes specific UIDs (e.g., those marking unavailable).
    """
    exclude_uids = set(exclude_uids) if exclude_uids else set()
    scheduled = set()
    
    for key, value in schedule_data.items():
        if key == "extra":
            continue
        
        if key == "altar" and isinstance(value, list):
            for server in value:
                if isinstance(server, dict):
                    uid = server.get("uid")
                    if uid and uid not in exclude_uids and server.get("name") != "N/A":
                        scheduled.add(uid)
        elif isinstance(value, dict):
            uid = value.get("uid")
            if uid and uid not in exclude_uids and value.get("name") != "N/A":
                scheduled.add(uid)
    
    return scheduled


def get_existing_replacement_uids(unavailable_data: Dict[str, Any]) -> set:
    """
    Extracts UIDs already suggested as replacements in existing unavailable data.
    """
    replacement_uids = set()
    
    for key, value in unavailable_data.items():
        if key == "altar" and isinstance(value, dict):
            for index, entry in value.items():
                if isinstance(entry, dict) and "replacement" in entry:
                    uid = entry["replacement"].get("uid")
                    if uid and entry["replacement"].get("name") != "N/A":
                        replacement_uids.add(uid)
        elif isinstance(value, dict) and "replacement" in value:
            uid = value["replacement"].get("uid")
            if uid and value["replacement"].get("name") != "N/A":
                replacement_uids.add(uid)
    
    return replacement_uids


def unavailable(request_data: dict):
    """
    Marks a user (and optionally family) as unavailable for a specific week.
    
    This function:
    1. Finds the best replacement using the role-appropriate scoring algorithm
    2. Records the unavailability in churches/{churchId}/unavailable/{weekId}
       with both original server and suggested replacement
    3. Updates the schedule to show "N/A" for the vacated role (until admin approves)
    4. Removes the user from the extras list
    5. Leaves the suggested replacement in extras (until admin approves)
    6. Does NOT send notifications - that happens when admin processes the request
    
    Args:
        request_data: Dict containing:
            - church: Church ID
            - week: Week ID (MM-DD-YY format)
            - uid: User ID marking themselves unavailable
            - family: Boolean - if True, also process children with roles (not extras)
    
    Unavailable Collection Structure:
        churches/{churchId}/unavailable/{weekId}
        {
            "gospel": {
                "original": { "name": "John Smith", "uid": "abc123" },
                "replacement": { "name": "Mark Jones", "uid": "def456" }
            },
            "altar": {
                "0": {
                    "original": { "name": "Peter Paul", "uid": "ghi789" },
                    "replacement": { "name": "James Adam", "uid": "jkl012" }
                }
            }
        }
    """
    logging.info("Unavailable function triggered.")

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    user_id = request_data.get("uid")
    family = request_data.get("family")

    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_ref.get()
    
    all_uids = [user_id]
    if user_doc.exists:
        user_data = user_doc.to_dict()
        if "children" in user_data and family:
            for child in user_data["children"]:
                all_uids.append(child["uid"])

    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()
    
    if not schedule_doc.exists:
        logging.error(f"Schedule not found for week {week_id}")
        return

    schedule_data = schedule_doc.to_dict()
    
    unavailable_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("unavailable")
        .document(week_id)
    )
    unavailable_doc = unavailable_ref.get()
    
    if unavailable_doc.exists:
        unavailable_data = unavailable_doc.to_dict()
    else:
        unavailable_data = {}
    
    extra_deacons, scoring_context = create_extra_deacons(
        church_id, schedule_data.get("extra", []), week_id
    )
    
    # Track UIDs that are excluded from being replacements:
    # 1. Anyone currently scheduled (except those marking unavailable)
    # 2. Anyone already suggested as a replacement
    excluded_uids = get_scheduled_uids(schedule_data, exclude_uids=all_uids)
    excluded_uids.update(get_existing_replacement_uids(unavailable_data))
    # The people making this request cannot be the answer to it. `all_uids` is
    # deliberately held out of get_scheduled_uids above so their own slots can
    # be vacated - but that also left them eligible as replacements, so on a
    # family request a child just marked unavailable could be suggested to cover
    # their own parent's role.
    excluded_uids.update(all_uids)
    # Nor can anyone else who has already told us they are away this week.
    excluded_uids.update(scoring_context["unavailable_uids"])
    
    # Only people who actually vacated a role count as having declined; being
    # in `extra` means they were not scheduled, so dropping out costs nothing.
    declined_uids = []

    for uid in all_uids:
        # Drop them from the extra pool first, whatever else is true of them.
        # This used to sit at the bottom of the loop, below two `continue`s, so
        # anyone found sitting in `extra` skipped it and stayed in the pool.
        extras = schedule_data.get("extra", [])
        schedule_data["extra"] = [e for e in extras if e.get("uid") != uid]

        key, server_data = find_server(schedule_data, uid)

        # Not on this week's sheet at all, or only in the extra pool we just
        # removed them from: nothing to vacate and no replacement to find.
        if key is None or (len(key) == 2 and key[0] == "extra"):
            continue

        declined_uids.append(uid)

        original_server = {
            "name": server_data.get("name"),
            "uid": server_data.get("uid")
        }
        
        # Pass excluded_uids to find_replacement
        suggested_replacement = find_replacement(
            key, extra_deacons, excluded_uids, scoring_context
        )
        
        # Add the new replacement to excluded set for subsequent iterations
        if suggested_replacement.get("uid") and suggested_replacement.get("name") != "N/A":
            excluded_uids.add(suggested_replacement["uid"])
        
        na_placeholder = {
            "name": "N/A",
            "uid": str(uuid.uuid4())
        }
        
        if len(key) == 2 and key[0] == "altar":
            role_name = str(key[0])
            index = str(key[1])
            
            if role_name not in unavailable_data:
                unavailable_data[role_name] = {}
            
            unavailable_data[role_name][index] = {
                "original": original_server,
                "replacement": suggested_replacement
            }
            
            schedule_data[role_name][key[1]] = na_placeholder
            
        else:
            role_name = str(key[0])
            
            unavailable_data[role_name] = {
                "original": original_server,
                "replacement": suggested_replacement
            }
            
            schedule_data[role_name] = na_placeholder

    unavailable_ref.set(unavailable_data, merge=True)
    schedule_ref.update(schedule_data)

    # Frequency decay plus the decline counters, in a single roster write.
    if user_doc.exists:
        update_attendance(user_ref, user_data, declined_uids=declined_uids)
    
    trigger_async_function(
        "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
        {"church": church_id},
    )
    
    logging.info(f"Unavailability recorded for week {week_id}")


def find_replacement(key, extra_deacons: List[Dict[str, Any]], excluded_uids: set = None, context: Dict[str, Any] = None) -> Dict[str, str]:
    """
    Finds the best replacement for a role using the appropriate scoring algorithm.

    Args:
        key: Tuple identifying the role - ("gospel",) or ("altar", index)
        extra_deacons: List of available deacons with full data for scoring
        excluded_uids: Set of UIDs to exclude (already scheduled or already suggested)
        context: Scoring context from create_extra_deacons. Omitting it scores
            on rotation and age alone - which would suggest the very people the
            reliability term exists to stop suggesting.

    Returns:
        Dict with "name" and "uid" of suggested replacement, or N/A if none available
    """
    excluded_uids = excluded_uids or set()

    available_deacons = [d for d in extra_deacons if d.get("uid") not in excluded_uids]

    if not available_deacons:
        return {"name": "N/A", "uid": str(uuid.uuid4())}

    # key is ("altar", index) or ("gospel",); the role name is key[0] either way.
    role = key[0]

    if role not in ROLE_RULES:
        return {
            "name": available_deacons[0].get("name"),
            "uid": available_deacons[0].get("uid")
        }

    # Score copies: these dicts belong to the caller's extra_deacons list, and
    # scoring writes `value` onto them.
    scored_deacons = score_role([d.copy() for d in available_deacons], role, context)

    if not scored_deacons:
        return {"name": "N/A", "uid": str(uuid.uuid4())}

    best_candidate = scored_deacons[0]
    return {
        "name": best_candidate.get("name"),
        "uid": best_candidate.get("uid")
    }


def _decay_frequency(value: float) -> float:
    """One decline's worth of decay, floored so a chronic decliner never hits 0.

    Note how gentle this is: 5% per decline, so it takes ~14 declines to halve.
    It is the only penalty a no-show currently carries.
    """
    value *= 0.95
    return 0.5 if value < 0.1 else value


def _sync_children_into(user_data: Dict[str, Any], deacons: List[Dict[str, Any]]) -> bool:
    """Push the parent's church and frequency onto their children, in place.

    Mutates both `user_data["children"]` and the matching `deacons` entries.
    Returns whether there was anything to do.
    """
    children = user_data.get("children")
    if not children:
        return False

    frequency = user_data.get("frequency")
    by_uid = {d.get("uid"): d for d in deacons}

    for child in children:
        child["church"] = user_data["church"]
        # A parent with no frequency yet leaves the child's alone rather than
        # raising - the original indexed straight into user_data["frequency"].
        if frequency is not None:
            child["frequency"] = frequency
        deacon = by_uid.get(child.get("uid"))
        if deacon is not None and frequency is not None:
            deacon["frequency"] = child.get("frequency", 0)

    return True


def update_attendance(user_ref: firestore.DocumentReference, user_data: Dict[str, Any] = None, declined_uids: List[str] = None):
    """
    Decreases user's frequency score when they mark unavailable.

    Accepts an already-fetched `user_data` because `unavailable()` has just read
    that document. This function used to re-read it, then call `sync_child`,
    which read the same user *and* church documents a second time and issued a
    second full deacons-array write. Now one read and one write of each.

    `declined_uids` are the people who vacated a role in this request - the
    parent and, for a family request, any children who held one. Each gets
    `declinedCount` incremented, which is what drives the reliability score.
    Frequency decay alone is far too gentle to represent a chronic no-show: at
    5% per decline it takes about fourteen of them to halve.
    """
    firestore_client = firestore.Client()

    if user_data is None:
        user_data = user_ref.get().to_dict()
    if not user_data:
        return

    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict() or {}
    deacons = church_data.get("deacons", [])

    if "frequency" in user_data:
        user_data["frequency"] = _decay_frequency(user_data["frequency"])
        for deacon in deacons:
            if deacon["uid"] == user_data["uid"]:
                deacon["frequency"] = user_data["frequency"]
                break

    _sync_children_into(user_data, deacons)

    if declined_uids:
        declined = set(declined_uids)
        for deacon in deacons:
            if deacon.get("uid") in declined:
                deacon["declinedCount"] = (deacon.get("declinedCount") or 0) + 1

    church_ref.update({"deacons": deacons})
    # Scoped to the fields that changed. The original wrote the whole user
    # document back, which reopens a lost-update window on every other field.
    patch = {"frequency": user_data.get("frequency")}
    if user_data.get("children"):
        patch["children"] = user_data["children"]
    user_ref.update(patch)
    return


def find_server(schedule_data: Dict[str, Any], target_uid: str) -> Tuple[Union[Tuple[str, int], None], Union[Dict[str, Any], None]]:
    """
    Locates a server in the schedule by UID.
    """
    for key, value in schedule_data.items():
        if isinstance(value, list):
            for i in range(len(value)):
                if isinstance(value[i], dict) and value[i].get("uid") == target_uid:
                    return ((key, i), value[i])
        elif isinstance(value, dict):
            if value.get("uid") == target_uid:
                return ((key,), value)
    return (None, None)


def create_extra_deacons(church_id: str, extra_deacons: List[Dict[str, Any]], week_id: str = None):
    """
    Enriches extra deacon list with full deacon data from church document.

    Preserves church-roster order (not the order of `extra_deacons`), matching
    the nested-loop version this replaced.

    Returns (available, context): the enriched candidates, and the scoring
    context built from the same roster read, so the replacement picker applies
    the same memory terms as generation rather than falling back to rotation
    and age alone.

    Passing `week_id` also loads who has declared themselves unavailable for
    that week, so the picker cannot suggest someone who has already said no.
    """
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church_id)
    church_doc = church_ref.get()
    church_data = church_doc.to_dict() or {}
    roster = church_data.get("deacons", [])

    wanted = {d["uid"] for d in extra_deacons if "uid" in d}
    available = [d for d in roster if d.get("uid") in wanted]

    # Only the candidates need the declaration lookup - the rest of the roster
    # is already scheduled or otherwise out of the running for this week.
    away = declared_unavailable_uids(
        firestore_client, [d.get("uid") for d in available], week_id
    )

    # Built from the whole roster, not just the available subset: the famine
    # term compares against the roster median, which a subset would skew.
    context = build_context(
        roster, church_data.get("scheduleWeights"), unavailable_uids=away
    )
    return available, context


def trigger_async_function(endpoint_url: str, payload: dict):
    """Fire-and-forget HTTP call to trigger async Cloud Function."""
    try:
        requests.post(endpoint_url, json=payload, timeout=1)
    except requests.exceptions.ReadTimeout:
        pass


def update_future_schedules(church: str):
    """
    Rebalances altar/extra assignments when church changes altarServers count.
    """
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    church_doc = church_ref.get()

    if not church_doc.exists:
        return

    church_data = church_doc.to_dict()
    num_altar_servers = int(church_data.get("altarServers", 0))

    schedule_ref = (
        firestore_client.collection("churches").document(church).collection("schedule")
    )

    docs = schedule_ref.stream()
    for doc in docs:
        schedule_data = doc.to_dict()
        altar_list = schedule_data.get("altar", [])
        extra_list = schedule_data.get("extra", [])

        servers = altar_list + extra_list
        updated_altar_servers = servers[:num_altar_servers]
        updated_extra_servers = servers[num_altar_servers:]

        doc.reference.update(
            {"altar": updated_altar_servers, "extra": updated_extra_servers}
        )

    return


# ============================================================================
# CHILD PARAMETER SYNC
# ============================================================================

def sync_child(user_id):
    """
    Syncs a user's children to have the same church and frequency settings
    as the parent user.
    """
    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_data = user_doc_ref.get().to_dict()

    if not user_data or not user_data.get("church"):
        return

    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict() or {}
    deacons = church_data.get("deacons", [])

    if _sync_children_into(user_data, deacons):
        church_ref.update({"deacons": deacons})
        user_doc_ref.update({"children": user_data["children"]})


# ============================================================================
# NEXT WEEK SERVE TRACKING
# ============================================================================

def set_next_week_serve(church_id):
    """
    Scans all schedules and updates each user's nextWeekServe field.

    A user is recorded against the *earliest* week they appear in, so the
    schedules are walked in date order and the first hit wins.

    Two round-trips total, rather than two per scheduled person: one `get_all`
    to learn which uids have a user document, then batched updates. The
    existence check is not optional - child profiles and the `uuid4()`
    placeholders minted for unfilled slots have no user doc, and `update` on a
    missing document fails the whole batch. (`set(..., merge=True)` would
    "succeed" by creating junk documents for every empty slot instead.)
    """
    reset_next_dates(church_id)

    firestore_client = firestore.Client()
    schedules_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
    )
    schedules = list(schedules_ref.stream())
    schedules.sort(key=lambda s: datetime.datetime.strptime(s.id, "%m-%d-%y"))

    user_ref = firestore_client.collection("users")
    pending = {}

    for schedule in schedules:
        schedule_id = schedule.id
        schedule_data = schedule.to_dict()

        for key, value in schedule_data.items():
            if key == "extra":
                continue

            if key == "altar":
                candidates = [
                    server.get("uid")
                    for server in value
                    if isinstance(server, dict)
                ]
            elif isinstance(value, dict):
                candidates = [value.get("uid")]
            else:
                candidates = []

            for uid in candidates:
                if uid and uid != "N/A" and uid not in pending:
                    pending[uid] = {
                        "nextWeekServe": str(schedule_id),
                        "nextRole": interpret_role(key),
                    }

    if not pending:
        return

    uids = list(pending)
    refs = [user_ref.document(uid) for uid in uids]
    live = {doc.id for doc in firestore_client.get_all(refs) if doc.exists}

    commit_in_batches(
        firestore_client,
        ((user_ref.document(uid), pending[uid]) for uid in uids if uid in live),
    )
    return
