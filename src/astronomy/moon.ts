import { Ecliptic, GeoMoon, MakeTime } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/**
 * Sidereal longitude of the Moon at a given UTC instant.
 *
 * Uses Ecliptic(GeoMoon(t)).elon for the geocentric ecliptic longitude.
 * EclipticLongitude(Body.Moon) returns heliocentric longitude, which is
 * inappropriate for panchang calculations.
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system: `'lahiri'`, `'raman'`, or `'krishnamurti'`.
 * @returns             Sidereal longitude in degrees, normalized to [0, 360).
 *
 * @example
 * ```typescript
 * import { getSiderealMoonLongitude } from 'panchang-ts';
 * const lon = getSiderealMoonLongitude(new Date('2025-01-14T12:00:00Z'), 'lahiri');
 * // ~96.5° — Moon in Karka (Cancer) rashi, Punarvasu nakshatra
 * ```
 */
export function getSiderealMoonLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  const astroTime = MakeTime(date);
  const tropicalLon = Ecliptic(GeoMoon(astroTime)).elon;
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalLon - ayanamsa);
}

/**
 * Tropical (geocentric ecliptic) longitude of the Moon.
 * Exposed for consumers who want to apply their own ayanamsa.
 */
export function getTropicalMoonLongitude(date: Date): number {
  return Ecliptic(GeoMoon(MakeTime(date))).elon;
}
