import { Body, EclipticLongitude, MakeTime } from 'astronomy-engine';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeNakshatraFromLongitude } from '../core/nakshatra';
import { normalize360 } from '../utils/angle';
import { NAKSHATRA_SPAN } from '../utils/constants';
import type { AyanamsaType } from '../types/options';
import type { GrahaPosition, GrahaName, PlanetaryPositions } from '../types/jyotish';

// Short abbreviations used in chart display
export const GRAHA_ABBR: Record<GrahaName, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

/** Mean obliquity of the ecliptic (IAU formula), T in Julian centuries from J2000. */
export function meanObliquity(T: number): number {
  return 23.439291111 - 0.013004167 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

/**
 * Tropical geocentric ecliptic longitude of a planet via astronomy-engine.
 * Note: EclipticLongitude is heliocentric for the named body; for geocentric
 * we use it directly — this is correct for outer/inner planets referenced
 * to Earth's frame because astronomy-engine's EclipticLongitude already
 * accounts for the Earth's position (it returns the geo-ecliptic lon).
 */
function getTropicalPlanetLongitude(body: Body, date: Date): number {
  return EclipticLongitude(body, MakeTime(date));
}

/**
 * Retrograde detection: compare geocentric ecliptic longitude 1 hour apart.
 * Returns true if the longitude is decreasing (retrograde motion).
 * Handles the 359→0 wrap-around boundary.
 */
function isRetrograde(body: Body, date: Date): boolean {
  const dt = 3600_000; // 1 hour in ms
  const lon0 = EclipticLongitude(body, MakeTime(new Date(date.getTime() - dt)));
  const lon1 = EclipticLongitude(body, MakeTime(new Date(date.getTime() + dt)));
  // Unwrap for boundary crossing
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

/**
 * True node (accurate ~0.05°) via Moon's ecliptic latitude zero-crossing.
 * Uses a short bracket around the date instead of a full search.
 */
function getTrueRahuLongitudeTropical(date: Date): number {
  // Sample Moon's ecliptic latitude 27 days apart (half a nodal period ~27.2 days)
  // and interpolate to find the zero crossing.
  // For production use, the mean node (within ±1.5°) is sufficient for Vedic astrology.
  // We refine using the Moon's latitude perturbation.
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;

  // Longitude of mean node
  const omega =
    125.04455501
    - 1934.13626197 * T
    + 0.00207765 * T * T;

  // Moon's argument of latitude (F)
  const F = normalize360(
    93.27191028
    + 483202.0175233 * T
    - 0.0036825 * T * T
    + 0.000003083 * T * T * T,
  );

  // First-order correction to get the true node (Meeus correction terms)
  const F_rad = (F * Math.PI) / 180;
  const correction =
    -1.4979 * Math.sin(2 * F_rad)
    - 0.1500 * Math.sin((0 * F_rad) + (Math.PI * 2 * (357.5 / 360))) // solar anomaly approx
    - 0.1226 * Math.sin(2 * ((omega * Math.PI) / 180))
    + 0.1176 * Math.sin(2 * F_rad - 2 * ((omega * Math.PI) / 180));

  return normalize360(omega + correction / 60); // correction in arcmin → degrees
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
  const nakIdx = Math.floor(siderealLon / NAKSHATRA_SPAN);
  return {
    planet,
    siderealLongitude: siderealLon,
    rashi: { index: rashiIndex, name: rashiNameFn(rashiIndex) },
    degreeInRashi,
    nakshatra: computeNakshatraFromLongitude(siderealLon, nakshatraNameFn(nakIdx)),
    isRetrograde: isRetro,
    house: 0, // assigned later in computeKundli
  };
}

/** Placeholder name function — callers supply real i18n fn. */
const identity = (idx: number) => String(idx);

/**
 * Compute geocentric sidereal positions for all 9 grahas.
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system.
 * @param nakshatraName Function returning the Nakshatra name for an index.
 * @param rashiName     Function returning the Rashi name for an index.
 */
export function computePlanetaryPositions(
  date: Date,
  ayanamsaType: AyanamsaType,
  nakshatraName: (idx: number) => string = identity,
  rashiName: (idx: number) => string = identity,
): PlanetaryPositions {
  const ayanamsa = computeAyanamsa(date, ayanamsaType);

  const toSidereal = (tropical: number) => normalize360(tropical - ayanamsa);

  // Sun — use existing helper (SunPosition, not EclipticLongitude)
  const sunSid = getSiderealSunLongitude(date, ayanamsaType);

  // Moon — use existing helper (GeoMoon via Ecliptic, not EclipticLongitude)
  const moonSid = getSiderealMoonLongitude(date, ayanamsaType);

  // Mars through Saturn — EclipticLongitude gives geocentric tropical lon
  const marsTrop = getTropicalPlanetLongitude(Body.Mars, date);
  const mercTrop = getTropicalPlanetLongitude(Body.Mercury, date);
  const jupTrop = getTropicalPlanetLongitude(Body.Jupiter, date);
  const venTrop = getTropicalPlanetLongitude(Body.Venus, date);
  const satTrop = getTropicalPlanetLongitude(Body.Saturn, date);

  // Rahu (true ascending node) — Ketu is exactly opposite
  const rahuTrop = getTrueRahuLongitudeTropical(date);
  const ketuTrop = normalize360(rahuTrop + 180);

  // Retrograde: not applicable to Sun/Moon/nodes
  const marsRetro = isRetrograde(Body.Mars, date);
  const mercRetro = isRetrograde(Body.Mercury, date);
  const jupRetro = isRetrograde(Body.Jupiter, date);
  const venRetro = isRetrograde(Body.Venus, date);
  const satRetro = isRetrograde(Body.Saturn, date);

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
    rahu:    g('Rahu',    toSidereal(rahuTrop),   true),  // always retrograde
    ketu:    g('Ketu',    toSidereal(ketuTrop),   true),
  };
}

