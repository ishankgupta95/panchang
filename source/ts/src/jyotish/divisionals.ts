import { navamsaFromBasis } from './charts';
import { computeNatalBasis, grahaList, type NatalBasis } from './natalBasis';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { Divisional, DivisionalChart, PlanetPlacement } from '../types/jyotish';

/**
 * A divisional (varga) chart per the BPHS Ch. 6 rules, whole-sign anchored to
 * its own divisional lagna.
 */
export function computeDivisionalChart(
  birthDate: Date,
  location: GeoLocation,
  divisional: Divisional,
  options: BirthChartOptions = {},
): DivisionalChart {
  return divisionalChartFromBasis(
    computeNatalBasis(birthDate, location, options),
    divisional,
  );
}

/** @internal */
export function divisionalChartFromBasis(
  basis: NatalBasis,
  divisional: Divisional,
): DivisionalChart {
  if (divisional === 'D9') return navamsaFromBasis(basis);

  const { lang } = basis;
  const transform = transformFor(divisional);
  const divLagnaLon = transform(basis.lagna.siderealLongitude);
  const divLagnaRashi = Math.floor(divLagnaLon / 30);

  const planets: PlanetPlacement[] = grahaList(basis).map(({ key, pos }) => {
    const dLon = transform(pos.siderealLongitude);
    const dRashi = Math.floor(dLon / 30);
    return {
      planet: key,
      longitude: dLon,
      rashi: { index: dRashi, name: resolveMasaName(dRashi, lang) },
      degreeInRashi: dLon - dRashi * 30,
      house: ((dRashi - divLagnaRashi + 12) % 12) + 1,
      isRetrograde: pos.isRetrograde,
    };
  });

  return {
    divisional,
    lagnaRashi: { index: divLagnaRashi, name: resolveMasaName(divLagnaRashi, lang) },
    planets,
  };
}

function transformFor(divisional: Exclude<Divisional, 'D9'>): (lon: number) => number {
  switch (divisional) {
    case 'D2':  return horaLongitude;
    case 'D3':  return drekkanaLongitude;
    case 'D7':  return saptamsaLongitude;
    case 'D10': return dasamsaLongitude;
    case 'D12': return dwadasamsaLongitude;
    case 'D30': return trimsamsaLongitude;
  }
}

function horaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const isOddSign = rashi % 2 === 0;     // Aries (0) is the 1st sign → odd
  const isFirstHalf = degInRashi < 15;
  const goesToSun = isOddSign === isFirstHalf;
  const targetRashi = goesToSun ? 4 /* Leo */ : 3 /* Cancer */;
  const degInHalf = isFirstHalf ? degInRashi : degInRashi - 15;
  const degInTargetRashi = (degInHalf / 15) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DREKKANA_SPAN = 10;
const DREKKANA_OFFSETS = [0, 4, 8] as const;

function drekkanaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(2, Math.floor(degInRashi / DREKKANA_SPAN));
  const targetRashi = (rashi + DREKKANA_OFFSETS[idx]!) % 12;
  const degInSeg = degInRashi - idx * DREKKANA_SPAN;
  const degInTargetRashi = (degInSeg / DREKKANA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const SAPTAMSA_SPAN = 30 / 7;

function saptamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(6, Math.floor(degInRashi / SAPTAMSA_SPAN));
  const startOffset = rashi % 2 === 0 ? 0 : 6;
  const targetRashi = (rashi + startOffset + idx) % 12;
  const degInSeg = degInRashi - idx * SAPTAMSA_SPAN;
  const degInTargetRashi = (degInSeg / SAPTAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DASAMSA_SPAN = 3;

function dasamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(9, Math.floor(degInRashi / DASAMSA_SPAN));
  const startOffset = rashi % 2 === 0 ? 0 : 8;
  const targetRashi = (rashi + startOffset + idx) % 12;
  const degInSeg = degInRashi - idx * DASAMSA_SPAN;
  const degInTargetRashi = (degInSeg / DASAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const DWADASAMSA_SPAN = 30 / 12;

function dwadasamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const idx = Math.min(11, Math.floor(degInRashi / DWADASAMSA_SPAN));
  const targetRashi = (rashi + idx) % 12;
  const degInSeg = degInRashi - idx * DWADASAMSA_SPAN;
  const degInTargetRashi = (degInSeg / DWADASAMSA_SPAN) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

const TRIMSA_ODD_BOUNDARIES = [0, 5, 10, 18, 25, 30] as const;
const TRIMSA_ODD_RASHIS = [
  0,  // 0-5°   → Mars     (Aries)
  10, // 5-10°  → Saturn   (Aquarius)
  8,  // 10-18° → Jupiter  (Sagittarius)
  2,  // 18-25° → Mercury  (Gemini)
  6,  // 25-30° → Venus    (Libra)
] as const;
const TRIMSA_EVEN_BOUNDARIES = [0, 5, 12, 20, 25, 30] as const;
const TRIMSA_EVEN_RASHIS = [
  1,  // 0-5°   → Venus    (Taurus)
  5,  // 5-12°  → Mercury  (Virgo)
  11, // 12-20° → Jupiter  (Pisces)
  9,  // 20-25° → Saturn   (Capricorn)
  7,  // 25-30° → Mars     (Scorpio)
] as const;

function trimsamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const isOdd = rashi % 2 === 0;
  const boundaries = isOdd ? TRIMSA_ODD_BOUNDARIES : TRIMSA_EVEN_BOUNDARIES;
  const rashis = isOdd ? TRIMSA_ODD_RASHIS : TRIMSA_EVEN_RASHIS;
  let segIdx = 4;
  for (let i = 0; i < 5; i++) {
    if (degInRashi < boundaries[i + 1]!) { segIdx = i; break; }
  }
  const targetRashi = rashis[segIdx]!;
  const segStart = boundaries[segIdx]!;
  const segWidth = boundaries[segIdx + 1]! - segStart;
  const degInSeg = degInRashi - segStart;
  const degInTargetRashi = (degInSeg / segWidth) * 30;
  return normalize360(targetRashi * 30 + degInTargetRashi);
}

export const _horaLongitudeForTest = horaLongitude;
export const _drekkanaLongitudeForTest = drekkanaLongitude;
export const _saptamsaLongitudeForTest = saptamsaLongitude;
export const _dasamsaLongitudeForTest = dasamsaLongitude;
export const _dwadasamsaLongitudeForTest = dwadasamsaLongitude;
export const _trimsamsaLongitudeForTest = trimsamsaLongitude;
