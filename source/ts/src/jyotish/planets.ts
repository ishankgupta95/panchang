import { getTropicalPlanetLongitude, type PlanetBody } from '../astronomy/planet';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeNakshatraFromLongitude } from '../core/nakshatra';
import { normalize360 } from '../utils/angle';
import { nakshatraOf } from '../utils/constants';
import type { AyanamsaType } from '../types/options';
import type { GrahaPosition, GrahaName, PlanetaryPositions } from '../types/jyotish';

/** Two-letter abbreviations for the 9 grahas. */
export const GRAHA_ABBR: Record<GrahaName, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

/** T in Julian centuries from J2000. */
export function meanObliquity(T: number): number {
  return 23.439291111 - 0.013004167 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

export { getTropicalPlanetLongitude };

function isRetrograde(body: PlanetBody, date: Date): boolean {
  const dt = 3600_000;
  const lon0 = getTropicalPlanetLongitude(body, new Date(date.getTime() - dt));
  const lon1 = getTropicalPlanetLongitude(body, new Date(date.getTime() + dt));
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

/** Meeus *Astronomical Algorithms* 2nd ed. eq. 47.7; the mean node is classical Vedic practice for Rahu/Ketu. */
function getMeanRahuLongitudeTropical(date: Date): number {
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;
  return normalize360(
    125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441
    - (T * T * T * T) / 60616000,
  );
}

/** Only the dominant Meeus Ch. 47 term; the next (−0.1500°·sin M) and smaller are neglected. */
function getTrueRahuLongitudeTropical(date: Date): number {
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;
  const meanΩ =
    125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441
    - (T * T * T * T) / 60616000;

  const D =
    297.8501921
    + 445267.1114034 * T
    - 0.0018819 * T * T
    + (T * T * T) / 545868
    - (T * T * T * T) / 113065000;
  const F =
    93.2720950
    + 483202.0175233 * T
    - 0.0036539 * T * T
    - (T * T * T) / 3526000
    + (T * T * T * T) / 863310000;

  const argRad = ((2 * D - 2 * F) * Math.PI) / 180;
  const correction = -1.4979 * Math.sin(argRad);
  return normalize360(meanΩ + correction);
}

function buildGrahaPosition(
  planet: GrahaName,
  siderealLon: number,
  isRetro: boolean,
  nakshatraNameFn: (idx: number) => string,
  rashiNameFn: (idx: number) => string,
): GrahaPosition {
  const rashiIndex = Math.floor(siderealLon / 30);
  const degreeInRashi = siderealLon - rashiIndex * 30;
  const nakIdx = nakshatraOf(siderealLon);
  return {
    planet,
    siderealLongitude: siderealLon,
    rashi: { index: rashiIndex, name: rashiNameFn(rashiIndex) },
    degreeInRashi,
    nakshatra: computeNakshatraFromLongitude(siderealLon, nakshatraNameFn(nakIdx)),
    isRetrograde: isRetro,
  };
}

const identity = (idx: number) => String(idx);

/** Geocentric sidereal positions for all 9 grahas at `date`. */
export function computePlanetaryPositions(
  date: Date,
  ayanamsaType: AyanamsaType,
  nakshatraName: (idx: number) => string = identity,
  rashiName: (idx: number) => string = identity,
  nodeType: 'mean' | 'true' = 'mean',
): PlanetaryPositions {
  const ayanamsa = computeAyanamsa(date, ayanamsaType);

  const toSidereal = (tropical: number) => normalize360(tropical - ayanamsa);

  const sunSid = getSiderealSunLongitude(date, ayanamsaType);
  const moonSid = getSiderealMoonLongitude(date, ayanamsaType);

  const marsTrop = getTropicalPlanetLongitude('mars', date);
  const mercTrop = getTropicalPlanetLongitude('mercury', date);
  const jupTrop = getTropicalPlanetLongitude('jupiter', date);
  const venTrop = getTropicalPlanetLongitude('venus', date);
  const satTrop = getTropicalPlanetLongitude('saturn', date);

  const rahuTrop =
    nodeType === 'true' ? getTrueRahuLongitudeTropical(date) : getMeanRahuLongitudeTropical(date);
  const ketuTrop = normalize360(rahuTrop + 180);

  const marsRetro = isRetrograde('mars', date);
  const mercRetro = isRetrograde('mercury', date);
  const jupRetro = isRetrograde('jupiter', date);
  const venRetro = isRetrograde('venus', date);
  const satRetro = isRetrograde('saturn', date);

  const g = (planet: GrahaName, sid: number, retro: boolean) =>
    buildGrahaPosition(planet, sid, retro, nakshatraName, rashiName);

  return {
    sun:     g('Sun',     sunSid,                false),
    moon:    g('Moon',    moonSid,               false),
    mars:    g('Mars',    toSidereal(marsTrop),   marsRetro),
    mercury: g('Mercury', toSidereal(mercTrop),   mercRetro),
    jupiter: g('Jupiter', toSidereal(jupTrop),    jupRetro),
    venus:   g('Venus',   toSidereal(venTrop),    venRetro),
    saturn:  g('Saturn',  toSidereal(satTrop),    satRetro),
    rahu:    g('Rahu',    toSidereal(rahuTrop),   true),
    ketu:    g('Ketu',    toSidereal(ketuTrop),   true),
  };
}

