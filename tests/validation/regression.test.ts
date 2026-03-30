/**
 * Phase 16 — Validation Hardening
 *
 * Three suites:
 *   1. 242-day structural suite (Pune, Sep 2025 – Apr 2026)
 *      Verifies: no crash, valid shapes, correct vara, time-ordering invariants,
 *      element-count range, Phase-15 fields (Gowri Panchangam).
 *
 *   2. Precise-value suite (~20 entries)
 *      Verifies: exact tithi name, nakshatra name, sunrise/sunset HH:MM (±2 min),
 *      Chandra Masa name across 5 Indian cities + New York.
 *
 *   3. Long-range regression (2030, 2035, 2040, 2045, 2050)
 *      Verifies: no crash, valid shapes, vara correct, ayanamsa in plausible range.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import structuralFixtures from '../fixtures/pune-200days.json';
import preciseFixtures from '../fixtures/drikpanchang-precise.json';

// ── helpers ──────────────────────────────────────────────────────────────────

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Format a display Date as HH:MM (reading via getUTC* per library convention). */
function fmtHHMM(d: Date): string {
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

/** Return |a - b| in minutes, where a and b are HH:MM strings. */
function diffMinutes(a: string, b: string): number {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  return Math.abs(toMin(a) - toMin(b));
}

// ── 1. 242-day structural suite ───────────────────────────────────────────────

describe('242-day structural regression (Pune, Sep 2025 – Apr 2026)', () => {
  for (const fixture of structuralFixtures) {
    const { date, location, timezone, expected } = fixture;

    describe(`${date}`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone });

      it('does not throw', () => {
        expect(r).toBeDefined();
      });

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(r.vara.englishName).toBe(expected.varaEnglish);
      });

      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
        expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
      });

      it('dayDurationMinutes is in (0, 960)', () => {
        expect(r.dayDurationMinutes).toBeGreaterThan(0);
        expect(r.dayDurationMinutes).toBeLessThan(960); // < 16 h near equator
      });

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(r.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
        expect(r.tithis.length).toBeLessThanOrEqual(3);
      });

      it(`nakshatras.length >= ${expected.nakshatraCountAtLeast}`, () => {
        expect(r.nakshatras.length).toBeGreaterThanOrEqual(expected.nakshatraCountAtLeast);
        expect(r.nakshatras.length).toBeLessThanOrEqual(3);
      });

      it('rahuKalam, gulikaKalam, yamaganda are ordered', () => {
        expect(r.rahuKalam.start.getTime()).toBeLessThan(r.rahuKalam.end.getTime());
        expect(r.gulikaKalam.start.getTime()).toBeLessThan(r.gulikaKalam.end.getTime());
        expect(r.yamaganda.start.getTime()).toBeLessThan(r.yamaganda.end.getTime());
      });

      it('abhijitMuhurta is within daytime', () => {
        expect(r.abhijitMuhurta.start.getTime()).toBeGreaterThan(r.sunrise.getTime());
        expect(r.abhijitMuhurta.end.getTime()).toBeLessThan(r.sunset.getTime());
      });

      it('choghadiya has 8 day + 8 night slots covering sunrise→nextSunrise', () => {
        expect(r.choghadiya.day).toHaveLength(8);
        expect(r.choghadiya.night).toHaveLength(8);
        expect(r.choghadiya.day[0]!.start.getTime()).toBe(r.sunrise.getTime());
        expect(r.choghadiya.day[7]!.end.getTime()).toBe(r.sunset.getTime());
        expect(r.choghadiya.night[0]!.start.getTime()).toBe(r.sunset.getTime());
        expect(r.choghadiya.night[7]!.end.getTime()).toBe(r.nextSunrise.getTime());
      });

      it('gowriPanchangam has 8 day + 8 night slots covering sunrise→nextSunrise', () => {
        expect(r.gowriPanchangam.day).toHaveLength(8);
        expect(r.gowriPanchangam.night).toHaveLength(8);
        expect(r.gowriPanchangam.day[0]!.start.getTime()).toBe(r.sunrise.getTime());
        expect(r.gowriPanchangam.day[7]!.end.getTime()).toBe(r.sunset.getTime());
        expect(r.gowriPanchangam.night[0]!.start.getTime()).toBe(r.sunset.getTime());
        expect(r.gowriPanchangam.night[7]!.end.getTime()).toBe(r.nextSunrise.getTime());
      });

      it('hora has 12 day + 12 night slots', () => {
        expect(r.hora.day).toHaveLength(12);
        expect(r.hora.night).toHaveLength(12);
      });

      it('ayanamsa is in [23.5, 25.5] for 2025–2026', () => {
        expect(r.ayanamsa).toBeGreaterThan(23.5);
        expect(r.ayanamsa).toBeLessThan(25.5);
      });

      it('durMuhurta has 2 ordered periods', () => {
        const [dm1, dm2] = r.durMuhurta;
        expect(dm1!.start.getTime()).toBeLessThan(dm1!.end.getTime());
        expect(dm2!.start.getTime()).toBeLessThan(dm2!.end.getTime());
      });
    });
  }
});

