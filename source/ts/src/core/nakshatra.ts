import { NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, nakshatraOf } from '../utils/constants';
import type { NakshatraInfo } from '../types/elements';

export function computeNakshatraFromLongitude(
  siderealMoon: number,
  name: string,
): NakshatraInfo {
  const index = nakshatraOf(siderealMoon);
  const degreesInNakshatra = Math.max(siderealMoon - index * NAKSHATRA_SPAN, 0);
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
