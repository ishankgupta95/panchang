import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { computeSunrise } from '../../src/astronomy/sunrise';
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
    const result = getDailyPanchang(noonUtc(2025, 6, 21), TROMSO, { timezone: 120 });
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
    const result = getDailyPanchang(noonUtc(2025, 7, 4), NYC, { timezone: -240 });
    expect(result.sunrise).toBeInstanceOf(Date);
    expect(result.tithis.length).toBeGreaterThanOrEqual(1);
    expect(result.vara.englishName).toBe('Friday');
  });

  it('getInstantPanchang before sunrise returns previous calendar day vara', () => {
    // Pune sunrise on 2025-01-14 is ~01:39 UTC — use 00:30 UTC (well before sunrise)
    const beforeSunrise = new Date('2025-01-14T00:30:00Z');
    const result = getInstantPanchang(beforeSunrise, PUNE);
    // 2025-01-14 is Tuesday; before-sunrise → vara should be Monday (previous day)
    expect(result.vara.englishName).toBe('Monday');
  });

  it('computeEndTimes: false returns exactly 1 tithi/nakshatra/yoga/karana', () => {
    const result = getDailyPanchang(
      noonUtc(2025, 1, 14),
      PUNE,
      { timezone: 330, computeEndTimes: false },
    );
    expect(result.tithis).toHaveLength(1);
    expect(result.nakshatras).toHaveLength(1);
    expect(result.yogas).toHaveLength(1);
    expect(result.karanas).toHaveLength(1);
  });
});
