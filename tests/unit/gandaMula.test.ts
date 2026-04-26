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
      expect(r.active).toBe(true);
      expect(r.nakshatraName).toBe(name);
      expect(r.severity).toBe(severity);
    });
  }
});

describe('computeGandaMula — non-Ganda-Mula nakshatras', () => {
  // Two explicit negative fixtures requested by the spec.
  it('Bharani (1) → not active, no name/severity', () => {
    const r = computeGandaMula(1);
    expect(r.active).toBe(false);
    expect(r.nakshatraName).toBeUndefined();
    expect(r.severity).toBeUndefined();
  });

  it('Anuradha (16) → not active, no name/severity', () => {
    const r = computeGandaMula(16);
    expect(r.active).toBe(false);
    expect(r.nakshatraName).toBeUndefined();
    expect(r.severity).toBeUndefined();
  });

  it('all 21 non-root nakshatras return active: false', () => {
    const rootSet = new Set([0, 8, 9, 17, 18, 26]);
    let nonActive = 0;
    for (let i = 0; i < 27; i++) {
      if (rootSet.has(i)) continue;
      const r = computeGandaMula(i);
      expect(r.active).toBe(false);
      expect(r.nakshatraName).toBeUndefined();
      expect(r.severity).toBeUndefined();
      nonActive++;
    }
    expect(nonActive).toBe(21);
  });
});

describe('computeGandaMula — i18n', () => {
  it('en (default) returns Sanskrit transliteration', () => {
    expect(computeGandaMula(18).nakshatraName).toBe('Mula');
    expect(computeGandaMula(0, 'en').nakshatraName).toBe('Ashwini');
  });

  it('hi returns Devanagari', () => {
    expect(computeGandaMula(18, 'hi').nakshatraName).toBe('मूल');
    expect(computeGandaMula(17, 'hi').nakshatraName).toBe('ज्येष्ठा');
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
      if (computeGandaMula(i).severity === 'severe') severe++;
    }
    expect(severe).toBe(2);
  });
});
