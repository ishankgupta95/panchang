/**
 * Performance regression tests.
 *
 * ## Why these are mostly *relative*
 *
 * The previous version of this file asserted absolute ceilings of 25 ms and
 * 50 ms against stated means of 0.10 ms and 0.50 ms — 50–250× of headroom. That
 * is wide enough to swallow almost any regression, and it did: `computeEndTimes:
 * false` had silently stopped being a fast path (it measured within 1% of a full
 * run, because an unconditional eclipse search dominated both), and every test
 * here still passed comfortably.
 *
 * Absolute timings cannot be tightened much without becoming flaky on shared CI
 * runners, so the load-bearing assertions below are **ratios between two
 * measurements taken in the same process**. A ratio is insensitive to how fast
 * the machine is, and it directly encodes the invariant we actually care about:
 * *asking for less work must cost less*. The absolute bounds are kept only as a
 * catastrophic-failure backstop (infinite loop, disabled cache).
 *
 * Observed on Apple M-series (Node 24), for orientation only — do not tighten
 * the absolute thresholds to these:
 *   full (all sections, end-times)   ~1.6 ms
 *   sections: [], no end-times       ~0.22 ms
 *   instant                          ~0.33 ms
 *   eclipse check, non-eclipse day   ~0.03 ms
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/index';
import { getEclipseDuringDay } from '../../src/astronomy/eclipse';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { LongitudeCache } from '../../src/astronomy/cache';
import type { PanchangSection } from '../../src/types/options';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const NYC = { latitude: 40.7128, longitude: -74.006 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };

/** Mean ms/call over `runs`, after warmup. */
function measureMs(fn: () => void, warmup = 5, runs = 30): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

/**
 * Smallest of N per-attempt `numerator / denominator` ratios, measuring the two
 * **interleaved** rather than one after the other.
 *
 * Two deliberate choices, both about surviving a contended CI run:
 *
 * *Interleaved*, because Vitest runs test files across parallel workers. Timing
 * A to completion and then B lets a scheduling stall land entirely on one side
 * and corrupt the ratio; alternating exposes both to the same contention. The
 * earlier version of this file measured them independently and failed roughly
 * half of all full-suite runs, once reporting 1.40 for a ratio whose true value
 * is 0.87.
 *
 * *Minimum rather than mean or median*, because contention is one-sided: a
 * stalled measurement is always too slow, never too fast. The smallest observed
 * ratio is therefore the closest to the uncontended truth, and it is the right
 * estimator for an assertion of the form `ratio < bound`.
 */
function ratioOf(numerator: () => void, denominator: () => void, attempts = 7): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) {
    const d = measureMs(denominator);
    const n = measureMs(numerator);
    best = Math.min(best, n / d);
  }
  return best;
}

const ALL_SECTIONS: readonly PanchangSection[] = [
  'festivals', 'eclipse', 'moonTimes', 'lunarWindows',
];

const fullRun = () =>
  getDailyPanchang(new Date('2025-07-04'), PUNE, {
    timezone: 330,
    sections: ALL_SECTIONS,
    computeEndTimes: true,
  });

/**
 * Distinct-day variants of the ratio machinery above.
 *
 * ## Why some of these ratios cannot be measured on one repeated day
 *
 * Phase 36.1 moved the Chebyshev longitude blocks and the lunar rise/set events
 * to module-level caches. On the *second* call for the same day, almost every
 * ephemeris result the optional sections need is already computed, so a repeated
 * day measures the fixed per-call arithmetic — slot systems, muhurtas, object
 * construction — that no option removes. Measured on the same day repeated,
 * before and after 36.1:
 *
 *   full run (all sections, end-times)   0.629 ms → 0.176 ms   (3.6× faster)
 *   `getInstantPanchang`                 0.245 ms → 0.142 ms   (1.7× faster)
 *   ratio                                0.39    → 0.80
 *
 * Nothing got slower; the *denominator collapsed*. Instant mode has less
 * cacheable ephemeris work to begin with, so it gained less, and the ratio rose
 * even though both sides improved. Over distinct days — a calendar scan, which
 * is the workload these options exist for — the same ratio is **0.19**.
 *
 * So the two ratios that had become insensitive are measured over distinct days
 * instead. Their thresholds are unchanged; only the workload is.
 */
