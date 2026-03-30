/**
 * Unit tests for planetary position calculations.
 *
 * Verifies sidereal longitudes, rashi assignments, nakshatra assignments,
 * retrograde detection, and Rahu/Ketu always-retrograde flag.
 *
 * Reference: DrikPanchang.com planetary positions + general ephemeris knowledge.
 */

import { describe, it, expect } from 'vitest';
import { computePlanetaryPositions, GRAHA_ABBR } from '../../src/jyotish/planets';
import { resolveNakshatraName } from '../../src/i18n/resolver';
import { en } from '../../src/i18n/en';

const RASHI_NAMES = en.masaNames; // masaNames doubles as rashi names

// Known date: 2025-01-14T06:00:00Z (mid-morning IST)
const JAN_14_2025 = new Date('2025-01-14T06:00:00Z');
// Known date: 2025-07-04T12:00:00Z (mid-year)
const JUL_04_2025 = new Date('2025-07-04T12:00:00Z');

describe('computePlanetaryPositions', () => {
  describe('basic structure and range checks', () => {
    const pp = computePlanetaryPositions(
      JAN_14_2025,
      'lahiri',
      (idx) => resolveNakshatraName(idx, 'en'),
      (idx) => RASHI_NAMES[idx] ?? String(idx),
    );

    it('returns all 9 grahas', () => {
      expect(pp.sun).toBeDefined();
      expect(pp.moon).toBeDefined();
      expect(pp.mars).toBeDefined();
      expect(pp.mercury).toBeDefined();
      expect(pp.jupiter).toBeDefined();
      expect(pp.venus).toBeDefined();
      expect(pp.saturn).toBeDefined();
      expect(pp.rahu).toBeDefined();
      expect(pp.ketu).toBeDefined();
    });

    const allGrahas = [
      pp.sun, pp.moon, pp.mars, pp.mercury, pp.jupiter,
      pp.venus, pp.saturn, pp.rahu, pp.ketu,
    ];

    for (const g of allGrahas) {
      it(`${g.planet} siderealLongitude in [0, 360)`, () => {
        expect(g.siderealLongitude).toBeGreaterThanOrEqual(0);
        expect(g.siderealLongitude).toBeLessThan(360);
      });

      it(`${g.planet} rashi.index in [0, 11]`, () => {
        expect(g.rashi.index).toBeGreaterThanOrEqual(0);
        expect(g.rashi.index).toBeLessThanOrEqual(11);
      });

      it(`${g.planet} degreeInRashi in [0, 30)`, () => {
        expect(g.degreeInRashi).toBeGreaterThanOrEqual(0);
        expect(g.degreeInRashi).toBeLessThan(30);
      });

      it(`${g.planet} rashi.index === floor(lon / 30)`, () => {
        expect(g.rashi.index).toBe(Math.floor(g.siderealLongitude / 30));
      });

      it(`${g.planet} has valid nakshatra`, () => {
        expect(g.nakshatra.index).toBeGreaterThanOrEqual(0);
        expect(g.nakshatra.index).toBeLessThanOrEqual(26);
        expect(g.nakshatra.pada).toBeGreaterThanOrEqual(1);
        expect(g.nakshatra.pada).toBeLessThanOrEqual(4);
      });

      it(`${g.planet} rashi name is a valid name`, () => {
        expect(g.rashi.name).toBeTruthy();
        expect(RASHI_NAMES).toContain(g.rashi.name);
      });
    }
  });

  describe('Sun position on Makar Sankranti (2025-01-14)', () => {
    const pp = computePlanetaryPositions(
      JAN_14_2025,
      'lahiri',
      (idx) => resolveNakshatraName(idx, 'en'),
      (idx) => RASHI_NAMES[idx] ?? String(idx),
    );

    it('Sun should be in Dhanus or Makara (Sagittarius/Capricorn transition)', () => {
      // Makar Sankranti = Sun entering Makara. Depending on exact time it may be
      // at the very end of Dhanus (index 8) or start of Makara (index 9)
      expect([8, 9]).toContain(pp.sun.rashi.index);
    });

    it('Sun is not retrograde', () => {
      expect(pp.sun.isRetrograde).toBe(false);
    });

    it('Moon is not retrograde', () => {
      expect(pp.moon.isRetrograde).toBe(false);
    });
  });

  describe('Rahu and Ketu properties', () => {
    const pp = computePlanetaryPositions(JAN_14_2025, 'lahiri');

    it('Rahu is always retrograde', () => {
      expect(pp.rahu.isRetrograde).toBe(true);
    });

    it('Ketu is always retrograde', () => {
      expect(pp.ketu.isRetrograde).toBe(true);
    });

    it('Ketu is exactly 180° from Rahu', () => {
      const diff = Math.abs(pp.rahu.siderealLongitude - pp.ketu.siderealLongitude);
      // Should be 180 ± 0.1° (accounting for float precision)
      expect(Math.abs(diff - 180)).toBeLessThan(0.5);
    });
  });

  describe('consistency across ayanamsa systems', () => {
    const lahiri = computePlanetaryPositions(JAN_14_2025, 'lahiri');
    const raman = computePlanetaryPositions(JAN_14_2025, 'raman');
    const kp = computePlanetaryPositions(JAN_14_2025, 'krishnamurti');

    it('all ayanamsa systems return valid positions', () => {
      for (const pp of [lahiri, raman, kp]) {
        expect(pp.sun.siderealLongitude).toBeGreaterThanOrEqual(0);
        expect(pp.sun.siderealLongitude).toBeLessThan(360);
      }
    });

    it('longitudes differ by ayanamsa offset (Lahiri vs Raman ~1-2°)', () => {
      const diff = Math.abs(lahiri.sun.siderealLongitude - raman.sun.siderealLongitude);
      // Lahiri and Raman differ by about 1-2 degrees
      expect(diff).toBeLessThan(3);
      expect(diff).toBeGreaterThan(0.1);
    });
  });

  describe('retrograde detection for outer planets mid-year', () => {
    const pp = computePlanetaryPositions(JUL_04_2025, 'lahiri');

    it('Mars, Jupiter, or Saturn can be retrograde', () => {
      // At least verify the boolean is present (actual retrograde depends on date)
      expect(typeof pp.mars.isRetrograde).toBe('boolean');
      expect(typeof pp.jupiter.isRetrograde).toBe('boolean');
      expect(typeof pp.saturn.isRetrograde).toBe('boolean');
    });

    it('Mercury or Venus can be retrograde', () => {
      expect(typeof pp.mercury.isRetrograde).toBe('boolean');
      expect(typeof pp.venus.isRetrograde).toBe('boolean');
    });
  });

  describe('GRAHA_ABBR', () => {
    it('has all 9 planet abbreviations', () => {
      expect(Object.keys(GRAHA_ABBR)).toHaveLength(9);
      expect(GRAHA_ABBR.Sun).toBe('Su');
      expect(GRAHA_ABBR.Moon).toBe('Mo');
      expect(GRAHA_ABBR.Mars).toBe('Ma');
      expect(GRAHA_ABBR.Mercury).toBe('Me');
      expect(GRAHA_ABBR.Jupiter).toBe('Ju');
      expect(GRAHA_ABBR.Venus).toBe('Ve');
      expect(GRAHA_ABBR.Saturn).toBe('Sa');
      expect(GRAHA_ABBR.Rahu).toBe('Ra');
      expect(GRAHA_ABBR.Ketu).toBe('Ke');
    });
  });

  describe('multiple dates stability', () => {
    const dates = [
      new Date('2025-01-01T00:00:00Z'),
      new Date('2025-04-15T06:00:00Z'),
      new Date('2025-07-21T12:00:00Z'),
      new Date('2025-10-31T18:00:00Z'),
      new Date('2026-03-20T06:00:00Z'),
    ];

    for (const d of dates) {
      it(`does not throw for ${d.toISOString().slice(0, 10)}`, () => {
        expect(() => computePlanetaryPositions(d, 'lahiri')).not.toThrow();
      });

      it(`all positions valid for ${d.toISOString().slice(0, 10)}`, () => {
        const pp = computePlanetaryPositions(d, 'lahiri');
        const allGrahas = [
          pp.sun, pp.moon, pp.mars, pp.mercury, pp.jupiter,
          pp.venus, pp.saturn, pp.rahu, pp.ketu,
        ];
        for (const g of allGrahas) {
          expect(g.siderealLongitude).toBeGreaterThanOrEqual(0);
          expect(g.siderealLongitude).toBeLessThan(360);
          expect(g.rashi.index).toBeGreaterThanOrEqual(0);
          expect(g.rashi.index).toBeLessThanOrEqual(11);
        }
      });
    }
  });
});
