/**
 * @tier 1  the reference almanac: published to the minute, own rule interpretations
 *
 * ±3 min covers altitude-model differences, ±5 min the almanac's own rounding.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { readTestData } from '../testdata';

const fixtures = readTestData('almanac', 'almanac-verified.json');
const festivalFixtures = readTestData('almanac', 'almanac-festivals.json');

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function fmtHHMM(local: string): string {
  return local.slice(11, 16);
}

function diffMinutes(a: string, b: string): number {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  return Math.abs(toMin(a) - toMin(b));
}

function parseEndMinutes(s: string): number {
  const [hm, dayOffset] = s.split('+') as [string, string | undefined];
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m + (dayOffset ? Number(dayOffset) * 1440 : 0);
}

function endMinutesFromDate(endLocal: string, dateStr: string): number {
  const dayDelta = Math.round(
    (Date.parse(`${endLocal.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dateStr}T00:00:00Z`))
    / 86_400_000,
  );
  const [h, m, sec] = endLocal.slice(11, 19).split(':').map(Number) as [number, number, number];
  return dayDelta * 1440 + h * 60 + m + sec / 60;
}

type VerifiedFixture = {
  _source: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    varaEnglish: string;
    vara: string;
    tithiAtSunrise: string;
    nakshatraAtSunrise: string;
    yogaAtSunrise: string;
    karanaAtSunrise: string;
    paksha: string;
    sunriseHHMM: string;
    sunsetHHMM: string;
    chandraRashi: string;
    chandramasaName: string;
    rahuKalamStartHHMM: string | null;
    rahuKalamEndHHMM: string | null;
    yamagandaStartHHMM: string | null;
    yamagandaEndHHMM: string | null;
    abhijitMuhurtaStartHHMM: string | null;
    abhijitMuhurtaEndHHMM: string | null;
    festivals: string[];
    tithiEndHHMM?: string;
    nakshatraEndHHMM?: string;
    yogaEndHHMM?: string;
    karanaEndHHMM?: string;
  };
};

describe('Reference-almanac cross-verification', () => {
  for (const fixture of fixtures as VerifiedFixture[]) {
    const { date, city, location, timezone, expected } = fixture;

    describe(`${date} / ${city}`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone })!;

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(r.angas.vara.englishName).toBe(expected.varaEnglish);
      });

      it(`vara.name === "${expected.vara}"`, () => {
        expect(r.angas.vara.name).toBe(expected.vara);
      });

      it(`sunrise within ±3 min of ${expected.sunriseHHMM}`, () => {
        expect(diffMinutes(fmtHHMM(r.sun.riseLocal), expected.sunriseHHMM)).toBeLessThanOrEqual(3);
      });

      it(`sunset within ±3 min of ${expected.sunsetHHMM}`, () => {
        expect(diffMinutes(fmtHHMM(r.sun.setLocal), expected.sunsetHHMM)).toBeLessThanOrEqual(3);
      });

      it(`tithi at sunrise === "${expected.tithiAtSunrise}"`, () => {
        expect(r.angas.tithis[0]!.name).toBe(expected.tithiAtSunrise);
      });

      it(`nakshatra at sunrise === "${expected.nakshatraAtSunrise}"`, () => {
        expect(r.angas.nakshatras[0]!.name).toBe(expected.nakshatraAtSunrise);
      });

      it(`yoga at sunrise === "${expected.yogaAtSunrise}"`, () => {
        expect(r.angas.yogas[0]!.name).toBe(expected.yogaAtSunrise);
      });

      it(`karana at sunrise === "${expected.karanaAtSunrise}"`, () => {
        expect(r.angas.karanas[0]!.name).toBe(expected.karanaAtSunrise);
      });

      it(`paksha === "${expected.paksha}"`, () => {
        expect(r.angas.tithis[0]!.paksha).toBe(expected.paksha);
      });

      it(`chandraRashi === "${expected.chandraRashi}"`, () => {
        expect(r.moon.rashi.name).toBe(expected.chandraRashi);
      });

      it(`chandramasa === "${expected.chandramasaName}"`, () => {
        expect(r.calendar.chandramasa.name).toBe(expected.chandramasaName);
      });

      if (expected.rahuKalamStartHHMM) {
        it(`rahuKalam start within ±5 min of ${expected.rahuKalamStartHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.inauspicious.rahuKalam.startLocal), expected.rahuKalamStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`rahuKalam end within ±5 min of ${expected.rahuKalamEndHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.inauspicious.rahuKalam.endLocal), expected.rahuKalamEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      if (expected.yamagandaStartHHMM) {
        it(`yamaganda start within ±5 min of ${expected.yamagandaStartHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.inauspicious.yamaganda.startLocal), expected.yamagandaStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`yamaganda end within ±5 min of ${expected.yamagandaEndHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.inauspicious.yamaganda.endLocal), expected.yamagandaEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      if (expected.abhijitMuhurtaStartHHMM === null) {
        it('abhijitMuhurta is null (Wednesday, almanac convention)', () => {
          expect(r.muhurtas.abhijit).toBeNull();
        });
      } else if (expected.abhijitMuhurtaStartHHMM) {
        it(`abhijitMuhurta start within ±5 min of ${expected.abhijitMuhurtaStartHHMM}`, () => {
          expect(r.muhurtas.abhijit).not.toBeNull();
          expect(
            diffMinutes(fmtHHMM(r.muhurtas.abhijit!.startLocal), expected.abhijitMuhurtaStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`abhijitMuhurta end within ±5 min of ${expected.abhijitMuhurtaEndHHMM}`, () => {
          expect(r.muhurtas.abhijit).not.toBeNull();
          expect(
            diffMinutes(fmtHHMM(r.muhurtas.abhijit!.endLocal), expected.abhijitMuhurtaEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      if (expected.tithiEndHHMM) {
        it(`tithi[0] endTime within ±3 min of ${expected.tithiEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.angas.tithis[0]!.endTimeLocal!, date);
          const almanac = parseEndMinutes(expected.tithiEndHHMM!);
          expect(Math.abs(actual - almanac)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.nakshatraEndHHMM) {
        it(`nakshatras[0] endTime within ±3 min of ${expected.nakshatraEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.angas.nakshatras[0]!.endTimeLocal!, date);
          const almanac = parseEndMinutes(expected.nakshatraEndHHMM!);
          expect(Math.abs(actual - almanac)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.yogaEndHHMM) {
        it(`yogas[0] endTime within ±3 min of ${expected.yogaEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.angas.yogas[0]!.endTimeLocal!, date);
          const almanac = parseEndMinutes(expected.yogaEndHHMM!);
          expect(Math.abs(actual - almanac)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.karanaEndHHMM) {
        it(`karanas[0] endTime within ±3 min of ${expected.karanaEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.angas.karanas[0]!.endTimeLocal!, date);
          const almanac = parseEndMinutes(expected.karanaEndHHMM!);
          expect(Math.abs(actual - almanac)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.festivals.length > 0) {
        it(`festivals include ${expected.festivals.join(', ')}`, () => {
          const actualNames = r.festivals.map((f: { name: string }) => f.name);
          for (const name of expected.festivals) {
            expect(actualNames).toContain(name);
          }
        });
      }

      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sun.rise.getTime()).toBeLessThan(r.sun.set.getTime());
        expect(r.sun.set.getTime()).toBeLessThan(r.sun.nextRise.getTime());
      });

      it('has at least 1 tithi, nakshatra, yoga, karana', () => {
        expect(r.angas.tithis.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.nakshatras.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.yogas.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.karanas.length).toBeGreaterThanOrEqual(1);
      });

      it('ayanamsa is in [24.0, 24.3] for 2025-2026', () => {
        expect(r.ayanamsa).toBeGreaterThanOrEqual(24.0);
        expect(r.ayanamsa).toBeLessThanOrEqual(24.3);
      });
    });
  }
});

type FestivalFixture = {
  _source: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expectedFestival: string;
};

describe('Reference-almanac festival cross-verification', () => {
  for (const fixture of festivalFixtures as FestivalFixture[]) {
    const { date, city, location, timezone, expectedFestival } = fixture;
    it(`${date} / ${city} emits festival "${expectedFestival}"`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone })!;
      const names = r.festivals.map((f: { name: string }) => f.name);
      expect(names).toContain(expectedFestival);
    });
  }
});
