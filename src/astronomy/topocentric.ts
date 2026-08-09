/**
 * Earth-rotation and observer geometry: sidereal time, the observer's own
 * position, and the conversion from an ecliptic-of-date longitude/latitude to
 * the altitude a person at a given place would measure.
 *
 * This is Phase 36.3's frame layer, and it is what the rise/set solver, the
 * ascendant, the bhava cusps and the upagraha horizon reads all sit on. It
 * replaces `SiderealTime`, `Observer`, `Equator` and `Horizon`.
 *
 * ## Sidereal time
 *
 * GAST = ERA + the IAU 2006 accumulated-precession polynomial + the equation of
 * the equinoxes. Splitting it that way rather than using a single GMST
 * polynomial is not decoration: **ERA is a function of UT1 and the polynomial
 * is a function of TT**, and conflating them puts ΔT — 69 s today, and growing
 * — into the Earth's rotation angle, where it is worth 0.29″ of longitude per
 * second. Keeping them apart is also what makes the ΔT exposure documented in
 * `deltaT.ts` stay confined to where it belongs.
 *
 * ## Why the observer is an ellipsoid and not a point
 *
 * For the Sun this barely matters. For the Moon it is the whole game: the
 * Moon's horizontal parallax is about 57′, more than a degree of apparent
 * displacement, so a geocentric moonrise is wrong by minutes. The observer's
 * geocentric vector is therefore computed on the WGS84 ellipsoid — flattening
 * included, because the 21 km difference between the equatorial and polar radii
 * is itself worth ~11″ of parallax.
 */
import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from './frame';
import { ttDaysSinceJ2000 } from './deltaT';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** WGS84 equatorial radius, km. */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;
/** Polar / equatorial radius ratio, WGS84. */
const EARTH_FLATTENING = 0.996647180302104;
/**
 * Squared flattening ratio. Exported because the rise/set solver hoists the
 * observer's ellipsoid constants out of its inner loop — they depend only on
 * latitude, and recomputing them per probe was measurable.
 */
export const EARTH_FLATTENING_SQUARED = EARTH_FLATTENING * EARTH_FLATTENING;

/** Solar radius as a fraction of an AU — for the "upper limb" rise convention. */
export const SUN_RADIUS_AU = 695700.0 / AU_KM;
/** Lunar equatorial radius, km. */
export const MOON_RADIUS_KM = 1738.1;

/**
 * Refractive "lift" assumed for a body on the horizon, degrees.
 *
 * 34 arcminutes is the conventional value — it is what almanacs, and
 * `astronomy-engine` before it, use to define rise and set. It is a *standard*,
 * not a measurement: real refraction at the horizon swings by several
 * arcminutes with temperature and pressure, which at sunrise is worth tens of
 * seconds. Keeping the same convention is what makes this port's rise times
 * comparable to the ones it replaces.
 */
export const REFRACTION_NEAR_HORIZON_DEG = 34 / 60;

/**
 * Greenwich Apparent Sidereal Time, degrees in [0, 360).
 *
 * @param ttDays  Days of Terrestrial Time from J2000.0.
 * @param utDays  Days of UT from J2000.0 — the Earth's rotation angle is a
 *                function of UT1, never of TT.
 */
export function gastDegrees(ttDays: number, utDays: number): number {
  // Earth Rotation Angle (IAU 2000): a linear function of UT1, by definition.
  // Split as integer + fraction so the accumulated turns never eat the
  // precision of the part that matters — at 2100 the unsplit product is ~10⁵
  // turns and would leave microsecond resolution at best.
  const theta = 360 * (((0.7790572732640 + 0.00273781191135448 * utDays) % 1 + (utDays % 1)) % 1);

  const t = ttDays / 36525;
  const { dpsi } = nutation(t);
  const trueObliquity = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  // Equation of the equinoxes: the difference between the true and mean
  // equinox projected onto the equator.
  const eqeq = dpsi * Math.cos(trueObliquity);
  // IAU 2006 accumulated precession in right ascension, arcseconds.
  const precession = 0.014506
    + (4612.156534 + (1.3915817 + (-0.00000044 + (-0.000029956 + -0.0000000368 * t) * t) * t) * t) * t;

  const gast = (theta + (eqeq + precession) / 3600) % 360;
  return gast < 0 ? gast + 360 : gast;
}

/**
 * The observer's geocentric position, AU, in the true equatorial frame of date.
 *
 * `latitude` is geodetic — the latitude on a map. The ellipsoid correction
 * turns it into the geocentric radius vector, which is what a parallax
 * subtraction needs.
 */
