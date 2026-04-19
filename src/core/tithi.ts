import { normalize360 } from '../utils/angle';
import { TITHI_SPAN } from '../utils/constants';
import type { TithiInfo } from '../types/elements';

/**
 * Compute the Tithi at a given instant from pre-computed sidereal longitudes.
 *
 * Formula:
 *   tithiAngle = normalize360(moonLon - sunLon)
 *   tithiIndex = floor(tithiAngle / 12)
 *
 * Indices 0–14  = Shukla Paksha (Pratipada to Purnima)
 * Indices 15–29 = Krishna Paksha (Pratipada to Amavasya)
 */
export function computeTithiFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,
  paksha: string,
): TithiInfo {
  const angle = normalize360(siderealMoon - siderealSun);
  const index = Math.floor(angle / TITHI_SPAN);
  const elapsed = angle - index * TITHI_SPAN;
  const completionPercentage = (elapsed / TITHI_SPAN) * 100;
  const number = index < 15 ? index + 1 : index - 14;
  return {
    index,
    name,
    paksha,
    number,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

/**
 * Get the Tithi index at a given UTC instant.
 * Used as the callback for binary search.
 */
export function getTithiIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const angle = normalize360(getCachedMoon(date) - getCachedSun(date));
  return Math.floor(angle / TITHI_SPAN);
}

/** Direct longitude → index (no Date needed). Used by the orchestrator at sunrise. */
export function getTithiIndexFromLons(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealMoon - siderealSun) / TITHI_SPAN);
}
