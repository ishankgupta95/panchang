import { getTropicalPlanetLongitude, type PlanetBody } from '../astronomy/planet';
import { computeAyanamsa, dateToJulianDay } from '../astronomy/ayanamsa';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeNakshatraFromLongitude } from '../core/nakshatra';
import { normalize360 } from '../utils/angle';
import { nakshatraOf } from '../utils/constants';
import type { AyanamsaType } from '../types/options';
import type { GrahaPosition, GrahaName, PlanetaryPositions } from '../types/jyotish';

/**
 * Two-letter abbreviations for the 9 grahas, suitable for chart tables and
 * compact UI displays.
 *
 * @example
 * ```typescript
 * import { GRAHA_ABBR } from 'panchang-ts';
 * GRAHA_ABBR.Jupiter; // "Ju"
 * GRAHA_ABBR.Rahu;    // "Ra"
 * ```
 */
export const GRAHA_ABBR: Record<GrahaName, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

/** Mean obliquity of the ecliptic (IAU formula), T in Julian centuries from J2000. */
export function meanObliquity(T: number): number {
  return 23.439291111 - 0.013004167 * T - 0.000000164 * T * T + 0.000000504 * T * T * T;
}

export { getTropicalPlanetLongitude };

/**
 * Retrograde detection: compare geocentric ecliptic longitude 1 hour apart.
 * Returns true if the longitude is decreasing (retrograde motion).
 * Handles the 359→0 wrap-around boundary.
 *
 * Before Phase 36.4 the two probes here were taken **without** aberration while
 * the published longitude was taken **with** it — an inconsistency that could
 * not affect the answer, since aberration is common to both probes and cancels
 * in the difference, but which had no reason to exist. Both now go through the
 * same apparent-position path.
 */
function isRetrograde(body: PlanetBody, date: Date): boolean {
  const dt = 3600_000; // 1 hour in ms
  const lon0 = getTropicalPlanetLongitude(body, new Date(date.getTime() - dt));
  const lon1 = getTropicalPlanetLongitude(body, new Date(date.getTime() + dt));
  // Unwrap for boundary crossing
  let delta = lon1 - lon0;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta < 0;
}

/**
 * Tropical longitude of the Moon's mean ascending node (Rahu).
 *
 * Uses the Meeus Ch. 47 polynomial (Astronomical Algorithms, 2nd ed., eq. 47.7).
 * Accuracy vs. the true (instantaneous) node: typically within ±0.5°, with
 * worst-case excursions near ±2° during the periodic perturbation peaks. This
 * matches classical Vedic practice, which traditionally uses the mean node for
 * Rahu/Ketu in Vimshottari Dasha and transit computations. If true-node
 * accuracy is later required, a `nodeType: 'mean' | 'true'` option can be
 * added to expose the full periodic correction series.
 *
 * T is measured in Julian centuries from J2000.0.
 */
function getMeanRahuLongitudeTropical(date: Date): number {
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;
  return normalize360(
    125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441
    - (T * T * T * T) / 60616000,
  );
}

/**
 * Tropical longitude of the Moon's *true* (apparent) ascending node — Rahu.
 *
 * The true node oscillates around the mean node by up to ±1.5° due to the
 * periodic perturbations from the Sun. This implementation adds the dominant
 * correction term from Meeus *Astronomical Algorithms* 2nd ed. Ch. 47:
 *
 *   Ω_true = Ω_mean − 1.4979° · sin(2D − 2F)
 *
 * where D is the Moon's mean elongation from the Sun and F is the Moon's
 * argument of latitude. Higher-order perturbations (sub-arcminute) are
 * neglected — adequate for Vedic transit purposes (sub-degree accuracy).
 */
function getTrueRahuLongitudeTropical(date: Date): number {
  const T = (dateToJulianDay(date) - 2451545.0) / 36525.0;
  const meanΩ =
    125.0445479
    - 1934.1362891 * T
    + 0.0020754 * T * T
    + (T * T * T) / 467441
    - (T * T * T * T) / 60616000;

  // Meeus Ch. 47 fundamental arguments (mean elongation D, mean arg of latitude F).
  const D =
    297.8501921
    + 445267.1114034 * T
    - 0.0018819 * T * T
    + (T * T * T) / 545868
    - (T * T * T * T) / 113065000;
  const F =
    93.2720950
    + 483202.0175233 * T
    - 0.0036539 * T * T
    - (T * T * T) / 3526000
    + (T * T * T * T) / 863310000;

  const argRad = ((2 * D - 2 * F) * Math.PI) / 180;
  const correction = -1.4979 * Math.sin(argRad);
  return normalize360(meanΩ + correction);
}

