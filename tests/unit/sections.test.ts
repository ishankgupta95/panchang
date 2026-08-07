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
      expect(r.moon.rise, day).toBeNull();
      expect(r.moon.set, day).toBeNull();
      expect(r.inauspicious.bhadra, day).toBeNull();
      expect(r.inauspicious.varjyam, day).toBeNull();
      expect(r.inauspicious.panchakaRahita, day).toEqual([]);
    }
  });

  it('still computes everything outside the optional sections', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      // Slot systems, inauspicious periods, masa and special yogas are
      // arithmetic on the sunrise triplet and are never skipped.
      expect(JSON.stringify(bare.periods.choghadiya), day).toBe(JSON.stringify(full.periods.choghadiya));
      expect(JSON.stringify(bare.periods.hora), day).toBe(JSON.stringify(full.periods.hora));
      expect(JSON.stringify(bare.inauspicious.rahuKalam), day).toBe(JSON.stringify(full.inauspicious.rahuKalam));
      expect(JSON.stringify(bare.calendar.chandramasa), day).toBe(JSON.stringify(full.calendar.chandramasa));
      expect(JSON.stringify(bare.specialYogas), day).toBe(JSON.stringify(full.specialYogas));
      expect(bare.angas.vara.index, day).toBe(full.angas.vara.index);
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
            JSON.stringify(bare.angas[field]),
            `${field} on ${day} at ${name} must be identical when narrowed`,
          ).toBe(JSON.stringify(full.angas[field]));
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
      expect(moonOnly.moon.rise?.toISOString() ?? null, `moonrise ${day}`)
        .toBe(full.moon.rise?.toISOString() ?? null);
      expect(moonOnly.moon.set?.toISOString() ?? null, `moonset ${day}`)
        .toBe(full.moon.set?.toISOString() ?? null);

      const windowsOnly = panchangFor(day, ['lunarWindows']);
      expect(JSON.stringify(windowsOnly.inauspicious.bhadra), `bhadra ${day}`)
        .toBe(JSON.stringify(full.inauspicious.bhadra));
      expect(JSON.stringify(windowsOnly.inauspicious.varjyam), `varjyam ${day}`)
        .toBe(JSON.stringify(full.inauspicious.varjyam));
      expect(JSON.stringify(windowsOnly.inauspicious.panchakaRahita), `panchakaRahita ${day}`)
        .toBe(JSON.stringify(full.inauspicious.panchakaRahita));
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
    expect(withoutWindows.inauspicious.bhadra).toBeNull();
  });

  /**
   * Guards the point of the option: if narrowing ever stopped skipping work,
   * this would regress toward 1.0.
   *
   * ## Why this measures *distinct days* rather than one day repeated
   *
   * It used to repeat a single day, and that stopped measuring the property in
   * v5. Phase 36.1 moved the Chebyshev longitude blocks and the lunar rise/set
   * events to module-level caches, so on the *second* call for the same day
   * almost everything the optional sections need is already computed. Measured
   * on the same day repeated, before and after that change:
   *
   *   full run, `computeEndTimes: false`   0.745 ms → 0.163 ms   (4.6× faster)
   *   `sections: []`, same                 0.161 ms → 0.150 ms   (7% faster)
   *   ratio                                0.22    → 0.93
   *
   * The ratio rose because the *denominator collapsed*, not because narrowing
   * stopped working: a repeated day has little ephemeris work left to skip, and
   * what remains on both sides is the fixed per-call arithmetic (slot systems,
   * muhurtas, object construction) that `sections` never claimed to remove.
   *
   * Distinct days are also the shape the option exists for — a calendar scan —
   * and there narrowing removed ~69% of the work. So the measurement moved to
   * distinct days and the bound *tightened* from 0.75 to 0.5.
   *
   * ## Why it is no longer a ratio at all
   *
   * The bound then had to go back out to 0.62, and it was the same trap one
   * level up: the ratio rose because the **denominator improved**, by more than
   * the numerator. Measured, `computeEndTimes: false`, ms per distinct day:
   *
   *   |                | pre-36.2 | after 36.5 | end of 36 | + 4-day track |
   *   |----------------|----------|------------|-----------|---------------|
   *   | full run       | 0.7595   | 0.6365     | 0.4741    | **0.4010**    |
   *   | `sections: []` | 0.2933   | 0.3622     | 0.2664    | **0.2602**    |
   *   | ratio          | 0.386    | 0.569      | 0.562     | 0.649         |
   *
   * Every column is faster than the one before it and the ratio rose the whole
   * way. Raising the bound each time the library got faster was the only move
   * available, which is the tell that the instrument was wrong: a ratio cannot
   * distinguish "narrowing got worse" from "the full call got better".
   *
   * So the assertion below is an **absolute ms/day ceiling** on the narrowed
   * call, which measures the thing this test is named for and nothing else, and
   * never has to move when some other part of the library gets faster.
   * Measured 2026-08-07 on the machine `notes/v5-harness.md` describes, at load
   * average 3.3: 0.2602 ms/day as a median of 15 processes (`node
   * notes/driver.mjs`, config `cold/sections-empty+no-end`), 0.357–0.358 with
   * this file alone, and 0.400–0.471 during a full-suite run, where vitest's
   * parallel workers inflate it ~1.7×.
   *
   * The bound is **1.60**, and it is deliberately loose for a reason that
   * belongs here rather than in a commit message. Across nineteen full-suite
   * runs this reads 0.384–0.479 ms/day at load average ~3 and up to 1.093 at
   * load ~11 — a 2.9× range, wider than the 1.5× regression the test looks for.
   * An absolute bound tight enough to catch that regression fails on a busy
   * machine; this one catches only a gross regression. The subtler case is left
   * to the direction assertion below and to the contention-free figure in
   * `notes/bench-*.json`. See the twin assertion in `tests/perf/perf.test.ts`
   * for the full measurement.
   *
   *
   * **Observed again 2026-08-07, and worse than the range above.** Across four
   * five-run gates (20 full-suite runs) on the same build, this assertion and
   * its twin failed in two runs of the one gate taken while eight stray shell
   * loops were polling in the background at load average ~6 — so the minimum of
   * twelve samples exceeded 1.60, a 4× inflation over the 0.40 typical. The
   * documented cliff was load ~11; it is really load ~6 with enough processes
   * behind it. The other three gates were 15/15 green at load 3–5. Do not read
   * a failure here as a regression without first checking what else was running.
   * The repeated-day case below keeps a ratio, because there the only property
   * that must never break is the *direction* — narrowing may save nothing, but
   * it may never cost more — and a direction is machine-independent in a way an
   * absolute ceiling is not.
   */
  it('stays under its absolute ms/day ceiling when sections are dropped', () => {
    // A fresh stretch of days per measurement, so no call is served by a day the
    // previous measurement already computed.
    let cursor = 0;
    const nextDays = (n: number) =>
      Array.from(
        { length: n },
        () => new Date(Date.UTC(2024, 0, 1) + cursor++ * 86_400_000),
      );

    const time = (sections?: readonly PanchangSection[]) => {
      const opts = {
        timezone: TZ,
        computeEndTimes: false,
        ...(sections === undefined ? {} : { sections }),
      };
      for (const d of nextDays(40)) getDailyPanchang(d, PUNE, opts);
      const days = nextDays(200);
      const t0 = performance.now();
      for (const d of days) getDailyPanchang(d, PUNE, opts);
      return (performance.now() - t0) / days.length;
    };
    // Minimum of N — see `ratioOf` in tests/perf/perf.test.ts for why.
    // Vitest runs files in parallel workers, and contention only ever inflates
    // a timing, so the smallest sample is the closest to the uncontended truth
    // and the right estimator for `cost < ceiling`.
    let msPerDay = Infinity;
    for (let i = 0; i < 12; i++) msPerDay = Math.min(msPerDay, time([]));
    expect(
      msPerDay,
      `sections:[] cost ${msPerDay.toFixed(4)} ms/day`,
    ).toBeLessThan(1.60);
  });

  it('never costs more to ask for less, even on a fully cached day', () => {
    // The residual guarantee once the module caches have absorbed the ephemeris
    // work: narrowing may save little, but it must never be a net loss.
    const day = new Date('2025-07-04T06:30:00Z');
    const time = (sections?: readonly PanchangSection[]) => {
      const opts = {
        timezone: TZ,
        computeEndTimes: false,
        ...(sections === undefined ? {} : { sections }),
      };
      for (let i = 0; i < 50; i++) getDailyPanchang(day, PUNE, opts);
      const t0 = performance.now();
      for (let i = 0; i < 200; i++) getDailyPanchang(day, PUNE, opts);
      return performance.now() - t0;
    };
    let ratio = Infinity;
    for (let i = 0; i < 5; i++) ratio = Math.min(ratio, time([]) / time());
    expect(ratio, `sections:[] took ${(ratio * 100).toFixed(0)}% of a full run`)
      .toBeLessThan(1.0);
  });
});
