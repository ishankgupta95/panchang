/**
 * @tier 1  DrikPanchang.com day-panchang, 50 scraped fixtures
 *
 * Phase 28 cross-validation against DrikPanchang.com.
 *
 * Coverage: 10 cities × 5 dates = 50 fixtures spanning seasons + Adhika
 * Jyestha 2026 (2026-05-25). Source fixture
 * `tests/fixtures/drikpanchang-phase28.json` was scraped from
 * drikpanchang.com/panchang/day-panchang.html (per-entry `_source`
 * declares the geoname-id and scrape date).
 *
 * ── Feature-level findings (50/50 fixtures) ──────────────────────────────────
 *
 * STRICT MATCH (asserted at ±2 min for time windows, exact for categorical):
 *   - Sunrise / Sunset baseline     50/50 within ±3 min (existing convention)
 *   - Madhyahna midpoint            50/50 within ±1 min
 *   - Pratah Sandhya start + end    50/50 within ±2 min — elastic ghatika
 *                                     algorithm (width = nightDuration/10,
 *                                     end == sunrise) matches DrikPanchang
 *   - Sayahna Sandhya start + end   50/50 within ±2 min — same algorithm,
 *                                     start == sunset
 *   - Varjyam windows                 within ±2 min — elastic ghatikas of
 *                                     nakshatra duration. Multi-window
 *                                     contract: every window overlapping the
 *                                     Hindu day is published, so the fixture's
 *                                     Drik row must match SOME window on every
 *                                     fixture that has one.
 *   - Anandadi Yoga name            50/50 exact
 *   - Ganda Mula active flag        50/50 exact
 *
 * SOFT MATCH (one-way superset; library output ⊇ recognized Drik names):
 *   Special yogas. Drik's "Auspicious / Inauspicious Yogas" panels lump
 *   `SpecialYogaInfo` items together with unrelated muhurta entries
 *   (Brahma Muhurta, Vishti, Bhadra, Panchaka, Bana, Abhijit, Vijaya, …),
 *   so an exact-set comparison isn't meaningful. Instead, we map each
 *   Drik panel string to a `SpecialYogaInfo['type']` if recognized, then
 *   verify the library detects it. The reverse direction (library detects
 *   yogas Drik doesn't list) is permitted.
 *
 *   Aadal / Vidaal are NOT cross-checked here — see the sourcing comment
 *   on `drikYogaToLibType` below. Briefly: the library follows the
 *   classical Moon-from-Sun nakshatra-distance rule; DrikPanchang appears
 *   to use the popular Tamil-Vakya weekday-keyed rule. The disagreement
 *   is by-design.
 *
 *   Two outlier dates are skipped from the soft check:
 *   - Hyderabad 2026-11-05 (Drik returned an unusually broad auspicious-
 *     yoga set — flagged in the fixture `_note`).
 *   - Jaipur    2026-04-15 (Drik inauspicious panel scrape was incomplete
 *     — flagged in the fixture `_note`).
 *
 * NOT CROSS-VALIDATED:
 *   - Tarabala. Janma-nakshatra-keyed; Drik's panel is a per-nakshatra
 *     band ("Good Tarabalam till X PM for nakshatras N, M, …"), which
 *     doesn't lend itself to per-fixture scalar comparison. Algorithm
 *     verified by `tests/unit/tarabala.test.ts` (38 cases) +
 *     `tests/integration/tarabala-wiring.test.ts`.
 *   - Do Ghati Muhurta. Not on Drik's day-panchang page; the 30-name
 *     table at drikpanchang.com/muhurat/daily/do-ghati-muhurat.html is
 *     fixed across weekdays (sourcing comment in
 *     `src/core/doGhati.ts:3-21`). Algorithm verified by
 *     `tests/unit/doGhati.test.ts` against that reference table.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { formatInZone } from '../../src/utils/timezone';
import fixtures from '../fixtures/drikpanchang-phase28.json';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STRICT_TOL_MIN = 1;
const SUNRISE_TOL_MIN = 3;

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function parseHHMM(s: string): number {
  const [hm, off] = s.split('+') as [string, string | undefined];
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m + (off ? Number(off) * 1440 : 0);
}

/**
 * Minutes from local midnight of `dateStr`, read from an offset-carrying ISO
 * string.
 *
 * v5: published `Date`s are true instants, so subtracting a UTC midnight no
 * longer yields a local wall clock. The `*Local` string already carries the
 * offset, so the day component of the string is what tells us whether the event
 * rolled past midnight.
 */
function localMinutes(local: string, dateStr: string): number {
  const dayDelta = Math.round(
    (Date.parse(`${local.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`))
    / 86_400_000,
  );
  const [h, m] = local.slice(11, 16).split(':').map(Number) as [number, number];
  return dayDelta * 1440 + h * 60 + m;
}

function diffMin(libLocal: string, fixHHMM: string, dateStr: string): number {
  return Math.abs(localMinutes(libLocal, dateStr) - parseHHMM(fixHHMM));
}

