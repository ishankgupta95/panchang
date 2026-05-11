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
import type { LagnaInfo, SripatiLagnaInfo } from '../types/jyotish';

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
 * sunrise — half the rate of Hora Lagna (which advances 1 rashi per
 * hour, 30°/hour). Bhava Lagna completes a full zodiac in 24 hours.
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
 * **Sripati Lagna** — cusp 1 of the *Sripati Paddhati*, a 12th-century
 * Indian house system in which the 12 bhava midpoints (madhyas) are
 * obtained by trisecting each of the four ASC → IC → DSC → MC → ASC
 * ecliptic-arc quadrants. Cusp 1 (the *bhava 1 madhya*) coincides with
 * the natal ascendant by construction.
 *
 * **Default call (no options) returns {@link LagnaInfo}** — the natal
 * ascendant, unchanged from the cusp-1-only behaviour shipped before
 * Phase 34e. Pass `{ includeCusps: true }` as a fifth argument to
 * receive the {@link SripatiLagnaInfo} extension with all 12 bhava-
 * madhya longitudes (`cusps[0]` = lagna, `cusps[3]` = sidereal IC,
 * `cusps[6]` = descendant, `cusps[9]` = sidereal MC, opposite cusps
 * always 180° apart).
 *
 * The cusp formula is the classical Sripati Paddhati trisection
 * (BPHS Ch. 5):
 *
 * ```
 * arc_q1 = (IC  − ASC) mod 360;  arc_q3 = (MC  − DSC) mod 360
 * arc_q2 = (DSC − IC)  mod 360;  arc_q4 = (ASC − MC ) mod 360
 *
 * cusp_2  = ASC + arc_q1/3        cusp_3  = ASC + 2·arc_q1/3
 * cusp_5  = IC  + arc_q2/3        cusp_6  = IC  + 2·arc_q2/3
 * cusp_8  = DSC + arc_q3/3        cusp_9  = DSC + 2·arc_q3/3
 * cusp_11 = MC  + arc_q4/3        cusp_12 = MC  + 2·arc_q4/3
 * ```
 *
 * Unlike Placidus, Sripati cusps are defined at every latitude — there
 * is no circumpolar singularity, since the trisection is pure arithmetic
 * on already-defined ASC and MC longitudes.
 *
 * **Sources.** Sripati, *Sripati Paddhati* (~12th century); BPHS Ch. 5;
 * *Phaladeepika* Ch. 1; Wikipedia "Bhāva"; modern walkthroughs at
 * jothishi.com, planetarypositions.com, astrologershukla, Lalitha
 * Anamika's *Bhava Chalit Intro*. Drik panchang publishes no Sripati
 * cusp table on any of its 18 jyotish calculators; the formula is
 * unanimous across surveyed secondary sources, with no competing
 * intermediate-cusp algorithm proposed under the Sripati name.
 *
 * @example
 * ```typescript
 * // Default — backwards compatible (LagnaInfo only)
 * const lagna = computeSripatiLagna(date, location);
 *
 * // Opt-in cusp output
 * const sripati = computeSripatiLagna(date, location, 'lahiri', 'en',
 *                                     { includeCusps: true });
 * sripati.cusps[0];  // bhava 1 madhya (= lagna sidereal longitude)
 * sripati.cusps[9];  // bhava 10 madhya (= sidereal MC)
 * ```
 */
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType?: AyanamsaType,
  lang?: Language,
): LagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType | undefined,
  lang: Language | undefined,
  options: { includeCusps: true },
): SripatiLagnaInfo;
export function computeSripatiLagna(
  birthDate: Date,
  location: GeoLocation,
  ayanamsaType: AyanamsaType = 'lahiri',
  lang: Language = 'en',
  options?: { includeCusps?: boolean },
): LagnaInfo | SripatiLagnaInfo {
  const lagna = computeLagna(birthDate, location, ayanamsaType, lang);
  if (!options?.includeCusps) return lagna;

  // Sidereal MC via Meeus' tropical-MC formula: λ_MC = atan2(sin θ, cos θ · cos ε).
  // Replicated inline rather than importing computeBhava to avoid the
  // bhava.ts → lagna.ts back-edge (bhava.ts already imports computeLagna).
  const gastHours = SiderealTime(birthDate);
  const lstDeg = normalize360(gastHours * 15 + location.longitude);
  const θ = degToRad(lstDeg);
  const T = (dateToJulianDay(birthDate) - 2451545.0) / 36525.0;
  const ε = degToRad(meanObliquity(T));
  const mcTropical = normalize360(
    (Math.atan2(Math.sin(θ), Math.cos(θ) * Math.cos(ε)) * 180) / Math.PI,
  );
  const ayanamsa = computeAyanamsa(birthDate, ayanamsaType);
  const mcSidereal = normalize360(mcTropical - ayanamsa);

  return { ...lagna, cusps: sripatiCusps(lagna.siderealLongitude, mcSidereal) };
}

/**
 * Trisect the four ASC → IC → DSC → MC quadrants to produce all 12
 * Sripati bhava-madhya cusps. Pure mod-360 arithmetic; opposite cusps
 * are guaranteed to differ by exactly 180° by construction.
 */
function sripatiCusps(ascSidereal: number, mcSidereal: number): number[] {
  const ASC = normalize360(ascSidereal);
  const MC  = normalize360(mcSidereal);
  const IC  = normalize360(MC + 180);
  const DSC = normalize360(ASC + 180);

  const arc_q1 = normalize360(IC  - ASC);
  const arc_q2 = normalize360(DSC - IC);
  const arc_q3 = normalize360(MC  - DSC);
  const arc_q4 = normalize360(ASC + 360 - MC);

  return [
    ASC,                                  // 1  — bhava 1 madhya = lagna
    normalize360(ASC + arc_q1 / 3),       // 2
    normalize360(ASC + 2 * arc_q1 / 3),   // 3
    IC,                                   // 4  — bhava 4 madhya = IC
    normalize360(IC  + arc_q2 / 3),       // 5
    normalize360(IC  + 2 * arc_q2 / 3),   // 6
    DSC,                                  // 7  — bhava 7 madhya = descendant
    normalize360(DSC + arc_q3 / 3),       // 8
    normalize360(DSC + 2 * arc_q3 / 3),   // 9
    MC,                                   // 10 — bhava 10 madhya = MC
    normalize360(MC  + arc_q4 / 3),       // 11
    normalize360(MC  + 2 * arc_q4 / 3),   // 12
  ];
}
