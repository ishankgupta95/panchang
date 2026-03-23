import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import fixtures from '../fixtures/drikpanchang-india.json';

// Use noon UTC so getDate() returns the intended calendar day in any system timezone
function dateAtNoonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

describe('getDailyPanchang — fixture regression', () => {
  for (const fixture of fixtures) {
    const { date, city, location, timezone, expected } = fixture;

    describe(`${date} / ${city}`, () => {
      // Compute once per fixture group
      const result = getDailyPanchang(
        dateAtNoonUtc(date),
        location,
        { timezone },
      );

      it('sunrise is a valid Date', () => {
        expect(result.sunrise).toBeInstanceOf(Date);
        expect(isNaN(result.sunrise.getTime())).toBe(false);
      });

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(result.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
      });

      it(`nakshatras.length >= ${expected.nakshatraCountAtLeast}`, () => {
        expect(result.nakshatras.length).toBeGreaterThanOrEqual(expected.nakshatraCountAtLeast);
      });

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(result.vara.englishName).toBe(expected.varaEnglish);
      });

      it('rahuKalam.start < rahuKalam.end', () => {
        expect(result.rahuKalam.start.getTime()).toBeLessThan(result.rahuKalam.end.getTime());
      });

      it('abhijitMuhurta.start < abhijitMuhurta.end', () => {
        expect(result.abhijitMuhurta.start.getTime()).toBeLessThan(result.abhijitMuhurta.end.getTime());
      });

      it('dayDurationMinutes is in (0, 1440)', () => {
        expect(result.dayDurationMinutes).toBeGreaterThan(0);
        expect(result.dayDurationMinutes).toBeLessThan(24 * 60);
      });
    });
  }
});
