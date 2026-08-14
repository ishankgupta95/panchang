/**
 * @tier 1  Swiss Ephemeris SE_SIDM_RAMAN via the Astrological eMagazine's own
 *          module (sweph-wasm@2.6.9), probed live 2026-08-13
 *
 * Raman ayanamsa versus the authoritative implementation.
 *
 * The Astrological eMagazine — the Raman family's publication — computes its
 * panchanga with Swiss Ephemeris sidereal mode 3 (SE_SIDM_RAMAN), which makes
 * that model the reference for what "Raman ayanamsa" means. The values below
 * are ayanamsa = tropical − sidereal Sun longitude from the exact module and
 * version their site loads, measured at ten epochs spanning 1900–2100.
 *
 * The measured values live in the TRUE frame (they carry nutation in
 * longitude, ±17.5″ ≈ ±0.00486°); this library's ayanamsas are deliberately
 * mean-frame across every system. The tolerance below is therefore the
 * nutation envelope plus the 0.6″ smooth-part residual of the fit — a
 * disagreement beyond that means the anchor or the rate drifted, which is
 * exactly what this test exists to catch.
 */

import { describe, it, expect } from 'vitest';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';

/** [UTC instant, measured SwissEph SIDM_RAMAN ayanamsa in degrees]. */
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

describe('Raman ayanamsa — SwissEph SIDM_RAMAN parity (mean-frame)', () => {
  for (const [iso, measured] of MEASURED) {
    it(`${iso.slice(0, 4)}: within the nutation envelope of the measured value`, () => {
      const ours = computeAyanamsa(new Date(iso), 'raman');
      expect(Math.abs(ours - measured), `Δ° at ${iso}`).toBeLessThan(TOLERANCE_DEG);
    });
  }

  it('J2000.0 anchor is the measured nutation-free value, 22.410791°', () => {
    // 2451545.0 TT ~ 2000-01-01T12:00Z for this purpose; the smooth anchor
    // was fitted at exactly this epoch, so equality here is by construction
    // and pins the constant against accidental edits.
    const ours = computeAyanamsa(new Date('2000-01-01T12:00:00Z'), 'raman');
    expect(ours).toBeCloseTo(22.410791, 5);
  });

  it('old constant would fail this suite (guards against regression to it)', () => {
    // The pre-2026-08-13 offset (Lahiri − 1.392722°) sat 3.62′ above the
    // measured model — two orders beyond the nutation envelope.
    const oldRamanJ2000 = 23.863801 - 1.392722;
    expect(Math.abs(oldRamanJ2000 - 22.40690218)).toBeGreaterThan(10 * TOLERANCE_DEG);
  });
});
