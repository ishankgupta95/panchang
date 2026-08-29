import type { MasaInfo } from '../types/panchang';

/** Saura Masa: 0 = Mesha … 11 = Meena. */
export function computeMasa(
  siderealSunLon: number,
  nameResolver: (index: number) => string,
): MasaInfo {
  const index = Math.floor(siderealSunLon / 30);
  return {
    index,
    name: nameResolver(index),
  };
}
