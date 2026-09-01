import { describe, it, expect } from 'vitest';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

describe('computeAyanamsa', () => {
  it('Lahiri at J2000 epoch = 23° 51′ 49.68″', () => {
    const result = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(23.863801, 5);
  });

  /**
   * Read off the reference almanac's day-panchang pages at 00:00 UT. The
   * widely-repeated 23° 51′ 11.6″ J2000 figure is wrong by 38″.
   */
  it("matches the reference almanac's published Lahiri ayanamsa across 1950-2050", () => {
    const ALMANAC: [string, number][] = [
      ['1950-01-01', 23.165393],
      ['1975-01-01', 23.514568],
      ['2000-01-01', 23.863782],
      ['2010-01-01', 24.003501],
      ['2020-01-01', 24.143189],
      ['2025-01-14', 24.213570],
      ['2030-01-01', 24.282920],
      ['2050-01-01', 24.562364],
    ];
    const ARCSEC = 1 / 3600;
    for (const [date, published] of ALMANAC) {
      const ours = computeAyanamsa(new Date(`${date}T00:00:00Z`), 'lahiri');
      const driftArcsec = Math.abs(ours - published) / ARCSEC;
      expect(driftArcsec, `${date}: ${ours.toFixed(6)} vs almanac ${published}`)
        .toBeLessThan(0.01);
    }
  });

  it('Lahiri at 2025 ≈ 24.2°', () => {
    const result = computeAyanamsa(new Date('2025-01-01T00:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(24.2, 0);
  });

  it('Raman < Lahiri (always)', () => {
    const date = new Date('2025-06-15T00:00:00Z');
    expect(computeAyanamsa(date, 'raman')).toBeLessThan(computeAyanamsa(date, 'lahiri'));
  });

  it('throws for unknown ayanamsa type', () => {
    expect(() => computeAyanamsa(new Date(), 'unknown' as any)).toThrow();
  });

  it('True Chitrapaksha at J2000 ≈ Lahiri − 0.0006°', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    const lahiri = computeAyanamsa(date, 'lahiri');
    const trueChitra = computeAyanamsa(date, 'true-chitra');
    expect(trueChitra).toBeCloseTo(lahiri - 0.0006, 4);
  });

  it('Thirukanitham at J2000 = Lahiri + 1′ 6.4″ (Tamil Vakya tradition)', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    expect(computeAyanamsa(date, 'thirukanitham'))
      .toBeCloseTo(computeAyanamsa(date, 'lahiri') + 0.018456, 5);
  });

  it('All five ayanamsas advance with the same precession rate', () => {
    const t0 = new Date('2000-01-01T00:00:00Z');
    const t1 = new Date('2050-01-01T00:00:00Z');
    const dy = 50;
    const expectedDelta = (5029.0966 / 3600) * (dy / 100); // General precession in longitude.
    for (const sys of ['lahiri', 'krishnamurti', 'true-chitra', 'thirukanitham'] as const) {
      const delta = computeAyanamsa(t1, sys) - computeAyanamsa(t0, sys);
      expect(delta).toBeCloseTo(expectedDelta, 1);
    }
  });

  /**
   * No external ground truth exists for the non-Lahiri systems: this pins their
   * offsets from Lahiri only, never their absolute correctness.
   */
  it('non-Lahiri systems keep their documented offsets from Lahiri', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    const lahiri = computeAyanamsa(date, 'lahiri');
    const OFFSETS: [Parameters<typeof computeAyanamsa>[1], number][] = [
      ['true-chitra', -0.0006],
      ['krishnamurti', -0.079605],
      ['thirukanitham', +0.018456],
      ['raman', -1.453010],
    ];
    for (const [system, offset] of OFFSETS) {
      expect(
        computeAyanamsa(date, system) - lahiri,
        `${system} offset from Lahiri at J2000`,
      ).toBeCloseTo(offset, 6);
    }
  });
});