const DAY_MS = 86_400_000;
let dayCursor = 0;
/** A fresh stretch of days, never reused, so no call is served by a cached day. */
function nextDays(n: number): Date[] {
  return Array.from(
    { length: n },
    () => new Date(Date.UTC(2024, 0, 1) + dayCursor++ * DAY_MS),
  );
}

/** Mean ms/call over `runs` distinct days, after a warm-up on distinct days. */
function measureOverDays(fn: (d: Date) => void, warmup = 30, runs = 150): number {
  for (const d of nextDays(warmup)) fn(d);
  const days = nextDays(runs);
  const start = performance.now();
  for (const d of days) fn(d);
  return (performance.now() - start) / runs;
}

/**
 * Smallest ms/day over `attempts` independent measurements.
 *
 * Minimum rather than mean, for the reason {@link ratioOf} gives: contention
 * only ever inflates a timing, so the smallest sample is the closest to the
 * uncontended truth and the right estimator for `cost < ceiling`.
 */
function bestMsPerDay(fn: (d: Date) => void, attempts = 12): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) best = Math.min(best, measureOverDays(fn));
  return best;
}

/** {@link ratioOf}, over distinct days. */
function ratioOverDays(
  numerator: (d: Date) => void,
  denominator: (d: Date) => void,
  attempts = 5,
): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) {
    const den = measureOverDays(denominator);
    const num = measureOverDays(numerator);
    best = Math.min(best, num / den);
  }
  return best;
}

const fullRunOn = (d: Date) => {
  getDailyPanchang(d, PUNE, {
    timezone: 330,
    sections: ALL_SECTIONS,
    computeEndTimes: true,
  });
};

// ── The invariants that actually guard against regression ────────────────────

