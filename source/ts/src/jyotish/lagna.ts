import { greenwichApparentSiderealDegrees } from '../astronomy/topocentric';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { computeSunrise } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { meanObliquity } from './planets';
import { resolveNakshatraName, resolveMasaName } from '../i18n/resolver';
import { normalize360, degToRad } from '../utils/angle';
import { NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN, nakshatraOf } from '../utils/constants';
import { validateLocation, validateDate } from '../utils/validation';
import type { AyanamsaType, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { LagnaInfo, SripatiLagnaInfo } from '../types/jyotish';

/** Lagna (ascendant): the sidereal ecliptic longitude rising on the eastern horizon.
 *  Meeus, *Astronomical Algorithms* 2nd ed. eq. 13.6, less ayanamsa. */
export function computeLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);

  const lstDeg = normalize360(greenwichApparentSiderealDegrees(birthDate) + location.longitude);
  const θ = degToRad(lstDeg);

  const T = (dateToJulianDay(birthDate) - 2451545.0) / 36525.0;
  const ε = degToRad(meanObliquity(T));
  const φ = degToRad(location.latitude);

  const numerator = Math.cos(θ);
  const denominator = -Math.sin(ε) * Math.tan(φ) - Math.cos(ε) * Math.sin(θ);
  const tropicalLagna = normalize360((Math.atan2(numerator, denominator) * 180) / Math.PI);

  const ayanamsa = computeAyanamsa(birthDate, ayanamsaType);
  const siderealLongitude = normalize360(tropicalLagna - ayanamsa);

  const rashiIndex = Math.floor(siderealLongitude / 30);
  const degreeInRashi = siderealLongitude - rashiIndex * 30;
  const nakIdx = nakshatraOf(siderealLongitude);
  // Clamped at 0: a sub-ULP negative would floor pada to 0.
  const degreesInNakshatra = Math.max(siderealLongitude - nakIdx * NAKSHATRA_SPAN, 0);
  const pada = Math.min(4, Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1);

  return {
    siderealLongitude,
    rashi: { index: rashiIndex, name: resolveMasaName(rashiIndex, lang) },
    degreeInRashi,
    nakshatra: { index: nakIdx, name: resolveNakshatraName(nakIdx, lang) },
    pada,
  };
}

export function findSunriseBefore(date: Date, location: GeoLocation): Date {
  const back30h = new Date(date.getTime() - 30 * 3600_000);
  let candidate = computeSunrise(back30h, location);
  // 22 h hops never overshoot a solar day; the bound guards polar inputs.
  for (let i = 0; i < 4; i++) {
    const lookAhead = new Date(candidate.getTime() + 22 * 3600_000);
    const next = computeSunrise(lookAhead, location);
    if (next.getTime() > date.getTime()) return candidate;
    candidate = next;
  }
  return candidate;
}

/** @internal */
export const _findSunriseBeforeForTest = findSunriseBefore;

function buildLagnaInfo(siderealLongitude: number, lang: Language): LagnaInfo {
  const sid = normalize360(siderealLongitude);
  const rashiIndex = Math.floor(sid / 30);
  const degreeInRashi = sid - rashiIndex * 30;
  const nakIdx = nakshatraOf(sid);
  // Clamped at 0: a sub-ULP negative would floor pada to 0.
  const degreesInNakshatra = Math.max(sid - nakIdx * NAKSHATRA_SPAN, 0);
  const pada = Math.min(4, Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1);
  return {
    siderealLongitude: sid,
    rashi: { index: rashiIndex, name: resolveMasaName(rashiIndex, lang) },
    degreeInRashi,
    nakshatra: { index: nakIdx, name: resolveNakshatraName(nakIdx, lang) },
    pada,
  };
}

