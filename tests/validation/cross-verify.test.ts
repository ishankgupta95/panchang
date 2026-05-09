/**
 * Cross-verification test suite against DrikPanchang.com
 *
 * Verifies every panchang element against data manually extracted from
 * DrikPanchang.com — the most authoritative online Hindu panchang.
 *
 * Tolerances:
 *   - Sunrise/Sunset: ±3 min (accounts for altitude model differences)
 *   - Rahu Kalam / Gulika / Yamaganda: ±5 min (1/8 division rounding)
 *   - Abhijit Muhurta: ±5 min
 *   - Tithi/Nakshatra/Yoga/Karana names: exact match
 *   - Chandra Rashi / Chandra Masa: exact match
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import fixtures from '../fixtures/drikpanchang-verified.json';
import festivalFixtures from '../fixtures/drikpanchang-festivals.json';

// ── Helpers ──────────────────────────────────────────────────────────────────

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

/** Format a display Date as HH:MM (via getUTC* per library convention). */
function fmtHHMM(d: Date): string {
  return (
    String(d.getUTCHours()).padStart(2, '0') +
    ':' +
    String(d.getUTCMinutes()).padStart(2, '0')
  );
}

/** Return |a - b| in minutes, where a and b are HH:MM strings. */
function diffMinutes(a: string, b: string): number {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  return Math.abs(toMin(a) - toMin(b));
}

/**
 * Parse an end-time string like "03:21+1" or "23:49" into minutes since
 * 00:00 of the fixture's reference date. The "+N" suffix means N days later.
 */
function parseEndMinutes(s: string): number {
  const [hm, dayOffset] = s.split('+') as [string, string | undefined];
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m + (dayOffset ? Number(dayOffset) * 1440 : 0);
}

/**
 * Convert a library endTime Date (stored with local clock in UTC fields) to
 * minutes since 00:00 of the fixture's reference date.
 */
