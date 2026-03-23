import { Body, MakeTime, SunPosition } from 'astronomy-engine';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

// Body is imported to keep the public API consistent with the rest of astronomy layer
void Body;

/**
 * Sidereal longitude of the Sun at a given UTC instant.
 * Returns degrees in range [0, 360).
 *
 * Uses SunPosition() for the geocentric ecliptic longitude of the Sun.
 * EclipticLongitude(Body.Sun) is not valid — the Sun has no heliocentric longitude.
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
