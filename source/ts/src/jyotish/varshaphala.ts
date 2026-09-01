import { isSunAboveHorizon } from '../astronomy/horizon';
import { computeRashiChart } from './charts';
import { computeShadbala } from './shadbala';
import { computeLagna } from './lagna';
import { RASHI_LORD } from './matchingTables';
import {
  ALL_SAHAM_NAMES, SAHAM_FORMULAS,
  type SahamFormula, type SahamName, type SahamOperand,
} from './sahamsTables';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BhavaChart, BirthChart, GrahaName, LagnaInfo, PlanetPlacement,
} from '../types/jyotish';

export interface SahamPosition {
  longitude: number;
  /** 0..11. */
  rashi: number;
  rashiName: string;
  /** 1..12, whole-sign from the varsha lagna. */
  house: number;
}

/** Muntha: anchored at the natal lagna's rashi, advanced one rashi per year of age. */
export interface MunthaInfo {
  /** 0..11. */
  rashi: number;
  lord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  /** 1..12, whole-sign from the varsha lagna. */
  house: number;
}

/** Varshaphala (Tajik annual) chart, cast at the solar-return instant. */
export interface VarshaphalaChart {
  solarReturnInstant: Date;
  varshaLagna: LagnaInfo;
  muntha: MunthaInfo;
  /** Varsha Pati: strongest of the four classical candidates by Shadbala. */
  yearLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  sahams: Record<SahamName, SahamPosition>;
  isDayBirth: boolean;
  planets: PlanetPlacement[];
  bhava: BhavaChart;
}

const SIDEREAL_YEAR_DAYS = 365.25636;

const SUN_DEG_PER_DAY = 360 / SIDEREAL_YEAR_DAYS;

type VisibleGraha = Exclude<GrahaName, 'Rahu' | 'Ketu'>;

const VISIBLE_GRAHAS_BY_INDEX: readonly VisibleGraha[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * Varshaphala (Tajik annual horoscope) for one solar-return year: varsha lagna,
 * Muntha, year lord and the 27 Sahams of Neelakantha's *Tajika Neelakanthi*.
 * @param yearAge  1-indexed solar-return year; must be a positive integer.
 * @param location Location for the varsha cusps, natal by classical convention.
 */
export function computeVarshaphala(
  natalBirth: Date,
  yearAge: number,
  location: GeoLocation,
  options: BirthChartOptions = {},
): VarshaphalaChart {
  validateDate(natalBirth);
  validateLocation(location);
  if (!Number.isInteger(yearAge) || yearAge < 1) {
    throw new PanchangError(
      `Varshaphala yearAge must be a positive integer (1 = first solar return); got ${yearAge}`,
      'INVALID_INPUT',
    );
  }

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';

  const natalSun = getSiderealSunLongitude(natalBirth, ayanamsaType);
  const solarReturnInstant = findSolarReturn(natalBirth, yearAge, natalSun, ayanamsaType);

  const varshaChart = computeRashiChart(solarReturnInstant, location, options);
  const isDay = isDayBirth(solarReturnInstant, location);

  const natalLagna = computeLagna(natalBirth, location, ayanamsaType, lang);
  const muntha = buildMuntha(natalLagna.rashi.index, yearAge, varshaChart.lagna.rashi.index, lang);
  const yearLord = pickYearLord(varshaChart, muntha.lord, isDay, solarReturnInstant, location, options);

  const sahams = computeSahams(varshaChart, isDay, lang);

  return {
    solarReturnInstant,
    varshaLagna: varshaChart.lagna,
    muntha,
    yearLord,
    sahams,
    isDayBirth: isDay,
    planets: varshaChart.planets,
    bhava: varshaChart.bhava,
  };
}

/** @internal: not re-exported from the package entry; `tithiPravesha.ts` uses it. */
export function findSolarReturn(
  natalBirth: Date,
  yearAge: number,
  natalSun: number,
  ayanamsaType: AyanamsaType,
): Date {
  let t = natalBirth.getTime() + yearAge * SIDEREAL_YEAR_DAYS * 86400_000;

  const TOL_DEG = 0.0001;
  for (let iter = 0; iter < 25; iter++) {
    const lon = getSiderealSunLongitude(new Date(t), ayanamsaType);
    let delta = lon - natalSun;
    delta = ((delta + 540) % 360) - 180;
    if (Math.abs(delta) < TOL_DEG) break;
    t -= (delta / SUN_DEG_PER_DAY) * 86400_000;
  }

  return new Date(Math.round(t));
}

/** Apparent *centre*, deliberately not the refracted upper limb used by `computeSunrise` / `computeSunset`. */
function isDayBirth(date: Date, location: GeoLocation): boolean {
  return isSunAboveHorizon(date, location);
}

/** @internal */
export const _isDayBirthForTest = isDayBirth;

function buildMuntha(
  natalLagnaRashi: number,
  yearAge: number,
  varshaLagnaRashi: number,
  lang: Language,
): MunthaInfo {
  const munthaRashi = (natalLagnaRashi + yearAge) % 12;
  const lordIdx = RASHI_LORD[munthaRashi]!;
  const lord = VISIBLE_GRAHAS_BY_INDEX[lordIdx]!;
  const house = ((munthaRashi - varshaLagnaRashi + 12) % 12) + 1;
  void lang;
  return { rashi: munthaRashi, lord, house };
}

/** Triraashi Pati: element index `rashi % 4` = fire, earth, air, water (B.V. Raman, *Annual Horoscope* Ch. 2). */
function triraashiPati(rashi: number, isDay: boolean): VisibleGraha {
  const elem = rashi % 4;
  if (isDay) {
    return (['Sun', 'Venus', 'Saturn', 'Venus'] as const)[elem]!;
  }
  return (['Jupiter', 'Moon', 'Mercury', 'Mars'] as const)[elem]!;
}

function pickYearLord(
  varshaChart: BirthChart,
  munthaLord: VisibleGraha,
  isDay: boolean,
  varshaInstant: Date,
  location: GeoLocation,
  options: BirthChartOptions,
): VisibleGraha {
  const lagnaRashi = varshaChart.lagna.rashi.index;
  const lagnaLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[lagnaRashi]!]!;

  const sunPlacement = varshaChart.byPlanet.Sun;
  const sunRashiLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[sunPlacement.rashi.index]!]!;

  const triraashi = triraashiPati(lagnaRashi, isDay);

  const candidates: VisibleGraha[] = [];
  for (const c of [lagnaLord, munthaLord, sunRashiLord, triraashi]) {
    if (!candidates.includes(c)) candidates.push(c);
  }

  const shadbala = computeShadbala(varshaInstant, location, options);

  let best: VisibleGraha = candidates[0]!;
  let bestTotal = shadbala[best].total;
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const total = shadbala[c].total;
    if (total > bestTotal) {
      best = c;
      bestTotal = total;
    }
  }
  return best;
}

