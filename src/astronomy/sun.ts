import { ttDaysSinceJ2000 } from './deltaT';
import {
  heliocentricLongitude, heliocentricLatitude, heliocentricRadius, earthRadiusCoarse,
} from './vsop87';
import { nutation, AU_KM, KM_PER_LIGHT_DAY, VSOP_TO_FK5_ARCSEC, VSOP_TO_FK5_LAT_ARCSEC } from './frame';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** Apparent geocentric position of the Sun, true ecliptic and equinox of date. */
export interface SunPosition {
  /** Apparent longitude, degrees in [0, 360). */
  longitude: number;
  /** Apparent latitude, degrees — never more than ~1.2″ from zero. */
  latitude: number;
  /** Geocentric distance, AU. */
  distance: number;
}

/**
 * Apparent geocentric longitude of the Sun, degrees.
 *
 * ## Why there is no precession here
 *
 * VSOP87 version **D** is published in the mean dynamical ecliptic and equinox
 * *of date*, so the Earth's heliocentric longitude already sits in the frame
 * this library reports in. Reflecting it through the geocentre (+180°) and
 * adding nutation is the whole frame chain. Contrast `moon.ts`, where
 * ELP2000-82B's inertial J2000 origin forces the full precession rotation —
 * the asymmetry is a property of the two theories, not an inconsistency.
 *
 * ## Light-time
 *
 * Worth 20.5″, by far the largest correction on this path, and it is what the
 * classical "aberration of the Sun" constant −20.4898″/R stands for. Applied as
 * a retardation — evaluate the Earth's position at `t − R/c` — rather than as
 * that constant, because the retardation is exact and the constant is its
 * first-order approximation. Measured effect: max error 39.7″ → 0.21″.
 */
export function getTropicalSunLongitude(date: Date): number {
  const ttDays = ttDaysSinceJ2000(date);
  const retarded = ttDays - (earthRadiusCoarse(ttDays) * AU_KM) / KM_PER_LIGHT_DAY;
  const lon = heliocentricLongitude('earth', retarded) * RAD_TO_DEG + 180;
  return normalize360(
    lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600,
  );
}

/**
 * Full apparent position — longitude, latitude and distance. The eclipse and
 * rise/set paths need all three; the panchang elements need only
 * {@link getTropicalSunLongitude}.
 */
export function getSunPosition(date: Date): SunPosition {
  const ttDays = ttDaysSinceJ2000(date);
  // Coarse radius decides *when* the light left; the full radius is what gets
  // reported. Reversing that would spend 63 terms to move the retardation by
  // 0.05 s, which is 0.002″.
  const retarded = ttDays - (earthRadiusCoarse(ttDays) * AU_KM) / KM_PER_LIGHT_DAY;
  const lon = heliocentricLongitude('earth', retarded) * RAD_TO_DEG + 180;
  const lat = -heliocentricLatitude('earth', retarded) * RAD_TO_DEG;
  return {
    longitude: normalize360(lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600),
    latitude: lat + (VSOP_TO_FK5_LAT_ARCSEC / 3600) * (Math.cos(lon * DEG_TO_RAD) - Math.sin(lon * DEG_TO_RAD)),
    distance: heliocentricRadius('earth', retarded),
  };
}

/**
 * Sidereal longitude of the Sun at a given UTC instant.
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system: `'lahiri'` (default in most APIs),
 *                      `'raman'`, or `'krishnamurti'`.
 * @returns             Sidereal longitude in degrees, normalized to [0, 360).
 *
 * @example
 * ```typescript
 * import { getSiderealSunLongitude } from 'panchang-ts';
 * const lon = getSiderealSunLongitude(new Date('2025-01-14T12:00:00Z'), 'lahiri');
 * // ~269.3° — Sun in Makara (Capricorn) rashi
 * ```
 */
export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  return normalize360(getTropicalSunLongitude(date) - computeAyanamsa(date, ayanamsaType));
}
