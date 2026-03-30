import type { ChandraMasaInfo } from '../types/elements';

/** Mean synodic month in days */
const SYNODIC_MONTH = 29.53059;
/** Julian year in days */
const TROPICAL_YEAR = 365.25;

/**
 * Compute the current Chandra Masa (Hindu lunar month) from sidereal longitudes.
 *
 * The Amanta (South-Indian) month is named after the nakshatra in which
 * the Purnima (full moon) of that month typically falls.  The Amavasya
 * that initiates a month falls one rashi behind the month's name:
 *   Sun in Meena at Amavasya  → Chaitra (index 0)
 *   Sun in Mesha at Amavasya  → Vaishakha (index 1)
 *   …
 *   Sun in Kumbha at Amavasya → Phalguna (index 11)
 *
 * Adhika Masa (intercalary month): when two consecutive Amavasyas fall within
 * the same solar month the first initiates an Adhika (extra) month and the
 * second the regular (Nija) month.
 *
 * Purnimanta (North-Indian) month starts at the previous full moon, so during
 * Krishna Paksha the Purnimanta name runs one month ahead of the Amanta name.
 *
 * @param siderealSun   Sidereal Sun longitude at the reference instant (degrees).
 * @param siderealMoon  Sidereal Moon longitude at the reference instant (degrees).
 * @param nameFn        Callback that returns a translated month name for an index.
 */
export function computeChandraMasa(
  siderealSun: number,
  siderealMoon: number,
  nameFn: (index: number, isAdhika: boolean) => string,
): ChandraMasaInfo {
  // Moon–Sun elongation in [0, 360)
  const elongation = ((siderealMoon - siderealSun) + 360) % 360;

  // ── Previous Amavasya ────────────────────────────────
  const daysElapsed = (elongation / 360) * SYNODIC_MONTH;
  // Sun moves ~360°/year; subtract the degrees it has travelled since new moon
  const sunAtPrevNewMoon = ((siderealSun - (daysElapsed / TROPICAL_YEAR) * 360) + 36000) % 360;
  const solarMonthAtPrev = Math.floor(sunAtPrevNewMoon / 30);

  // ── Next Amavasya ────────────────────────────────────
  const daysUntilNext = SYNODIC_MONTH - daysElapsed;
  const sunAtNextNewMoon = (siderealSun + (daysUntilNext / TROPICAL_YEAR) * 360) % 360;
  const solarMonthAtNext = Math.floor(sunAtNextNewMoon / 30);

  // Adhika: both Amavasyas land in the same solar month
  const isAdhika = solarMonthAtPrev === solarMonthAtNext;

  const index = (solarMonthAtPrev + 1) % 12;
  const name = nameFn(index, isAdhika);

  // ── Purnimanta ───────────────────────────────────────
  // In Krishna Paksha (elongation ≥ 180°) the Purnimanta month is
  // already one month ahead of the Amanta month.
  const isKrishnaPaksha = elongation >= 180;
  const purnimantaIndex = isKrishnaPaksha ? (index + 1) % 12 : index;
  const purnimantaName = nameFn(purnimantaIndex, false);

  return { index, name, isAdhika, purnimantaIndex, purnimantaName };
}
