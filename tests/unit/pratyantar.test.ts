/**
 * Unit tests for `computeVimshottariPratyantar` — third (sub-sub) level of
 * the Vimshottari hierarchy.
 */

import { describe, it, expect } from 'vitest';
import {
  computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar,
  DASHA_ORDER,
  DASHA_YEARS,
} from '../../src/jyotish/dasha';

describe('computeVimshottariPratyantar', () => {
  const birthDate = new Date('1990-06-15T10:30:00Z');
  const dasha = computeVimshottariDashaFromBirth(birthDate);
  const sampleAntardasha = dasha.mahaDashas[1]!.antarDashas[2]!;

  it('returns 9 pratyantars in cycle order starting from antardasha lord', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    expect(ps).toHaveLength(9);
    const startIdx = DASHA_ORDER.indexOf(sampleAntardasha.lord);
    for (let i = 0; i < 9; i++) {
      expect(ps[i]!.lord).toBe(DASHA_ORDER[(startIdx + i) % 9]);
    }
  });

  it('pratyantars are contiguous and span the full antardasha', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    expect(ps[0]!.startDate.getTime()).toBe(sampleAntardasha.startDate.getTime());
    expect(ps[8]!.endDate.getTime()).toBe(sampleAntardasha.endDate.getTime());
    for (let i = 1; i < 9; i++) {
      expect(ps[i]!.startDate.getTime()).toBe(ps[i - 1]!.endDate.getTime());
    }
  });

  it('pratyantar duration is proportional to (lord_years / 120) × antardasha duration', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    const antardashaMs = sampleAntardasha.endDate.getTime() - sampleAntardasha.startDate.getTime();
    for (const p of ps) {
      const expected = (DASHA_YEARS[p.lord] / 120) * antardashaMs;
      const actual = p.endDate.getTime() - p.startDate.getTime();
      expect(actual / expected).toBeCloseTo(1, 9);
    }
  });

  it('pratyantar durations sum to antardasha duration', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    const antardashaMs = sampleAntardasha.endDate.getTime() - sampleAntardasha.startDate.getTime();
    const totalMs = ps.reduce((s, p) => s + (p.endDate.getTime() - p.startDate.getTime()), 0);
    expect(totalMs / antardashaMs).toBeCloseTo(1, 9);
  });

  it('throws on invalid antardasha lord', () => {
    expect(() =>
      computeVimshottariPratyantar({
        // @ts-expect-error — testing runtime guard
        lord: 'NotALord',
        startDate: new Date(),
        endDate: new Date(),
      }),
    ).toThrow();
  });
});