export function observerVector(
  latitudeDeg: number, longitudeDeg: number, elevationM: number, gastDeg: number,
  out: Float64Array,
): void {
  const phi = latitudeDeg * DEG_TO_RAD;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const c = 1 / Math.hypot(cosPhi, EARTH_FLATTENING * sinPhi);
  const s = EARTH_FLATTENING_SQUARED * c;
  const heightKm = elevationM / 1000;
  const ach = EARTH_EQUATORIAL_RADIUS_KM * c + heightKm;
  const ash = EARTH_EQUATORIAL_RADIUS_KM * s + heightKm;
  const local = (gastDeg + longitudeDeg) * DEG_TO_RAD;
  out[0] = (ach * cosPhi * Math.cos(local)) / AU_KM;
  out[1] = (ach * cosPhi * Math.sin(local)) / AU_KM;
  out[2] = (ash * sinPhi) / AU_KM;
}

/**
 * Ecliptic of date (degrees, degrees, distance) → true equatorial of date,
 * rectangular, in the units the distance was given in.
 */
export function eclipticToEquatorial(
  lonDeg: number, latDeg: number, distance: number, t: number, out: Float64Array,
): void {
  const eps = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  const lon = lonDeg * DEG_TO_RAD;
  const lat = latDeg * DEG_TO_RAD;
  const cosLat = Math.cos(lat);
  const x = distance * cosLat * Math.cos(lon);
  const y = distance * cosLat * Math.sin(lon);
  const z = distance * Math.sin(lat);
  const cosEps = Math.cos(eps);
  const sinEps = Math.sin(eps);
  out[0] = x;
  out[1] = cosEps * y - sinEps * z;
  out[2] = sinEps * y + cosEps * z;
}

/**
 * Geometric altitude of a direction, degrees, unrefracted.
 *
 * `vec` is the **topocentric** equatorial-of-date vector — the observer's own
 * position already subtracted. The zenith is built from the geodetic latitude,
 * which is the direction a plumb line points, and spun by the local sidereal
 * angle.
 */
export function altitudeDegrees(
  vec: Float64Array, latitudeDeg: number, longitudeDeg: number, gastDeg: number,
): number {
  const phi = latitudeDeg * DEG_TO_RAD;
  const local = (gastDeg + longitudeDeg) * DEG_TO_RAD;
  const cosPhi = Math.cos(phi);
  // Unit vector toward the observer's zenith, in the same frame as `vec`.
  const zx = cosPhi * Math.cos(local);
  const zy = cosPhi * Math.sin(local);
  const zz = Math.sin(phi);
  const length = Math.hypot(vec[0] as number, vec[1] as number, vec[2] as number);
  if (length === 0) return 0;
  const dot = ((vec[0] as number) * zx + (vec[1] as number) * zy + (vec[2] as number) * zz) / length;
  return Math.asin(Math.max(-1, Math.min(1, dot))) * RAD_TO_DEG;
}

/**
 * Greenwich Apparent Sidereal Time at a UTC instant, degrees in [0, 360).
 *
 * The `Date`-taking form, for the ascendant and the bhava cusps. Everything
 * inside the rise/set solver uses {@link gastDegrees} directly, because there
 * the day's ΔT is already in hand and re-deriving it per probe would be the
 * single most expensive thing in the loop.
 */
export function greenwichApparentSiderealDegrees(date: Date): number {
  return gastDegrees(
    ttDaysSinceJ2000(date),
    (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000,
  );
}


/**
 * Atmospheric refraction at a given geometric altitude, degrees — Saemundsson's
 * formula as given by Meeus, *Astronomical Algorithms* ch. 16.
 *
 * The clamp at −1° is not cosmetic: the expression has a pole near −5.11° and
 * diverges before it, so an unclamped call on a body well below the horizon
 * returns nonsense. Below −1° the correction is faded linearly toward the
 * nadir, which keeps the refracted altitude monotonic in the geometric one —
 * the property any threshold test on it depends on.
 */
export function refractionDegrees(geometricAltitudeDeg: number): number {
  if (geometricAltitudeDeg < -90 || geometricAltitudeDeg > 90) return 0;
  const clamped = Math.max(geometricAltitudeDeg, -1);
  let refraction = 1.02 / Math.tan((clamped + 10.3 / (clamped + 5.11)) * DEG_TO_RAD) / 60;
  if (geometricAltitudeDeg < -1) refraction *= (geometricAltitudeDeg + 90) / 89;
  return refraction;
}