describe('Performance invariants — narrowing work must cost less', () => {
  it('sections: [] + no end-times stays under its absolute ceiling', () => {
    /**
     * Distinct days — see `measureOverDays`.
     *
     * ## This was a ratio, and a ratio was the wrong instrument
     *
     * It asserted that `sections: []` cost under half a full run, then under
     * 0.62 of one. Both bounds moved for the same reason, and the reason is the
     * problem: the **denominator** kept improving. Measured, ms per distinct
     * day with `computeEndTimes: false`:
     *
     *   full run        0.7595 (pre-36.2) → 0.6365 (after 36.5) → 0.4741 → 0.4010
     *   `sections: []`  0.2933            → 0.3622             → 0.2664 → 0.2602
     *   ratio           0.386             → 0.569              → 0.562  → 0.649
     *
     * Every one of those columns is faster than the one before it, and the
     * ratio rose the whole way. A ratio bound cannot tell "narrowing got worse"
     * from "the full call got better", so raising it each time the library got
     * faster was the only available move and it made the assertion evidence of
     * nothing. It also sat at 0.505–0.514 against a 0.5 bound at the end of
     * Phase 36 — passing about one full-suite run in three, which is worse than
     * failing outright, and was only found by running the suite five times.
     *
     * The ceiling below is absolute instead, so it measures the narrowed path
     * and nothing else and never has to move when some *other* part of the
     * library gets faster. **Measured 2026-08-07**, on the machine
     * `notes/v5-harness.md` describes, at load average 3.3:
     *
     *   0.2602 ms/day          median of 15 processes (`node notes/driver.mjs`,
     *                          config `cold/sections-empty+no-end`)
     *   0.357 – 0.383 ms/day   this file alone, four runs, min-of-5
     *   0.384 – 0.479 ms/day   **full suite**, three runs, min-of-12
     *
     * ## What that third row costs, stated rather than glossed
     *
     * Vitest runs files in parallel workers, so the same call reads ~1.7× its
     * single-process cost during a full-suite run. Worse, that factor is itself
     * a function of what else the machine is doing. Nineteen full-suite runs
     * during the Phase 36 close-out:
     *
     *   load average ~3     0.384 – 0.479 ms/day    13 runs, all green
     *   load average ~11    up to 1.093 ms/day       6 runs, 4 with a failure
     *
     * A call with *no* narrowing would read ~0.66 ms/day at the lower load. So
     * the contention range (2.9×) is wider than the regression this test looks
     * for (1.5×), and **no absolute bound can both survive a loaded machine and
     * catch narrowing regressing by half.** That is a property of the harness,
     * not of a bound chosen badly, and it is the honest limit of replacing the
     * ratio with a ceiling.
     *
     * The bound is **1.60** — 1.5× the worst observation across all nineteen
     * runs. At that level it catches a gross regression (the narrowed call
     * costing more than a *full* call does today) and nothing subtler. The
     * subtler case is covered by the direction assertion below, and properly by
     * the single-process figure in `notes/bench-*.json`, which is measured
     * without contention and is where a change of this size is meant to be
     * seen. Note that even the direction assertion — a ratio, and so immune to
     * machine speed — failed once at load 11, reading 117%; contention that
     * lands unevenly on two interleaved measurements defeats a ratio too.
     *
     * **Observed again 2026-08-07, and worse than the range above.** Across
     * four five-run gates (20 full-suite runs) on one unchanged build, this
     * assertion, its twin in `tests/unit/sections.test.ts` and the instant-mode
     * ratio below failed during two runs of the one gate taken while eight
     * stray shell loops were polling in the background at load average ~6 — the
     * *minimum* of twelve samples exceeded 1.60, a 4× inflation over the 0.40
     * typical. The documented cliff was load ~11; it is really load ~6 with
     * enough processes behind it. The other three gates were 15/15 green at
     * load 3–5. Do not read a failure here as a regression without first
     * checking what else was running on the machine.
     */
    const msPerDay = bestMsPerDay((d) => {
      getDailyPanchang(d, PUNE, {
        timezone: 330,
        sections: [],
        computeEndTimes: false,
      });
    });
    expect(
      msPerDay,
      `sections:[] + no end-times cost ${msPerDay.toFixed(4)} ms/day; ` +
        `optional sections may no longer be being skipped`,
    ).toBeLessThan(1.60);
  });

  it('dropping the festivals section alone is measurably cheaper', () => {
    // Festivals are the single most expensive optional block; if this ratio
    // approaches 1.0 the gate has stopped working.
    //
    // Deliberately still measured on one repeated day, unlike the two ratios
    // above: cold, both sides pay the same ~0.28 ms of rise/set searches, which
    // swamps the ~0.04 ms the festival block adds and pushes the ratio to 0.945.
    // Warm, that shared floor is cached away and the festival block is a larger
    // share of what remains, so the repeated-day measurement is the *more*
    // sensitive one here. Measured 0.83 (worst of 12: 0.92) against the 0.95
    // bound — improved from a worst-of-12 of 0.90 before 36.1, but still the
    // narrowest margin in this file.
    const ratio = ratioOf(
      () =>
        getDailyPanchang(new Date('2025-07-04'), PUNE, {
          timezone: 330,
          sections: ['eclipse', 'moonTimes', 'lunarWindows'],
          computeEndTimes: true,
        }),
      fullRun,
    );
    expect(ratio, `without festivals took ${(ratio * 100).toFixed(0)}% of full`)
      .toBeLessThan(0.95);
  });

  it('the eclipse check is negligible on a day that holds no syzygy', () => {
    // 2025-07-04 is neither a new nor a full moon, so the syzygy guard should
    // reject before running any eclipse search. Without the guard this single
    // call cost ~4.4 ms — roughly 3× an entire present-day panchang.
    const sunrise = computeSunrise(new Date('2025-07-03T18:30:00Z'), PUNE);
    const nextSunrise = computeSunrise(computeSunset(sunrise, PUNE), PUNE);
    const ratio = ratioOf(() => {
      getEclipseDuringDay(sunrise, nextSunrise, PUNE);
    }, fullRun);
    expect(
      ratio,
      `eclipse check took ${(ratio * 100).toFixed(0)}% of a full panchang; ` +
        `the syzygy guard is not firing`,
    ).toBeLessThan(0.25);
  });

  it('instant mode stays far cheaper than a daily panchang', () => {
    // Distinct days — see `ratioOverDays`. Threshold unchanged at 0.75; measured
    // 0.19 over distinct days against 0.79 on one repeated day.
    const ratio = ratioOverDays((d) => {
      getInstantPanchang(new Date(d.getTime() + 6 * 3600_000), PUNE);
    }, fullRunOn);
    expect(ratio, `instant took ${(ratio * 100).toFixed(0)}% of a full run`)
      .toBeLessThan(0.75);
  });
});

