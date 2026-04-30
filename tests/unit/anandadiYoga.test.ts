/**
 * Unit tests for Anandadi Yoga — the 28-name Vara × Nakshatra cycle.
 *
 * Classical reference (Muhurta-chintamani Ch. 4): yoga[Sunday][Ashwini] =
 * Ananda; the cycle advances +1 yoga per nakshatra and +4 nakshatras per
 * weekday (so yoga[Monday][Mrigashira] = Ananda, yoga[Tuesday][Ashlesha]
 * = Ananda, etc.). The 28-yoga cycle is reduced to 27 nakshatras by
 * eliding Abhijit — see `ANANDADI_TABLE` in src/utils/constants.ts.
 */

import { describe, it, expect } from 'vitest';
import { computeAnandadiYoga } from '../../src/core/anandadiYoga';
import {
  ANANDADI_TABLE,
  ANANDADI_QUALITY,
  TOTAL_ANANDADI_YOGAS,
  TOTAL_NAKSHATRAS,
} from '../../src/utils/constants';

describe('computeAnandadiYoga — 28 fixtures (one per yoga)', () => {
  // Each fixture is the first (vara, nakshatra) pair that maps to the given yoga
  // index. yoga 21 (Musala) is unreachable on Sunday because the Sunday row
  // elides yoga 21 (it would have fallen on Abhijit, which we skip), so its
  // fixture lives on Monday × Purva Bhadrapada.
  const fixtures: Array<{
    yoga: number;
    vara: number;
    nakshatra: number;
    name: string;
    quality: 'auspicious' | 'inauspicious';
  }> = [
    { yoga:  0, vara: 0, nakshatra:  0, name: 'Ananda',     quality: 'auspicious' },
    { yoga:  1, vara: 0, nakshatra:  1, name: 'Kaladanda',  quality: 'inauspicious' },
    { yoga:  2, vara: 0, nakshatra:  2, name: 'Dhumra',     quality: 'inauspicious' },
    { yoga:  3, vara: 0, nakshatra:  3, name: 'Prajapati',  quality: 'auspicious' },
    { yoga:  4, vara: 0, nakshatra:  4, name: 'Saumya',     quality: 'auspicious' },
    { yoga:  5, vara: 0, nakshatra:  5, name: 'Dhwanksha',  quality: 'inauspicious' },
    { yoga:  6, vara: 0, nakshatra:  6, name: 'Dhwaja',     quality: 'auspicious' },
    { yoga:  7, vara: 0, nakshatra:  7, name: 'Shrivatsa',  quality: 'auspicious' },
    { yoga:  8, vara: 0, nakshatra:  8, name: 'Vajra',      quality: 'inauspicious' },
    { yoga:  9, vara: 0, nakshatra:  9, name: 'Mudgara',    quality: 'inauspicious' },
    { yoga: 10, vara: 0, nakshatra: 10, name: 'Chhatra',    quality: 'auspicious' },
    { yoga: 11, vara: 0, nakshatra: 11, name: 'Maitra',     quality: 'auspicious' },
    { yoga: 12, vara: 0, nakshatra: 12, name: 'Manasa',     quality: 'auspicious' },
    { yoga: 13, vara: 0, nakshatra: 13, name: 'Padma',      quality: 'auspicious' },
    { yoga: 14, vara: 0, nakshatra: 14, name: 'Lumba',      quality: 'inauspicious' },
    { yoga: 15, vara: 0, nakshatra: 15, name: 'Utpaata',    quality: 'inauspicious' },
    { yoga: 16, vara: 0, nakshatra: 16, name: 'Mrityu',     quality: 'inauspicious' },
    { yoga: 17, vara: 0, nakshatra: 17, name: 'Kana',       quality: 'inauspicious' },
    { yoga: 18, vara: 0, nakshatra: 18, name: 'Siddhi',     quality: 'auspicious' },
    { yoga: 19, vara: 0, nakshatra: 19, name: 'Shubha',     quality: 'auspicious' },
    { yoga: 20, vara: 0, nakshatra: 20, name: 'Amrita',     quality: 'auspicious' },
    { yoga: 21, vara: 1, nakshatra: 24, name: 'Musala',     quality: 'inauspicious' },
    { yoga: 22, vara: 0, nakshatra: 21, name: 'Gada',       quality: 'inauspicious' },
    { yoga: 23, vara: 0, nakshatra: 22, name: 'Matanga',    quality: 'inauspicious' },
    { yoga: 24, vara: 0, nakshatra: 23, name: 'Raksha',     quality: 'inauspicious' },
    { yoga: 25, vara: 0, nakshatra: 24, name: 'Charma',     quality: 'inauspicious' },
    { yoga: 26, vara: 0, nakshatra: 25, name: 'Sthira',     quality: 'auspicious' },
    { yoga: 27, vara: 0, nakshatra: 26, name: 'Vardhamana', quality: 'auspicious' },
  ];

  for (const f of fixtures) {
    it(`yoga ${f.yoga} (${f.name}) at vara=${f.vara}, nakshatra=${f.nakshatra}`, () => {
      const r = computeAnandadiYoga(f.vara, f.nakshatra);
      expect(r.index).toBe(f.yoga);
      expect(r.name).toBe(f.name);
      expect(r.quality).toBe(f.quality);
    });
  }
});

