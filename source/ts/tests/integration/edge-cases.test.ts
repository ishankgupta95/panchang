import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { computeSunrise } from '../../src/astronomy/sunrise';
import { getSiderealMoonLongitude } from '../../src/astronomy/moon';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { PanchangError } from '../../src/types/errors';

function noonUtc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const NYC  = { latitude: 40.7128, longitude: -74.006 };
const TROMSO = { latitude: 69.65, longitude: 18.96 };

describe('edge cases', () => {
  it('Tromsø in June returns null (midnight sun, Hindu day undefined)', () => {
    const result = getDailyPanchang(noonUtc(2025, 6, 21), TROMSO, { timezone: 120 })!;
    expect(result).toBeNull();
  });

  it('low-level computeSunrise still throws PanchangError NO_SUNRISE for polar callers', () => {
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
    const beforeSunrise = new Date('2025-01-14T00:30:00Z');
    const result = getInstantPanchang(beforeSunrise, PUNE)!;
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

describe('element slivers at the day boundary', () => {
  const LONDON = { latitude: 51.5074, longitude: -0.1278 };
  const SLIVER_DAY = noonUtc(2027, 10, 5);
  const TRUE_TRANSITION_UTC = Date.UTC(2027, 9, 6, 6, 8, 52, 186);

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
    const r = getDailyPanchang(SLIVER_DAY, LONDON, { timezone: 0 })!;
    const error = r.angas.yogas[1]!.endTime!.getTime() - TRUE_TRANSITION_UTC;
    expect(error, `error ${error}ms`).toBeGreaterThanOrEqual(0);
    expect(error, `error ${error}ms`).toBeLessThanOrEqual(25);
  });

  it('the true transition really does precede nextSunrise', () => {
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
