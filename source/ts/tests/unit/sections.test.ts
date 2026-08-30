import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import type { PanchangSection } from '../../src/types/options';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const ALL: readonly PanchangSection[] = ['festivals', 'eclipse', 'moonTimes', 'lunarWindows'];

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
      expect(r.inauspicious.varjyam, day).toEqual([]);
      expect(r.inauspicious.panchakaRahita, day).toEqual([]);
    }
  });

  it('still computes everything outside the optional sections', () => {
    for (const day of DAYS) {
      const full = panchangFor(day);
      const bare = panchangFor(day, []);
      expect(JSON.stringify(bare.periods.choghadiya), day).toBe(JSON.stringify(full.periods.choghadiya));
      expect(JSON.stringify(bare.periods.hora), day).toBe(JSON.stringify(full.periods.hora));
      expect(JSON.stringify(bare.inauspicious.rahuKalam), day).toBe(JSON.stringify(full.inauspicious.rahuKalam));
      expect(JSON.stringify(bare.calendar.chandramasa), day).toBe(JSON.stringify(full.calendar.chandramasa));
      expect(JSON.stringify(bare.specialYogas), day).toBe(JSON.stringify(full.specialYogas));
      expect(bare.angas.vara.index, day).toBe(full.angas.vara.index);
    }
  });

  // Exact equality: `LongitudeCache` memoizes on the exact instant, and a
  // one-bucket (60 s) tolerance hid a real 63 s drift.
  it('is exactly output-neutral for element arrays', () => {
    const LOCATIONS = [
      { name: 'Pune', loc: PUNE, tz: 330 },
      { name: 'NYC', loc: { latitude: 40.7128, longitude: -74.006 }, tz: -300 },
      { name: 'London', loc: { latitude: 51.5074, longitude: -0.1278 }, tz: 0 },
      { name: 'Sydney', loc: { latitude: -33.8688, longitude: 151.2093 }, tz: 600 },
    ];
    // 2025-01-06 at NYC is the day a bucketed memo disagreed on element count.
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
    // Raksha Bandhan's "after Bhadra ends" note reads the window even unreported.
    const day = '2026-08-28'; // Shravana Purnima 2026
    const withWindows = panchangFor(day, ['festivals', 'lunarWindows']);
    const withoutWindows = panchangFor(day, ['festivals']);
    expect(JSON.stringify(withoutWindows.festivals))
      .toBe(JSON.stringify(withWindows.festivals));
    expect(withoutWindows.inauspicious.bhadra).toBeNull();
  });

  // An absolute ceiling, not a narrowed/full ratio, which rises whenever the full
  // call gets faster. 1.60 is loose because the reading is dominated by machine
  // load (0.26 ms/day uncontended); check what else ran before calling a failure.
  // Timing, so it stands aside under coverage: instrumentation would make the
  // reading measure the instrumentation.
  it.skipIf(process.env.COVERAGE)('stays under its absolute ms/day ceiling when sections are dropped', () => {
    // A fresh stretch of days per measurement, so no call is served by a cached day.
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
    // Contention only inflates a timing, so the smallest sample is the estimator.
    let msPerDay = Infinity;
    for (let i = 0; i < 12; i++) msPerDay = Math.min(msPerDay, time([]));
    expect(
      msPerDay,
      `sections:[] cost ${msPerDay.toFixed(4)} ms/day`,
    ).toBeLessThan(1.60);
  });

  it.skipIf(process.env.COVERAGE)('never costs more to ask for less, even on a fully cached day', () => {
    // Little left to skip once the caches are warm, so only direction is asserted.
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
