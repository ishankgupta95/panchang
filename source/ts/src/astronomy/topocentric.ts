import { nutation, meanObliquityArcsec, ARCSEC_TO_RAD, AU_KM } from './frame';
import { ttDaysSinceJ2000 } from './deltaT';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export const EARTH_EQUATORIAL_RADIUS_KM = 6378.1366;
/** Polar / equatorial radius ratio, WGS84. */
const EARTH_FLATTENING = 0.996647180302104;
export const EARTH_FLATTENING_SQUARED = EARTH_FLATTENING * EARTH_FLATTENING;

export const SUN_RADIUS_AU = 695700.0 / AU_KM;
export const MOON_RADIUS_KM = 1738.1;

/** 34′ is the almanac convention that *defines* rise and set, not a measurement. */
export const REFRACTION_NEAR_HORIZON_DEG = 34 / 60;

/** `utDays` drives rotation (UT1), `ttDays` precession (TT). */
export function gastDegrees(ttDays: number, utDays: number): number {
  const theta = 360 * (((0.7790572732640 + 0.00273781191135448 * utDays) % 1 + (utDays % 1)) % 1);

  const t = ttDays / 36525;
  const { dpsi } = nutation(t);
  const trueObliquity = (meanObliquityArcsec(t) + nutation(t).deps) * ARCSEC_TO_RAD;
  const eqeq = dpsi * Math.cos(trueObliquity);
  const precession = 0.014506
    + (4612.156534 + (1.3915817 + (-0.00000044 + (-0.000029956 + -0.0000000368 * t) * t) * t) * t) * t;

  const gast = (theta + (eqeq + precession) / 3600) % 360;
  return gast < 0 ? gast + 360 : gast;
}

/** AU, equatorial of date; `latitudeDeg` is geodetic. */
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

/** Unrefracted, degrees; `vec` must already be topocentric. */
export function altitudeDegrees(
  vec: Float64Array, latitudeDeg: number, longitudeDeg: number, gastDeg: number,
): number {
  const phi = latitudeDeg * DEG_TO_RAD;
  const local = (gastDeg + longitudeDeg) * DEG_TO_RAD;
  const cosPhi = Math.cos(phi);
  const zx = cosPhi * Math.cos(local);
  const zy = cosPhi * Math.sin(local);
  const zz = Math.sin(phi);
  const length = Math.hypot(vec[0] as number, vec[1] as number, vec[2] as number);
  if (length === 0) return 0;
  const dot = ((vec[0] as number) * zx + (vec[1] as number) * zy + (vec[2] as number) * zz) / length;
  return Math.asin(Math.max(-1, Math.min(1, dot))) * RAD_TO_DEG;
}

export function greenwichApparentSiderealDegrees(date: Date): number {
  return gastDegrees(
    ttDaysSinceJ2000(date),
    (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000,
  );
}

/** Saemundsson refraction, degrees (Meeus ch. 16). The −1° clamp guards a pole near
 * −5.11°; the fade below it keeps refraction monotonic, as the rise/set search needs. */
export function refractionDegrees(geometricAltitudeDeg: number): number {
  if (geometricAltitudeDeg < -90 || geometricAltitudeDeg > 90) return 0;
  const clamped = Math.max(geometricAltitudeDeg, -1);
  let refraction = 1.02 / Math.tan((clamped + 10.3 / (clamped + 5.11)) * DEG_TO_RAD) / 60;
  if (geometricAltitudeDeg < -1) refraction *= (geometricAltitudeDeg + 90) / 89;
  return refraction;
}
