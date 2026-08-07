/**
 * Unit tests for Nakshatra computation.
 *
 * 27 nakshatras, each spanning 13°20' (13.333°).
 * Each nakshatra has 4 padas of 3°20' (3.333°).
 */

import { describe, it, expect } from 'vitest';
import { computeNakshatraFromLongitude } from '../../src/core/nakshatra';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
  'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

describe('computeNakshatraFromLongitude', () => {
  describe('boundary values for all 27 nakshatras', () => {
    for (let i = 0; i < 27; i++) {
      const startDeg = i * NAKSHATRA_SPAN;
      const midDeg = startDeg + NAKSHATRA_SPAN / 2;

      it(`index ${i} (${NAKSHATRA_NAMES[i]}): mid-point ${midDeg.toFixed(2)}° → correct index`, () => {
        const result = computeNakshatraFromLongitude(midDeg, NAKSHATRA_NAMES[i]!);
        expect(result.index).toBe(i);
        expect(result.name).toBe(NAKSHATRA_NAMES[i]);
      });
    }
  });

  describe('pada assignment', () => {
    it('0° (start of Ashwini) → pada 1', () => {
      const result = computeNakshatraFromLongitude(0.1, 'Ashwini');
      expect(result.pada).toBe(1);
    });

    it('3.5° (mid pada 2 of Ashwini) → pada 2', () => {
      const result = computeNakshatraFromLongitude(3.5, 'Ashwini');
      expect(result.pada).toBe(2);
    });

    it('7.0° (mid pada 3 of Ashwini) → pada 3', () => {
      const result = computeNakshatraFromLongitude(7.0, 'Ashwini');
      expect(result.pada).toBe(3);
    });

    it('11.0° (pada 4 of Ashwini) → pada 4', () => {
      const result = computeNakshatraFromLongitude(11.0, 'Ashwini');
      expect(result.pada).toBe(4);
    });
  });

  describe('completion percentage', () => {
    it('start of nakshatra → ~0%', () => {
      const result = computeNakshatraFromLongitude(0.01, 'Ashwini');
      expect(result.completionPercentage).toBeLessThan(1);
    });

    it('mid-nakshatra → ~50%', () => {
      const result = computeNakshatraFromLongitude(NAKSHATRA_SPAN / 2, 'Ashwini');
      expect(result.completionPercentage).toBeCloseTo(50, 0);
    });

    it('near end of nakshatra → ~99%+', () => {
      const result = computeNakshatraFromLongitude(NAKSHATRA_SPAN - 0.01, 'Ashwini');
      expect(result.completionPercentage).toBeGreaterThan(99);
    });
  });

  describe('degreesInNakshatra', () => {
    it('mid-Ashwini → degreesInNakshatra ≈ 6.67', () => {
      const result = computeNakshatraFromLongitude(6.667, 'Ashwini');
      expect(result.degreesInNakshatra).toBeCloseTo(6.667, 1);
    });

    it('start of Bharani (13.33°) → degreesInNakshatra ≈ 0', () => {
      const result = computeNakshatraFromLongitude(13.34, 'Bharani');
      expect(result.degreesInNakshatra).toBeLessThan(0.1);
    });
  });

  describe('wrap-around at 360°', () => {
    it('359° → Revati (last nakshatra)', () => {
      const result = computeNakshatraFromLongitude(359, 'Revati');
      expect(result.index).toBe(26);
    });
  });
});
