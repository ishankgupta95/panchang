/**
 * Unit tests for Do Ghati Muhurta — the 30-slot (15 day + 15 night) ~48-min
 * panchanga subdivision.
 *
 * Source: DrikPanchang's Do Ghati Muhurat daily table. The 30 names (Rudra…
 * Bhaga / Ishwara…Samirana) are FIXED — they do NOT rotate by weekday — and
 * each carries a fixed auspicious / inauspicious classification.
 *
 * Verification of "no weekday rotation" was performed against DrikPanchang
 * pages for two distinct weekdays during Phase 28-7 implementation (April
 * 15 2026 Wednesday and April 20 2026 Monday produced identical name
 * sequences).
 */

import { describe, it, expect } from 'vitest';
import { computeDoGhati } from '../../src/core/doGhati';

const nameResolver = (idx: number) =>
  [
    // Day (0–14)
    'Rudra', 'Uraga', 'Mitra', 'Pitara', 'Vasu',
    'Ambu', 'Vishwedeva', 'Vidhi', 'Brahma', 'Indra',
    'Indragni', 'Daitya', 'Varuna', 'Aryama', 'Bhaga',
    // Night (15–29)
    'Ishwara', 'Ajaikapada', 'Ahirbudhnya', 'Pusha', 'Ashwini',
    'Yama', 'Agni', 'Brahma', 'Chandra', 'Aditi',
    'Brihaspati', 'Vishnu', 'Surya', 'Tvashta', 'Samirana',
  ][idx]!;
const qualityNameResolver = (q: string) => q;

const SUNRISE = new Date('2025-01-14T01:45:00Z'); // 07:15 IST
const SUNSET = new Date('2025-01-14T12:16:00Z');  // 17:46 IST
const NEXT_SUNRISE = new Date('2025-01-15T01:45:00Z');

describe('computeDoGhati — slot structure', () => {
  const result = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);

  it('returns 15 day + 15 night slots', () => {
    expect(result.day).toHaveLength(15);
    expect(result.night).toHaveLength(15);
  });

  it('day slots span sunrise → sunset exactly', () => {
    expect(result.day[0]!.start.getTime()).toBe(SUNRISE.getTime());
    expect(result.day[14]!.end.getTime()).toBe(SUNSET.getTime());
  });

  it('night slots span sunset → next sunrise exactly', () => {
    expect(result.night[0]!.start.getTime()).toBe(SUNSET.getTime());
    expect(result.night[14]!.end.getTime()).toBe(NEXT_SUNRISE.getTime());
  });

  it('day slots are contiguous (no gaps, no overlaps)', () => {
    for (let i = 1; i < 15; i++) {
      expect(result.day[i]!.start.getTime()).toBe(result.day[i - 1]!.end.getTime());
    }
  });

  it('night slots are contiguous (no gaps, no overlaps)', () => {
    for (let i = 1; i < 15; i++) {
      expect(result.night[i]!.start.getTime()).toBe(result.night[i - 1]!.end.getTime());
    }
  });

  it('all slots are monotonically increasing in start time', () => {
    const allSlots = [...result.day, ...result.night];
    for (let i = 1; i < allSlots.length; i++) {
      expect(allSlots[i]!.start.getTime()).toBeGreaterThan(allSlots[i - 1]!.start.getTime());
    }
  });

  it('each day slot has duration ≈ dayLength / 15', () => {
    const expectedMs = (SUNSET.getTime() - SUNRISE.getTime()) / 15;
    for (const slot of result.day) {
      const ms = slot.end.getTime() - slot.start.getTime();
      expect(Math.abs(ms - expectedMs)).toBeLessThan(2); // ≤ 1 ms float rounding
    }
  });

  it('each night slot has duration ≈ nightLength / 15', () => {
    const expectedMs = (NEXT_SUNRISE.getTime() - SUNSET.getTime()) / 15;
    for (const slot of result.night) {
      const ms = slot.end.getTime() - slot.start.getTime();
      expect(Math.abs(ms - expectedMs)).toBeLessThan(2);
    }
  });
});

describe('computeDoGhati — index and naming', () => {
  const result = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);

  it('day slot indices are 0..14', () => {
    for (let i = 0; i < 15; i++) {
      expect(result.day[i]!.index).toBe(i);
    }
  });

  it('night slot indices are 15..29', () => {
    for (let i = 0; i < 15; i++) {
      expect(result.night[i]!.index).toBe(i + 15);
    }
  });

  it('first day slot is Rudra (matches DrikPanchang)', () => {
    expect(result.day[0]!.name).toBe('Rudra');
  });

  it('last day slot is Bhaga (matches DrikPanchang)', () => {
    expect(result.day[14]!.name).toBe('Bhaga');
  });

  it('first night slot is Ishwara (matches DrikPanchang)', () => {
    expect(result.night[0]!.name).toBe('Ishwara');
  });

  it('last night slot is Samirana (matches DrikPanchang)', () => {
    expect(result.night[14]!.name).toBe('Samirana');
  });

  it('Brahma appears at slot 8 (day) and slot 22 (night)', () => {
    // Per DrikPanchang's table — Brahma is repeated in both halves.
    expect(result.day[8]!.name).toBe('Brahma');
    expect(result.night[22 - 15]!.name).toBe('Brahma');
  });
});

