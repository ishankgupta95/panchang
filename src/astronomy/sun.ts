import { Body, MakeTime, SunPosition } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

// Body is imported to keep the public API consistent with the rest of astronomy layer
void Body;

/**
 * Sidereal longitude of the Sun at a given UTC instant.
 *
 * Uses SunPosition() for the geocentric ecliptic longitude of the Sun.
 * EclipticLongitude(Body.Sun) is not valid — the Sun has no heliocentric longitude.
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system: `'lahiri'` (default in most APIs),
 *                      `'raman'`, or `'krishnamurti'`.
 * @returns             Sidereal longitude in degrees, normalized to [0, 360).
 *
 * @example
 * ```typescript
 * import { getSiderealSunLongitude } from 'panchang-ts';
 * const lon = getSiderealSunLongitude(new Date('2025-01-14T12:00:00Z'), 'lahiri');
 * // ~269.3° — Sun in Makara (Capricorn) rashi
 * ```
 */
export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  const astroTime = MakeTime(date);
  const tropicalLon = SunPosition(astroTime).elon;
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalLon - ayanamsa);
}

/**
 * Tropical (geocentric ecliptic) longitude of the Sun.
 * Exposed for consumers who want to apply their own ayanamsa.
 */
export function getTropicalSunLongitude(date: Date): number {
  return SunPosition(MakeTime(date)).elon;
}