describe('computeAnandadiYoga — phasing per weekday', () => {
  // Each weekday's "Ananda" (yoga 0) anchors at a specific nakshatra under the
  // 28-naks classical phasing. Translated to 27 naks (Abhijit elided), Friday
  // and Saturday's Ananda anchor differs slightly — but Sunday..Thursday all
  // hit Ananda at the predicted nakshatra.
  it('Sunday → Ananda at Ashwini (0)', () => {
    expect(computeAnandadiYoga(0, 0).index).toBe(0);
  });
  it('Monday → Ananda at Mrigashira (4)', () => {
    expect(computeAnandadiYoga(1, 4).index).toBe(0);
  });
  it('Tuesday → Ananda at Ashlesha (8)', () => {
    expect(computeAnandadiYoga(2, 8).index).toBe(0);
  });
  it('Wednesday → Ananda at Hasta (12)', () => {
    expect(computeAnandadiYoga(3, 12).index).toBe(0);
  });
  it('Thursday → Ananda at Anuradha (16)', () => {
    expect(computeAnandadiYoga(4, 16).index).toBe(0);
  });
  it('Friday → Ananda at Uttara Ashadha (20)', () => {
    expect(computeAnandadiYoga(5, 20).index).toBe(0);
  });
  it('Saturday → Ananda at Shatabhisha (23)', () => {
    // 28-naks index 24 → 27-naks index 23 (skipping Abhijit at 28-naks 21).
    expect(computeAnandadiYoga(6, 23).index).toBe(0);
  });
});

describe('computeAnandadiYoga — invariants', () => {
  it('every (vara, nakshatra) pair returns a valid yoga index in [0, 27]', () => {
    for (let v = 0; v < 7; v++) {
      for (let n = 0; n < 27; n++) {
        const r = computeAnandadiYoga(v, n);
        expect(r.index).toBeGreaterThanOrEqual(0);
        expect(r.index).toBeLessThanOrEqual(27);
      }
    }
  });

  it('every weekday row hits 27 distinct yoga indices (one is skipped)', () => {
    // The 27-naks reduction of a 28-yoga cycle skips exactly one yoga per row
    // (the one that falls on Abhijit in the 28-naks classical layout).
    for (let v = 0; v < 7; v++) {
      const seen = new Set<number>();
      for (let n = 0; n < 27; n++) {
        seen.add(computeAnandadiYoga(v, n).index);
      }
      expect(seen.size).toBe(27);
    }
  });

  it('quality counts: 14 auspicious + 14 inauspicious across the 28-name cycle', () => {
    // Sample the full cycle by using Sunday's first 21 entries plus the rows
    // that cover the remaining yogas.
    const qualityByYoga: Record<number, string> = {};
    for (let v = 0; v < 7; v++) {
      for (let n = 0; n < 27; n++) {
        const r = computeAnandadiYoga(v, n);
        qualityByYoga[r.index] = r.quality;
      }
    }
    expect(Object.keys(qualityByYoga).length).toBe(28);
    const counts = { auspicious: 0, inauspicious: 0, neutral: 0 };
    for (const q of Object.values(qualityByYoga)) {
      counts[q as keyof typeof counts]++;
    }
    expect(counts.auspicious).toBe(14);
    expect(counts.inauspicious).toBe(14);
    expect(counts.neutral).toBe(0);
  });
});

