import { computeRashiChart } from './charts';
import { findSolarReturn } from './varshaphala';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { normalize360 } from '../utils/angle';
import { validateDate, validateLocation } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { AyanamsaType, BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BhavaChart, LagnaInfo, PlanetPlacement,
} from '../types/jyotish';

/** Tithi-Pravesha (annual soli-lunar return) chart, cast at the PVR Narasimha Rao
 *  redefinition moment: the sidereal Sun back in its natal sign AND the Sun-Moon
 *  separation back at its natal value. */
export interface TithiPraveshaChart {
  praveshInstant: Date;
  /** 0..29: Shukla 1..15 → 0..14, Krishna 1..15 → 15..29. */
  natalTithi: number;
  /** Equals `natalTithi` by construction. */
  praveshTithi: number;
  varshaLagna: LagnaInfo;
  planets: PlanetPlacement[];
  bhava: BhavaChart;
}

const SIDEREAL_YEAR_DAYS = 365.25636;
const MOON_SUN_DIFF_DEG_PER_DAY = 360 / 29.5306;

/** Tithi-Pravesha chart for the native's `yearAge`-th annual cycle.
 *  @param yearAge 1-indexed annual cycle (1 = first tithi-pravesha). */
export function computeTithiPravesha(
  natalBirth: Date,
  yearAge: number,
  location: GeoLocation,
  options: BirthChartOptions = {},
): TithiPraveshaChart {
  validateDate(natalBirth);
  validateLocation(location);
  if (!Number.isInteger(yearAge) || yearAge < 1) {
    throw new PanchangError(
      `Tithi-Pravesha yearAge must be a positive integer (1 = first cycle); got ${yearAge}`,
      'INVALID_INPUT',
    );
  }

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';

  const natalSun = getSiderealSunLongitude(natalBirth, ayanamsaType);
  const natalMoon = getSiderealMoonLongitude(natalBirth, ayanamsaType);
  const targetDelta = normalize360(natalMoon - natalSun);
  const natalTithi = computeNatalTithiIndex(natalSun, natalMoon);
  const natalSunRashi = Math.floor(natalSun / 30);

  const solarReturn = findSolarReturn(natalBirth, yearAge, natalSun, ayanamsaType);

  const praveshInstant = findTithiPraveshaInNatalSign(
    solarReturn, targetDelta, natalSunRashi, ayanamsaType,
  );

  const chart = computeRashiChart(praveshInstant, location, options);

  const praveshSun = getSiderealSunLongitude(praveshInstant, ayanamsaType);
  const praveshMoon = getSiderealMoonLongitude(praveshInstant, ayanamsaType);
  const praveshTithi = computeNatalTithiIndex(praveshSun, praveshMoon);

  return {
    praveshInstant,
    natalTithi,
    praveshTithi,
    varshaLagna: chart.lagna,
    planets: chart.planets,
    bhava: chart.bhava,
  };
}

/** Local copy: importing `core/tithi` here would make an import cycle. */
function computeNatalTithiIndex(sunLon: number, moonLon: number): number {
  const diff = normalize360(moonLon - sunLon);
  return Math.min(29, Math.floor(diff / 12));
}

const SYNODIC_MONTH_MS = 29.530589 * 86400_000;

/** The natal-sign window is ~30.4 days and tithi matches are 29.53 days apart,
 *  so exactly one of the two candidates qualifies. */
function findTithiPraveshaInNatalSign(
  solarReturn: Date,
  targetDelta: number,
  natalSunRashi: number,
  ayanamsaType: AyanamsaType,
): Date {
  const t1 = findTithiPravesha(solarReturn, targetDelta, ayanamsaType);
  const sunAtT1 = getSiderealSunLongitude(t1, ayanamsaType);
  if (Math.floor(sunAtT1 / 30) === natalSunRashi) return t1;

  const dir = t1.getTime() < solarReturn.getTime() ? +1 : -1;
  const t2Approx = new Date(t1.getTime() + dir * SYNODIC_MONTH_MS);
  const t2 = findTithiPravesha(t2Approx, targetDelta, ayanamsaType);
  const sunAtT2 = getSiderealSunLongitude(t2, ayanamsaType);
  if (Math.floor(sunAtT2 / 30) === natalSunRashi) return t2;

  const dT1 = Math.abs(t1.getTime() - solarReturn.getTime());
  const dT2 = Math.abs(t2.getTime() - solarReturn.getTime());
  return dT1 <= dT2 ? t1 : t2;
}

/** Newton on the wrapped Moon-Sun phase deviation; exactly one zero per synodic
 *  period around `centerInstant`. */
function findTithiPravesha(
  centerInstant: Date,
  targetDelta: number,
  ayanamsaType: AyanamsaType,
): Date {
  let t = centerInstant.getTime();
  const TOL_DEG = 0.0001;

  for (let iter = 0; iter < 25; iter++) {
    const t0 = new Date(t);
    const moon = getSiderealMoonLongitude(t0, ayanamsaType);
    const sun = getSiderealSunLongitude(t0, ayanamsaType);
    const d = normalize360(moon - sun);
    let phaseDelta = targetDelta - d;
    phaseDelta = ((phaseDelta + 540) % 360) - 180;

    if (Math.abs(phaseDelta) < TOL_DEG) break;
    t += (phaseDelta / MOON_SUN_DIFF_DEG_PER_DAY) * 86400_000;
  }

  return new Date(Math.round(t));
}

/** @internal */
export const _computeNatalTithiIndexForTest = computeNatalTithiIndex;

// Reserved for a future window-size guard.
void SIDEREAL_YEAR_DAYS;
