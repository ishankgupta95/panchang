import { SiderealTime } from 'astronomy-engine';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { computeSunrise } from '../astronomy/sunrise';
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

// ── Special lagnas (Hora / Ghati / Bhava / Sripati) ────

/**
 * Locate the most recent sunrise at or before the given UTC instant for
 * the given location. Used by the time-derived special lagnas
 * (Hora / Ghati / Bhava) which advance from the *day's* sunrise.
 *
 * `astronomy-engine.SearchRiseSet` only searches forward, so we step
 * back ~30 h to seed the search and then walk forward day-by-day until
 * the next sunrise would exceed `date`. This handles all three cases:
 *
 *   - `date` mid-day → returns the morning's sunrise.
 *   - `date` between midnight and sunrise → returns the prior day's sunrise.
 *   - `date` itself a sunrise instant → returns that sunrise (the loop
 *     stops when the *next* sunrise strictly exceeds `date`).
 *
 * @internal — exported via `_findSunriseBeforeForTest` for unit tests.
 */
function findSunriseBefore(date: Date, location: GeoLocation): Date {
  const back30h = new Date(date.getTime() - 30 * 3600_000);
  let candidate = computeSunrise(back30h, location);
  // Walk forward by safe < 24 h hops (22 h chosen to never overshoot a
  // single solar day) until the *next* sunrise is strictly after `date`.
  // Bound iterations to defend against pathological polar inputs that
  // slipped past `validateLocation`.
  for (let i = 0; i < 4; i++) {
    const lookAhead = new Date(candidate.getTime() + 22 * 3600_000);
    const next = computeSunrise(lookAhead, location);
    if (next.getTime() > date.getTime()) return candidate;
    candidate = next;
  }
  return candidate;
}

/** @internal */
export const _findSunriseBeforeForTest = findSunriseBefore;

/**
 * Build a `LagnaInfo` from a raw sidereal longitude (no recomputation —
 * just the shape conversion). Used by the special-lagna helpers below
 * to avoid duplicating the rashi / nakshatra / pada decomposition.
 */
function buildLagnaInfo(siderealLongitude: number, lang: Language): LagnaInfo {
  const sid = normalize360(siderealLongitude);
  const rashiIndex = Math.floor(sid / 30);
  const degreeInRashi = sid - rashiIndex * 30;
  const nakIdx = Math.floor(sid / NAKSHATRA_SPAN);
  const degreesInNakshatra = sid - nakIdx * NAKSHATRA_SPAN;
  const pada = Math.min(4, Math.floor(degreesInNakshatra / NAKSHATRA_PADA_SPAN) + 1);
  return {
    siderealLongitude: sid,
    rashi: { index: rashiIndex, name: resolveMasaName(rashiIndex, lang) },
    degreeInRashi,
    nakshatra: { index: nakIdx, name: resolveNakshatraName(nakIdx, lang) },
    pada,
  };
}

/**
 * **Hora Lagna** — a time-derived sensitive lagna that advances 1 rashi
 * per **1 hour** (= 30°/hour) from sunrise, per the BPHS Ch. 4 /
 * Phaladeepika Ch. 1 standard definition.
 *
 * Algorithm:
 * ```
 * sunrise = sunrise on or before birthDate
 * hoursSinceSunrise = (birthDate − sunrise) / 1 hour
 * horaLagna = ascAtSunrise + (hoursSinceSunrise × 30°) mod 360°
 * ```
 *
 * `ascAtSunrise` is the sidereal ecliptic longitude of the ascendant at
 * the prior sunrise (computed via {@link computeLagna}). The 30°/hour
 * advance completes a full zodiac in 12 hours.
 *
 * **Sources.** BPHS Ch. 4; *Phaladeepika* Ch. 1; Astroyogi & Wikidot
 * Astroveda (1 sign per hour). Hora Lagna is **distinct** from Bhava
 * Lagna (which advances at 15°/hour = 1 sign per 2 hours).
 *
 * @example
 * ```typescript
 * import { computeHoraLagna } from 'panchang-ts';
 * const hl = computeHoraLagna(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * hl.rashi.name;           // Hora-Lagna rashi
 * hl.siderealLongitude;    // sidereal degrees
 * ```
 */
export function computeHoraLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  const ascAtSunrise = computeLagna(sunrise, location, ayanamsaType, lang).siderealLongitude;
  const hoursSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / 3600_000;
  const horaLon = ascAtSunrise + hoursSinceSunrise * 30;
  return buildLagnaInfo(horaLon, lang);
}

/**
 * **Ghati Lagna** — advances 1 rashi per **1 ghatika** (24 minutes)
 * from sunrise. The fastest of the special lagnas.
 *
 * ```
 * ghatikasSinceSunrise = (birthDate − sunrise) / 24 minutes
 * ghatiLagna = ascAtSunrise + (ghatikasSinceSunrise × 30°) mod 360°
 * ```
 *
 * Equivalent to `ascAtSunrise + hoursSinceSunrise × 75°` — one full
 * cycle every 4 hours and 48 minutes.
 *
 * **Sources.** BPHS Ch. 4; *Phaladeepika* Ch. 1.
 */
export function computeGhatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  const ascAtSunrise = computeLagna(sunrise, location, ayanamsaType, lang).siderealLongitude;
  const ghatikasSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / (24 * 60 * 1000);
  const ghatiLon = ascAtSunrise + ghatikasSinceSunrise * 30;
  return buildLagnaInfo(ghatiLon, lang);
}

/**
 * **Bhava Lagna** — advances 1 rashi per **5 ghatikas** (2 hours) from
 * sunrise. Same advance-rate as Hora Lagna under this library's
 * definition (15°/hour); the two are conceptually distinct anchors in
 * classical practice but produce identical longitudes here.
 *
 * ```
 * bhavaLagna = ascAtSunrise + (hoursSinceSunrise × 15°) mod 360°
 * ```
 *
 * **Sources.** BPHS Ch. 4; *Phaladeepika* Ch. 1 (1 rashi per 5
 * ghatikas).
 */
export function computeBhavaLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  validateDate(birthDate);
  validateLocation(location);
  const sunrise = findSunriseBefore(birthDate, location);
  const ascAtSunrise = computeLagna(sunrise, location, ayanamsaType, lang).siderealLongitude;
  const hoursSinceSunrise = (birthDate.getTime() - sunrise.getTime()) / 3600_000;
  const bhavaLon = ascAtSunrise + hoursSinceSunrise * 15;
  return buildLagnaInfo(bhavaLon, lang);
}

/**
 * **Sripati Lagna** — the cusp-1 of the *Sripati Paddhati* (a classical
 * Indian house system closely related to Placidus). Currently exposed
 * as the Placidus-KP first cusp, which equals the natal lagna by
 * construction in that system.
 *
 * The Sripati Paddhati distinguishes between *cusps* (the boundaries
 * computed by Placidus) and *bhavas* (whose midpoints fall at adjacent
 * Placidus midpoints). This function returns the **cusp** form for
 * lagna analysis; the midpoint-of-cusps interpretation is a future
 * extension.
 *
 * **Sources.** Sripati, *Sripati Paddhati* (~12th century); BPHS Ch. 4;
 * *Phaladeepika* Ch. 1.
 */
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
): LagnaInfo {
  // Sripati cusp 1 = natal lagna (the ascendant at the moment of birth).
  // The Sripati Paddhati's distinction is in the bhava midpoints, not in
  // the lagna itself.
  return computeLagna(birthDate, location, ayanamsaType, lang);
}
