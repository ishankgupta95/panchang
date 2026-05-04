import { SiderealTime } from 'astronomy-engine';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { meanObliquity } from './planets';
import { resolveNakshatraName, resolveMasaName } from '../i18n/resolver';
import { normalize360, degToRad } from '../utils/angle';
import { NAKSHATRA_SPAN, NAKSHATRA_PADA_SPAN } from '../utils/constants';
import { validateLocation, validateDate } from '../utils/validation';
import type { AyanamsaType, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { LagnaInfo } from '../types/jyotish';

/**
 * Compute the lagna (ascendant) — the sidereal ecliptic longitude rising on
 * the eastern horizon at the given instant for the given location.
 *
 * Algorithm (Meeus, *Astronomical Algorithms* 2nd ed. ch. 13):
 *
 *   λ_asc(tropical) = atan2(cos θ, −sin(ε)·tan(φ) − cos(ε)·sin θ)
 *
 * where θ is the local apparent sidereal time, φ the geographic latitude,
 * and ε the mean obliquity of the ecliptic. The result is converted to
 * sidereal (Vedic) by subtracting the ayanamsa.
 *
 * The local apparent sidereal time θ uses Greenwich apparent sidereal time
 * from astronomy-engine's `SiderealTime` (already accounts for nutation and
 * Earth-rotation theory) plus the geographic longitude (positive east).
 *
 * @param birthDate    Instant of birth in UTC.
 * @param location     Geographic location of birth (decimal degrees).
 * @param ayanamsaType Sidereal system to subtract from the tropical longitude.
 *                     Defaults to `'lahiri'` (Indian government standard).
 * @param lang         Output language for `rashi.name` and `nakshatra.name`.
 *                     Defaults to `'en'`.
 * @returns            `LagnaInfo` — sidereal longitude, rashi, degree-in-rashi,
 *                     nakshatra, and pada (1..4).
 *
 * @throws `PanchangError` if `birthDate` is invalid or out of supported range,
 *         or if `location` is malformed.
 *
 * @example
 * ```typescript
 * import { computeLagna } from 'panchang-ts';
 *
 * const lagna = computeLagna(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },  // New Delhi
 *   'lahiri',
 *   'en',
 * );
 * lagna.rashi.name;      // e.g. 'Simha'
 * lagna.nakshatra.name;  // e.g. 'Magha'
 * lagna.pada;            // 1..4
 * ```
 */
export function computeLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);

  // Greenwich apparent sidereal time (hours) → degrees, then add longitude.
  const gastHours = SiderealTime(birthDate);
  const lstDeg = normalize360(gastHours * 15 + location.longitude);
  const θ = degToRad(lstDeg);

  const T = (dateToJulianDay(birthDate) - 2451545.0) / 36525.0;
  const ε = degToRad(meanObliquity(T));
  const φ = degToRad(location.latitude);

  // Tropical ecliptic longitude of the ascendant (Meeus eq. 13.6, atan2 form).
  const numerator = Math.cos(θ);
  const denominator = -Math.sin(ε) * Math.tan(φ) - Math.cos(ε) * Math.sin(θ);
  const tropicalLagna = normalize360((Math.atan2(numerator, denominator) * 180) / Math.PI);

  const ayanamsa = computeAyanamsa(birthDate, ayanamsaType);
  const siderealLongitude = normalize360(tropicalLagna - ayanamsa);

  const rashiIndex = Math.floor(siderealLongitude / 30);
  const degreeInRashi = siderealLongitude - rashiIndex * 30;
  const nakIdx = Math.floor(siderealLongitude / NAKSHATRA_SPAN);
  const degreesInNakshatra = siderealLongitude - nakIdx * NAKSHATRA_SPAN;
  const pada = Math.min(4, Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1);

  return {
    siderealLongitude,
    rashi: { index: rashiIndex, name: resolveMasaName(rashiIndex, lang) },
    degreeInRashi,
    nakshatra: { index: nakIdx, name: resolveNakshatraName(nakIdx, lang) },
    pada,
  };
}
