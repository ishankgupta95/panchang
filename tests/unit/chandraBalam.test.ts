/**
 * Unit tests for Chandra Balam (transit Moon strength from janma rashi).
 *
 * Classical rule: houses 1, 3, 6, 7, 10, 11 from janma are Shubha (strong);
 *                 houses 2, 4, 5, 8, 9, 12 are Ashubha (weak).
 */

import { describe, it, expect } from 'vitest';
import { computeChandraBalam } from '../../src/jyotish/chandraBalam';

describe('computeChandraBalam', () => {
  describe('classical house-quality mapping from janma = Mesha (index 0)', () => {
    const cases: Array<{ transit: number; house: number; quality: 'strong' | 'weak' }> = [
      { transit: 0,  house: 1,  quality: 'strong' },  // Mesha
      { transit: 1,  house: 2,  quality: 'weak' },    // Vrishabha
      { transit: 2,  house: 3,  quality: 'strong' },  // Mithuna
      { transit: 3,  house: 4,  quality: 'weak' },    // Karka
      { transit: 4,  house: 5,  quality: 'weak' },    // Simha
      { transit: 5,  house: 6,  quality: 'strong' },  // Kanya
      { transit: 6,  house: 7,  quality: 'strong' },  // Tula
      { transit: 7,  house: 8,  quality: 'weak' },    // Vrischika
      { transit: 8,  house: 9,  quality: 'weak' },    // Dhanus
      { transit: 9,  house: 10, quality: 'strong' },  // Makara
      { transit: 10, house: 11, quality: 'strong' },  // Kumbha
      { transit: 11, house: 12, quality: 'weak' },    // Meena
    ];

    for (const { transit, house, quality } of cases) {
      it(`transit rashi ${transit} → house ${house}, ${quality}`, () => {
        const cb = computeChandraBalam(0, transit);
        expect(cb.house).toBe(house);
        expect(cb.quality).toBe(quality);
      });
    }
  });

  describe('wrap-around with janma = Meena (index 11)', () => {
    it('transit Mesha (0) is house 2 → weak', () => {
      const cb = computeChandraBalam(11, 0);
      expect(cb.house).toBe(2);
      expect(cb.quality).toBe('weak');
    });

    it('transit Meena (11) is house 1 → strong', () => {
      const cb = computeChandraBalam(11, 11);
      expect(cb.house).toBe(1);
      expect(cb.quality).toBe('strong');
    });

    it('transit Kumbha (10) is house 12 → weak', () => {
      const cb = computeChandraBalam(11, 10);
      expect(cb.house).toBe(12);
      expect(cb.quality).toBe('weak');
    });
  });

  describe('englishName mapping', () => {
    it("strong → 'Shubha'", () => {
      expect(computeChandraBalam(0, 0).englishName).toBe('Shubha');
    });

    it("weak → 'Ashubha'", () => {
      expect(computeChandraBalam(0, 1).englishName).toBe('Ashubha');
    });
  });

  describe('i18n localized name', () => {
    it('en returns Shubha / Ashubha', () => {
      expect(computeChandraBalam(0, 0, 'en').name).toBe('Shubha');
      expect(computeChandraBalam(0, 1, 'en').name).toBe('Ashubha');
    });

    it('sa returns Devanagari शुभ / अशुभ', () => {
      expect(computeChandraBalam(0, 0, 'sa').name).toBe('शुभ');
      expect(computeChandraBalam(0, 1, 'sa').name).toBe('अशुभ');
    });

    it('hi returns Devanagari शुभ / अशुभ', () => {
      expect(computeChandraBalam(0, 0, 'hi').name).toBe('शुभ');
      expect(computeChandraBalam(0, 1, 'hi').name).toBe('अशुभ');
    });

    it('defaults to en when lang omitted', () => {
      expect(computeChandraBalam(0, 0).name).toBe('Shubha');
    });
  });

  describe('input validation', () => {
    it('throws for janmaRashi < 0', () => {
      expect(() => computeChandraBalam(-1, 0)).toThrow(RangeError);
    });

    it('throws for janmaRashi > 11', () => {
      expect(() => computeChandraBalam(12, 0)).toThrow(RangeError);
    });

    it('throws for non-integer janmaRashi', () => {
      expect(() => computeChandraBalam(1.5, 0)).toThrow(RangeError);
    });

    it('throws for transitMoon < 0', () => {
      expect(() => computeChandraBalam(0, -1)).toThrow(RangeError);
    });

    it('throws for transitMoon > 11', () => {
      expect(() => computeChandraBalam(0, 12)).toThrow(RangeError);
    });

    it('throws for non-integer transitMoon', () => {
      expect(() => computeChandraBalam(0, 5.5)).toThrow(RangeError);
    });
  });

  describe('invariants', () => {
    it('exactly 6 of 12 houses are strong', () => {
      let strong = 0;
      for (let t = 0; t < 12; t++) {
        if (computeChandraBalam(0, t).quality === 'strong') strong++;
      }
      expect(strong).toBe(6);
    });

    it('house numbers are a permutation of 1..12 across all transits', () => {
      const houses = new Set<number>();
      for (let t = 0; t < 12; t++) {
        houses.add(computeChandraBalam(0, t).house);
      }
      expect(houses.size).toBe(12);
      for (let h = 1; h <= 12; h++) {
        expect(houses.has(h)).toBe(true);
      }
    });

    it('same transit→janma offset always gives same house (shift invariance)', () => {
      for (let janma = 0; janma < 12; janma++) {
        for (let offset = 0; offset < 12; offset++) {
          const transit = (janma + offset) % 12;
          const cb = computeChandraBalam(janma, transit);
          expect(cb.house).toBe(offset + 1);
        }
      }
    });
  });
});
