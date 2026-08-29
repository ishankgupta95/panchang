/**
 * @tier 1  Swiss Ephemeris SE_SIDM_RAMAN via the Astrological eMagazine's own
 *          module (sweph-wasm@2.6.9), probed live 2026-08-13
 *
 * The eMagazine's SwissEph mode 3 defines what "Raman ayanamsa" means. Its
 * values are TRUE-frame (they carry nutation) while this library is mean-frame.
 */

import { describe, it, expect } from 'vitest';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

const MEASURED: readonly (readonly [string, number])[] = [
  ['1900-01-01T00:00:00Z', 21.01907176],
  ['1925-01-01T00:00:00Z', 21.36007860],
  ['1950-01-01T00:00:00Z', 21.71150619],
  ['1975-01-01T00:00:00Z', 22.06625638],
  ['2000-01-01T00:00:00Z', 22.40690218],
  ['2010-01-01T00:00:00Z', 22.55505199],
  ['2026-01-01T00:00:00Z', 22.77550862],
  ['2050-01-01T00:00:00Z', 23.11352617],
  ['2075-01-01T00:00:00Z', 23.45434182],
  ['2100-01-01T00:00:00Z', 23.80888076],
];

/** Nutation envelope (±17.5″) + smooth-part fit residual (0.6″), degrees. */
const TOLERANCE_DEG = (17.5 + 0.6) / 3600;

describe('Raman ayanamsa: SwissEph SIDM_RAMAN parity (mean-frame)', () => {
  for (const [iso, measured] of MEASURED) {
    it(`${iso.slice(0, 4)}: within the nutation envelope of the measured value`, () => {
      const ours = computeAyanamsa(new Date(iso), 'raman');
      expect(Math.abs(ours - measured), `Δ° at ${iso}`).toBeLessThan(TOLERANCE_DEG);
    });
  }

  it('J2000.0 anchor is the measured nutation-free value, 22.410791°', () => {
    // The smooth anchor was fitted at this epoch, so equality is by construction.
    const ours = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'raman');
    expect(ours).toBeCloseTo(22.410791, 5);
  });

  it('old constant would fail this suite (guards against regression to it)', () => {
    // 1.392722° is the literature offset from Lahiri, 3.62′ above the measured model.
    const oldRamanJ2000 = 23.863801 - 1.392722;
    expect(Math.abs(oldRamanJ2000 - 22.40690218)).toBeGreaterThan(10 * TOLERANCE_DEG);
  });
});
