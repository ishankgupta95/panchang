import { ttDaysSinceJ2000 } from './deltaT';
import {
  moonElpLongitude, moonElpLatitude, moonElpLatitudeCoarse,
  moonElpDistance, moonElpDistanceTrack, moonElpDistanceCoarse,
} from './elp';
import { nutation, elpToEclipticOfDate, KM_PER_LIGHT_DAY } from './frame';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';

const RAD_TO_DEG = 180 / Math.PI;

const ROTATED = /* @__PURE__ */ new Float64Array(3);

/** True ecliptic and equinox of date. Light-time is applied; stellar aberration
 * deliberately is not, cancelling for a geocentric body. */
export interface MoonPosition {
  longitude: number;
  latitude: number;
  /** Kilometres. */
  distance: number;
}

function retardedCenturies(ttDays: number): number {
  return (ttDays - moonElpDistanceCoarse(ttDays / 36525) / KM_PER_LIGHT_DAY) / 36525;
}

/** Degrees. Distance and latitude use the coarse series deliberately: they enter only
 * via light-time and the frame rotation. */
export function getTropicalMoonLongitude(date: Date): number {
  const ttDays = ttDaysSinceJ2000(date);
  const t = retardedCenturies(ttDays);
  elpToEclipticOfDate(moonElpLongitude(t), moonElpLatitudeCoarse(t), 1, t, ROTATED);
  const lon = Math.atan2(ROTATED[1] as number, ROTATED[0] as number) * RAD_TO_DEG;
  return normalize360(lon + nutation(ttDays / 36525).dpsi / 3600);
}

export function getMoonPosition(date: Date): MoonPosition {
  return moonPositionWith(date, moonElpLatitude, moonElpDistance);
}

/** Full latitude, reduced distance: latitude error divides by an altitude rate that
 * vanishes at a grazing horizon crossing, distance only by a parallax ratio. */
export function getMoonPositionForTrack(date: Date): MoonPosition {
  return moonPositionWith(date, moonElpLatitude, moonElpDistanceTrack);
}

function moonPositionWith(
  date: Date, latitudeAt: (t: number) => number, distanceAt: (t: number) => number,
): MoonPosition {
  const ttDays = ttDaysSinceJ2000(date);
  const t = retardedCenturies(ttDays);
  const distance = distanceAt(t);
  elpToEclipticOfDate(moonElpLongitude(t), latitudeAt(t), distance, t, ROTATED);
  const x = ROTATED[0] as number, y = ROTATED[1] as number, z = ROTATED[2] as number;
  return {
    longitude: normalize360(Math.atan2(y, x) * RAD_TO_DEG + nutation(ttDays / 36525).dpsi / 3600),
    latitude: Math.asin(z / distance) * RAD_TO_DEG,
    distance,
  };
}

/** Sidereal longitude of the Moon at a UTC instant, degrees in [0, 360); an Invalid Date throws `INVALID_DATE`. */
export function getSiderealMoonLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  validateDate(date, 'any');
  return normalize360(getTropicalMoonLongitude(date) - computeAyanamsa(date, ayanamsaType));
}
