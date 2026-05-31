import type { ChandraMasaInfo } from '../types/elements';
import type { MasaSystem } from '../types/options';
import { boundingNewMoons } from '../astronomy/newMoon';

/**
 * Compute the current Chandra Masa (Hindu lunar month).
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
 * The masa identity (index + Adhika status) is derived from the **actual** new
 * moons bounding the current lunar month — found via {@link boundingNewMoons}
 * and the sidereal Sun rashi at each — not from mean-motion estimates. Mean
 * motion overshoots the Sankranti boundary near aphelion (June/July), exactly
 * when Adhika Jyeshtha/Ashadha occur, which previously produced false-negative,
 * day-to-day-flickering `isAdhika` values within a single Adhika month.
 *
 * Purnimanta (North-Indian) month starts at the previous full moon, so during
 * Krishna Paksha the Purnimanta name runs one month ahead of the Amanta name.
 *
 * @param siderealSun   Sidereal Sun longitude at the reference instant (degrees).
 * @param siderealMoon  Sidereal Moon longitude at the reference instant (degrees).
 * @param nameFn        Callback that returns a translated month name for an index.
 * @param system        `'purnimanta'` (default) or `'amanta'` — controls which
 *                      system the primary `index`/`name` fields represent.
 * @param refDate       Reference instant (UTC) — used to locate the bounding new moons.
 * @param getSiderealSun  Returns the sidereal Sun longitude (degrees) at a given instant.
 */
export function computeChandraMasa(
  siderealSun: number,
  siderealMoon: number,
  nameFn: (index: number, isAdhika: boolean) => string,
  system: MasaSystem = 'purnimanta',
  refDate: Date,
  getSiderealSun: (d: Date) => number,
): ChandraMasaInfo {
  // Moon–Sun elongation in [0, 360)
  const elongation = ((siderealMoon - siderealSun) + 360) % 360;

  // ── Bounding Amavasyas of the current lunar month ────
  // Use the true new-moon instants and the sidereal Sun rashi at each.
  const { prev, next } = boundingNewMoons(refDate);
  const sunAtPrevNewMoon = ((getSiderealSun(prev) % 360) + 360) % 360;
  const sunAtNextNewMoon = ((getSiderealSun(next) % 360) + 360) % 360;
  const solarMonthAtPrev = Math.floor(sunAtPrevNewMoon / 30);
  const solarMonthAtNext = Math.floor(sunAtNextNewMoon / 30);

  // Adhika: both bounding Amavasyas land in the same solar month
  // (no Sankranti occurs between them).
  const isAdhika = solarMonthAtPrev === solarMonthAtNext;

  const amantaIndex = (solarMonthAtPrev + 1) % 12;
  const amantaName = nameFn(amantaIndex, isAdhika);

  // ── Purnimanta ───────────────────────────────────────
  // In Krishna Paksha (elongation ≥ 180°) the Purnimanta month is
  // already one month ahead of the Amanta month.
  const isKrishnaPaksha = elongation >= 180;
  const purnimantaIndex = isKrishnaPaksha ? (amantaIndex + 1) % 12 : amantaIndex;
  const purnimantaName = nameFn(purnimantaIndex, false);

  // Primary index/name follows the selected system
  const index = system === 'amanta' ? amantaIndex : purnimantaIndex;
  const name = system === 'amanta' ? amantaName : purnimantaName;

  return { index, name, isAdhika, system, amantaIndex, amantaName, purnimantaIndex, purnimantaName };
}
