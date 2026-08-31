"""
harness.py - Deterministic simulator for the schedule allocation algorithm.

Why this exists
---------------
`create_schedule` has no tests and touches Firestore, so there was no way to
change it without guessing at the blast radius. This runs the real allocator
over a fixed-seed roster for N weeks with Firestore stubbed out, and emits a
normalised, diffable transcript.

Two jobs:

1. **Golden diff** (`transcript`) - prove a refactor changed nothing. Every
   nondeterministic value is normalised away, so byte-equality is meaningful.
2. **Fairness metrics** (`metrics`) - measure whether the memory terms actually
   fix the three complaints: no-shows crowding the queue, reliable people never
   being picked, and role repetition.

Run directly for a human-readable report:
    venv/bin/python -m tests.harness
"""
import asyncio
import json
import random
import statistics
from typing import Any, Dict, List

# Role keys in the order create_schedule fills them. `altar` is a list; the
# other nine are single-person dicts.
READING_ROLES = [
    "wine", "gospel", "water", "praxis", "catholic",
    "pauline", "sixth", "third", "matins",
]
ALL_ROLES = READING_ROLES + ["altar"]

RANKS = ["Chanter (Epsaltos)", "Reader", "Subdeacon", "Deacon (Full Deacon)"]


class FakeDocRef:
    """Stands in for a Firestore DocumentReference.

    `update_weeks` writes the whole deacons array back through this. We only
    need to not explode; the harness carries the roster in memory, which is
    equivalent to production re-reading the doc it just wrote.
    """

    def __init__(self):
        self.writes = 0

    def update(self, payload):
        self.writes += 1


def build_roster(size: int, seed: int = 1979) -> List[Dict[str, Any]]:
    """A fixed-seed roster.

    Deliberately does NOT call `generate_test_data`: that function is fair game
    for refactoring, and the golden must not move when it changes. Uses a local
    Random instance so it cannot be perturbed by other code seeding the global.
    """
    rng = random.Random(seed)
    roster = []
    for i in range(size):
        roster.append({
            "uid": f"uid-{i:03d}",
            "name": f"Person {i:03d}",
            # Age is a string here on purpose: production stores it both ways,
            # which is why every scorer defensively calls int(deacon["age"]).
            "age": str(rng.randint(9, 60)),
            "experience": round(rng.uniform(0, 10), 3),
            "frequency": round(rng.uniform(0, 10), 3),
            "rank": rng.choice(RANKS),
            "weeksSince": rng.randint(0, 5),
            "lastWeeksSince": 0,
        })
    return roster


