import { NAKSHATRA_SPAN, nakshatraOf } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import { computeBhava } from './bhava';
import {
  DASHA_ORDER, DASHA_YEARS, NAKSHATRA_LORD,
} from './dasha';
import { RASHI_LORD } from './matchingTables';
import { validateLocation, validateDate } from '../utils/validation';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BirthChart, DashaLord, GrahaName,
} from '../types/jyotish';

/** Index order must match `RASHI_LORD`. */
const VISIBLE_GRAHAS_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

const ALL_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

function dashaLordToGraha(d: DashaLord): GrahaName {
  return d as GrahaName;
}

/** Sign lord, star (nakshatra) lord and KP sub-lord of one longitude. */
export interface KpSubLordInfo {
  /** Sidereal longitude in degrees, [0, 360). */
  longitude: number;
  /** Rashi index 0..11. */
  rashi: number;
  /** Nakshatra index 0..26. */
  nakshatra: number;
  signLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  starLord: DashaLord;
  subLord: DashaLord;
}

export interface KpCuspalSubLords {
  /** 12 cusps in order: index 0 = cusp 1 = ascendant. */
  cusps: KpSubLordInfo[];
}

/** Houses each planet signifies: the union of the houses occupied and owned by
 *  the planet and by its star-lord. */
export interface KpSignificators {
  byPlanet: Record<GrahaName, number[]>;
  byHouse: Record<number, GrahaName[]>;
}

function subWidth(lord: DashaLord): number {
  return (DASHA_YEARS[lord] / 120) * NAKSHATRA_SPAN;
}

function subLordAtOffset(degInNak: number, starLord: DashaLord): DashaLord {
  const starLordIdx = DASHA_ORDER.indexOf(starLord);
  let cum = 0;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(starLordIdx + i) % 9]!;
    cum += subWidth(lord);
    if (degInNak < cum) return lord;
  }
  return DASHA_ORDER[(starLordIdx + 8) % 9]!;
}

/** KP-Paddhati sub-lord of a sidereal longitude: the nakshatra split into 9
 *  sub-portions proportional to the Vimshottari dasha years, starting from the
 *  nakshatra's own lord. A non-finite longitude has no KP reading: the indices
 *  come back NaN and `signLord` and `starLord` undefined. */
export function computeKpSubLord(siderealLongitude: number): KpSubLordInfo {
  const lon = normalize360(siderealLongitude);
  const rashi = Math.floor(lon / 30);
  const nakIdx = nakshatraOf(lon);
  const degInNak = lon - nakIdx * NAKSHATRA_SPAN;

  const starLord = NAKSHATRA_LORD[nakIdx]!;
  const subLord = subLordAtOffset(degInNak, starLord);
  const signLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[rashi]!]!;

  return {
    longitude: lon,
    rashi,
    nakshatra: nakIdx,
    signLord,
    starLord,
    subLord,
  };
}

/** KP cuspal sub-lords for the 12 Placidus-KP cusps; `houseSystem` is forced to
 *  `'placidus-kp'` over any caller value, and ayanamsa defaults to `'krishnamurti'`. */
export function computeKpCuspalSubLords(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): KpCuspalSubLords {
  validateDate(birthDate);
  validateLocation(location);

  const kpOptions: BirthChartOptions = {
    ...options,
    ayanamsa: options.ayanamsa ?? 'krishnamurti',
    houseSystem: 'placidus-kp',
  };
  const bhava = computeBhava(birthDate, location, kpOptions);

  const cusps: KpSubLordInfo[] = bhava.houses.map((h) => computeKpSubLord(h.cuspLongitude));
  return { cusps };
}

/** The 4-fold KP significators, keyed both by planet and by house. A planet longitude outside [0, 360) is wrapped
 *  into it; a non-finite one gives that planet no star lord. */
export function computeKpSignificators(chart: BirthChart): KpSignificators {
  const planetHouse: Partial<Record<GrahaName, number>> = {};
  const planetStarLord: Partial<Record<GrahaName, DashaLord>> = {};
  for (const p of chart.planets) {
    planetHouse[p.planet] = p.house;
    const nakIdx = nakshatraOf(normalize360(p.longitude));
    planetStarLord[p.planet] = NAKSHATRA_LORD[nakIdx]!;
  }

  const lagnaRashi = chart.lagna.rashi.index;
  const rashiToHouse = (rashi: number) => ((rashi - lagnaRashi + 12) % 12) + 1;

  const planetOwnedHouses: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number[]> = {
    Sun: [], Moon: [], Mars: [], Mercury: [], Jupiter: [], Venus: [], Saturn: [],
  };
  for (let r = 0; r < 12; r++) {
    const ownerIdx = RASHI_LORD[r]!;
    const owner = VISIBLE_GRAHAS_BY_INDEX[ownerIdx]!;
    planetOwnedHouses[owner].push(rashiToHouse(r));
  }

  const byPlanet: Record<GrahaName, number[]> = {} as Record<GrahaName, number[]>;
  for (const planet of ALL_GRAHAS) {
    const houses = new Set<number>();

    const ownHouse = planetHouse[planet];
    if (ownHouse !== undefined) houses.add(ownHouse);

    const starLord = planetStarLord[planet];
    if (starLord !== undefined) {
      const slGraha = dashaLordToGraha(starLord);
      const slHouse = planetHouse[slGraha];
      if (slHouse !== undefined) houses.add(slHouse);
    }

    if (planet !== 'Rahu' && planet !== 'Ketu') {
      for (const h of planetOwnedHouses[planet]) houses.add(h);
    }

    if (starLord !== undefined) {
      const slGraha = dashaLordToGraha(starLord);
      if (slGraha !== 'Rahu' && slGraha !== 'Ketu') {
        for (const h of planetOwnedHouses[slGraha]) houses.add(h);
      }
    }

    byPlanet[planet] = [...houses].sort((a, b) => a - b);
  }

  const byHouse: Record<number, GrahaName[]> = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = [];
  for (const planet of ALL_GRAHAS) {
    for (const h of byPlanet[planet]!) {
      byHouse[h]!.push(planet);
    }
  }

  return { byPlanet, byHouse };
}

/** @internal */
export const _SUB_CUMULATIVE_WIDTHS_FOR_TEST: readonly number[] = /* @__PURE__ */ (() => {
  const out: number[] = [];
  let cum = 0;
  for (const lord of DASHA_ORDER) {
    cum += subWidth(lord);
    out.push(cum);
  }
  return out;
})();
