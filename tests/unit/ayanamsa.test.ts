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

  // Phase 29-6: True Chitrapaksha + Thirukanitham additions.
  it('True Chitrapaksha at J2000 ≈ Lahiri − 0.0006°', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    const lahiri = computeAyanamsa(date, 'lahiri');
    const trueChitra = computeAyanamsa(date, 'true-chitra');
    expect(trueChitra).toBeCloseTo(lahiri - 0.0006, 4);
  });

  it('Thirukanitham at J2000 ≈ 23.8717° (Tamil Vakya tradition)', () => {
    const result = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'thirukanitham');
    expect(result).toBeCloseTo(23.8717, 3);
  });

  it('All five ayanamsas advance with the same precession rate', () => {
    const t0 = new Date('2000-01-01T00:00:00Z');
    const t1 = new Date('2050-01-01T00:00:00Z');
    const dy = 50;
    const expectedDelta = (5029.0966 / 3600) * (dy / 100); // arcsec → degrees over 50 yr
    for (const sys of ['lahiri', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const) {
      const delta = computeAyanamsa(t1, sys) - computeAyanamsa(t0, sys);
      expect(delta).toBeCloseTo(expectedDelta, 1);
    }
  });
});
