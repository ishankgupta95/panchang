import { normalize360 } from '../utils/angle';
import { KARANA_SPAN } from '../utils/constants';
import type { KaranaInfo } from '../types/elements';

/**
 * Karana = half-Tithi = 6° of Moon-Sun elongation. 60 Karanas per lunar month.
 *
 * Mapping:
 *   index 0:       Kimstughna (fixed)
 *   index 1–56:    7-Karana movable cycle (Bava→Vishti, repeating 8 times)
 *   index 57–59:   Shakuni, Chatushpada, Naga (fixed)
 */
export function computeKaranaFromLongitudes(
  siderealMoon: number,
  siderealSun: number,
  name: string,
): KaranaInfo {
  const angle = normalize360(siderealMoon - siderealSun);
  const index = Math.floor(angle / KARANA_SPAN);
  const elapsed = angle - index * KARANA_SPAN;
  const completionPercentage = (elapsed / KARANA_SPAN) * 100;
  return {
    index,
    name,
    type: getKaranaType(index),
    completionPercentage: Math.round(completionPercentage * 100) / 100,
    endTime: null,
  };
}

export function getKaranaType(index: number): 'fixed' | 'movable' {
  return index === 0 || index >= 57 ? 'fixed' : 'movable';
}

export function getKaranaIndexAtTime(
  date: Date,
  getCachedMoon: (d: Date) => number,
  getCachedSun: (d: Date) => number,
): number {
  const angle = normalize360(getCachedMoon(date) - getCachedSun(date));
  return Math.floor(angle / KARANA_SPAN);
}

/** Direct longitude → index. Used by the orchestrator at sunrise. */
export function getKaranaIndex(siderealMoon: number, siderealSun: number): number {
  return Math.floor(normalize360(siderealMoon - siderealSun) / KARANA_SPAN);
}