function resolveOperand(
  op: SahamOperand,
  varshaChart: BirthChart,
  priorSahams: Partial<Record<SahamName, number>>,
): number {
  switch (op) {
    case 'Sun':
    case 'Moon':
    case 'Mars':
    case 'Mercury':
    case 'Jupiter':
    case 'Venus':
    case 'Saturn':
      return varshaChart.byPlanet[op].longitude;
    case 'Asc':
      return varshaChart.lagna.siderealLongitude;
    case 'AscLord': {
      const lord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[varshaChart.lagna.rashi.index]!]!;
      return varshaChart.byPlanet[lord].longitude;
    }
    case 'House11Cusp': {
      const lagnaRashi = varshaChart.lagna.rashi.index;
      return ((lagnaRashi + 10) % 12) * 30;
    }
    case 'Punya': {
      const v = priorSahams.Punya;
      if (v === undefined) {
        throw new PanchangError(
          'Saham operand Punya referenced before Punya was computed',
          'SAHAM_DEPENDENCY_ERROR',
        );
      }
      return v;
    }
  }
}

/**
 * Tajika completion rule (*Tajika Neelakanthi*): after `X − Y + Z`, add one rashi if Z is not met
 * walking the zodiac from Y toward X. The check uses the *effective* X/Y, after any night swap.
 */
function evaluateSaham(
  formula: SahamFormula,
  isDay: boolean,
  varshaChart: BirthChart,
  priorSahams: Partial<Record<SahamName, number>>,
): number {
  const xOp = formula.swap && !isDay ? formula.y : formula.x;
  const yOp = formula.swap && !isDay ? formula.x : formula.y;
  const x = resolveOperand(xOp, varshaChart, priorSahams);
  const y = resolveOperand(yOp, varshaChart, priorSahams);
  const z = resolveOperand(formula.z, varshaChart, priorSahams);
  const zInArcYtoX = normalize360(z - y) <= normalize360(x - y);
  return normalize360(x - y + z + (zInArcYtoX ? 0 : 30));
}

function computeSahams(
  varshaChart: BirthChart,
  isDay: boolean,
  lang: Language,
): Record<SahamName, SahamPosition> {
  const longitudes: Partial<Record<SahamName, number>> = {};

  for (const formula of SAHAM_FORMULAS) {
    longitudes[formula.name] = evaluateSaham(formula, isDay, varshaChart, longitudes);
  }

  const lagnaRashi = varshaChart.lagna.rashi.index;
  const out = {} as Record<SahamName, SahamPosition>;
  for (const name of ALL_SAHAM_NAMES) {
    const lon = longitudes[name]!;
    const rashi = Math.floor(lon / 30);
    out[name] = {
      longitude: lon,
      rashi,
      rashiName: resolveMasaName(rashi, lang),
      house: ((rashi - lagnaRashi + 12) % 12) + 1,
    };
  }
  return out;
}

/** @internal */
export const _triraashiPatiForTest = triraashiPati;
/** @internal */
export const _evaluateSahamForTest = evaluateSaham;
