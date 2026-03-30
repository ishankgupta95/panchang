import { validateDate, validateLocation } from '../utils/validation';
import { getInstantPanchang } from '../core/panchang';
import { computePlanetaryPositions, GRAHA_ABBR } from './planets';
import { computeLagnaLongitude, navamsaRashi, rashiFromLongitude } from './lagna';
import { computeVimshottariDasha } from './dasha';
import { resolveMasaName, resolveNakshatraName } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { InstantPanchangOptions } from '../types/options';
import type { RashiInfo } from '../types/elements';
import type {
  KundliResult, KundliHouse, NavamsaChart, GrahaName, GrahaPosition,
} from '../types/jyotish';

export interface KundliOptions extends InstantPanchangOptions {
  /**
   * When true, compute Vimshottari Dasha periods.
   * Slightly more expensive. Default: true.
   */
  computeDasha?: boolean;
}

/**
 * Compute a complete Janam Kundli (birth chart).
 *
 * Returns planetary positions, Lagna, 12 houses, Navamsa (D-9) chart,
 * Vimshottari Dasha periods, and the full birth Panchang.
 *
 * @param birthDateUtc  UTC birth moment. For times stored as "local time in UTC"
 *                      (the panchang-ts convention), pass the Date as-is.
 * @param location      Birth location coordinates.
 * @param options       Optional ayanamsa, language, computeDasha flag.
 */
export function computeKundli(
  birthDateUtc: Date,
  location: GeoLocation,
  options?: KundliOptions,
): KundliResult {
  validateDate(birthDateUtc);
  validateLocation(location);

  const ayanamsa = options?.ayanamsa ?? 'lahiri';
  const lang = options?.language ?? 'en';
  const doDasha = options?.computeDasha !== false;

  const rashiName = (idx: number) => resolveMasaName(idx, lang);
  const nakshatraName = (idx: number) => resolveNakshatraName(idx, lang);

  // ── 1. Birth Panchang ──────────────────────────────
  const birthPanchang = getInstantPanchang(birthDateUtc, location, {
    ayanamsa,
    language: lang,
    computeEndTimes: options?.computeEndTimes ?? false,
    precision: options?.precision,
  });

  // ── 2. Planetary positions ─────────────────────────
  const grahas = computePlanetaryPositions(birthDateUtc, ayanamsa, nakshatraName, rashiName);

  // ── 3. Lagna (Ascendant) ───────────────────────────
  const lagnaLon = computeLagnaLongitude(
    birthDateUtc,
    location.latitude,
    location.longitude,
    ayanamsa,
  );
  const lagna: RashiInfo = rashiFromLongitude(lagnaLon, rashiName);

  // ── 4. House assignment ────────────────────────────
  // Whole-sign house system (standard in Vedic astrology):
  // House 1 = Lagna sign, House 2 = next sign, etc.
  const lagnaRashiIdx = lagna.index;

  const houses: KundliHouse[] = Array.from({ length: 12 }, (_, i) => {
    const houseRashiIdx = (lagnaRashiIdx + i) % 12;
    return {
      number: i + 1,
      rashi: { index: houseRashiIdx, name: rashiName(houseRashiIdx) },
      planets: [],
    };
  });

  // Assign each graha to its house
  const grahaList = Object.values(grahas) as GrahaPosition[];
  for (const graha of grahaList) {
    const houseNumber = ((graha.rashi.index - lagnaRashiIdx + 12) % 12) + 1;
    graha.house = houseNumber;
    houses[houseNumber - 1]!.planets.push(GRAHA_ABBR[graha.planet as GrahaName]);
  }

  // ── 5. Navamsa chart ──────────────────────────────
  const navamsa = buildNavamsaChart(grahas, lagnaLon, rashiName);

  // ── 6. Vimshottari Dasha ──────────────────────────
  const dasha = doDasha
    ? computeVimshottariDasha(birthDateUtc, birthPanchang.siderealMoon)
    : { currentMahaDashaLord: 'Sun' as const, currentIndex: 0, mahaDashas: [] };

  return {
    lagnaLongitude: lagnaLon,
    lagna,
    houses,
    grahas,
    navamsa,
    birthPanchang,
    dasha,
  };
}

function buildNavamsaChart(
  grahas: ReturnType<typeof computePlanetaryPositions>,
  lagnaLon: number,
  rashiName: (idx: number) => string,
): NavamsaChart {
  const grahaList = Object.values(grahas) as GrahaPosition[];
  const positions = grahaList.map((g) => ({
    planet: g.planet,
    rashi: {
      index: navamsaRashi(g.siderealLongitude),
      name: rashiName(navamsaRashi(g.siderealLongitude)),
    },
  }));

  return {
    positions,
    lagna: {
      index: navamsaRashi(lagnaLon),
      name: rashiName(navamsaRashi(lagnaLon)),
    },
  };
}
