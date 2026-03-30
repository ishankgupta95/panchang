import { SiderealTime, MakeTime } from 'astronomy-engine';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { normalize360, degToRad, radToDeg } from '../utils/angle';
import { meanObliquity } from './planets';
import type { AyanamsaType } from '../types/options';
import type { RashiInfo } from '../types/elements';

/**
 * Compute the sidereal longitude of the Lagna (Ascendant) for a given
 * UTC birth time and observer location.
 *
 * Algorithm (Meeus, Astronomical Algorithms, Ch. 14):
 *   1. GAST  = SiderealTime(date) in hours → degrees
 *   2. LAST  = GAST + observerLongitude (in degrees)
 *   3. RAMC  = LAST (Right Ascension of the Midheaven Culminating)
 *   4. tan(λ_asc) = -cos(RAMC) / (sin(RAMC)·cos(ε) + tan(φ)·sin(ε))
 *      where ε = mean obliquity, φ = geographic latitude
 *   5. Sidereal Lagna = normalize(λ_asc − ayanamsa)
 *
 * @param date          UTC birth moment.
 * @param latitude      Observer geographic latitude in degrees (−90 to +90).
 * @param longitude     Observer geographic longitude in degrees (−180 to +180).
 * @param ayanamsaType  Ayanamsa correction system.
 * @returns             Sidereal ascendant longitude [0, 360).
 */
export function computeLagnaLongitude(
  date: Date,
  latitude: number,
  longitude: number,
  ayanamsaType: AyanamsaType,
): number {
  // 1. Greenwich Apparent Sidereal Time in hours (astronomy-engine)
  const gastHours = SiderealTime(MakeTime(date));

  // 2. Local Apparent Sidereal Time in degrees
  const last_deg = normalize360(gastHours * 15 + longitude);

  // 3. Mean obliquity of ecliptic
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;
  const eps_deg = meanObliquity(T);

  const ramc = degToRad(last_deg);
  const eps = degToRad(eps_deg);
  const phi = degToRad(latitude);

  // 4. Ascendant tropical longitude (Meeus formula)
  //    y = -cos(RAMC)
  //    x = sin(RAMC)·cos(ε) + tan(φ)·sin(ε)
  const y = -Math.cos(ramc);
  const x = Math.sin(ramc) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps);
  let tropicalAsc = normalize360(radToDeg(Math.atan2(y, x)));

  // 5. Quadrant correction: the ascendant must be in the eastern horizon,
  //    which means it should be ~90° behind the Midheaven (MC).
  //    MC = atan2(tan(RAMC), cos(ε)), also adjusted to the right quadrant.
  const mcRaw = radToDeg(Math.atan2(Math.tan(ramc), Math.cos(eps)));
  const mc = normalize360(
    last_deg < 180 ? normalize360(mcRaw) : normalize360(mcRaw + 180),
  );

  // Ensure Ascendant is ~90° east of (ahead of) the MC clockwise
  // i.e. in the range [MC+90, MC+270] (mod 360) — the ascending semi-arc.
  const diff = normalize360(tropicalAsc - mc);
  if (diff < 90 || diff > 270) {
    tropicalAsc = normalize360(tropicalAsc + 180);
  }

  // 6. Apply ayanamsa to get sidereal Lagna
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalAsc - ayanamsa);
}

/**
 * Given a sidereal Lagna longitude, return the Navamsa Lagna rashi index.
 * Navamsa (D-9): each sign is divided into 9 equal parts of 3°20'.
 * The navamsa sign follows a specific pattern per element (fire/earth/air/water).
 */
export function navamsaRashi(siderealLongitude: number): number {
  const rashiIdx = Math.floor(siderealLongitude / 30);
  const degInRashi = siderealLongitude - rashiIdx * 30;
  const navamsaIndex = Math.floor(degInRashi / (30 / 9)); // 0–8

  // Starting sign of navamsa for each rashi element group:
  // Fire signs (0,4,8 = Aries,Leo,Sagittarius) start from Aries (0)
  // Earth signs (1,5,9 = Taurus,Virgo,Capricorn) start from Capricorn (9)
  // Air signs (2,6,10 = Gemini,Libra,Aquarius) start from Libra (6)
  // Water signs (3,7,11 = Cancer,Scorpio,Pisces) start from Cancer (3)
  const NAVAMSA_STARTS = [0, 9, 6, 3, 0, 9, 6, 3, 0, 9, 6, 3];
  return (NAVAMSA_STARTS[rashiIdx]! + navamsaIndex) % 12;
}

/**
 * Resolve Rashi info for a given sidereal longitude, using the provided name function.
 */
export function rashiFromLongitude(
  lon: number,
  nameFn: (idx: number) => string,
): RashiInfo {
  const index = Math.floor(lon / 30);
  return { index, name: nameFn(index) };
}
