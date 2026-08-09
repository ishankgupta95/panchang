import { describe, it, expect } from 'vitest';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

describe('computeAyanamsa', () => {
  it('Lahiri at J2000 epoch = 23° 51′ 49.68″', () => {
    const result = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'lahiri');
    expect(result).toBeCloseTo(23.863801, 5);
  });

  /**
   * The load-bearing test for every sidereal output in the library.
   *
   * DrikPanchang publishes its Lahiri ayanamsa to six decimals on each
   * day-panchang page; these are read off directly, at 00:00 UT for the given
   * date. They are external ground truth, not a regeneration of our own output,
   * and they pin both the J2000 constant *and* the precession polynomial —
   * a century-wide baseline is enough that no single wrong constant plus wrong
   * rate could fit all eight.
   *
   * This previously read `≈ 23.853°`, which came from the widely-repeated but
   * incorrect 23° 51′ 11.6″ figure and left the library 38″ behind Drik.
   */
  it("matches DrikPanchang's published Lahiri ayanamsa across 1950-2050", () => {
    const DRIK: [string, number][] = [
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
    for (const [date, published] of DRIK) {
      const ours = computeAyanamsa(new Date(`${date}T00:00:00Z`), 'lahiri');
      const driftArcsec = Math.abs(ours - published) / ARCSEC;
      expect(driftArcsec, `${date}: ${ours.toFixed(6)} vs Drik ${published}`)
        .toBeLessThan(0.01);
    }
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

  it('Thirukanitham at J2000 = Lahiri + 1′ 6.4″ (Tamil Vakya tradition)', () => {
    // Tracks Lahiri by a fixed offset, so correcting the Lahiri base moved this
    // with it. Drik publishes no Thirukanitham value to check against directly;
    // the offset is what the library has always encoded.
    const date = new Date('2000-01-01T12:00:00Z');
    expect(computeAyanamsa(date, 'thirukanitham'))
      .toBeCloseTo(computeAyanamsa(date, 'lahiri') + 0.018456, 5);
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

  /**
   * Only Lahiri is verified against an external reference — DrikPanchang
   * publishes a Lahiri value and offers **no ayanamsa setting at all**, so
   * there is no Drik ground truth for the other four. What the library does
   * encode is each system's *offset from Lahiri*, and that is what this pins.
   *
   * The point is to stop the offsets drifting silently. When the Lahiri base
   * was corrected by +38″ to match Drik, these four had to move with it or
   * their documented relationships would have changed as a side effect; this
   * test is what makes that non-negotiable rather than a matter of noticing.
   *
   * Do not read a passing test here as evidence that KP / Raman / True-Chitra /
   * Thirukanitham are correct in absolute terms. They are traditional offsets
   * carried forward, and verifying them needs a source this project does not
   * currently have.
   */
  it('non-Lahiri systems keep their documented offsets from Lahiri', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    const lahiri = computeAyanamsa(date, 'lahiri');
    const OFFSETS: [Parameters<typeof computeAyanamsa>[1], number][] = [
      ['true-chitra', -0.0006],
      ['krishnamurti', -0.079605],
      ['thirukanitham', +0.018456],
      ['raman', -1.392722],
    ];
    for (const [system, offset] of OFFSETS) {
      expect(
        computeAyanamsa(date, system) - lahiri,
        `${system} offset from Lahiri at J2000`,
      ).toBeCloseTo(offset, 6);
    }
  });
});