def decliner_uids(roster_size: int, fraction: float) -> set:
    """Deterministic, evenly-spread set of people who never actually serve."""
    count = int(roster_size * fraction)
    if count <= 0:
        return set()
    step = max(1, roster_size // count)
    return {f"uid-{i:03d}" for i in range(0, roster_size, step)}


def declared_uids(roster_size: int, fraction: float, week_index: int) -> set:
    """Who has declared themselves unavailable for a given week.

    Rotates through the roster so a long run exercises the exclusion against
    many different people instead of the same fixed slice every week.
    """
    count = int(roster_size * fraction)
    if count <= 0:
        return set()
    offset = (week_index * count) % roster_size
    return {
        f"uid-{(offset + i) % roster_size:03d}"
        for i in range(count)
    }


def normalise(schedule: Dict[str, Any]) -> Dict[str, Any]:
    """Strip nondeterminism so two runs are byte-comparable.

    Empty slots carry a fresh `uuid4()` every run, so a raw dict never equals
    itself. Collapse those to a plain "N/A" and keep only uid (names are a pure
    function of uid in the harness).
    """
    out = {}
    for role in READING_ROLES:
        entry = schedule.get(role) or {}
        out[role] = "N/A" if entry.get("name") == "N/A" else entry.get("uid")
    out["altar"] = [
        "N/A" if e.get("name") == "N/A" else e.get("uid")
        for e in schedule.get("altar", [])
    ]
    out["extra"] = sorted(e.get("uid") for e in schedule.get("extra", []))
    return out


async def simulate(
    weeks: int = 26,
    roster_size: int = 60,
    num_altar_servers: int = 9,
    full_deacon: bool = False,
    seed: int = 1979,
    weights: Dict[str, Any] = None,
    decliner_fraction: float = 0.0,
    declared_fraction: float = 0.0,
) -> Dict[str, Any]:
    """Run the real allocator for `weeks` consecutive weeks.

    `decliner_fraction` models the complaint the memory layer exists for:
    that share of the roster never actually serves. Every week they are
    assigned, they drop out - which is what `unavailable()` records in
    production - so their `declinedCount` climbs alongside `assignedCount`.

    `declared_fraction` models people telling us in advance that they cannot
    make a given week - what `users/{uid}.unavailableWeeks` records. A different
    slice declares each week, and the set for each week is returned as
    `declared` so a test can assert none of them were scheduled.

    Returns {"transcript": [...], "roster": [...]} - the transcript is the
    golden artefact, the roster is the final state (weeksSince et al) so drift
    in the memory fields is visible too.
    """
    from files import schedule_generation as sg

    deacons = build_roster(roster_size, seed)
    doc_ref = FakeDocRef()
    transcript = []

    decliners = decliner_uids(roster_size, decliner_fraction)
    declared_per_week = []

    for week_index in range(weeks):
        # Derived fresh each week. Production derives this once outside its
        # 5-week loop (my_async_scheduled_function), so its copy goes stale --
        # tracked separately; the harness must be internally consistent.
        full = (
            [d for d in deacons if d.get("rank") == "Deacon (Full Deacon)"]
            if full_deacon else None
        )
        # A different slice of the roster declares each week, so the exclusion
        # is exercised against many different people rather than one fixed set.
        away = declared_uids(roster_size, declared_fraction, week_index)
        declared_per_week.append(away)

        schedule = await sg.create_schedule(
            deacons, doc_ref, num_altar_servers, full, weights=weights,
            unavailable_uids=away,
        )
        transcript.append(normalise(schedule))

        if decliners:
            # Mirror update_attendance: anyone assigned who never comes has
            # their declinedCount incremented for that assignment.
            assigned = set()
            for role in READING_ROLES:
                entry = schedule.get(role) or {}
                if entry.get("name") != "N/A":
                    assigned.add(entry.get("uid"))
            for entry in schedule.get("altar", []):
                if entry.get("name") != "N/A":
                    assigned.add(entry.get("uid"))
            for deacon in deacons:
                if deacon["uid"] in decliners and deacon["uid"] in assigned:
                    deacon["declinedCount"] = (deacon.get("declinedCount") or 0) + 1

    return {
        "declared": declared_per_week,
        "transcript": transcript,
        "roster": [
            {k: d.get(k) for k in ("uid", "weeksSince", "lastWeeksSince")}
            for d in sorted(deacons, key=lambda x: x["uid"])
        ],
        "writes": doc_ref.writes,
    }


# ---------------------------------------------------------------------------
# Fairness metrics - the evidence that the three complaints are addressed
# ---------------------------------------------------------------------------

def _gini(values: List[float]) -> float:
    """0 = everyone served identically often, 1 = one person served everything."""
    if not values or all(v == 0 for v in values):
        return 0.0
    xs = sorted(values)
    n = len(xs)
    cumulative = sum((i + 1) * x for i, x in enumerate(xs))
    return (2 * cumulative) / (n * sum(xs)) - (n + 1) / n


def metrics(result: Dict[str, Any], roster_size: int) -> Dict[str, Any]:
    """Turn a transcript into the numbers that answer the three complaints."""
    transcript = result["transcript"]
    all_uids = [f"uid-{i:03d}" for i in range(roster_size)]

    counts = {uid: 0 for uid in all_uids}
    role_counts = {uid: {} for uid in all_uids}
    per_week_assignments = []

    for week in transcript:
        assigned = []
        for role in READING_ROLES:
            uid = week[role]
            if uid and uid != "N/A":
                assigned.append((uid, role))
        for uid in week["altar"]:
            if uid and uid != "N/A":
                assigned.append((uid, "altar"))
        for uid, role in assigned:
            if uid in counts:
                counts[uid] += 1
                role_counts[uid][role] = role_counts[uid].get(role, 0) + 1
        per_week_assignments.append([u for u, _ in assigned])

    served = [c for c in counts.values()]
    never_picked = [uid for uid, c in counts.items() if c == 0]

    # Longest run of consecutive weeks a person held the same role.
    longest_streak = 0
    streak_holder = None
    for uid in all_uids:
        current_role, run = None, 0
        for week in transcript:
            role_this_week = None
            for role in READING_ROLES:
                if week[role] == uid:
                    role_this_week = role
                    break
            if role_this_week is None and uid in week["altar"]:
                role_this_week = "altar"
            if role_this_week is not None and role_this_week == current_role:
                run += 1
            else:
                current_role, run = role_this_week, 1 if role_this_week else 0
            if run > longest_streak:
                longest_streak, streak_holder = run, uid

    # How concentrated is each person's service in a single role?
    role_concentration = []
    for uid in all_uids:
        total = counts[uid]
        if total >= 3:
            role_concentration.append(max(role_counts[uid].values()) / total)

    unfilled = sum(
        sum(1 for r in READING_ROLES if week[r] == "N/A")
        + sum(1 for a in week["altar"] if a == "N/A")
        for week in transcript
    )

    return {
        "weeks": len(transcript),
        "roster_size": roster_size,
        "total_assignments": sum(served),
        "never_picked": len(never_picked),
        "never_picked_uids": sorted(never_picked)[:10],
        "assignments_min": min(served) if served else 0,
        "assignments_max": max(served) if served else 0,
        "assignments_median": statistics.median(served) if served else 0,
        "gini": round(_gini(served), 4),
        "longest_same_role_streak": longest_streak,
        "streak_holder": streak_holder,
        "mean_role_concentration": (
            round(statistics.mean(role_concentration), 4) if role_concentration else None
        ),
        "unfilled_slots": unfilled,
        "firestore_writes": result["writes"],
    }


def run(**kwargs) -> Dict[str, Any]:
    roster_size = kwargs.get("roster_size", 60)
    result = asyncio.run(simulate(**kwargs))
    return {"result": result, "metrics": metrics(result, roster_size)}


if __name__ == "__main__":
    for size in (20, 40, 60):
        out = run(roster_size=size, weeks=26)
        print(f"\n=== roster {size} / 26 weeks ===")
        print(json.dumps(out["metrics"], indent=2))
