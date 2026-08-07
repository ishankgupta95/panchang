import { ttDaysSinceJ2000 } from './deltaT';
import {
  moonElpLongitude, moonElpLatitude, moonElpLatitudeCoarse,
  moonElpDistance, moonElpDistanceTrack, moonElpDistanceCoarse,
} from './elp';
import { nutation, elpToEclipticOfDate, KM_PER_LIGHT_DAY } from './frame';
import { computeAyanamsa } from './ayanamsa';
import { normalize360 } from '../utils/angle';
import type { AyanamsaType } from '../types/options';

const RAD_TO_DEG = 180 / Math.PI;

/** Scratch vector for the frame rotation — the hot path allocates nothing. */
const ROTATED = new Float64Array(3);

/**
 * Apparent geocentric position of the Moon, true ecliptic and equinox of date.
 *
 * ## Light-time
 *
 * The Moon is seen where it was 1.28 seconds ago, and it moves 0.549″ per
 * second, so the retardation is worth +0.706″ — predicted from those two
 * numbers before it was measured, then measured at 0.7062″. `astronomy-engine`
 * omitted it (`GeoVector(Body.Moon, t, true)` returns output bit-identical to
 * `GeoMoon`, so it could not simply be asked for either), and applying it cuts
 * the max error against DE441 by 18%, from 3.75″ to 3.07″ on that code and
 * from 2.00″ to 1.29″ on this one.
 *
 * There is no separate stellar-aberration term, and its absence is not an
 * oversight. For a geocentric body the observer's barycentric velocity is
 * shared by the target, so annual aberration and the barycentric part of the
 * light-time displacement cancel; the geocentric retardation applied here is
 * what survives. The measurement confirms it — the residual bias is +0.38″, not
 * the ~20″ an unmatched aberration term would leave.
 *
 * The whole position chain, ELP series and frame rotation alike, is evaluated
 * at the retarded epoch, while nutation is evaluated at the observation epoch.
 * Referring the result to the mean equinox of `t − τ` rather than of `t` costs
 * 5029″/century × 1.28 s = 2 × 10⁻⁶″, six orders of magnitude below the
 * truncation budget, and keeping one epoch through the chain is worth more than
 * chasing that.
 */
export interface MoonPosition {
  /** Apparent longitude, degrees in [0, 360). */
  longitude: number;
  /** Apparent latitude, degrees. */
  latitude: number;
  /** Geocentric distance, km. */
  distance: number;
}

/** Retarded epoch in Julian centuries of TT, given the observation epoch. */
function retardedCenturies(ttDays: number): number {
  return (ttDays - moonElpDistanceCoarse(ttDays / 36525) / KM_PER_LIGHT_DAY) / 36525;
}

/**
 * Apparent geocentric longitude of the Moon, degrees.
 *
 * The distance and latitude reads use the coarse series (22 and 36 terms), not
 * the full ones: they enter only through the light-time and through the
 * ecliptic's own ~47″/century tilt in the frame rotation, where they are worth
 * 0.0002″ and 0.005″ — a fortieth of the 0.2″ truncation budget. Callers that
 * need the distance itself want {@link getMoonPosition}, which is roughly three
 * times the cost.
 */
export function getTropicalMoonLongitude(date: Date): number {
  const ttDays = ttDaysSinceJ2000(date);
  const t = retardedCenturies(ttDays);
  elpToEclipticOfDate(moonElpLongitude(t), moonElpLatitudeCoarse(t), 1, t, ROTATED);
  const lon = Math.atan2(ROTATED[1] as number, ROTATED[0] as number) * RAD_TO_DEG;
  return normalize360(lon + nutation(ttDays / 36525).dpsi / 3600);
}

/**
 * Full apparent position — longitude, latitude and distance. Used by the
 * eclipse geometry, which needs all three at full precision; the panchang
 * elements need only {@link getTropicalMoonLongitude}, and the rise/set track
 * wants {@link getMoonPositionForTrack}.
 */
export function getMoonPosition(date: Date): MoonPosition {
  return moonPositionWith(date, moonElpLatitude, moonElpDistance);
}

/**
 * Apparent position for the rise/set track: **full** latitude, reduced distance
 * (88 terms against 623).
 *
 * The asymmetry was measured, not assumed. Latitude and distance enter rise/set
 * through completely different paths:
 *
 * - **Latitude is declination**, and declination error converts to time error
 *   by dividing by the body's altitude rate. At mid-latitude that rate is
 *   ~15″ per second, so 1″ is 0.07 s — but where the Moon *grazes* the horizon
 *   the rate approaches zero and the division blows up. A 1″ latitude tier
 *   measured **402 ms** of moonrise error at Alert, 82.5 °N. It is not worth
 *   2.4 µs.
 * - **Distance is parallax**, which enters as a ratio: 5 km against 384,400 km
 *   moves the 57′ horizontal parallax by 0.04″, and unlike declination it does
 *   not divide by anything small. Dropping 535 terms there costs 0.003 s
 *   everywhere, including at Alert.
 *
 * So the tier survives for distance and not for latitude.
 */
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

/**
 * Sidereal longitude of the Moon at a given UTC instant.
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system: `'lahiri'`, `'raman'`, or `'krishnamurti'`.
 * @returns             Sidereal longitude in degrees, normalized to [0, 360).
 *
 * @example
 * ```typescript
 * import { getSiderealMoonLongitude } from 'panchang-ts';
 * const lon = getSiderealMoonLongitude(new Date('2025-01-14T12:00:00Z'), 'lahiri');
 * // ~96.5° — Moon in Karka (Cancer) rashi, Punarvasu nakshatra
 * ```
 */
export function getSiderealMoonLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  return normalize360(getTropicalMoonLongitude(date) - computeAyanamsa(date, ayanamsaType));
}
