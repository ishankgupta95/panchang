import { nakshatraOf } from '../utils/constants';
import type { RashiInfo, NakshatraIndexInfo } from '../types/elements';

export function computeChandraRashi(
  siderealMoon: number,
  nameFn: (index: number) => string,
): RashiInfo {
  const index = Math.floor(siderealMoon / 30);
  return { index, name: nameFn(index) };
}

export function computeSuryaNakshatra(
  siderealSun: number,
  nameFn: (index: number) => string,
): NakshatraIndexInfo {
  const index = nakshatraOf(siderealSun);
  return { index, name: nameFn(index) };
}
