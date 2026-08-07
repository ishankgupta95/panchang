import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { computeSunrise } from '../../src/astronomy/sunrise';
import { getSiderealMoonLongitude } from '../../src/astronomy/moon';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { PanchangError } from '../../src/types/errors';

// Use noon UTC so getDate() is unambiguous in any system timezone
function noonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const NYC  = { latitude: 40.7128, longitude: -74.006 };
// Tromsø, Norway — midnight sun in June
const TROMSO = { latitude: 69.65, longitude: 18.96 };

describe('edge cases', () => {
  it('Tromsø in June returns null (midnight sun — Hindu day undefined)', () => {
    const result = getDailyPanchang(noonUtc(2025, 6, 21), TROMSO, { timezone: 120 })!;
    expect(result).toBeNull();
  });

  it('low-level computeSunrise still throws PanchangError NO_SUNRISE for polar callers', () => {
    // Direct callers of the low-level astronomy primitive still get the
    // typed error; only the high-level `getDailyPanchang` surface returns null.
    expect(() => computeSunrise(noonUtc(2025, 6, 21), TROMSO)).toThrow(PanchangError);
    try {
      computeSunrise(noonUtc(2025, 6, 21), TROMSO);
    } catch (e) {
      expect((e as PanchangError).code).toBe('NO_SUNRISE');
    }
  });

  it('Dec 31 / Jan 1 year boundary does not throw', () => {
    expect(() =>
      getDailyPanchang(noonUtc(2025, 12, 31), PUNE, { timezone: 330 }),
    ).not.toThrow();

    expect(() =>
      getDailyPanchang(noonUtc(2026, 1, 1), PUNE, { timezone: 330 }),
    ).not.toThrow();
  });

  it('negative longitude (New York) returns a valid result', () => {
    const result = getDailyPanchang(noonUtc(2025, 7, 4), NYC, { timezone: -240 })!;
    expect(result.sun.rise).toBeInstanceOf(Date);
    expect(result.angas.tithis.length).toBeGreaterThanOrEqual(1);
    expect(result.angas.vara.englishName).toBe('Friday');
  });

  it('getInstantPanchang before sunrise returns previous calendar day vara', () => {
    // Pune sunrise on 2025-01-14 is ~01:39 UTC — use 00:30 UTC (well before sunrise)
    const beforeSunrise = new Date('2025-01-14T00:30:00Z');
    const result = getInstantPanchang(beforeSunrise, PUNE)!;
    // 2025-01-14 is Tuesday; before-sunrise → vara should be Monday (previous day)
    expect(result.angas.vara.englishName).toBe('Monday');
  });

  it('computeEndTimes: false returns exactly 1 tithi/nakshatra/yoga/karana', () => {
    const result = getDailyPanchang(
      noonUtc(2025, 1, 14),
      PUNE,
      { timezone: 330, computeEndTimes: false },
    )!;
    expect(result.angas.tithis).toHaveLength(1);
    expect(result.angas.nakshatras).toHaveLength(1);
    expect(result.angas.yogas).toHaveLength(1);
    expect(result.angas.karanas).toHaveLength(1);
  });
});

/**
 * Sub-tolerance element slivers at the day boundary.
 *
 * On the Hindu day beginning 2027-10-05 at London, the Saubhagya→Shobhana yoga
 * transition falls at 06:08:46.935 UTC — **5.85 seconds before** that day's
 * `nextSunrise` (06:08:52.784 UTC), verified below by bisecting exact
 * longitudes. The day therefore genuinely contains three yogas, the last
 * lasting under six seconds.
 *
 * A sliver this short used to be a coin flip. `findTransitionTime` bisected
 * until the bracket fell under a tolerance and returned the upper bound, so the
 * answer landed uniformly in [true, true + 15.8 s] — and whether a 5.85 s
 * element survived depended on where in that band it fell. It did not survive.
 *
 * The search now solves for the boundary by secant iteration on the continuous
 * angle and converges to the root, landing within 25 ms. That is what this
 * pins: sub-tolerance elements at a day boundary are decided by astronomy
 * rather than by search tolerance.
 *
 * (The example itself has been re-derived twice — an earlier NYC 2026-02-27
 * case stopped being a sliver when the Lahiri ayanamsa was corrected to match
 * DrikPanchang, since yoga carries the ayanamsa twice and that transition moved
 * ~122 s. The scenario is astronomical, not structural: when the sidereal frame
 * moves, the example has to move with it.)
 */
