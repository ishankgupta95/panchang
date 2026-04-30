/**
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
 *   - Varjyam window (sunrise-active nakshatra) within ±2 min — elastic
 *                                     ghatikas of nakshatra duration. Library
 *                                     returns null on transition days where
 *                                     Drik picks the second nakshatra (the
 *                                     single-window contract is an explicit
 *                                     limitation, not a parity gap).
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

function dateToMinutes(d: Date, dateStr: string): number {
  const [y, mo, da] = dateStr.split('-').map(Number) as [number, number, number];
  const midnight = Date.UTC(y, mo - 1, da, 0, 0, 0);
  return Math.round((d.getTime() - midnight) / 60000);
}

function diffMin(libDate: Date, fixHHMM: string, dateStr: string): number {
  return Math.abs(dateToMinutes(libDate, dateStr) - parseHHMM(fixHHMM));
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
        expect(diffMin(result.sunrise, f.expected.sunriseHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });
      it(`sunset within ±${SUNRISE_TOL_MIN} min`, () => {
        expect(diffMin(result.sunset, f.expected.sunsetHHMM, f.date))
          .toBeLessThanOrEqual(SUNRISE_TOL_MIN);
      });

      if (f.expected.madhyahnaHHMM) {
        it(`Madhyahna midpoint within ±${STRICT_TOL_MIN} min`, () => {
          const mid = new Date(
            (result.madhyahna.start.getTime() + result.madhyahna.end.getTime()) / 2,
          );
          expect(diffMin(mid, f.expected.madhyahnaHHMM!, f.date))
            .toBeLessThanOrEqual(STRICT_TOL_MIN);
        });
      }

      if (f.expected.anandadiYogaName) {
        it(`Anandadi Yoga "${f.expected.anandadiYogaName}"`, () => {
          expect(result.anandadiYoga.name).toBe(f.expected.anandadiYogaName);
        });
      }

      it(`Ganda Mula active === ${f.expected.gandaMulaActive}`, () => {
        expect(result.gandaMula.active).toBe(f.expected.gandaMulaActive);
      });

      // ── STRICT (Sandhya — elastic ghatikas of nighttime, ±2 min vs Drik) ──
      const SANDHYA_TOL_MIN = 2;

      if (f.expected.pratahSandhyaStartHHMM && f.expected.pratahSandhyaEndHHMM) {
        it(`Pratah Sandhya start within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.pratahSandhya.start, f.expected.pratahSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Pratah Sandhya end within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.pratahSandhya.end, f.expected.pratahSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      if (f.expected.sayahnaSandhyaStartHHMM && f.expected.sayahnaSandhyaEndHHMM) {
        it(`Sayahna Sandhya start within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.sayahnaSandhya.start, f.expected.sayahnaSandhyaStartHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
        it(`Sayahna Sandhya end within ±${SANDHYA_TOL_MIN} min of Drik`, () => {
          expect(diffMin(result.sayahnaSandhya.end, f.expected.sayahnaSandhyaEndHHMM!, f.date))
            .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
        });
      }

      // ── STRICT (Varjyam — elastic ghatikas of nakshatra, ±2 min vs Drik) ──
      // Library only emits the sunrise-active nakshatra's Varjyam (single-
      // window contract). On transition days Drik may pick the second
      // nakshatra; in those cases the library returns `null`. The cross-
      // verify accepts that ONLY on multi-nakshatra days — a `null` on a
      // single-nakshatra day where Drik shows a window is a real failure.
      if (f.expected.varjyamStartHHMM && f.expected.varjyamEndHHMM) {
        it(`Varjyam matches Drik (or null only on transition days)`, () => {
          if (result.varjyam) {
            expect(diffMin(result.varjyam.start, f.expected.varjyamStartHHMM!, f.date))
              .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
            expect(diffMin(result.varjyam.end, f.expected.varjyamEndHHMM!, f.date))
              .toBeLessThanOrEqual(SANDHYA_TOL_MIN);
          } else {
            // Drik published a window but library returned null. Permitted
            // only on transition days (multiple nakshatras span the Hindu day).
            expect(result.nakshatras.length).toBeGreaterThan(1);
          }
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
          diffMin(r.pratahSandhya.start, f.expected.pratahSandhyaStartHHMM, f.date),
        );
      }
      if (f.expected.sayahnaSandhyaStartHHMM) {
        sayahnaMaxDiff = Math.max(
          sayahnaMaxDiff,
          diffMin(r.sayahnaSandhya.start, f.expected.sayahnaSandhyaStartHHMM, f.date),
        );
      }
    }
    expect(pratahMaxDiff).toBeLessThanOrEqual(2);
    expect(sayahnaMaxDiff).toBeLessThanOrEqual(2);
  });

  it('Varjyam (when emitted) agrees with Drik within ±2 min on every fixture', () => {
    let maxDiff = 0;
    let emitted = 0;
    for (const f of TYPED) {
      if (!f.expected.varjyamStartHHMM || !f.expected.varjyamEndHHMM) continue;
      const r = getDailyPanchang(noonUtc(f.date), f.location, {
        timezone: f.timezone,
        language: 'en',
      });
      if (r === null || r.varjyam === null) continue;
      emitted++;
      maxDiff = Math.max(
        maxDiff,
        diffMin(r.varjyam.start, f.expected.varjyamStartHHMM, f.date),
        diffMin(r.varjyam.end, f.expected.varjyamEndHHMM, f.date),
      );
    }
    // We expect a meaningful share of fixtures to emit a Varjyam window;
    // Drik publishes one for nearly all 50 dates. Anything below ~30 emitted
    // suggests the single-window contract is dropping more days than the
    // ~2 transition-days-per-month rate predicts.
    expect(emitted).toBeGreaterThanOrEqual(30);
    expect(maxDiff).toBeLessThanOrEqual(2);
  });
});
