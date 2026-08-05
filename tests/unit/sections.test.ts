/**
 * `options.sections` narrows which ephemeris-backed blocks `getDailyPanchang`
 * computes. Two properties matter and are pinned here:
 *
 *   1. Omitting the option is byte-identical to requesting every section, so
 *      existing callers are unaffected.
 *   2. A requested section produces exactly the same values it would have
 *      produced in a full run — narrowing skips work, it never degrades it.
 *
 * The second property is the one worth guarding: a naive implementation that
 * shares intermediate state between blocks could return subtly different
 * festivals when moon times are switched off.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import type { PanchangSection } from '../../src/types/options';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const ALL: readonly PanchangSection[] = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];

// A spread of days: an eclipse day, a festival-dense day, a Sankranti, and an
// ordinary day — so the comparisons below exercise populated sections rather
// than trivially-empty ones.
const DAYS = ['2025-09-07', '2026-03-03', '2026-01-14', '2026-08-26', '2025-07-04'];

function panchangFor(day: string, sections?: readonly PanchangSection[]) {
  const r = getDailyPanchang(new Date(`${day}T06:30:00Z`), PUNE, {
    timezone: TZ,
    ...(sections === undefined ? {} : { sections }),
  });
  if (r === null) throw new Error(`no panchang for ${day}`);
  return r;
}

describe('options.sections', () => {
  it('defaults to every section', () => {
    for (const day of DAYS) {
      expect(JSON.stringify(panchangFor(day)), day)
        .toBe(JSON.stringify(panchangFor(day, ALL)));
    }
  });

  it('leaves omitted sections at their documented empty values', () => {
    for (const day of DAYS) {
      const r = panchangFor(day, []);
      expect(r.festivals, day).toEqual([]);
      expect(r.eclipse, day).toBeNull();
      expect(r.moonrise, day).toBeNull();
      expect(r.moonset, day).toBeNull();
      expect(r.bhadra, day).toBeNull();
      expect(r.varjyam, day).toBeNull();
      expect(r.panchakaRahita, day).toEqual([]);
    }
  });

  it('still computes everything outside the optional sections', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      // Slot systems, inauspicious periods, masa and special yogas are
      // arithmetic on the sunrise triplet and are never skipped.
      expect(JSON.stringify(bare.choghadiya), day).toBe(JSON.stringify(full.choghadiya));
      expect(JSON.stringify(bare.hora), day).toBe(JSON.stringify(full.hora));
      expect(JSON.stringify(bare.rahuKalam), day).toBe(JSON.stringify(full.rahuKalam));
      expect(JSON.stringify(bare.chandramasa), day).toBe(JSON.stringify(full.chandramasa));
      expect(JSON.stringify(bare.specialYogas), day).toBe(JSON.stringify(full.specialYogas));
      expect(bare.vara.index, day).toBe(full.vara.index);
    }
  });

  /**
   * Narrowing is **exactly** output-neutral for the elements: same identity,
   * same transition times to the millisecond, same progress fields.
   *
   * This is a guarantee rather than a tolerance because `LongitudeCache`
   * memoizes on the exact instant. It did not always: while the memo keyed on a
   * 60-second bucket but stored the value computed at the first instant to land
   * in that bucket, a narrowed run populated the buckets from different
   * instants and transition times moved by up to 63 s — and on 2025-01-06 at
   * NYC the two paths even disagreed on how many nakshatras the day held.
   *
   * A tolerance-based version of this test hid that: it bounded drift at one
   * 60 s bucket and passed only because its day list never hit a larger case.
   * Exact equality has no such failure mode, so the matrix below is swept wide
   * on purpose.
   */
  it('is exactly output-neutral for element arrays', () => {
    const LOCATIONS = [
      { name: 'Pune', loc: PUNE, tz: 330 },
      { name: 'NYC', loc: { latitude: 40.7128, longitude: -74.006 }, tz: -300 },
      { name: 'London', loc: { latitude: 51.5074, longitude: -0.1278 }, tz: 0 },
      { name: 'Sydney', loc: { latitude: -33.8688, longitude: 151.2093 }, tz: 600 },
    ];
    // 2025-01-06 NYC is the day the bucketed memo disagreed on element count.
    const SWEEP = [
      '2025-01-06', '2025-01-24', '2025-02-15', '2025-07-04', '2025-09-07',
      '2025-10-04', '2025-12-20', '2026-01-14', '2026-03-03', '2026-08-26',
    ];

    for (const { name, loc, tz } of LOCATIONS) {
      for (const day of SWEEP) {
        const opts = { timezone: tz };
        const full = getDailyPanchang(new Date(`${day}T06:30:00Z`), loc, opts);
        const bare = getDailyPanchang(new Date(`${day}T06:30:00Z`), loc, {
          ...opts,
          sections: [],
        });
        if (full === null || bare === null) continue;
        for (const field of ['tithis', 'nakshatras', 'yogas', 'karanas'] as const) {
          expect(
            JSON.stringify(bare[field]),
            `${field} on ${day} at ${name} must be identical when narrowed`,
          ).toBe(JSON.stringify(full[field]));
        }
      }
    }
  });

  it('produces identical values for each section requested in isolation', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);

      const festivalsOnly = panchangFor(day, ['festivals', 'eclipse']);
      expect(festivalsOnly.festivals.map((f) => f.key), `festivals ${day}`)
        .toEqual(full.festivals.map((f) => f.key));

      const moonOnly = panchangFor(day, ['moonTimes']);
      expect(moonOnly.moonrise?.toISOString() ?? null, `moonrise ${day}`)
        .toBe(full.moonrise?.toISOString() ?? null);
      expect(moonOnly.moonset?.toISOString() ?? null, `moonset ${day}`)
        .toBe(full.moonset?.toISOString() ?? null);

      const windowsOnly = panchangFor(day, ['lunarWindows']);
      expect(JSON.stringify(windowsOnly.bhadra), `bhadra ${day}`)
        .toBe(JSON.stringify(full.bhadra));
      expect(JSON.stringify(windowsOnly.varjyam), `varjyam ${day}`)
        .toBe(JSON.stringify(full.varjyam));
      expect(JSON.stringify(windowsOnly.panchakaRahita), `panchakaRahita ${day}`)
        .toBe(JSON.stringify(full.panchakaRahita));
    }
  });

  it('keeps Bhadra-dependent festival descriptions correct without lunarWindows', () => {
    // Raksha Bandhan's "observe after Bhadra ends" note reads the Bhadra
    // window. Requesting 'festivals' alone must still compute it internally
    // even though the window itself is not reported.
    const day = '2026-08-28'; // Shravana Purnima 2026
    const withWindows = panchangFor(day, ['festivals', 'lunarWindows']);
    const withoutWindows = panchangFor(day, ['festivals']);
    expect(JSON.stringify(withoutWindows.festivals))
      .toBe(JSON.stringify(withWindows.festivals));
    expect(withoutWindows.bhadra).toBeNull();
  });

  it('is materially cheaper when sections are dropped', () => {
    // Guards the point of the option: if narrowing ever stopped skipping work,
    // this would regress toward 1.0. Generous bound to stay CI-stable.
    const day = new Date('2025-07-04T06:30:00Z');
    const time = (sections?: readonly PanchangSection[]) => {
      const opts = {
        timezone: TZ,
        computeEndTimes: false,
        ...(sections === undefined ? {} : { sections }),
      };
      for (let i = 0; i < 5; i++) getDailyPanchang(day, PUNE, opts);
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) getDailyPanchang(day, PUNE, opts);
      return performance.now() - t0;
    };
    // Interleaved, minimum-of-N — see `ratioOf` in tests/perf/perf.test.ts for
    // why. Vitest runs files in parallel workers, so timing one side to
    // completion and then the other lets a scheduling stall land entirely on
    // one of them; contention only ever inflates a measurement, so the smallest
    // observed ratio is the closest to the uncontended truth. The naive version
    // of this failed intermittently under a full-suite run while measuring
    // ~0.29 in isolation, against a 0.75 bound.
    let ratio = Infinity;
    for (let i = 0; i < 5; i++) ratio = Math.min(ratio, time([]) / time());
    expect(ratio, `sections:[] took ${(ratio * 100).toFixed(0)}% of a full run`)
      .toBeLessThan(0.75);
  });
});
