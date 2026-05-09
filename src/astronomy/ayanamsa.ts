import { PanchangError } from '../types/errors';
import type { AyanamsaType } from '../types/options';

/**
 * Compute the ayanamsa (precession offset) for a given UTC date.
 *
 * The ayanamsa is subtracted from the tropical (ecliptic) longitude to obtain
 * the sidereal longitude used in Vedic astrology.
 *
 * @param date UTC date to evaluate.
 * @param type Ayanamsa system: `'lahiri'` (default), `'raman'`, or `'krishnamurti'`.
 * @returns    Ayanamsa value in degrees. Typical range ~23–24° for dates near J2000.
 * @throws     `PanchangError` (INVALID_AYANAMSA) for unrecognised type strings.
 *
 * @example
 * ```typescript
 * import { getAyanamsa } from 'panchang-ts';
 * getAyanamsa(new Date('2025-01-01T00:00:00Z'), 'lahiri'); // ~24.10
 * ```
 */
export function computeAyanamsa(date: Date, type: AyanamsaType = 'lahiri'): number {
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

/**
 * True Chitrapaksha ayanamsa — anchored to Chitra star (Spica) at 180°
 * sidereal. Differs from Lahiri by ~1 arcsec at J2000 (Lahiri uses a
 * mean-Spica reference; True Chitra uses the actual stellar position).
 * The fractional offset is small in practice (~0.0006°).
 */
function trueChitraAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.853211 - 0.0006;
  const precessionArcsec = 5029.0966 * T + 1.112 * T * T - 0.000006 * T * T * T;
  return REF_J2000_DEG + precessionArcsec / 3600;
}

/**
 * Thirukanitham ayanamsa — Tamil-tradition variant used in some South
 * Indian (Vakya) panchangs. ~1.1 arcmin offset from Lahiri at J2000;
 * same precession rate.
 */
function thirukanithamAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.871667; // 23° 52' 18" per Tamil Vakya tradition
  const precessionArcsec = 5029.0966 * T + 1.112 * T * T - 0.000006 * T * T * T;
  return REF_J2000_DEG + precessionArcsec / 3600;
}

function lahiriAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.853211;
  const precessionArcsec = 5029.0966 * T + 1.112 * T * T - 0.000006 * T * T * T;
  return REF_J2000_DEG + precessionArcsec / 3600;
}

function ramanAyanamsa(T: number): number {
  const REF_J2000_DEG = 22.460489;
  const annualRateDeg = 50.3304 / 3600;
  return REF_J2000_DEG + annualRateDeg * T * 100;
}

function kpAyanamsa(T: number): number {
  const REF_J2000_DEG = 23.773606;
  const precessionArcsec = 5029.0966 * T + 1.112 * T * T - 0.000006 * T * T * T;
  return REF_J2000_DEG + precessionArcsec / 3600;
}

function julianCenturiesFromJ2000(date: Date): number {
  const jd = dateToJulianDay(date);
  return (jd - 2451545.0) / 36525.0;
}

export function dateToJulianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}