describe('computeDoGhati — quality classification', () => {
  const result = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);
  const allSlots = [...result.day, ...result.night];

  it('all slots have a valid ChoghadiyaQuality value', () => {
    for (const slot of allSlots) {
      expect(['auspicious', 'inauspicious', 'neutral']).toContain(slot.quality);
    }
  });

  it('Rudra, Bhaga, Yama, Agni are inauspicious (per DrikPanchang)', () => {
    const inauspiciousNames = new Set(['Rudra', 'Bhaga', 'Yama', 'Agni']);
    for (const slot of allSlots) {
      if (inauspiciousNames.has(slot.name)) {
        expect(slot.quality).toBe('inauspicious');
      }
    }
  });

  it('Mitra, Brahma, Indra, Vishnu, Surya are auspicious (per DrikPanchang)', () => {
    const auspiciousNames = new Set(['Mitra', 'Brahma', 'Indra', 'Vishnu', 'Surya']);
    for (const slot of allSlots) {
      if (auspiciousNames.has(slot.name)) {
        expect(slot.quality).toBe('auspicious');
      }
    }
  });

  it('day half has 9 auspicious + 6 inauspicious slots', () => {
    const auspCount = result.day.filter(s => s.quality === 'auspicious').length;
    const inauspCount = result.day.filter(s => s.quality === 'inauspicious').length;
    expect(auspCount).toBe(9);
    expect(inauspCount).toBe(6);
  });

  it('night half has 11 auspicious + 4 inauspicious slots', () => {
    const auspCount = result.night.filter(s => s.quality === 'auspicious').length;
    const inauspCount = result.night.filter(s => s.quality === 'inauspicious').length;
    expect(auspCount).toBe(11);
    expect(inauspCount).toBe(4);
  });
});

describe('computeDoGhati — full quality vector pin (per-slot)', () => {
  // Pins every one of the 30 slots' quality classification against the
  // DrikPanchang Do Ghati daily table. Reordering or relabelling the
  // DO_GHATI_QUALITY array in `src/core/doGhati.ts` will fail this test
  // immediately rather than silently shipping wrong auspicious/inauspicious
  // labels behind structurally-correct slot counts.
  const EXPECTED: ReadonlyArray<{ index: number; name: string; quality: 'auspicious' | 'inauspicious' }> = [
    // Day (0–14)
    { index:  0, name: 'Rudra',       quality: 'inauspicious' },
    { index:  1, name: 'Uraga',       quality: 'inauspicious' },
    { index:  2, name: 'Mitra',       quality: 'auspicious'   },
    { index:  3, name: 'Pitara',      quality: 'inauspicious' },
    { index:  4, name: 'Vasu',        quality: 'auspicious'   },
    { index:  5, name: 'Ambu',        quality: 'auspicious'   },
    { index:  6, name: 'Vishwedeva',  quality: 'auspicious'   },
    { index:  7, name: 'Vidhi',       quality: 'auspicious'   },
    { index:  8, name: 'Brahma',      quality: 'auspicious'   },
    { index:  9, name: 'Indra',       quality: 'auspicious'   },
    { index: 10, name: 'Indragni',    quality: 'inauspicious' },
    { index: 11, name: 'Daitya',      quality: 'inauspicious' },
    { index: 12, name: 'Varuna',      quality: 'auspicious'   },
    { index: 13, name: 'Aryama',      quality: 'auspicious'   },
    { index: 14, name: 'Bhaga',       quality: 'inauspicious' },
    // Night (15–29)
    { index: 15, name: 'Ishwara',     quality: 'inauspicious' },
    { index: 16, name: 'Ajaikapada',  quality: 'inauspicious' },
    { index: 17, name: 'Ahirbudhnya', quality: 'auspicious'   },
    { index: 18, name: 'Pusha',       quality: 'auspicious'   },
    { index: 19, name: 'Ashwini',     quality: 'auspicious'   },
    { index: 20, name: 'Yama',        quality: 'inauspicious' },
    { index: 21, name: 'Agni',        quality: 'inauspicious' },
    { index: 22, name: 'Brahma',      quality: 'auspicious'   },
    { index: 23, name: 'Chandra',     quality: 'auspicious'   },
    { index: 24, name: 'Aditi',       quality: 'auspicious'   },
    { index: 25, name: 'Brihaspati',  quality: 'auspicious'   },
    { index: 26, name: 'Vishnu',      quality: 'auspicious'   },
    { index: 27, name: 'Surya',       quality: 'auspicious'   },
    { index: 28, name: 'Tvashta',     quality: 'auspicious'   },
    { index: 29, name: 'Samirana',    quality: 'auspicious'   },
  ];

  const result = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);
  const allSlots = [...result.day, ...result.night];

  for (const expected of EXPECTED) {
    it(`slot ${expected.index} (${expected.name}) → ${expected.quality}`, () => {
      const slot = allSlots[expected.index]!;
      expect(slot.index).toBe(expected.index);
      expect(slot.name).toBe(expected.name);
      expect(slot.quality).toBe(expected.quality);
    });
  }
});

describe('computeDoGhati — name sequence is fixed (no weekday rotation)', () => {
  // Independence-of-weekday is a stronger statement than the function
  // signature alone (no varaIndex parameter); this test simply documents
  // that successive calls with the same sunrise / sunset triplet always
  // produce the same name sequence.
  it('two computations with identical inputs produce identical name sequences', () => {
    const r1 = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);
    const r2 = computeDoGhati(SUNRISE, SUNSET, NEXT_SUNRISE, nameResolver, qualityNameResolver);

    expect(r1.day.map(s => s.name)).toEqual(r2.day.map(s => s.name));
    expect(r1.night.map(s => s.name)).toEqual(r2.night.map(s => s.name));
  });
});
