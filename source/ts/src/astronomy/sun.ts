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

/** Apparent geocentric Sun, true ecliptic and equinox of date; degrees and AU. */
export interface SunPosition {
  longitude: number;
  latitude: number;
  distance: number;
}

/** Degrees. VSOP87D is already published of-date, so there is no precession rotation;
 * light-time enters as a retardation of the Earth's epoch, standing in for aberration,
 * so do not add a separate term. */
export function getTropicalSunLongitude(date: Date): number {
  const ttDays = ttDaysSinceJ2000(date);
  const retarded = ttDays - (earthRadiusCoarse(ttDays) * AU_KM) / KM_PER_LIGHT_DAY;
  const lon = heliocentricLongitude('earth', retarded) * RAD_TO_DEG + 180;
  return normalize360(
    lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600,
  );
}

export function getSunPosition(date: Date): SunPosition {
  const ttDays = ttDaysSinceJ2000(date);
  // Coarse radius only decides *when* the light left; the full one is reported.
  const retarded = ttDays - (earthRadiusCoarse(ttDays) * AU_KM) / KM_PER_LIGHT_DAY;
  const lon = heliocentricLongitude('earth', retarded) * RAD_TO_DEG + 180;
  const lat = -heliocentricLatitude('earth', retarded) * RAD_TO_DEG;
  return {
    longitude: normalize360(lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600),
    latitude: lat + (VSOP_TO_FK5_LAT_ARCSEC / 3600) * (Math.cos(lon * DEG_TO_RAD) - Math.sin(lon * DEG_TO_RAD)),
    distance: heliocentricRadius('earth', retarded),
  };
}

/** Sidereal longitude of the Sun at a UTC instant, degrees in [0, 360). */
export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  return normalize360(getTropicalSunLongitude(date) - computeAyanamsa(date, ayanamsaType));
}
