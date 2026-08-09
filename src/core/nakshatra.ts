import { NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, nakshatraOf } from '../utils/constants';
import type { NakshatraInfo } from '../types/elements';

/**
 * Nakshatra = sidereal Moon position divided into 27 equal parts of 13°20'.
 *
 * Formula:
 *   nakshatraIndex = floor(siderealMoon / 13.3333)
 *   pada = floor((siderealMoon mod 13.3333) / 3.3333) + 1
 */
export function computeNakshatraFromLongitude(
  siderealMoon: number,
  name: string,
): NakshatraInfo {
  const index = nakshatraOf(siderealMoon);
  const degreesInNakshatra = siderealMoon - index * NAKSHATRA_SPAN;
  const pada = Math.min(Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1, 4);
  const completionPercentage = (degreesInNakshatra / NAKSHATRA_SPAN) * 100;
  return {
    index,
    name,
    pada,
    degreesInNakshatra: Math.round(degreesInNakshatra * 10000) / 10000,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getNakshatraIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
): number {
  return nakshatraOf(getCachedMoon(date));
}