function endMinutesFromDate(endTime: Date, dateStr: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number) as [number, number, number];
  const midnight = Date.UTC(y, mo - 1, d, 0, 0, 0);
  return (endTime.getTime() - midnight) / 60000;
}

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DrikPanchang cross-verification', () => {
  for (const fixture of fixtures as VerifiedFixture[]) {
    const { date, city, location, timezone, expected } = fixture;

    describe(`${date} / ${city}`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone });

      // ── Vara (weekday) ──
      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(r.vara.englishName).toBe(expected.varaEnglish);
      });

      it(`vara.name === "${expected.vara}"`, () => {
        expect(r.vara.name).toBe(expected.vara);
      });

      // ── Sunrise / Sunset ──
      it(`sunrise within ±3 min of ${expected.sunriseHHMM}`, () => {
        expect(diffMinutes(fmtHHMM(r.sunrise), expected.sunriseHHMM)).toBeLessThanOrEqual(3);
      });

      it(`sunset within ±3 min of ${expected.sunsetHHMM}`, () => {
        expect(diffMinutes(fmtHHMM(r.sunset), expected.sunsetHHMM)).toBeLessThanOrEqual(3);
      });

      // ── Pancha Anga at sunrise ──
      it(`tithi at sunrise === "${expected.tithiAtSunrise}"`, () => {
        expect(r.tithis[0]!.name).toBe(expected.tithiAtSunrise);
      });

      it(`nakshatra at sunrise === "${expected.nakshatraAtSunrise}"`, () => {
        expect(r.nakshatras[0]!.name).toBe(expected.nakshatraAtSunrise);
      });

      it(`yoga at sunrise === "${expected.yogaAtSunrise}"`, () => {
        expect(r.yogas[0]!.name).toBe(expected.yogaAtSunrise);
      });

      it(`karana at sunrise === "${expected.karanaAtSunrise}"`, () => {
        expect(r.karanas[0]!.name).toBe(expected.karanaAtSunrise);
      });

      // ── Paksha ──
      it(`paksha === "${expected.paksha}"`, () => {
        expect(r.tithis[0]!.paksha).toBe(expected.paksha);
      });

      // ── Chandra Rashi ──
      it(`chandraRashi === "${expected.chandraRashi}"`, () => {
        expect(r.chandraRashi.name).toBe(expected.chandraRashi);
      });

      // ── Chandra Masa ──
      it(`chandramasa === "${expected.chandramasaName}"`, () => {
        expect(r.chandramasa.name).toBe(expected.chandramasaName);
      });

      // ── Rahu Kalam ──
      if (expected.rahuKalamStartHHMM) {
        it(`rahuKalam start within ±5 min of ${expected.rahuKalamStartHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.rahuKalam.start), expected.rahuKalamStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`rahuKalam end within ±5 min of ${expected.rahuKalamEndHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.rahuKalam.end), expected.rahuKalamEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      // ── Yamaganda ──
      if (expected.yamagandaStartHHMM) {
        it(`yamaganda start within ±5 min of ${expected.yamagandaStartHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.yamaganda.start), expected.yamagandaStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`yamaganda end within ±5 min of ${expected.yamagandaEndHHMM}`, () => {
          expect(
            diffMinutes(fmtHHMM(r.yamaganda.end), expected.yamagandaEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      // ── Abhijit Muhurta ──
      // Drik convention: Abhijit is dropped on Wednesday (Buddha-vara) — fixture
      // entries for Wednesdays set both fields to null and we assert the library
      // also returns null. On other days both should match Drik within ±5 min.
      if (expected.abhijitMuhurtaStartHHMM === null) {
        it('abhijitMuhurta is null (Wednesday — Drik convention)', () => {
          expect(r.abhijitMuhurta).toBeNull();
        });
      } else if (expected.abhijitMuhurtaStartHHMM) {
        it(`abhijitMuhurta start within ±5 min of ${expected.abhijitMuhurtaStartHHMM}`, () => {
          expect(r.abhijitMuhurta).not.toBeNull();
          expect(
            diffMinutes(fmtHHMM(r.abhijitMuhurta!.start), expected.abhijitMuhurtaStartHHMM!),
          ).toBeLessThanOrEqual(5);
        });

        it(`abhijitMuhurta end within ±5 min of ${expected.abhijitMuhurtaEndHHMM}`, () => {
          expect(r.abhijitMuhurta).not.toBeNull();
          expect(
            diffMinutes(fmtHHMM(r.abhijitMuhurta!.end), expected.abhijitMuhurtaEndHHMM!),
          ).toBeLessThanOrEqual(5);
        });
      }

      // ── Element end times (Phase 19-2) ──
      // Tolerance: ±3 min vs Drik (observed max drift = 2.01 min across 20
      // end-time assertions on 5 fixture days). Our Meeus truncation gives
      // sub-arc-minute agreement on Moon+Sun longitudes, which is what drives
      // tithi/nakshatra/yoga/karana boundary timing.
      if (expected.tithiEndHHMM) {
        it(`tithi[0] endTime within ±3 min of ${expected.tithiEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.tithis[0]!.endTime!, date);
          const drik = parseEndMinutes(expected.tithiEndHHMM!);
          expect(Math.abs(actual - drik)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.nakshatraEndHHMM) {
        it(`nakshatras[0] endTime within ±3 min of ${expected.nakshatraEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.nakshatras[0]!.endTime!, date);
          const drik = parseEndMinutes(expected.nakshatraEndHHMM!);
          expect(Math.abs(actual - drik)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.yogaEndHHMM) {
        it(`yogas[0] endTime within ±3 min of ${expected.yogaEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.yogas[0]!.endTime!, date);
          const drik = parseEndMinutes(expected.yogaEndHHMM!);
          expect(Math.abs(actual - drik)).toBeLessThanOrEqual(3);
        });
      }

      if (expected.karanaEndHHMM) {
        it(`karanas[0] endTime within ±3 min of ${expected.karanaEndHHMM}`, () => {
          const actual = endMinutesFromDate(r.karanas[0]!.endTime!, date);
          const drik = parseEndMinutes(expected.karanaEndHHMM!);
          expect(Math.abs(actual - drik)).toBeLessThanOrEqual(3);
        });
      }

      // ── Festivals ──
      if (expected.festivals.length > 0) {
        it(`festivals include ${expected.festivals.join(', ')}`, () => {
          const actualNames = r.festivals.map((f: { name: string }) => f.name);
          for (const name of expected.festivals) {
            expect(actualNames).toContain(name);
          }
        });
      }

      // ── Structural invariants ──
      it('sunrise < sunset < nextSunrise', () => {
        expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
        expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
      });

      it('has at least 1 tithi, nakshatra, yoga, karana', () => {
        expect(r.tithis.length).toBeGreaterThanOrEqual(1);
        expect(r.nakshatras.length).toBeGreaterThanOrEqual(1);
        expect(r.yogas.length).toBeGreaterThanOrEqual(1);
        expect(r.karanas.length).toBeGreaterThanOrEqual(1);
      });

      it('ayanamsa is in [24.0, 24.3] for 2025-2026', () => {
        expect(r.ayanamsa).toBeGreaterThanOrEqual(24.0);
        expect(r.ayanamsa).toBeLessThanOrEqual(24.3);
      });
    });
  }
});

// ── Festival Drik validation (Phase 19-1) ────────────────────────────────────
//
// Per-festival `dateRule` tags in FESTIVAL_REGISTRY select the canonical time
// at which the qualifying tithi must prevail: sunrise (default), madhyahna
// (mid-day — e.g. Akshaya Tritiya), pradosha (sunset — e.g. Diwali Amavasya),
// or nishita (local midnight — e.g. Janmashtami, Maha Shivaratri).

type FestivalFixture = {
  _source: string;
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expectedFestival: string;
};

describe('DrikPanchang festival cross-verification', () => {
  for (const fixture of festivalFixtures as FestivalFixture[]) {
    const { date, city, location, timezone, expectedFestival } = fixture;
    it(`${date} / ${city} emits festival "${expectedFestival}"`, () => {
      const r = getDailyPanchang(noonUtc(date), location, { timezone });
      const names = r.festivals.map((f: { name: string }) => f.name);
      expect(names).toContain(expectedFestival);
    });
  }
});