/** Hora Lagna: 30 deg/hour (one rashi per hour) from sunrise, BPHS Ch. 4. */
export function computeHoraLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  // BPHS Ch. 4: the base point is the Sun at sunrise, not the ascendant.
  const sunSidAtSunrise = getSiderealSunLongitude(sunrise, ayanamsaType);
  const hoursSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / 3600_000;
  const horaLon = sunSidAtSunrise + hoursSinceSunrise * 30;
  return buildLagnaInfo(horaLon, lang);
}

/** Ghati Lagna: one rashi per ghatika (24 min) from sunrise, 75 deg/hour. */
export function computeGhatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  const sunSidAtSunrise = getSiderealSunLongitude(sunrise, ayanamsaType);
  const ghatikasSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / (24 * 60 * 1000);
  const ghatiLon = sunSidAtSunrise + ghatikasSinceSunrise * 30;
  return buildLagnaInfo(ghatiLon, lang);
}

/** Bhava Lagna: one rashi per 5 ghatikas (2 h) from sunrise, 15 deg/hour. */
export function computeBhavaLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  const sunSidAtSunrise = getSiderealSunLongitude(sunrise, ayanamsaType);
  const hoursSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / 3600_000;
  const bhavaLon = sunSidAtSunrise + hoursSinceSunrise * 15;
  return buildLagnaInfo(bhavaLon, lang);
}

/** Sripati Lagna: cusp 1 of the Sripati Paddhati, which trisects each of the four
 *  ASC/IC/DSC/MC quadrants into the 12 bhava madhyas (BPHS Ch. 5). */
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType?: AyanamsaType,
  lang?: Language,
): LagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType | undefined,
  lang: Language | undefined,
  options: { includeCusps: true },
): SripatiLagnaInfo;
/** Explicit `{ includeCusps: false }`; without this overload such a call fails
 *  to compile. */
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType | undefined,
  lang: Language | undefined,
  options?: { includeCusps?: false },
): LagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
  options?: { includeCusps?: boolean },
): LagnaInfo | SripatiLagnaInfo {
  const lagna = computeLagna(birthDate, location, ayanamsaType, lang);
  if (!options?.includeCusps) return lagna;

  // Sidereal MC, Meeus' tropical-MC formula; inlined rather than importing
  // computeBhava, which would create a bhava.ts -> lagna.ts cycle.
  const lstDeg = normalize360(greenwichApparentSiderealDegrees(birthDate) + location.longitude);
  const θ = degToRad(lstDeg);
  const T = (dateToJulianDay(birthDate) - 2451545.0) / 36525.0;
  const ε = degToRad(meanObliquity(T));
  const mcTropical = normalize360(
    (Math.atan2(Math.sin(θ), Math.cos(θ) * Math.cos(ε)) * 180) / Math.PI,
  );
  const ayanamsa = computeAyanamsa(birthDate, ayanamsaType);
  const mcSidereal = normalize360(mcTropical - ayanamsa);

  return { ...lagna, cusps: sripatiCusps(lagna.siderealLongitude, mcSidereal) };
}

function sripatiCusps(ascSidereal: number, mcSidereal: number): number[] {
  const ASC = normalize360(ascSidereal);
  const MC  = normalize360(mcSidereal);
  const IC  = normalize360(MC + 180);
  const DSC = normalize360(ASC + 180);

  const arc_q1 = normalize360(IC  - ASC);
  const arc_q2 = normalize360(DSC - IC);
  const arc_q3 = normalize360(MC  - DSC);
  const arc_q4 = normalize360(ASC + 360 - MC);

  return [
    ASC,
    normalize360(ASC + arc_q1 / 3),
    normalize360(ASC + 2 * arc_q1 / 3),
    IC,
    normalize360(IC  + arc_q2 / 3),
    normalize360(IC  + 2 * arc_q2 / 3),
    DSC,
    normalize360(DSC + arc_q3 / 3),
    normalize360(DSC + 2 * arc_q3 / 3),
    MC,
    normalize360(MC  + arc_q4 / 3),
    normalize360(MC  + 2 * arc_q4 / 3),
  ];
}