// ── Catastrophic-failure backstops (deliberately loose) ──────────────────────

describe('Performance backstops — absolute ceilings', () => {
  // These exist to catch runaway behaviour (a search that stops converging, a
  // cache that stops caching), not to police incremental drift. Do not tighten
  // them toward the observed means; the ratio tests above do that job.
  const CEILING_MS = 20;

  for (const [name, loc, tz, date] of [
    ['Pune summer', PUNE, 330, '2025-07-04'],
    ['NYC (negative longitude)', NYC, -240, '2025-07-04'],
    ['Delhi year-end', DELHI, 330, '2025-12-31'],
  ] as const) {
    it(`${name} full run < ${CEILING_MS}ms/call`, () => {
      const ms = measureMs(() =>
        getDailyPanchang(new Date(date), loc, { timezone: tz, computeEndTimes: true }),
      );
      expect(ms, `full run took ${ms.toFixed(2)}ms`).toBeLessThan(CEILING_MS);
    });
  }

  it('instant mode < 5ms/call', () => {
    const moment = new Date('2025-07-04T06:00:00Z');
    const ms = measureMs(() => {
      getInstantPanchang(moment, PUNE);
    });
    expect(ms, `instant took ${ms.toFixed(2)}ms`).toBeLessThan(5);
  });
});

// ── Cache behaviour, measured the way the library actually uses it ───────────

describe('LongitudeCache — real usage', () => {
  /**
   * The old version of this test ran three passes over the same 30 timestamps
   * and asserted a >50% hit rate — which is arithmetically guaranteed by the
   * loop shape (2 of every 3 reads repeat) and told us nothing about the
   * library. What matters is that the access pattern a daily panchang actually
   * produces re-reads instants often enough for the memo to earn its place.
   */
  it('the daily-panchang access pattern re-reads instants enough to benefit', () => {
    const cache = new LongitudeCache('lahiri');

    // Sunrise, sunset and the kala anchors are each read by several
    // independent blocks (tithi, nakshatra, yoga, karana).
    const sunrise = computeSunrise(new Date('2025-07-03T18:30:00Z'), PUNE);
    const sunset = computeSunset(sunrise, PUNE);
    const nextSunrise = computeSunrise(sunset, PUNE);
    const dayMs = sunset.getTime() - sunrise.getTime();
    const anchors = [
      sunrise,
      sunset,
      nextSunrise,
      new Date(sunrise.getTime() + dayMs / 2),
      new Date(sunset.getTime() + 3600_000),
    ];
    for (let consumer = 0; consumer < 4; consumer++) {
      for (const a of anchors) {
        cache.getMoon(a);
        cache.getSun(a);
      }
    }

    const hitRate = cache.hits / (cache.hits + cache.misses);
    expect(
      hitRate,
      `hit rate ${(hitRate * 100).toFixed(1)}% — the memo is not paying off`,
    ).toBeGreaterThan(0.5);
    // Exactly one miss per distinct instant per body. The memo keys on the
    // exact instant, so this is the floor: four consumers reading the same five
    // anchors cost five computations each for Sun and Moon, and the other
    // fifteen reads are hits.
    expect(cache.misses).toBe(anchors.length * 2);
  });
});