function buildGrahaPosition(
  planet: GrahaName,
  siderealLon: number,
  isRetro: boolean,
  nakshatraNameFn: (idx: number) => string,
  rashiNameFn: (idx: number) => string,
): GrahaPosition {
  const rashiIndex = Math.floor(siderealLon / 30);
  const degreeInRashi = siderealLon - rashiIndex * 30;
  const nakIdx = nakshatraOf(siderealLon);
  return {
    planet,
    siderealLongitude: siderealLon,
    rashi: { index: rashiIndex, name: rashiNameFn(rashiIndex) },
    degreeInRashi,
    nakshatra: computeNakshatraFromLongitude(siderealLon, nakshatraNameFn(nakIdx)),
    isRetrograde: isRetro,
  };
}

/** Placeholder name function — callers supply real i18n fn. */
const identity = (idx: number) => String(idx);

/**
 * Compute geocentric sidereal positions for all 9 grahas (Sun, Moon, Mars,
 * Mercury, Jupiter, Venus, Saturn, Rahu, Ketu).
 *
 * @param date          UTC instant.
 * @param ayanamsaType  Ayanamsa system.
 * @param nakshatraName Function returning the Nakshatra name for an index.
 * @param rashiName     Function returning the Rashi name for an index.
 * @returns             `PlanetaryPositions` — per-planet sidereal longitude,
 *                      rashi, nakshatra + pada, and retrograde flag.
 *
 * @example
 * ```typescript
 * import { computePlanetaryPositions } from 'panchang-ts';
 *
 * const p = computePlanetaryPositions(new Date('2025-01-14T12:00:00Z'), 'lahiri');
 * p.jupiter.rashi.index;      // 1 (Vrishabha)
 * p.jupiter.isRetrograde;     // true
 * p.moon.nakshatra.name;      // e.g. "Punarvasu"
 * ```
 */
export function computePlanetaryPositions(
  date: Date,
  ayanamsaType: AyanamsaType,
  nakshatraName: (idx: number) => string = identity,
  rashiName: (idx: number) => string = identity,
  nodeType: 'mean' | 'true' = 'mean',
): PlanetaryPositions {
  const ayanamsa = computeAyanamsa(date, ayanamsaType);

  const toSidereal = (tropical: number) => normalize360(tropical - ayanamsa);

  // Sun — use existing helper (SunPosition, not EclipticLongitude)
  const sunSid = getSiderealSunLongitude(date, ayanamsaType);

  // Moon — use existing helper (GeoMoon via Ecliptic, not EclipticLongitude)
  const moonSid = getSiderealMoonLongitude(date, ayanamsaType);

  // Mars through Saturn — apparent geocentric tropical longitude.
  const marsTrop = getTropicalPlanetLongitude('mars', date);
  const mercTrop = getTropicalPlanetLongitude('mercury', date);
  const jupTrop = getTropicalPlanetLongitude('jupiter', date);
  const venTrop = getTropicalPlanetLongitude('venus', date);
  const satTrop = getTropicalPlanetLongitude('saturn', date);

  // Rahu — opt-in 'true' node uses Meeus periodic correction (typ. ±0.6°)
  // vs 'mean' node default (typ. ±0.5°, worst-case ±2°). Ketu always opposite.
  const rahuTrop =
    nodeType === 'true' ? getTrueRahuLongitudeTropical(date) : getMeanRahuLongitudeTropical(date);
  const ketuTrop = normalize360(rahuTrop + 180);

  // Retrograde: not applicable to Sun/Moon/nodes
  const marsRetro = isRetrograde('mars', date);
  const mercRetro = isRetrograde('mercury', date);
  const jupRetro = isRetrograde('jupiter', date);
  const venRetro = isRetrograde('venus', date);
  const satRetro = isRetrograde('saturn', date);

  const g = (planet: GrahaName, sid: number, retro: boolean) =>
    buildGrahaPosition(planet, sid, retro, nakshatraName, rashiName);

  return {
    sun:     g('Sun',     sunSid,                false),
    moon:    g('Moon',    moonSid,               false),
    mars:    g('Mars',    toSidereal(marsTrop),   marsRetro),
    mercury: g('Mercury', toSidereal(mercTrop),   mercRetro),
    jupiter: g('Jupiter', toSidereal(jupTrop),    jupRetro),
    venus:   g('Venus',   toSidereal(venTrop),    venRetro),
    saturn:  g('Saturn',  toSidereal(satTrop),    satRetro),
    rahu:    g('Rahu',    toSidereal(rahuTrop),   true),  // always retrograde
    ketu:    g('Ketu',    toSidereal(ketuTrop),   true),
  };
}