/**
 * Map a Drik-rendered yoga string to a library `SpecialYogaInfo['type']`.
 *
 * Aadal / Vidaal are intentionally NOT mapped here. The library uses the
 * classical Moon-from-Sun nakshatra-distance rule (sourced from AstroShastra
 * / HoraSarvam / Ernst Wilhelm — see `src/core/specialYogas.ts:111-138`),
 * while DrikPanchang appears to use the popular Tamil-Vakya weekday ×
 * nakshatra rule. The disagreement is by-design per the sourcing comment;
 * the parity oracle for Aadal / Vidaal is the classical compilations, not
 * Drik. They are still asserted by `tests/integration/specialYogas-v23-wiring.test.ts`
 * against fixed Vara/Tithi/Nakshatra inputs.
 */
function drikYogaToLibType(s: string): string | null {
  const k = s.toLowerCase();
  if (k.includes('sarvartha siddhi'))  return 'sarvartha_siddhi';
  if (k.includes('amrit siddhi'))      return 'amrit_siddhi';
  if (k.includes('ravi pushya'))       return 'ravi_pushya';
  if (k.includes('guru pushya'))       return 'guru_pushya';
  if (k.includes('dwipushkar'))        return 'dwipushkar';
  if (k.includes('tripushkar'))        return 'tripushkar';
  if (k.includes('jwalamukhi'))        return 'jwalamukhi';
  if (k === 'ravi yoga' || k.endsWith(' ravi yoga')) return 'ravi';
  return null;
}

// Two outlier (city, date) entries where Drik's panels were noisy / partial
// per scraper notes — exempt from soft-yoga-superset assertion.
const SOFT_YOGA_SKIP = new Set<string>([
  'Hyderabad|2026-11-05',
  'Jaipur|2026-04-15',
]);

// ── Types ────────────────────────────────────────────────────────────────────

type Phase28Fixture = {
  _source: string;
  _note?: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    sunriseHHMM: string;
    sunsetHHMM: string;
    varjyamStartHHMM: string | null;
    varjyamEndHHMM: string | null;
    madhyahnaHHMM: string | null;
    pratahSandhyaStartHHMM: string | null;
    pratahSandhyaEndHHMM: string | null;
    sayahnaSandhyaStartHHMM: string | null;
    sayahnaSandhyaEndHHMM: string | null;
    anandadiYogaName: string | null;
    gandaMulaActive: boolean;
    auspiciousYogas: string[];
    inauspiciousYogas: string[];
  };
};

const TYPED: Phase28Fixture[] = fixtures as unknown as Phase28Fixture[];

// ── Per-fixture sweep ────────────────────────────────────────────────────────

