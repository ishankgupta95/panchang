import { Ecliptic, GeoMoon, MakeTime } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

/**
 * Sidereal longitude of the Moon at a given UTC instant.
 * Returns degrees in range [0, 360).
 *
 * Uses Ecliptic(GeoMoon(t)).elon for the geocentric ecliptic longitude.
 * EclipticLongitude(Body.Moon) returns heliocentric longitude, which is
 * inappropriate for panchang calculations.
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