// ── 2. Precise-value suite ────────────────────────────────────────────────────

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
      const r = getDailyPanchang(noonUtc(date), location, { timezone });

      it(`vara === "${expected.varaEnglish}"`, () => {
        expect(r.vara.englishName).toBe(expected.varaEnglish);
      });

      if (expected.tithiAtSunrise) {
        const want = expected.tithiAtSunrise;
        it(`tithiAtSunrise === "${want}"`, () => {
          expect(r.tithis[0]!.name).toBe(want);
        });
      }

      if (expected.nakshatraAtSunrise) {
        const want = expected.nakshatraAtSunrise;
        it(`nakshatraAtSunrise === "${want}"`, () => {
          expect(r.nakshatras[0]!.name).toBe(want);
        });
      }

      if (expected.sunriseHHMM) {
        const want = expected.sunriseHHMM;
        it(`sunrise HH:MM within ±2 min of "${want}"`, () => {
          expect(diffMinutes(fmtHHMM(r.sunrise), want)).toBeLessThanOrEqual(2);
        });
      }

      if (expected.sunsetHHMM) {
        const want = expected.sunsetHHMM;
        it(`sunset HH:MM within ±2 min of "${want}"`, () => {
          expect(diffMinutes(fmtHHMM(r.sunset), want)).toBeLessThanOrEqual(2);
        });
      }

      if (expected.chandramasaName) {
        const want = expected.chandramasaName;
        it(`chandramasa === "${want}"`, () => {
          expect(r.chandramasa.name).toBe(want);
        });
      }

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(r.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
      });
    });
  }
});

// ── 3. Long-range regression (2030, 2035, 2040, 2045, 2050) ──────────────────

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

describe('long-range regression (2030–2050)', () => {
  for (const { date, varaEnglish, ayanamsaMin, ayanamsaMax } of LONG_RANGE_CASES) {
    describe(`${date}`, () => {
      const r = getDailyPanchang(noonUtc(date), PUNE, { timezone: 330 });

      it('does not throw', () => {
        expect(r).toBeDefined();
      });

      it(`vara === "${varaEnglish}"`, () => {
        expect(r.vara.englishName).toBe(varaEnglish);
      });

      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
        expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
      });

      it('all Pancha Anga elements present', () => {
        expect(r.tithis.length).toBeGreaterThanOrEqual(1);
        expect(r.nakshatras.length).toBeGreaterThanOrEqual(1);
        expect(r.yogas.length).toBeGreaterThanOrEqual(1);
        expect(r.karanas.length).toBeGreaterThanOrEqual(1);
      });

      it(`ayanamsa in [${ayanamsaMin}, ${ayanamsaMax}]`, () => {
        expect(r.ayanamsa).toBeGreaterThanOrEqual(ayanamsaMin);
        expect(r.ayanamsa).toBeLessThanOrEqual(ayanamsaMax);
      });

      it('choghadiya and gowriPanchangam have 8+8 slots', () => {
        expect(r.choghadiya.day).toHaveLength(8);
        expect(r.choghadiya.night).toHaveLength(8);
        expect(r.gowriPanchangam.day).toHaveLength(8);
        expect(r.gowriPanchangam.night).toHaveLength(8);
      });
    });
  }
});
