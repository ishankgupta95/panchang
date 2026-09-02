import { normalize360 } from '../utils/angle';
import { YOGA_SPAN } from '../utils/constants';
import type { YogaInfo } from '../types/elements';

export function computeYogaFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,
): YogaInfo {
  const angle = normalize360(siderealSun + siderealMoon);
  const index = Math.floor(angle / YOGA_SPAN);
  const elapsed = angle - index * YOGA_SPAN;
  const completionPercentage = (elapsed / YOGA_SPAN) * 100;
  return {
    index,
    name,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getYogaIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const angle = normalize360(getCachedSun(date) + getCachedMoon(date));
  return Math.floor(angle / YOGA_SPAN);
}

export function getYogaIndex(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealSun + siderealMoon) / YOGA_SPAN);
}
