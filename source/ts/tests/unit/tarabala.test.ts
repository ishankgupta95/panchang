
import { describe, it, expect } from 'vitest';
import { computeTarabala } from '../../src/jyotish/tarabala';

describe('computeTarabala', () => {
  describe('classical 9-tara mapping from janma = Ashwini (index 0)', () => {
    const cases: Array<{ transit: number; taraIndex: number; englishName: string; quality: 'auspicious' | 'inauspicious' }> = [
      { transit: 0,  taraIndex: 0, englishName: 'Janma',     quality: 'auspicious' },
      { transit: 1,  taraIndex: 1, englishName: 'Sampat',    quality: 'auspicious' },
      { transit: 2,  taraIndex: 2, englishName: 'Vipat',     quality: 'inauspicious' },
      { transit: 3,  taraIndex: 3, englishName: 'Kshema',    quality: 'auspicious' },
      { transit: 4,  taraIndex: 4, englishName: 'Pratyari',  quality: 'inauspicious' },
      { transit: 5,  taraIndex: 5, englishName: 'Sadhaka',   quality: 'auspicious' },
      { transit: 6,  taraIndex: 6, englishName: 'Vadha',     quality: 'inauspicious' },
      { transit: 7,  taraIndex: 7, englishName: 'Mitra',     quality: 'auspicious' },
      { transit: 8,  taraIndex: 8, englishName: 'Ati-Mitra', quality: 'auspicious' },
    ];

    for (const { transit, taraIndex, englishName, quality } of cases) {
      it(`transit nakshatra ${transit} → ${englishName} (${quality})`, () => {
        const tb = computeTarabala(0, transit);
        expect(tb.taraIndex).toBe(taraIndex);
        expect(tb.englishName).toBe(englishName);
        expect(tb.quality).toBe(quality);
      });
    }
  });

  describe('cycle repetition (3× across 27 nakshatras)', () => {
    for (let offset = 0; offset < 9; offset++) {
      it(`offsets ${offset}, ${offset + 9}, ${offset + 18} all map to taraIndex ${offset}`, () => {
        const a = computeTarabala(0, offset);
        const b = computeTarabala(0, offset + 9);
        const c = computeTarabala(0, offset + 18);
        expect(a.taraIndex).toBe(offset);
        expect(b.taraIndex).toBe(offset);
        expect(c.taraIndex).toBe(offset);
        expect(a.englishName).toBe(b.englishName);
        expect(b.englishName).toBe(c.englishName);
      });
    }
  });

  describe('wrap-around with janma = Revati (index 26)', () => {
    it('transit Ashwini (0) → tara 1 (Sampat)', () => {
      const tb = computeTarabala(26, 0);
      expect(tb.taraIndex).toBe(1);
      expect(tb.englishName).toBe('Sampat');
      expect(tb.quality).toBe('auspicious');
    });

    it('transit Revati (26) → tara 0 (Janma)', () => {
      const tb = computeTarabala(26, 26);
      expect(tb.taraIndex).toBe(0);
      expect(tb.englishName).toBe('Janma');
    });

    it('transit Uttara Bhadrapada (25) → tara 8 (Ati-Mitra)', () => {
      const tb = computeTarabala(26, 25);
      expect(tb.taraIndex).toBe(8);
      expect(tb.englishName).toBe('Ati-Mitra');
    });
  });

  describe('janma in middle (Magha = 9): exercises both wrap directions', () => {
    it('transit Magha (9) → Janma', () => {
      expect(computeTarabala(9, 9).englishName).toBe('Janma');
    });

    it('transit Ashwini (0) → 18 forward → 18 % 9 = 0 → Janma (third cycle start)', () => {
      expect(computeTarabala(9, 0).englishName).toBe('Janma');
    });

    it('transit Bharani (1) → 19 forward → 19 % 9 = 1 → Sampat', () => {
      expect(computeTarabala(9, 1).englishName).toBe('Sampat');
    });

    it('transit Revati (26) → 17 forward → 17 % 9 = 8 → Ati-Mitra', () => {
      expect(computeTarabala(9, 26).englishName).toBe('Ati-Mitra');
    });
  });

  describe('i18n localized name', () => {
    it('en returns Sanskrit transliterations', () => {
      expect(computeTarabala(0, 0, 'en').name).toBe('Janma');
      expect(computeTarabala(0, 2, 'en').name).toBe('Vipat');
      expect(computeTarabala(0, 8, 'en').name).toBe('Ati-Mitra');
    });

    it('hi returns Devanagari', () => {
      expect(computeTarabala(0, 0, 'hi').name).toBe('जन्म');
      expect(computeTarabala(0, 2, 'hi').name).toBe('विपत्');
      expect(computeTarabala(0, 8, 'hi').name).toBe('अति-मित्र');
    });

    it('defaults to en when lang omitted', () => {
      expect(computeTarabala(0, 4).name).toBe('Pratyari');
    });
  });

  describe('input validation', () => {
    it('throws for janmaNakshatra < 0', () => {
      expect(() => computeTarabala(-1, 0)).toThrow(RangeError);
    });

    it('throws for janmaNakshatra > 26', () => {
      expect(() => computeTarabala(27, 0)).toThrow(RangeError);
    });

    it('throws for non-integer janmaNakshatra', () => {
      expect(() => computeTarabala(1.5, 0)).toThrow(RangeError);
    });

    it('throws for transitNakshatra < 0', () => {
      expect(() => computeTarabala(0, -1)).toThrow(RangeError);
    });

    it('throws for transitNakshatra > 26', () => {
      expect(() => computeTarabala(0, 27)).toThrow(RangeError);
    });

    it('throws for non-integer transitNakshatra', () => {
      expect(() => computeTarabala(0, 5.5)).toThrow(RangeError);
    });
  });

  describe('invariants', () => {
    it('exactly 6 of every 9 transits are auspicious for any janma', () => {
      for (let janma = 0; janma < 27; janma++) {
        let ausp = 0;
        for (let t = 0; t < 9; t++) {
          const transit = (janma + t) % 27;
          if (computeTarabala(janma, transit).quality === 'auspicious') ausp++;
        }
        expect(ausp).toBe(6);
      }
    });

    it('exactly 18 of 27 transits are auspicious for any janma (3 cycles × 6)', () => {
      for (let janma = 0; janma < 27; janma++) {
        let ausp = 0;
        for (let transit = 0; transit < 27; transit++) {
          if (computeTarabala(janma, transit).quality === 'auspicious') ausp++;
        }
        expect(ausp).toBe(18);
      }
    });

    it('shift invariance: same (transit - janma) offset always gives same taraIndex', () => {
      for (let janma = 0; janma < 27; janma++) {
        for (let offset = 0; offset < 27; offset++) {
          const transit = (janma + offset) % 27;
          const tb = computeTarabala(janma, transit);
          expect(tb.taraIndex).toBe(offset % 9);
        }
      }
    });

    it('inauspicious taras occur at indices 2, 4, 6 only', () => {
      const inausp = new Set<number>();
      for (let t = 0; t < 27; t++) {
        const tb = computeTarabala(0, t);
        if (tb.quality === 'inauspicious') inausp.add(tb.taraIndex);
      }
      expect(inausp).toEqual(new Set([2, 4, 6]));
    });
  });
});
