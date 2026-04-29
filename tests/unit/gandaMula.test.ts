/**
 * Unit tests for Ganda Mula — Moon-in-root-nakshatra detection.
 *
 * Classical reference (Muhurta-chintamani Ch. 4 / BPHS Ch. 71): the 6 root
 * (gaṇḍānta-mūla) nakshatras are inauspicious for new beginnings. Mula and
 * Jyeshtha — the Vrischika/Dhanus gaṇḍānta pair — are *severe*; Ashwini,
 * Ashlesha, Magha, Revati are *mild*.
 */

import { describe, it, expect } from 'vitest';
import { computeGandaMula } from '../../src/core/gandaMula';

describe('computeGandaMula — the 6 root nakshatras', () => {
  const cases: Array<{ idx: number; name: string; severity: 'mild' | 'severe' }> = [
    { idx: 0,  name: 'Ashwini',  severity: 'mild' },
    { idx: 8,  name: 'Ashlesha', severity: 'mild' },
    { idx: 9,  name: 'Magha',    severity: 'mild' },
    { idx: 17, name: 'Jyeshtha', severity: 'severe' },
    { idx: 18, name: 'Mula',     severity: 'severe' },
    { idx: 26, name: 'Revati',   severity: 'mild' },
  ];

  for (const { idx, name, severity } of cases) {
    it(`nakshatra ${idx} (${name}) → active, severity=${severity}`, () => {
      const r = computeGandaMula(idx);
      if (!r.active) throw new Error(`expected active at idx ${idx}`);
      expect(r.nakshatraName).toBe(name);
      expect(r.severity).toBe(severity);
    });
  }
});

describe('computeGandaMula — non-Ganda-Mula nakshatras', () => {
  // Discriminated-union shape: when `active === false`, the result has
  // exactly one key (`active`); `nakshatraName` and `severity` are not on
  // the type. The runtime check below pins the shape.
  it('Bharani (1) → inactive shape', () => {
    const r = computeGandaMula(1);
    expect(r.active).toBe(false);
    expect(Object.keys(r).sort()).toEqual(['active']);
  });

  it('Anuradha (16) → inactive shape', () => {
    const r = computeGandaMula(16);
    expect(r.active).toBe(false);
    expect(Object.keys(r).sort()).toEqual(['active']);
  });

  it('all 21 non-root nakshatras return active: false', () => {
    const rootSet = new Set([0, 8, 9, 17, 18, 26]);
    let nonActive = 0;
    for (let i = 0; i < 27; i++) {
      if (rootSet.has(i)) continue;
      const r = computeGandaMula(i);
      expect(r.active).toBe(false);
      expect(Object.keys(r).sort()).toEqual(['active']);
      nonActive++;
    }
    expect(nonActive).toBe(21);
  });
});

describe('computeGandaMula — i18n', () => {
  it('en (default) returns Sanskrit transliteration', () => {
    const r1 = computeGandaMula(18);
    if (!r1.active) throw new Error('Mula should be active');
    expect(r1.nakshatraName).toBe('Mula');
    const r2 = computeGandaMula(0, 'en');
    if (!r2.active) throw new Error('Ashwini should be active');
    expect(r2.nakshatraName).toBe('Ashwini');
  });

  it('hi returns Devanagari', () => {
    const r1 = computeGandaMula(18, 'hi');
    if (!r1.active) throw new Error('Mula should be active');
    expect(r1.nakshatraName).toBe('मूल');
    const r2 = computeGandaMula(17, 'hi');
    if (!r2.active) throw new Error('Jyeshtha should be active');
    expect(r2.nakshatraName).toBe('ज्येष्ठा');
  });
});

describe('computeGandaMula — input validation', () => {
  it('throws RangeError for negative index', () => {
    expect(() => computeGandaMula(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index ≥ 27', () => {
    expect(() => computeGandaMula(27)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer index', () => {
    expect(() => computeGandaMula(3.5)).toThrow(RangeError);
  });
});

describe('computeGandaMula — invariants', () => {
  it('exactly 6 of 27 nakshatras are Ganda Mula', () => {
    let active = 0;
    for (let i = 0; i < 27; i++) {
      if (computeGandaMula(i).active) active++;
    }
    expect(active).toBe(6);
  });

  it('exactly 2 of the 6 are severe (Mula + Jyeshtha)', () => {
    let severe = 0;
    for (let i = 0; i < 27; i++) {
      const r = computeGandaMula(i);
      if (r.active && r.severity === 'severe') severe++;
    }
    expect(severe).toBe(2);
  });
});
