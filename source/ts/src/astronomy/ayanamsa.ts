import { PanchangError } from '../types/errors';
import { validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';

/** Precession offset in degrees, subtracted from a tropical longitude to get the sidereal one; an Invalid Date throws `INVALID_DATE`. */
export function computeAyanamsa(date: Date, type: AyanamsaType = 'lahiri'): number {
  validateDate(date, 'any');
  const T = julianCenturiesFromJ2000(date);

  switch (type) {
    case 'lahiri':
      return lahiriAyanamsa(T);
    case 'raman':
      return ramanAyanamsa(T);
    case 'krishnamurti':
      return kpAyanamsa(T);
    case 'true-chitra':
      return trueChitraAyanamsa(T);
    case 'thirukanitham':
      return thirukanithamAyanamsa(T);
    default:
      throw new PanchangError(`Unknown ayanamsa type: ${type}`, 'INVALID_AYANAMSA');
  }
}

/** Solved from the reference almanac's published ayanamsa across 1950-2050; the literature figure is 38″ smaller. */
const LAHIRI_J2000_DEG = 23.863801;

/** IAU general precession in longitude, arcsec, T in Julian centuries from J2000. */
function precessionArcsec(T: number): number {
  return 5029.0966 * T + 1.112 * T * T - 0.000006 * T * T * T;
}

const AYANAMSA_OFFSET_FROM_LAHIRI = {
  trueChitra: -0.0006,
  kp: -0.079605,
  thirukanitham: +0.018456,
  /** Solved from Swiss Ephemeris `SE_SIDM_RAMAN` with nutation removed; the literature value is 3.6′ smaller and wrong. */
  raman: -1.453010,
} as const;

function trueChitraAyanamsa(T: number): number {
  return LAHIRI_J2000_DEG + AYANAMSA_OFFSET_FROM_LAHIRI.trueChitra + precessionArcsec(T) / 3600;
}

function thirukanithamAyanamsa(T: number): number {
  return LAHIRI_J2000_DEG + AYANAMSA_OFFSET_FROM_LAHIRI.thirukanitham + precessionArcsec(T) / 3600;
}

function lahiriAyanamsa(T: number): number {
  return LAHIRI_J2000_DEG + precessionArcsec(T) / 3600;
}

function ramanAyanamsa(T: number): number {
  return LAHIRI_J2000_DEG + AYANAMSA_OFFSET_FROM_LAHIRI.raman + precessionArcsec(T) / 3600;
}

function kpAyanamsa(T: number): number {
  return LAHIRI_J2000_DEG + AYANAMSA_OFFSET_FROM_LAHIRI.kp + precessionArcsec(T) / 3600;
}

function julianCenturiesFromJ2000(date: Date): number {
  const jd = dateToJulianDay(date);
  return (jd - 2451545.0) / 36525.0;
}

export function dateToJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}
