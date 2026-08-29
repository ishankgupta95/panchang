import { bhavaFromBasis } from './bhava';
import { computeNatalBasis, grahaList, type NatalBasis } from './natalBasis';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BirthChart, DivisionalChart, GrahaName, PlanetPlacement,
} from '../types/jyotish';

/** Natal D1 (Rashi) chart: sidereal lagna, bhava cusps, 9 grahas. Whole-sign houses by default. */
export function computeRashiChart(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BirthChart {
  return rashiChartFromBasis(computeNatalBasis(birthDate, location, options), options);
}

/** @internal */
export function rashiChartFromBasis(
  basis: NatalBasis,
  options: BirthChartOptions = {},
): BirthChart {
  const bhava = bhavaFromBasis(basis, options.houseSystem ?? 'whole-sign');
  const cusps = bhava.houses.map((h) => h.cuspLongitude);

  const planets: PlanetPlacement[] = grahaList(basis).map(({ key, pos }) => ({
    planet: key,
    longitude: pos.siderealLongitude,
    rashi: pos.rashi,
    degreeInRashi: pos.degreeInRashi,
    house: houseOfLongitude(pos.siderealLongitude, cusps),
    isRetrograde: pos.isRetrograde,
  }));

  return {
    divisional: 'D1',
    lagna: basis.lagna,
    bhava,
    planets,
    byPlanet: indexPlanets(planets),
  };
}

/** @internal */
export function indexPlanets(
  planets: readonly PlanetPlacement[],
): Record<GrahaName, PlanetPlacement> {
  const byPlanet = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of planets) byPlanet[p.planet] = p;
  return byPlanet;
}

/** D9 (Navamsa) chart: nine 3°20' arcs per rashi, whole-sign houses from the navamsa lagna. */
export function computeNavamsa(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): DivisionalChart {
  return navamsaFromBasis(computeNatalBasis(birthDate, location, options));
}

/** @internal */
export function navamsaFromBasis(basis: NatalBasis): DivisionalChart {
  const { lang } = basis;
  const navLagnaLon = navamsaLongitude(basis.lagna.siderealLongitude);
  const navLagnaRashi = Math.floor(navLagnaLon / 30);

  const planets: PlanetPlacement[] = grahaList(basis).map(({ key, pos }) => {
    const d9Lon = navamsaLongitude(pos.siderealLongitude);
    const d9Rashi = Math.floor(d9Lon / 30);
    return {
      planet: key,
      longitude: d9Lon,
      rashi: { index: d9Rashi, name: resolveMasaName(d9Rashi, lang) },
      degreeInRashi: d9Lon - d9Rashi * 30,
      house: ((d9Rashi - navLagnaRashi + 12) % 12) + 1,
      isRetrograde: pos.isRetrograde,
    };
  });

  return {
    divisional: 'D9',
    lagnaRashi: { index: navLagnaRashi, name: resolveMasaName(navLagnaRashi, lang) },
    planets,
  };
}

const NAV_SPAN = 30 / 9;

function navamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const navIdxInRashi = Math.min(8, Math.floor(degInRashi / NAV_SPAN));
  // Movable starts at its own sign, fixed at the 9th from it, dual at the 5th.
  const startOffset = rashi % 3 === 0 ? 0 : rashi % 3 === 1 ? 8 : 4;
  const navRashi = (rashi + startOffset + navIdxInRashi) % 12;
  const degInNavRashi = ((degInRashi % NAV_SPAN) * 30) / NAV_SPAN;
  return normalize360(navRashi * 30 + degInNavRashi);
}

function houseOfLongitude(λ: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]!;
    const end = cusps[(i + 1) % 12]!;
    if (start <= end) {
      if (λ >= start && λ < end) return i + 1;
    } else {
      if (λ >= start || λ < end) return i + 1;
    }
  }
  return 1;
}

/** @internal */
export const _navamsaLongitudeForTest = navamsaLongitude;
