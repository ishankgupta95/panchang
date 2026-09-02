import { describe, it, expect } from 'vitest';
import { computeChandraRashi, computeSuryaNakshatra } from '../../src/core/rashi';

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrischika',
  'Dhanus', 'Makara', 'Kumbha', 'Meena',
];

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
  'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const rashiNameFn = (idx: number) => RASHI_NAMES[idx]!;
const nakshatraNameFn = (idx: number) => NAKSHATRA_NAMES[idx]!;

describe('computeChandraRashi', () => {
  describe('all 12 rashis', () => {
    for (let i = 0; i < 12; i++) {
      const midDeg = i * 30 + 15;
      it(`${midDeg}° → ${RASHI_NAMES[i]} (index ${i})`, () => {
        const result = computeChandraRashi(midDeg, rashiNameFn);
        expect(result.index).toBe(i);
        expect(result.name).toBe(RASHI_NAMES[i]);
      });
    }
  });

  describe('boundary cases', () => {
    it('0° → Mesha (index 0)', () => {
      const result = computeChandraRashi(0.5, rashiNameFn);
      expect(result.index).toBe(0);
    });

    it('29.99° → Mesha (index 0)', () => {
      const result = computeChandraRashi(29.99, rashiNameFn);
      expect(result.index).toBe(0);
    });

    it('30° → Vrishabha (index 1)', () => {
      const result = computeChandraRashi(30.0, rashiNameFn);
      expect(result.index).toBe(1);
    });

    it('359° → Meena (index 11)', () => {
      const result = computeChandraRashi(359, rashiNameFn);
      expect(result.index).toBe(11);
    });
  });
});

describe('computeSuryaNakshatra', () => {
  describe('all 27 nakshatras', () => {
    const NAKSHATRA_SPAN = 13.333333333333334;
    for (let i = 0; i < 27; i++) {
      const midDeg = i * NAKSHATRA_SPAN + NAKSHATRA_SPAN / 2;
      it(`${midDeg.toFixed(2)}° → ${NAKSHATRA_NAMES[i]} (index ${i})`, () => {
        const result = computeSuryaNakshatra(midDeg, nakshatraNameFn);
        expect(result.index).toBe(i);
        expect(result.name).toBe(NAKSHATRA_NAMES[i]);
      });
    }
  });
});
