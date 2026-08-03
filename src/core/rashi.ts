import { nakshatraOf } from '../utils/constants';
import type { RashiInfo } from '../types/elements';

/**
 * Compute Chandra Rashi — the Moon's sidereal zodiac sign.
 *
 * The ecliptic is divided into 12 equal signs of 30° each, starting from
 * Mesha (Aries).  This is a coarser view than Nakshatra (27 × 13.33°) and
 * is the primary sign used in natal Jyotish charts.
 *
 * @param siderealMoon  Moon's sidereal longitude in degrees [0, 360).
 * @param nameFn        Callback returning the translated Rashi name for an index.
 */
export function computeChandraRashi(
  siderealMoon: number,
  nameFn: (index: number) => string,
): RashiInfo {
  const index = Math.floor(siderealMoon / 30);
  return { index, name: nameFn(index) };
}

/**
 * Compute the Sun's current Nakshatra (Surya Nakshatra).
 *
 * The Sun moves through one Nakshatra in roughly 13–14 days.  The result
 * uses the same Nakshatra list as the Moon-based Nakshatra calculation.
 *
 * @param siderealSun  Sun's sidereal longitude in degrees [0, 360).
 * @param nameFn       Callback returning the translated Nakshatra name for an index.
 */
export function computeSuryaNakshatra(
  siderealSun: number,
  nameFn: (index: number) => string,
): RashiInfo {
  const index = nakshatraOf(siderealSun);
  return { index, name: nameFn(index) };
}
