"""
golden_check.py - Prove a change to the allocator changed nothing.

Captures the normalised transcript for a spread of configurations and diffs it
against the checked-in snapshots in tests/golden/.

    venv/bin/python -m tests.golden_check            # verify (exit 1 on drift)
    venv/bin/python -m tests.golden_check --update   # re-record

Re-record ONLY when a behaviour change is intended, and review the resulting
diff in the same commit that causes it.
"""
import argparse
import asyncio
import json
import os
import sys

from tests.harness import simulate

GOLDEN_DIR = os.path.join(os.path.dirname(__file__), "golden")

# Spread chosen to cover the branches that actually fork behaviour:
#  - roster below/at/above the 25-candidate truncation in sort_deacons
#  - altar demand below and above the hardcoded range(9)
#  - the fullDeacon path, which sources wine from a different list entirely
CONFIGS = {
    "small_20":        dict(roster_size=20, weeks=26, num_altar_servers=9),
    "at_boundary_25":  dict(roster_size=25, weeks=26, num_altar_servers=9),
    "large_60":        dict(roster_size=60, weeks=26, num_altar_servers=9),
    "few_altar_3":     dict(roster_size=40, weeks=26, num_altar_servers=3),
    "many_altar_12":   dict(roster_size=40, weeks=26, num_altar_servers=12),
    "full_deacon":     dict(roster_size=40, weeks=26, num_altar_servers=9, full_deacon=True),
    "tiny_8":          dict(roster_size=8,  weeks=26, num_altar_servers=9),
}


def capture(name):
    result = asyncio.run(simulate(**CONFIGS[name]))
    # `writes` is a perf counter, not behaviour - excluded so that batching the
    # Firestore writes does not read as a behaviour change.
    return {"transcript": result["transcript"], "roster": result["roster"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--update", action="store_true")
    args = parser.parse_args()

    os.makedirs(GOLDEN_DIR, exist_ok=True)
    failures = []

    for name in CONFIGS:
        path = os.path.join(GOLDEN_DIR, f"{name}.json")
        actual = capture(name)

        if args.update:
            with open(path, "w") as fh:
                json.dump(actual, fh, indent=1, sort_keys=True)
            print(f"recorded  {name}")
            continue

        if not os.path.exists(path):
            failures.append(f"{name}: no golden recorded (run --update)")
            continue

        with open(path) as fh:
            expected = json.load(fh)

        if expected == actual:
            print(f"ok        {name}")
        else:
            weeks = expected.get("transcript", [])
            drift = [
                i for i, (e, a) in enumerate(zip(weeks, actual["transcript"])) if e != a
            ]
            first = drift[0] if drift else None
            detail = ""
            if first is not None:
                detail = (
                    f"\n    first drift at week {first}"
                    f"\n      expected: {json.dumps(weeks[first])}"
                    f"\n      actual:   {json.dumps(actual['transcript'][first])}"
                )
            failures.append(f"{name}: {len(drift)} week(s) differ{detail}")
            print(f"DRIFT     {name}")

    if failures:
        print("\n" + "\n".join(failures), file=sys.stderr)
        return 1
    if not args.update:
        print(f"\nAll {len(CONFIGS)} configurations match.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
