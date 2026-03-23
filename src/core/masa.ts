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
const MASA_NAMES_EN = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka',
  'Simha', 'Kanya', 'Tula', 'Vrischika',
  'Dhanus', 'Makara', 'Kumbha', 'Meena',
] as const;

export function computeMasa(siderealSunLon: number): MasaInfo {
  const index = Math.floor(siderealSunLon / 30);
  return {
    index,
    name: MASA_NAMES_EN[index]!,
  };
}