describe('Phase 28 cross-validation against DrikPanchang (50 fixtures)', () => {
  for (const f of TYPED) {
    describe(`${f.city} ${f.date}`, () => {
      const result = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
        computeEndTimes: true,
      });

      it('result is non-null', () => {
        expect(result).not.toBeNull();
      });
      if (result === null) return;

      // ── STRICT (Drik agreement) ──
      it(`sunrise within ±${SUNRISE_TOL_MIN} min`, () => {
        expect(diffMin(result.sun.riseLocal, f.expected.sunriseHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });
      it(`sunset within ±${SUNRISE_TOL_MIN} min`, () => {
        expect(diffMin(result.sun.setLocal, f.expected.sunsetHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });

      if (f.expected.madhyahnaHHMM) {
        it(`Madhyahna midpoint within ±${STRICT_TOL_MIN} min`, () => {
          // Averaging two instants is now meaningful arithmetic — in 4.x both
          // were offset-shifted, so the midpoint was too. `formatInZone` renders
          // the derived instant in the result's own zone.
          const mid = new Date(
            (result.muhurtas.madhyahna.start.getTime() + result.muhurtas.madhyahna.end.getTime()) / 2,
          );
          expect(diffMin(
            formatInZone(mid, result.timezone.offsetMinutes),
            f.expected.madhyahnaHHMM!,
            f.date,
          ))
            .toBeLessThanOrEqual(STRICT_TOL_MIN);
        });
      }

      if (f.expected.anandadiYogaName) {
        it(`Anandadi Yoga "${f.expected.anandadiYogaName}"`, () => {
          expect(result.anandadiYoga.name).toBe(f.expected.anandadiYogaName);
        });
      }

      it(`Ganda Mula active === ${f.expected.gandaMulaActive}`, () => {
        expect(result.inauspicious.gandaMula.active).toBe(f.expected.gandaMulaActive);
      });

      // ── STRICT (Sandhya — elastic ghatikas of nighttime, ±2 min vs Drik) ──
      const SANDHYA_TOL_MIN = 2;

      if (f.expected.pratahSandhyaStartHHMM && f.expected.pratahSandhyaEndHHMM) {
        it(`Pratah Sandhya start within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.muhurtas.pratahSandhya.startLocal, f.expected.pratahSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Pratah Sandhya end within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.muhurtas.pratahSandhya.endLocal, f.expected.pratahSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      if (f.expected.sayahnaSandhyaStartHHMM && f.expected.sayahnaSandhyaEndHHMM) {
        it(`Sayahna Sandhya start within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.muhurtas.sayahnaSandhya.startLocal, f.expected.sayahnaSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Sayahna Sandhya end within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.muhurtas.sayahnaSandhya.endLocal, f.expected.sayahnaSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      // ── STRICT (Varjyam — elastic ghatikas of nakshatra, ±2 min vs Drik) ──
      // The library publishes every Varjyam window overlapping the Hindu day
      // (multi-window contract); the fixture recorded one Drik row, so the
      // assertion is that SOME published window matches it. The old escape
      // hatch ("null allowed on transition days") is gone — multi-window is
      // exactly what closed that gap.
      if (f.expected.varjyamStartHHMM && f.expected.varjyamEndHHMM) {
        it(`Varjyam: some window matches Drik's row`, () => {
          const windows = result.inauspicious.varjyam;
          expect(windows.length, 'Drik printed a Varjyam row; library emitted none')
            .toBeGreaterThan(0);
          const best = Math.min(...windows.map((w) => Math.max(
            diffMin(w.startLocal, f.expected.varjyamStartHHMM!, f.date),
            diffMin(w.endLocal, f.expected.varjyamEndHHMM!, f.date),
          )));
          expect(best).toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      // ── SOFT (yoga superset) ──
      const skipKey = `${f.city}|${f.date}`;
      if (!SOFT_YOGA_SKIP.has(skipKey)) {
        const drikYogas = [...f.expected.auspiciousYogas, ...f.expected.inauspiciousYogas]
          .map(drikYogaToLibType)
          .filter((y): y is string => y !== null);
        const drikYogaSet = new Set(drikYogas);
        if (drikYogaSet.size > 0) {
          for (const y of drikYogaSet) {
            it(`special yoga "${y}" detected by library`, () => {
              const libTypes = result.specialYogas.map((s) => s.type);
              expect(libTypes).toContain(y);
            });
          }
        }
      }
    });
  }
});

// ── Aggregate sanity ─────────────────────────────────────────────────────────

describe('Phase 28 cross-validation — aggregate', () => {
  it('coverage: 10 cities × 5 dates', () => {
    const cities = new Set(TYPED.map((f) => f.city));
    const dates = new Set(TYPED.map((f) => f.date));
    expect(cities.size).toBe(10);
    expect(dates.size).toBe(5);
    expect(TYPED.length).toBe(50);
  });

  it('all 50 fixtures resolve to non-null library results', () => {
    let nonNull = 0;
    for (const f of TYPED) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r !== null) nonNull++;
    }
    expect(nonNull).toBe(TYPED.length);
  });

  // Aggregate parity — every fixture's Sandhya start matches Drik within
  // ±2 min after the Phase 28 algorithm switch (elastic night ghatikas).
  // A regression that breaks the convention will fail many fixtures here
  // *and* in the per-fixture sweep above; this aggregate gives a single
  // headline-number assertion.
  it('Pratah + Sayahna Sandhya agree with Drik within ±2 min on every fixture', () => {
    let pratahMaxDiff = 0;
    let sayahnaMaxDiff = 0;
    for (const f of TYPED) {
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r === null) continue;
      if (f.expected.pratahSandhyaStartHHMM) {
        pratahMaxDiff = Math.max(
          pratahMaxDiff,
          diffMin(r.muhurtas.pratahSandhya.startLocal, f.expected.pratahSandhyaStartHHMM, f.date),
        );
      }
      if (f.expected.sayahnaSandhyaStartHHMM) {
        sayahnaMaxDiff = Math.max(
          sayahnaMaxDiff,
          diffMin(r.muhurtas.sayahnaSandhya.startLocal, f.expected.sayahnaSandhyaStartHHMM, f.date),
        );
      }
    }
    expect(pratahMaxDiff).toBeLessThanOrEqual(2);
    expect(sayahnaMaxDiff).toBeLessThanOrEqual(2);
  });

  it('Varjyam agrees with Drik within ±2 min on every fixture that has one', () => {
    let maxDiff = 0;
    let emitted = 0;
    let withExpected = 0;
    for (const f of TYPED) {
      if (!f.expected.varjyamStartHHMM || !f.expected.varjyamEndHHMM) continue;
      withExpected++;
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r === null || r.inauspicious.varjyam.length === 0) continue;
      emitted++;
      const best = Math.min(...r.inauspicious.varjyam.map((w) => Math.max(
        diffMin(w.startLocal, f.expected.varjyamStartHHMM!, f.date),
        diffMin(w.endLocal, f.expected.varjyamEndHHMM!, f.date),
      )));
      maxDiff = Math.max(maxDiff, best);
    }
    // Multi-window contract: every fixture where Drik printed a Varjyam row
    // must yield at least one matching library window — the transition-day
    // drop-outs of the old single-window contract are exactly what the
    // multi-window walk closed.
    expect(emitted).toBe(withExpected);
    expect(maxDiff).toBeLessThanOrEqual(2);
  });
});
