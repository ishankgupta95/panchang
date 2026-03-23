import { describe, it, expect } from 'vitest';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

describe('computeAyanamsa', () => {
  it('Lahiri at J2000 epoch ≈ 23.853°', () => {
    const result = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(23.853, 2);
  });

  it('Lahiri at 2025 ≈ 24.2°', () => {
    const result = computeAyanamsa(new Date('2025-01-01T00:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(24.2, 0); // ±0.5° tolerance for now
  });

  it('Raman < Lahiri (always)', () => {
    const date = new Date('2025-06-15T00:00:00Z');
    expect(computeAyanamsa(date, 'raman')).toBeLessThan(computeAyanamsa(date, 'lahiri'));
  });

  it('throws for unknown ayanamsa type', () => {
    expect(() => computeAyanamsa(new Date(), 'unknown' as any)).toThrow();
  });
});
