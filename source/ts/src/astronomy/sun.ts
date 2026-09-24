import { ttDaysSinceJ2000 } from './deltaT';
import { evaluateVsop, millennia, earthRadiusCoarse } from './vsop87';
import { EAR_L, EAR_B, EAR_R } from './series/vsop87d';
import { nutation, AU_KM, KM_PER_LIGHT_DAY, VSOP_TO_FK5_ARCSEC, VSOP_TO_FK5_LAT_ARCSEC } from './frame';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

/** `heliocentricLongitude('earth', …)` and its siblings, read off the Earth tables directly: the
 * generic helpers index a record of every planet's series, which would keep all of them in a
 * bundle that needs only the Sun. The same arrays and the same arithmetic. */
const earthLongitude = (ttDays: number): number => evaluateVsop(EAR_L, millennia(ttDays));
const earthLatitude = (ttDays: number): number => evaluateVsop(EAR_B, millennia(ttDays));
const earthRadius = (ttDays: number): number => evaluateVsop(EAR_R, millennia(ttDays));

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
  const lon = earthLongitude(retarded) * RAD_TO_DEG + 180;
  return normalize360(
    lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600,
  );
}

export function getSunPosition(date: Date): SunPosition {
  const ttDays = ttDaysSinceJ2000(date);
  const retarded = ttDays - (earthRadiusCoarse(ttDays) * AU_KM) / KM_PER_LIGHT_DAY;
  const lon = earthLongitude(retarded) * RAD_TO_DEG + 180;
  const lat = -earthLatitude(retarded) * RAD_TO_DEG;
  return {
    longitude: normalize360(lon + (nutation(ttDays / 36525).dpsi + VSOP_TO_FK5_ARCSEC) / 3600),
    latitude: lat + (VSOP_TO_FK5_LAT_ARCSEC / 3600) * (Math.cos(lon * DEG_TO_RAD) - Math.sin(lon * DEG_TO_RAD)),
    distance: earthRadius(retarded),
  };
}

/** Sidereal longitude of the Sun at a UTC instant, degrees in [0, 360); an Invalid Date throws `INVALID_DATE`. */
export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  validateDate(date, 'any');
  return normalize360(getTropicalSunLongitude(date) - computeAyanamsa(date, ayanamsaType));
}
