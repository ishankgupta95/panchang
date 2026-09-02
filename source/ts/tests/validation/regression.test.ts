/**
 * @tier 2  our own output, a structural regression detector with no outside authority.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { readTestData } from '../testdata';

const structuralFixtures = readTestData('structural', 'pune-200days.json');
const preciseFixtures = readTestData('almanac', 'almanac-precise.json');

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

describe('242-day structural regression (Pune, Sep 2025 to Apr 2026)', () => {
  for (const fixture of structuralFixtures) {
    const { date, location, timezone, expected } = fixture;

    describe(`${date}`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone })!;

      it('does not throw', () => {
        expect(r).toBeDefined();
      });

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(r.angas.vara.englishName).toBe(expected.varaEnglish);
      });

      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sun.rise.getTime()).toBeLessThan(r.sun.set.getTime());
        expect(r.sun.set.getTime()).toBeLessThan(r.sun.nextRise.getTime());
      });

      it('dayDurationMinutes is in (0, 960)', () => {
        expect(r.sun.dayDurationMinutes).toBeGreaterThan(0);
        expect(r.sun.dayDurationMinutes).toBeLessThan(960); // < 16 h near equator
      });

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(r.angas.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
        expect(r.angas.tithis.length).toBeLessThanOrEqual(3);
      });

      it(`nakshatras.length >= ${expected.nakshatraCountAtLeast}`, () => {
        expect(r.angas.nakshatras.length).toBeGreaterThanOrEqual(expected.nakshatraCountAtLeast);
        expect(r.angas.nakshatras.length).toBeLessThanOrEqual(3);
      });

      it('rahuKalam, gulikaKalam, yamaganda are ordered', () => {
        expect(r.inauspicious.rahuKalam.start.getTime()).toBeLessThan(r.inauspicious.rahuKalam.end.getTime());
        expect(r.inauspicious.gulikaKalam.start.getTime()).toBeLessThan(r.inauspicious.gulikaKalam.end.getTime());
        expect(r.inauspicious.yamaganda.start.getTime()).toBeLessThan(r.inauspicious.yamaganda.end.getTime());
      });

      it('abhijitMuhurta is null on Wednesday, within daytime otherwise', () => {
        if (expected.varaEnglish === 'Wednesday') {
          expect(r.muhurtas.abhijit).toBeNull();
        } else {
          expect(r.muhurtas.abhijit).not.toBeNull();
          expect(r.muhurtas.abhijit!.start.getTime()).toBeGreaterThan(r.sun.rise.getTime());
          expect(r.muhurtas.abhijit!.end.getTime()).toBeLessThan(r.sun.set.getTime());
        }
      });

      it('choghadiya has 8 day + 8 night slots covering sunrise→nextSunrise', () => {
        expect(r.periods.choghadiya.day).toHaveLength(8);
        expect(r.periods.choghadiya.night).toHaveLength(8);
        expect(r.periods.choghadiya.day[0]!.start.getTime()).toBe(r.sun.rise.getTime());
        expect(r.periods.choghadiya.day[7]!.end.getTime()).toBe(r.sun.set.getTime());
        expect(r.periods.choghadiya.night[0]!.start.getTime()).toBe(r.sun.set.getTime());
        expect(r.periods.choghadiya.night[7]!.end.getTime()).toBe(r.sun.nextRise.getTime());
      });

      it('gowriPanchangam has 8 day + 8 night slots covering sunrise→nextSunrise', () => {
        expect(r.periods.gowri.day).toHaveLength(8);
        expect(r.periods.gowri.night).toHaveLength(8);
        expect(r.periods.gowri.day[0]!.start.getTime()).toBe(r.sun.rise.getTime());
        expect(r.periods.gowri.day[7]!.end.getTime()).toBe(r.sun.set.getTime());
        expect(r.periods.gowri.night[0]!.start.getTime()).toBe(r.sun.set.getTime());
        expect(r.periods.gowri.night[7]!.end.getTime()).toBe(r.sun.nextRise.getTime());
      });

      it('hora has 12 day + 12 night slots', () => {
        expect(r.periods.hora.day).toHaveLength(12);
        expect(r.periods.hora.night).toHaveLength(12);
      });

      it('ayanamsa is in [23.5, 25.5] for 2025-2026', () => {
        expect(r.ayanamsa).toBeGreaterThan(23.5);
        expect(r.ayanamsa).toBeLessThan(25.5);
      });

      it('durMuhurta has 1-2 ordered periods (1 on Sun/Wed)', () => {
        const dms = r.inauspicious.durMuhurta;
        expect(dms.length).toBe([0, 3].includes(r.angas.vara.index) ? 1 : 2);
        for (const dm of dms) {
          expect(dm.start.getTime()).toBeLessThan(dm.end.getTime());
        }
      });
    });
  }
});

type PreciseExpected = {
  varaEnglish: string;
  tithiAtSunrise?: string;
  nakshatraAtSunrise?: string;
  sunriseHHMM?: string;
  sunsetHHMM?: string;
  chandramasaName?: string;
  tithiCountAtLeast: number;
  nakshatraCountAtLeast: number;
};

type PreciseFixture = {
  _note?: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: PreciseExpected;
};

describe('precise-value regression (library-baseline)', () => {
  for (const fixture of preciseFixtures as PreciseFixture[]) {
    const { date, city, location, timezone, expected } = fixture;

    describe(`${date} / ${city}`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone })!;

      it(`vara === "${expected.varaEnglish}"`, () => {
        expect(r.angas.vara.englishName).toBe(expected.varaEnglish);
      });

      if (expected.tithiAtSunrise) {
        const want = expected.tithiAtSunrise;
        it(`tithiAtSunrise === "${want}"`, () => {
          expect(r.angas.tithis[0]!.name).toBe(want);
        });
      }

      if (expected.nakshatraAtSunrise) {
        const want = expected.nakshatraAtSunrise;
        it(`nakshatraAtSunrise === "${want}"`, () => {
          expect(r.angas.nakshatras[0]!.name).toBe(want);
        });
      }

      if (expected.sunriseHHMM) {
        const want = expected.sunriseHHMM;
        it(`sunrise HH:MM within ±2 min of "${want}"`, () => {
          expect(diffMinutes(fmtHHMM(r.sun.riseLocal), want)).toBeLessThanOrEqual(2);
        });
      }

      if (expected.sunsetHHMM) {
        const want = expected.sunsetHHMM;
        it(`sunset HH:MM within ±2 min of "${want}"`, () => {
          expect(diffMinutes(fmtHHMM(r.sun.setLocal), want)).toBeLessThanOrEqual(2);
        });
      }

      if (expected.chandramasaName) {
        const want = expected.chandramasaName;
        it(`chandramasa === "${want}"`, () => {
          expect(r.calendar.chandramasa.name).toBe(want);
        });
      }

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(r.angas.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
      });
    });
  }
});

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

const LONG_RANGE_CASES: Array<{ date: string; varaEnglish: string; ayanamsaMin: number; ayanamsaMax: number }> = [
  { date: '2030-01-14', varaEnglish: 'Monday',    ayanamsaMin: 24.0, ayanamsaMax: 26.0 },
  { date: '2030-07-04', varaEnglish: 'Thursday',  ayanamsaMin: 24.0, ayanamsaMax: 26.0 },
  { date: '2035-03-21', varaEnglish: 'Wednesday', ayanamsaMin: 24.0, ayanamsaMax: 26.0 },
  { date: '2035-10-15', varaEnglish: 'Monday',    ayanamsaMin: 24.0, ayanamsaMax: 26.0 },
  { date: '2040-01-01', varaEnglish: 'Sunday',    ayanamsaMin: 24.0, ayanamsaMax: 26.5 },
  { date: '2040-06-21', varaEnglish: 'Thursday',  ayanamsaMin: 24.0, ayanamsaMax: 26.5 },
  { date: '2045-04-14', varaEnglish: 'Friday',    ayanamsaMin: 24.0, ayanamsaMax: 27.0 },
  { date: '2045-12-25', varaEnglish: 'Monday',    ayanamsaMin: 24.0, ayanamsaMax: 27.0 },
  { date: '2050-01-14', varaEnglish: 'Friday',    ayanamsaMin: 24.0, ayanamsaMax: 27.0 },
  { date: '2050-10-02', varaEnglish: 'Sunday',    ayanamsaMin: 24.0, ayanamsaMax: 27.0 },
];

describe('long-range regression (2030-2050)', () => {
  for (const { date, varaEnglish, ayanamsaMin, ayanamsaMax } of LONG_RANGE_CASES) {
    describe(`${date}`, () => {
      const r = getDailyPanchang(noonUtc(date), PUNE, { timezone: 330 })!;

      it('does not throw', () => {
        expect(r).toBeDefined();
      });

      it(`vara === "${varaEnglish}"`, () => {
        expect(r.angas.vara.englishName).toBe(varaEnglish);
      });

      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sun.rise.getTime()).toBeLessThan(r.sun.set.getTime());
        expect(r.sun.set.getTime()).toBeLessThan(r.sun.nextRise.getTime());
      });

      it('all Pancha Anga elements present', () => {
        expect(r.angas.tithis.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.nakshatras.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.yogas.length).toBeGreaterThanOrEqual(1);
        expect(r.angas.karanas.length).toBeGreaterThanOrEqual(1);
      });

      it(`ayanamsa in [${ayanamsaMin}, ${ayanamsaMax}]`, () => {
        expect(r.ayanamsa).toBeGreaterThanOrEqual(ayanamsaMin);
        expect(r.ayanamsa).toBeLessThanOrEqual(ayanamsaMax);
      });

      it('choghadiya and gowriPanchangam have 8+8 slots', () => {
        expect(r.periods.choghadiya.day).toHaveLength(8);
        expect(r.periods.choghadiya.night).toHaveLength(8);
        expect(r.periods.gowri.day).toHaveLength(8);
        expect(r.periods.gowri.night).toHaveLength(8);
      });
    });
  }
});
