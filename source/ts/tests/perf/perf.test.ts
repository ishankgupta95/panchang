/**
 * The load-bearing assertions are ratios between two measurements taken in the
 * same process, which makes them insensitive to machine speed. The absolute
 * bounds are only a catastrophic-failure backstop and must not be tightened
 * toward observed means.
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

function measureMs(fn: () => void, warmup = 5, runs = 30): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

/**
 * Interleaved and minimum, not batched and averaged: Vitest's parallel workers
 * make a stall one-sided (too slow, never too fast), so the smallest observed
 * ratio is closest to the uncontended truth.
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
 * Distinct-day variants of the ratio machinery above. Chebyshev longitude
 * blocks and lunar rise/set events live in module-level caches, so a second
 * call for the same day measures only the fixed per-call arithmetic that no
 * option removes, and the option ratios go insensitive.
 */
const DAY_MS = 86_400_000;
let dayCursor = 0;
function nextDays(n: number): Date[] {
  return Array.from(
    { length: n },
    () => new Date(Date.UTC(2024, 0, 1) + dayCursor++ * DAY_MS),
  );
}

function measureOverDays(fn: (d: Date) => void, warmup = 30, runs = 150): number {
  for (const d of nextDays(warmup)) fn(d);
  const days = nextDays(runs);
  const start = performance.now();
  for (const d of days) fn(d);
  return (performance.now() - start) / runs;
}

function bestMsPerDay(fn: (d: Date) => void, attempts = 12): number {
  let best = Infinity;
  for (let i = 0; i < attempts; i++) best = Math.min(best, measureOverDays(fn));
  return best;
}

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

describe('Performance invariants: narrowing work must cost less', () => {
  it('sections: [] + no end-times stays under its absolute ceiling', () => {
    /**
     * 1.5x the worst observation under a loaded parallel suite (1.09 ms/day
     * against 0.26 single-process), so it catches only a gross regression:
     * contention spans a wider range than the regression this test looks for.
     * Check what else was running before reading a failure here as one.
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
    // Deliberately one repeated day, unlike the ratios above: cold, both sides
    // pay the same rise/set searches, which swamp the festival block and push
    // the ratio to 0.945. This is the narrowest margin in the file.
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
    // reject before running any eclipse search.
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
    const ratio = ratioOverDays((d) => {
      getInstantPanchang(new Date(d.getTime() + 6 * 3600_000), PUNE);
    }, fullRunOn);
    expect(ratio, `instant took ${(ratio * 100).toFixed(0)}% of a full run`)
      .toBeLessThan(0.75);
  });
});

describe('Performance backstops: absolute ceilings', () => {
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

describe('LongitudeCache: real usage', () => {
  it('the daily-panchang access pattern re-reads instants enough to benefit', () => {
    const cache = new LongitudeCache('lahiri');

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
      `hit rate ${(hitRate * 100).toFixed(1)}%: the memo is not paying off`,
    ).toBeGreaterThan(0.5);
    // The memo keys on the exact instant: one miss per instant per body.
    expect(cache.misses).toBe(anchors.length * 2);
  });
});
