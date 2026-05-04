import { computeLagna } from './lagna';
import { computeBhava } from './bhava';
import { computePlanetaryPositions } from './planets';
import { resolveMasaName, resolveNakshatraName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import { validateLocation, validateDate } from '../utils/validation';
import type { AyanamsaType, Language, BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BirthChart, DivisionalChart, PlanetPlacement,
  GrahaPosition, GrahaName,
} from '../types/jyotish';

/**
 * Compute the full natal D1 (Rashi) chart: sidereal lagna, bhava cusps under
 * the configured house system, and the 9 grahas (Sun, Moon, Mars, Mercury,
 * Jupiter, Venus, Saturn, Rahu, Ketu) with house assignments.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param options   Birth-chart options (`ayanamsa`, `language`, `houseSystem`).
 *                  House system defaults to `'whole-sign'`.
 *
 * @example
 * ```typescript
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 *   { houseSystem: 'whole-sign' },
 * );
 * chart.lagna.rashi.name;            // ascendant rashi
 * chart.planets[0].house;            // Sun's house (1..12)
 * chart.planets[0].rashi.name;       // Sun's rashi
 * ```
 */
export function computeRashiChart(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BirthChart {
  validateDate(birthDate);
  validateLocation(location);

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';

  const lagna = computeLagna(birthDate, location, ayanamsaType, lang);
  const bhava = computeBhava(birthDate, location, options);
  const positions = computePlanetaryPositions(
    birthDate,
    ayanamsaType,
    (idx) => resolveNakshatraName(idx, lang),
    (idx) => resolveMasaName(idx, lang),
    options.nodeType ?? 'mean',
  );

  const cusps = bhava.houses.map((h) => h.cuspLongitude);
  const grahaList: { key: GrahaName; pos: GrahaPosition }[] = [
    { key: 'Sun', pos: positions.sun },
    { key: 'Moon', pos: positions.moon },
    { key: 'Mars', pos: positions.mars },
    { key: 'Mercury', pos: positions.mercury },
    { key: 'Jupiter', pos: positions.jupiter },
    { key: 'Venus', pos: positions.venus },
    { key: 'Saturn', pos: positions.saturn },
    { key: 'Rahu', pos: positions.rahu },
    { key: 'Ketu', pos: positions.ketu },
  ];

  const planets: PlanetPlacement[] = grahaList.map(({ key, pos }) => ({
    planet: key,
    longitude: pos.siderealLongitude,
    rashi: pos.rashi,
    degreeInRashi: pos.degreeInRashi,
    house: houseOfLongitude(pos.siderealLongitude, cusps),
    isRetrograde: pos.isRetrograde,
  }));

  return { divisional: 'D1', lagna, bhava, planets };
}

/**
 * Compute the D9 (Navamsa) chart. Each rashi is divided into nine 3°20'
 * navamsas; each navamsa maps to a rashi via the classical rule:
 *
 *   - Movable signs (Aries, Cancer, Libra, Capricorn) — navamsa starts at
 *     the same sign.
 *   - Fixed signs (Taurus, Leo, Scorpio, Aquarius) — navamsa starts at the
 *     9th sign from itself.
 *   - Dual signs (Gemini, Virgo, Sagittarius, Pisces) — navamsa starts at
 *     the 5th sign from itself.
 *
 * The rule is applied to the natal sidereal lagna and to each graha's natal
 * sidereal longitude. House numbers are whole-sign relative to the navamsa
 * lagna — divisional charts in classical Vedic practice are sign-based.
 *
 * @example
 * ```typescript
 * const d9 = computeNavamsa(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * d9.lagnaRashi.name;          // navamsa ascendant rashi
 * d9.planets[1].rashi.name;    // Moon's navamsa rashi
 * ```
 */
export function computeNavamsa(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): DivisionalChart {
  validateDate(birthDate);
  validateLocation(location);

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';

  const lagna = computeLagna(birthDate, location, ayanamsaType, lang);
  const positions = computePlanetaryPositions(
    birthDate,
    ayanamsaType,
    (idx) => resolveNakshatraName(idx, lang),
    (idx) => resolveMasaName(idx, lang),
    options.nodeType ?? 'mean',
  );

  const navLagnaLon = navamsaLongitude(lagna.siderealLongitude);
  const navLagnaRashi = Math.floor(navLagnaLon / 30);

  const grahaList: { key: GrahaName; pos: GrahaPosition }[] = [
    { key: 'Sun', pos: positions.sun },
    { key: 'Moon', pos: positions.moon },
    { key: 'Mars', pos: positions.mars },
    { key: 'Mercury', pos: positions.mercury },
    { key: 'Jupiter', pos: positions.jupiter },
    { key: 'Venus', pos: positions.venus },
    { key: 'Saturn', pos: positions.saturn },
    { key: 'Rahu', pos: positions.rahu },
    { key: 'Ketu', pos: positions.ketu },
  ];

  const planets: PlanetPlacement[] = grahaList.map(({ key, pos }) => {
    const d9Lon = navamsaLongitude(pos.siderealLongitude);
    const d9Rashi = Math.floor(d9Lon / 30);
    return {
      planet: key,
      longitude: d9Lon,
      rashi: { index: d9Rashi, name: resolveMasaName(d9Rashi, lang) },
      degreeInRashi: d9Lon - d9Rashi * 30,
      house: ((d9Rashi - navLagnaRashi + 12) % 12) + 1,
      isRetrograde: pos.isRetrograde,
    };
  });

  return {
    divisional: 'D9',
    lagnaRashi: { index: navLagnaRashi, name: resolveMasaName(navLagnaRashi, lang) },
    planets,
  };
}

// ── Helpers ────────────────────────────────────────────

const NAV_SPAN = 30 / 9; // 3.333… degrees

/**
 * Apply the navamsa transformation to a sidereal longitude. Returns the
 * D9 longitude (the planet's position within its navamsa rashi, scaled
 * up so each 3°20' source arc spans a full 30° in D9).
 */
function navamsaLongitude(siderealLon: number): number {
  const rashi = Math.floor(siderealLon / 30);
  const degInRashi = siderealLon - rashi * 30;
  const navIdxInRashi = Math.min(8, Math.floor(degInRashi / NAV_SPAN));
  // Movable (rashi % 3 == 0): start at own sign — offset 0.
  // Fixed   (rashi % 3 == 1): start at 9th from own — offset 8.
  // Dual    (rashi % 3 == 2): start at 5th from own — offset 4.
  const startOffset = rashi % 3 === 0 ? 0 : rashi % 3 === 1 ? 8 : 4;
  const navRashi = (rashi + startOffset + navIdxInRashi) % 12;
  // Position-within-navamsa-rashi = (degInRashi mod NAV_SPAN) * 9
  const degInNavRashi = ((degInRashi % NAV_SPAN) * 30) / NAV_SPAN;
  return normalize360(navRashi * 30 + degInNavRashi);
}

/**
 * Determine which house (1..12) contains the given sidereal longitude given
 * an array of 12 cusp longitudes (in zodiacal order, [0, 360)). Handles the
 * wrap across 360°.
 */
function houseOfLongitude(λ: number, cusps: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i]!;
    const end = cusps[(i + 1) % 12]!;
    if (start <= end) {
      if (λ >= start && λ < end) return i + 1;
    } else {
      if (λ >= start || λ < end) return i + 1;
    }
  }
  // Shouldn't reach here when cusps form a valid 360° partition; default to 1.
  return 1;
}

/**
 * Internal helper exposed for testing — returns the D9 (navamsa) longitude
 * for a given sidereal longitude. Not part of the public API surface.
 *
 * @internal
 */
export const _navamsaLongitudeForTest = navamsaLongitude;