describe('element slivers at the day boundary', () => {
  const LONDON = { latitude: 51.5074, longitude: -0.1278 };
  const SLIVER_DAY = noonUtc(2027, 10, 5);
  /**
   * Re-pinned in Phase 36.2, when the Sun and Moon series became this
   * library's own. Predicted before it was observed, per tests/TIERS.md:
   *
   *   yoga carries Moon + Sun at 0.590°/hr, so δ″ ⇒ δ × 1.69 s.
   *   The two implementations differ by ~1.2″ (Moon) and ~0.6″ (Sun) typically,
   *   which is ~2–3 s, worst ~11 s.
   *
   *   predicted: a shift of a few seconds, either direction
   *   observed:  −1.416 s (06:08:46.935 → 06:08:45.519), i.e. 0.84″ combined
   *
   * Re-pinned again at the end of Phase 36, when the truncation budgets were
   * raised to 0.4″ for both bodies. Predicted from the same coefficient:
   * the *change* in each longitude is bounded by old truncation plus new, so
   * (0.6 + 0.5)″ × 1.69 = 1.9 s worst. A before/after `notes/diff.mjs` over
   * 241 MB of output put the whole yoga family at 569 ms max before this test
   * was looked at.
   *
   *   predicted: ≤1.9 s, either direction
   *   observed:  +0.378 s (06:08:45.519 → 06:08:45.897)
   *
   * Re-pinned a third time when `PROBE_COUNT` in the generator went from 600 to
   * 100,000, so the truncation budgets are met over the sample size that
   * verifies them rather than over one 170× smaller. The series grew and the
   * longitudes moved toward the untruncated theory. Predicted from the same
   * coefficient — the change in each longitude is bounded by the old truncation
   * residual, so (0.9 + 0.9)″ × 1.69 = 3.0 s worst — and the whole yoga family
   * came in at 442 ms max across 241 MB of before/after output:
   *
   *   predicted: ≤3.0 s, either direction
   *   observed:  −0.196 s (06:08:45.897 → 06:08:45.701)
   *
   * The value is not a fixture in the usual sense — the third test below
   * re-derives it by bisecting exact longitudes, independently of the
   * library's own search. What it pins is agreement between the search and
   * that bisection, and that agreement is unchanged.
   */
  const TRUE_TRANSITION_UTC = Date.UTC(2027, 9, 6, 6, 8, 45, 701);

  it('resolves the ~6s third yoga', () => {
    const r = getDailyPanchang(SLIVER_DAY, LONDON, { timezone: 0 });
    expect(r).not.toBeNull();
    expect(r!.angas.yogas).toHaveLength(3);

    const sliver = r!.angas.yogas[2]!;
    expect(sliver.name).toBe('Shobhana');
    expect(sliver.endTime!.getTime()).toBe(r!.sun.nextRise.getTime());
    const spanMs = sliver.endTime!.getTime() - sliver.startTime!.getTime();
    expect(spanMs).toBeGreaterThan(0);
    expect(spanMs).toBeLessThan(60_000);
  });

  it('lands within 25ms of the true transition', () => {
    // The secant solve converges to the root. The residual is the bounded
    // forward walk that restores the never-early guarantee — one 25 ms step.
    const r = getDailyPanchang(SLIVER_DAY, LONDON, { timezone: 0 })!;
    const error = r.angas.yogas[1]!.endTime!.getTime() - TRUE_TRANSITION_UTC;
    expect(error, `error ${error}ms`).toBeGreaterThanOrEqual(0);
    expect(error, `error ${error}ms`).toBeLessThanOrEqual(25);
  });

  it('the true transition really does precede nextSunrise', () => {
    // Independent of the library's search: bisect exact longitudes.
    const SPAN = 360 / 27;
    const yogaIdxAt = (t: number): number => {
      const d = new Date(t);
      const sum = getSiderealMoonLongitude(d, 'lahiri') + getSiderealSunLongitude(d, 'lahiri');
      return Math.floor((((sum % 360) + 360) % 360) / SPAN);
    };
    let lo = Date.UTC(2027, 9, 6, 5, 30, 0);
    let hi = Date.UTC(2027, 9, 6, 6, 30, 0);
    const startIdx = yogaIdxAt(lo);
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (yogaIdxAt(mid) === startIdx) lo = mid; else hi = mid;
    }
    expect(hi).toBe(TRUE_TRANSITION_UTC);
    const r = getDailyPanchang(SLIVER_DAY, LONDON, { timezone: 0 })!;
    expect(hi).toBeLessThan(r.sun.nextRise.getTime());
    expect(r.sun.nextRise.getTime() - hi).toBeLessThan(30_000);
  });
});
