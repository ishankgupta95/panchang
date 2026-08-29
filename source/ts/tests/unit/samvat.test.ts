// The 56/57 and 78/79 offsets both apply: which one depends on whether the
// date falls before or after the Hindu new year.

import { describe, it, expect } from 'vitest';
import { computeSamvat } from '../../src/core/samvat';

describe('computeSamvat', () => {
  it('Jan 14, 2025 → VS 2081, SS 1946', () => {
    const date = new Date('2025-01-14T06:00:00Z');
    const result = computeSamvat(date);
    expect(result.vikramSamvat).toBe(2081);
    expect(result.shakaSamvat).toBe(1946);
  });

  it('Jan 1, 2025 → VS 2081, SS 1946', () => {
    const date = new Date('2025-01-01T06:00:00Z');
    const result = computeSamvat(date);
    expect(result.vikramSamvat).toBe(2081);
    expect(result.shakaSamvat).toBe(1946);
  });

  it('Apr 15, 2025 (after Hindu new year) → VS 2082, SS 1947', () => {
    const date = new Date('2025-04-15T06:00:00Z');
    const result = computeSamvat(date);
    expect(result.vikramSamvat).toBe(2082);
    expect(result.shakaSamvat).toBe(1947);
  });

  it('Dec 31, 2024 → VS 2081, SS 1946', () => {
    const date = new Date('2024-12-31T06:00:00Z');
    const result = computeSamvat(date);
    expect(result.vikramSamvat).toBe(2081);
    expect(result.shakaSamvat).toBe(1946);
  });

  it('returned values are positive integers', () => {
    for (const year of [2020, 2025, 2030, 2050]) {
      const date = new Date(`${year}-06-15T06:00:00Z`);
      const result = computeSamvat(date);
      expect(Number.isInteger(result.vikramSamvat)).toBe(true);
      expect(Number.isInteger(result.shakaSamvat)).toBe(true);
      expect(result.vikramSamvat).toBeGreaterThan(0);
      expect(result.shakaSamvat).toBeGreaterThan(0);
    }
  });

  it('VS is always ~57 more than CE', () => {
    const date = new Date('2025-06-15T06:00:00Z');
    const result = computeSamvat(date);
    const diff = result.vikramSamvat - 2025;
    expect(diff).toBeGreaterThanOrEqual(56);
    expect(diff).toBeLessThanOrEqual(57);
  });

  it('SS is always ~78 less than CE', () => {
    const date = new Date('2025-06-15T06:00:00Z');
    const result = computeSamvat(date);
    const diff = 2025 - result.shakaSamvat;
    expect(diff).toBeGreaterThanOrEqual(78);
    expect(diff).toBeLessThanOrEqual(79);
  });
});
