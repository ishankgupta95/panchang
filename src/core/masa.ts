import type { MasaInfo } from '../types/panchang';

/**
 * Hindu solar month (Saura Masa) based on Sun's sidereal longitude.
 * Each 30° of sidereal Sun = one Masa.
 *
 * 0 = Mesha (roughly Apr-May),  1 = Vrishabha, ..., 11 = Meena
 *
 * This is the solar month (Saura). Lunar month (Chandramana) is more complex
 * and can be added in a future version.
 */
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