describe('ANANDADI_TABLE / ANANDADI_QUALITY — structural invariants', () => {
  it('ANANDADI_TABLE has 7 rows, each of length TOTAL_NAKSHATRAS', () => {
    expect(ANANDADI_TABLE.length).toBe(7);
    for (const row of ANANDADI_TABLE) {
      expect(row.length).toBe(TOTAL_NAKSHATRAS);
    }
  });

  it('ANANDADI_QUALITY length === TOTAL_ANANDADI_YOGAS', () => {
    expect(ANANDADI_QUALITY.length).toBe(TOTAL_ANANDADI_YOGAS);
  });

  it('every cell of ANANDADI_TABLE is a valid index into ANANDADI_QUALITY', () => {
    for (const row of ANANDADI_TABLE) {
      for (const cell of row) {
        expect(Number.isInteger(cell)).toBe(true);
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(ANANDADI_QUALITY.length);
      }
    }
  });

  it('matches DrikPanchang anchor rows (regression for the build formula)', () => {
    // Pin the table against the four canonical anchor cells published by
    // DrikPanchang. Together with the row-length invariants above, these pin
    // both the per-weekday +4 phasing and the Abhijit elision at n27 ≥ 21.
    expect(ANANDADI_TABLE[0]![0]).toBe(0);    // Sun × Ashwini → Ananda
    expect(ANANDADI_TABLE[0]![26]).toBe(27);  // Sun × Revati  → Vardhamana
    expect(ANANDADI_TABLE[1]![4]).toBe(0);    // Mon × Mrigashira → Ananda
    expect(ANANDADI_TABLE[6]![23]).toBe(0);   // Sat × Shatabhisha → Ananda
  });
});

describe('computeAnandadiYoga — i18n', () => {
  it('en (default) returns Sanskrit transliteration', () => {
    expect(computeAnandadiYoga(0, 0).name).toBe('Ananda');
    expect(computeAnandadiYoga(0, 0, 'en').name).toBe('Ananda');
    expect(computeAnandadiYoga(0, 18).name).toBe('Siddhi');
  });

  it('hi returns Devanagari', () => {
    expect(computeAnandadiYoga(0, 0, 'hi').name).toBe('आनन्द');
    expect(computeAnandadiYoga(0, 18, 'hi').name).toBe('सिद्धि');
    expect(computeAnandadiYoga(0, 26, 'hi').name).toBe('वर्धमान');
  });
});

describe('computeAnandadiYoga — input validation', () => {
  it('throws RangeError for negative vara', () => {
    expect(() => computeAnandadiYoga(-1, 0)).toThrow(RangeError);
  });
  it('throws RangeError for vara ≥ 7', () => {
    expect(() => computeAnandadiYoga(7, 0)).toThrow(RangeError);
  });
  it('throws RangeError for non-integer vara', () => {
    expect(() => computeAnandadiYoga(2.5, 0)).toThrow(RangeError);
  });
  it('throws RangeError for negative nakshatra', () => {
    expect(() => computeAnandadiYoga(0, -1)).toThrow(RangeError);
  });
  it('throws RangeError for nakshatra ≥ 27', () => {
    expect(() => computeAnandadiYoga(0, 27)).toThrow(RangeError);
  });
  it('throws RangeError for non-integer nakshatra', () => {
    expect(() => computeAnandadiYoga(0, 3.5)).toThrow(RangeError);
  });
});
