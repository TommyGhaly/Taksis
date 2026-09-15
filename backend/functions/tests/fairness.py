"""
fairness.py - Does the memory layer actually fix the three complaints?

Runs the same roster twice, once with the memory weights off and once with
them enabled, and reports the three numbers that correspond to the three
complaints:

  decliner_share    share of assignments given to people who never turn up
  gini              spread of how often people serve (0 = perfectly even)
  role_concentration  how much of a person's service is in one single role

    venv/bin/python -m tests.fairness
"""
import asyncio

from tests.harness import simulate, metrics, decliner_uids, READING_ROLES

# A starting point, not a tuned answer. Scaled against the terms already in the
# scoring: a week of rotation is worth 4 and the age-window bonus is 30, so
# these are deliberately smaller than an age mismatch but larger than the
# frequency/experience nudges.
PROPOSED = {"reliability": 0.8, "famine": 8.0, "role_repeat": 10.0}

# The comparison baseline: the plain rotation/age/frequency algorithm.
#
# This has to be passed explicitly. It used to be spelled `weights=None`, back
# when DEFAULT_WEIGHTS was all zeros - but the defaults are PROPOSED now, so
# `None` resolves to the enabled weights and every row of the table read
# "same". A comparison whose two sides silently became the same run reports no
# effect rather than reporting that it is broken, so keep this explicit.
OFF = {"reliability": 0.0, "famine": 0.0, "role_repeat": 0.0}

SCENARIO = dict(roster_size=60, weeks=26, num_altar_servers=9, decliner_fraction=0.2)


def decliner_share(transcript, roster_size, fraction):
    """Fraction of all assignments that went to someone who never serves."""
    bad = decliner_uids(roster_size, fraction)
    total = wasted = 0
    for week in transcript:
        picks = [week[r] for r in READING_ROLES] + list(week["altar"])
        for uid in picks:
            if uid and uid != "N/A":
                total += 1
                wasted += uid in bad
    return (wasted / total * 100) if total else 0.0


def main():
    size = SCENARIO["roster_size"]
    fraction = SCENARIO["decliner_fraction"]

    off = asyncio.run(simulate(**SCENARIO, weights=OFF))
    on = asyncio.run(simulate(**SCENARIO, weights=PROPOSED))

    m_off, m_on = metrics(off, size), metrics(on, size)
    rows = [
        ("decliner_share %", decliner_share(off["transcript"], size, fraction),
         decliner_share(on["transcript"], size, fraction), "lower"),
        ("gini", m_off["gini"], m_on["gini"], "lower"),
        ("role_concentration", m_off["mean_role_concentration"],
         m_on["mean_role_concentration"], "lower"),
        ("longest_same_role_streak", m_off["longest_same_role_streak"],
         m_on["longest_same_role_streak"], "lower"),
        ("never_picked", m_off["never_picked"], m_on["never_picked"], "lower"),
        ("unfilled_slots", m_off["unfilled_slots"], m_on["unfilled_slots"], "lower"),
    ]

    print(f"roster={size}  weeks={SCENARIO['weeks']}  "
          f"{int(fraction * 100)}% never turn up")
    print(f"weights: {PROPOSED}\n")
    header = f"{'metric':<28}{'weights off':>13}{'weights on':>13}{'':>10}"
    print(header)
    print("-" * len(header))
    for name, before, after, direction in rows:
        if isinstance(before, float):
            before_s, after_s = f"{before:.3f}", f"{after:.3f}"
        else:
            before_s, after_s = str(before), str(after)
        if before == after:
            verdict = "same"
        else:
            improved = (after < before) if direction == "lower" else (after > before)
            verdict = "better" if improved else "worse"
        print(f"{name:<28}{before_s:>13}{after_s:>13}{verdict:>10}")

    slack_sweep()


def slack_sweep():
    """How much the memory layer can help, as a function of roster slack.

    This is the important caveat. A 2-week cooldown means a roster has to be
    about three times the weekly slot count before anyone is genuinely
    optional. Below that the scheduler has no choice to make: every eligible
    person is needed every cycle, so no amount of scoring changes who serves.

    Churches at or below that line are capacity-bound, not fairness-bound - the
    fix there is more servants, fewer altar slots, or a shorter cooldown, and
    the weights should be set to zero via `scheduleWeights` because they
    cannot achieve anything.
    """
    weeks = SCENARIO["weeks"]
    altar = SCENARIO["num_altar_servers"]
    fraction = SCENARIO["decliner_fraction"]
    slots = len(READING_ROLES) + altar
    saturation = slots * 3

    print(f"\n\nEffect vs roster slack ({slots} slots/week, "
          f"cooldown 2 -> saturated at ~{saturation} people)\n")
    header = (f"{'roster':>8}{'slack':>8}{'decliner % off':>16}"
              f"{'decliner % on':>15}{'reduction':>11}")
    print(header)
    print("-" * len(header))

    for size in (40, 60, 80, 100, 140):
        cfg = dict(roster_size=size, weeks=weeks,
                   num_altar_servers=altar, decliner_fraction=fraction)
        off = asyncio.run(simulate(**cfg, weights=OFF))
        on = asyncio.run(simulate(**cfg, weights=PROPOSED))
        a = decliner_share(off["transcript"], size, fraction)
        b = decliner_share(on["transcript"], size, fraction)
        note = "  capacity-bound" if size < saturation else ""
        print(f"{size:>8}{size - saturation:>8}{a:>16.1f}{b:>15.1f}"
              f"{a - b:>10.1f}{note}")


if __name__ == "__main__":
    main()
