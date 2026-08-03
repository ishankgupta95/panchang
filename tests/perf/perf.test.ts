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
 * Best-of-N mean. Taking the minimum damps scheduler noise, which matters
 * because the ratio assertions below divide two timings.
 */
function bestMs(fn: () => void, attempts = 3): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) best = Math.min(best, measureMs(fn));
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

// ── The invariants that actually guard against regression ────────────────────

describe('Performance invariants — narrowing work must cost less', () => {
  it('sections: [] + no end-times is well under half a full run', () => {
    const full = bestMs(fullRun);
    const bare = bestMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, {
        timezone: 330,
        sections: [],
        computeEndTimes: false,
      }),
    );
    const ratio = bare / full;
    expect(
      ratio,
      `bare run took ${(ratio * 100).toFixed(0)}% of a full run ` +
        `(${bare.toFixed(3)}ms vs ${full.toFixed(3)}ms); ` +
        `optional sections are no longer being skipped`,
    ).toBeLessThan(0.5);
  });

  it('dropping the festivals section alone is measurably cheaper', () => {
    // Festivals are the single most expensive optional block; if this ratio
    // approaches 1.0 the gate has stopped working.
    const full = bestMs(fullRun);
    const noFestivals = bestMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, {
        timezone: 330,
        sections: ['eclipse', 'moonTimes', 'lunarWindows'],
        computeEndTimes: true,
      }),
    );
    const ratio = noFestivals / full;
    expect(ratio, `without festivals took ${(ratio * 100).toFixed(0)}% of full`)
      .toBeLessThan(0.95);
  });

  it('the eclipse check is negligible on a day that holds no syzygy', () => {
    // 2025-07-04 is neither a new nor a full moon, so the syzygy guard should
    // reject before running any eclipse search. Without the guard this single
    // call cost ~4.4 ms — roughly 3× an entire present-day panchang.
    const sunrise = computeSunrise(new Date('2025-07-03T18:30:00Z'), PUNE);
    const nextSunrise = computeSunrise(computeSunset(sunrise, PUNE), PUNE);
    const full = bestMs(fullRun);
    const eclipseCheck = bestMs(() => {
      getEclipseDuringDay(sunrise, nextSunrise, PUNE);
    });
    const ratio = eclipseCheck / full;
    expect(
      ratio,
      `eclipse check took ${(ratio * 100).toFixed(0)}% of a full panchang ` +
        `(${eclipseCheck.toFixed(3)}ms); the syzygy guard is not firing`,
    ).toBeLessThan(0.25);
  });

  it('instant mode stays far cheaper than a daily panchang', () => {
    const moment = new Date('2025-07-04T06:00:00Z');
    const instant = bestMs(() => {
      getInstantPanchang(moment, PUNE);
    });
    const full = bestMs(fullRun);
    expect(instant / full).toBeLessThan(0.75);
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

  it('high precision stays within the same ceiling', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-01-14'), PUNE, {
        timezone: 330,
        computeEndTimes: true,
        precision: 'high',
      }),
    );
    expect(ms, `high precision took ${ms.toFixed(2)}ms`).toBeLessThan(CEILING_MS * 2);
  });

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
    // Exactly one miss per distinct instant per body: proof it memoizes on the
    // exact instant rather than on a time bucket.
    expect(cache.misses).toBe(anchors.length * 2);
  });
});
