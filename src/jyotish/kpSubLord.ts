import { NAKSHATRA_SPAN, nakshatraOf } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import { computeBhava } from './bhava';
import {
  DASHA_ORDER, DASHA_YEARS, NAKSHATRA_LORD,
} from './dasha';
import { RASHI_LORD } from './matchingTables';
import { validateLocation, validateDate } from '../utils/validation';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type {
  BirthChart, DashaLord, GrahaName,
} from '../types/jyotish';

/** The 7 visible grahas in the same index order as `RASHI_LORD`. */
const VISIBLE_GRAHAS_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/** All 9 grahas (Sun..Ketu) — the planets that participate in KP significators. */
const ALL_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

/**
 * Map a `DashaLord` (9 KP planets) onto its `GrahaName` equivalent. The two
 * union types share the same string identifiers for the 9 KP planets so
 * the cast is purely a TypeScript widening — no runtime conversion needed.
 */
function dashaLordToGraha(d: DashaLord): GrahaName {
  return d as GrahaName;
}

/**
 * KP sub-lord information for a single longitude.
 *
 *   - `signLord` — rashi-lord of the rashi the longitude falls in.
 *   - `starLord` — Vimshottari nakshatra-lord (also called `nakshatraLord`
 *     in older KP literature).
 *   - `subLord` — 9-fold sub-division lord, computed by walking the
 *     Vimshottari cycle starting from the star-lord, with each lord's
 *     allocation proportional to its dasha-years.
 */
export interface KpSubLordInfo {
  /** Sidereal longitude in degrees, [0, 360). */
  longitude: number;
  /** Rashi index 0..11 for convenience. */
  rashi: number;
  /** Nakshatra index 0..26 for convenience. */
  nakshatra: number;
  /** Rashi (sign) lord — one of the 7 visible grahas. */
  signLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
  /** Nakshatra (star) lord — Vimshottari ruler, one of the 9 KP planets. */
  starLord: DashaLord;
  /** Sub-lord — one of the 9 KP planets. */
  subLord: DashaLord;
}

/** Cuspal sub-lords for the 12 KP cusps. */
export interface KpCuspalSubLords {
  /** 12 cusps in order — index 0 = cusp 1 = ascendant. */
  cusps: KpSubLordInfo[];
}

/**
 * KP significator analysis. Each planet signifies a set of houses
 * (1..12) by the union of four rules:
 *
 *   1. Houses occupied by the planet.
 *   2. Houses occupied by the planet's star-lord.
 *   3. Houses owned by the planet (via rashi-lordship).
 *   4. Houses owned by the planet's star-lord.
 *
 * Rahu and Ketu have no rashi-lordship (rule 3 vacuous for them under
 * the Parashari scheme used here); all other rules apply.
 */
export interface KpSignificators {
  /** For each planet, the houses (1..12) it signifies. */
  byPlanet: Record<GrahaName, number[]>;
  /** For each house (1..12), the planets that signify it. */
  byHouse: Record<number, GrahaName[]>;
}

// ── Sub-lord computation ───────────────────────────────

/**
 * Width of one sub-division for a given Vimshottari lord:
 *   `width = (lord_years / 120) × NAKSHATRA_SPAN`.
 */
function subWidth(lord: DashaLord): number {
  return (DASHA_YEARS[lord] / 120) * NAKSHATRA_SPAN;
}

/**
 * Given the offset within a nakshatra (0..NAKSHATRA_SPAN) and the
 * nakshatra's own star-lord, return the sub-lord at that offset.
 *
 * The 9 sub-divisions follow the Vimshottari cycle in
 * {@link DASHA_ORDER} starting from the star-lord; each lord's
 * sub-width is proportional to its dasha years.
 */
function subLordAtOffset(degInNak: number, starLord: DashaLord): DashaLord {
  const starLordIdx = DASHA_ORDER.indexOf(starLord);
  let cum = 0;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(starLordIdx + i) % 9]!;
    cum += subWidth(lord);
    if (degInNak < cum) return lord;
  }
  // Shouldn't be reachable — the cumulative width sums to NAKSHATRA_SPAN
  // exactly. Fallback to the final sub-lord.
  return DASHA_ORDER[(starLordIdx + 8) % 9]!;
}

/**
 * Compute the KP-Paddhati sub-lord for a sidereal longitude.
 *
 * **Algorithm.** Each nakshatra (13°20') is divided into 9 sub-portions
 * proportional to the Vimshottari dasha years: Ketu 7y → 13°20' × 7/120
 * = 56'; Venus 20y → 2°40'; Sun 6y → 48'; Moon 10y → 1°20'; Mars 7y →
 * 56'; Rahu 18y → 2°; Jupiter 16y → 1°46'40"; Saturn 19y → 2°6'40";
 * Mercury 17y → 1°53'20" (sums to 13°20'). The sub-portions begin from
 * the nakshatra's own Vimshottari lord and follow the standard 9-cycle.
 *
 * Output also exposes `signLord` (the rashi lord) and `starLord`
 * (synonymous with the nakshatra-lord) — both are needed for KP
 * significator analysis.
 *
 * @param siderealLongitude Sidereal longitude in degrees, [0, 360).
 * @returns                 {@link KpSubLordInfo} — sign-lord, star-lord,
 *                          and sub-lord, plus the rashi/nakshatra indices.
 *
 * @example
 * ```typescript
 * import { computeKpSubLord } from 'panchang-ts';
 *
 * const info = computeKpSubLord(45.5);  // 15°30' Taurus
 * info.rashi;       // 1 (Taurus)
 * info.nakshatra;   // 3 (Rohini)
 * info.signLord;    // 'Venus' (rashi lord of Taurus)
 * info.starLord;    // 'Moon'  (nakshatra lord of Rohini)
 * info.subLord;     // KP sub-lord — depends on degree
 * ```
 *
 * **Sources.** K.S. Krishnamurti, *Krishnamurti Paddhati* (5 vols, esp.
 * Vol. I Ch. 6 on sub-lord theory).
 */
export function computeKpSubLord(siderealLongitude: number): KpSubLordInfo {
  const lon = normalize360(siderealLongitude);
  const rashi = Math.floor(lon / 30);
  const nakIdx = nakshatraOf(lon);
  const degInNak = lon - nakIdx * NAKSHATRA_SPAN;

  const starLord = NAKSHATRA_LORD[nakIdx]!;
  const subLord = subLordAtOffset(degInNak, starLord);
  const signLord = VISIBLE_GRAHAS_BY_INDEX[RASHI_LORD[rashi]!]!;

  return {
    longitude: lon,
    rashi,
    nakshatra: nakIdx,
    signLord,
    starLord,
    subLord,
  };
}

/**
 * Compute the KP cuspal sub-lords for the 12 Placidus-KP house cusps.
 *
 * Internally calls {@link computeBhava} with `houseSystem: 'placidus-kp'`
 * (any caller-supplied system is overridden — KP analysis is anchored
 * specifically to the Placidus-KP cuspal scheme) and applies
 * {@link computeKpSubLord} to each of the 12 cusp longitudes.
 *
 * **Why force Placidus-KP?** The KP system's analytical tradition is
 * built on the Placidus cusp positions; whole-sign / equal-house cusps
 * fall on rashi boundaries by construction and lose the cuspal-sub-lord
 * granularity that drives KP timing analysis.
 *
 * **Default ayanamsa.** Defaults to `'krishnamurti'` (the canonical KP
 * ayanamsa, K.S. Krishnamurti's published value at J2000 ≈ 23°46').
 * Pass `options.ayanamsa = 'lahiri'` (or any other) to override; doing
 * so will make the cuspal sub-lord positions analytically inconsistent
 * with the rest of KP literature.
 *
 * @example
 * ```typescript
 * import { computeKpCuspalSubLords } from 'panchang-ts';
 *
 * const result = computeKpCuspalSubLords(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * result.cusps[0].subLord;   // sub-lord of cusp 1 (ascendant)
 * result.cusps[6].subLord;   // sub-lord of cusp 7 (descendant)
 * ```
 *
 * **Sources.** K.S. Krishnamurti, *Krishnamurti Paddhati* Vols. II–III
 * (cuspal sub-lord theory); *KP Reader* compilations.
 */
export function computeKpCuspalSubLords(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): KpCuspalSubLords {
  validateDate(birthDate);
  validateLocation(location);

  // Force Placidus-KP regardless of caller's chart options. Default
  // ayanamsa to KP-canonical 'krishnamurti'; caller can still override.
  const kpOptions: BirthChartOptions = {
    ayanamsa: 'krishnamurti',
    ...options,
    houseSystem: 'placidus-kp',
  };
  const bhava = computeBhava(birthDate, location, kpOptions);

  const cusps: KpSubLordInfo[] = bhava.houses.map((h) => computeKpSubLord(h.cuspLongitude));
  return { cusps };
}

// ── Significators ──────────────────────────────────────

/**
 * Compute the 4-fold KP significators for a natal chart.
 *
 * For each planet `P`, the houses signified are the **union** of:
 *
 *   1. Houses *occupied* by `P`.
 *   2. Houses *occupied* by `P`'s star-lord.
 *   3. Houses *owned* by `P` (rashi-lord assignments — empty for Rahu/Ketu).
 *   4. Houses *owned* by `P`'s star-lord.
 *
 * The result is presented two ways: keyed by planet (which houses it
 * signifies) and by house (which planets signify it).
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeKpSignificators } from 'panchang-ts';
 *
 * const chart = computeRashiChart(birthDate, location);
 * const sig = computeKpSignificators(chart);
 * sig.byPlanet.Sun;   // [houses Sun signifies]
 * sig.byHouse[10];    // [planets that signify the 10th house]
 * ```
 *
 * **Sources.** K.S. Krishnamurti, *Krishnamurti Paddhati* — significator
 * theory recurs across vols. II / III. The four-fold rule (occupant +
 * star-lord-occupant + owner + star-lord-owner) is the form most widely
 * adopted in modern KP practice.
 */
export function computeKpSignificators(chart: BirthChart): KpSignificators {
  // Map planet → its house, planet → its star-lord, and rashi → planet (for ownership).
  const planetHouse: Partial<Record<GrahaName, number>> = {};
  const planetStarLord: Partial<Record<GrahaName, DashaLord>> = {};
  for (const p of chart.planets) {
    planetHouse[p.planet] = p.house;
    const nakIdx = nakshatraOf(p.longitude);
    planetStarLord[p.planet] = NAKSHATRA_LORD[nakIdx]!;
  }

  // Rashi → house number (1..12) given the lagna's rashi as house 1.
  const lagnaRashi = chart.lagna.rashi.index;
  const rashiToHouse = (rashi: number) => ((rashi - lagnaRashi + 12) % 12) + 1;

  // For each visible graha, the houses it owns (= rashis it rules,
  // mapped through `rashiToHouse`).
  const planetOwnedHouses: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number[]> = {
    Sun: [], Moon: [], Mars: [], Mercury: [], Jupiter: [], Venus: [], Saturn: [],
  };
  for (let r = 0; r < 12; r++) {
    const ownerIdx = RASHI_LORD[r]!;
    const owner = VISIBLE_GRAHAS_BY_INDEX[ownerIdx]!;
    planetOwnedHouses[owner].push(rashiToHouse(r));
  }

  // Build byPlanet.
  const byPlanet: Record<GrahaName, number[]> = {} as Record<GrahaName, number[]>;
  for (const planet of ALL_GRAHAS) {
    const houses = new Set<number>();

    // Rule 1: planet's own house
    const ownHouse = planetHouse[planet];
    if (ownHouse !== undefined) houses.add(ownHouse);

    // Rule 2: planet's star-lord's house
    const starLord = planetStarLord[planet];
    if (starLord !== undefined) {
      const slGraha = dashaLordToGraha(starLord);
      const slHouse = planetHouse[slGraha];
      if (slHouse !== undefined) houses.add(slHouse);
    }

    // Rule 3: houses planet owns by rashi-lordship (skip for Rahu/Ketu).
    if (planet !== 'Rahu' && planet !== 'Ketu') {
      for (const h of planetOwnedHouses[planet]) houses.add(h);
    }

    // Rule 4: houses planet's star-lord owns.
    if (starLord !== undefined) {
      const slGraha = dashaLordToGraha(starLord);
      if (slGraha !== 'Rahu' && slGraha !== 'Ketu') {
        for (const h of planetOwnedHouses[slGraha]) houses.add(h);
      }
    }

    byPlanet[planet] = [...houses].sort((a, b) => a - b);
  }

  // Build byHouse from byPlanet.
  const byHouse: Record<number, GrahaName[]> = {};
  for (let h = 1; h <= 12; h++) byHouse[h] = [];
  for (const planet of ALL_GRAHAS) {
    for (const h of byPlanet[planet]!) {
      byHouse[h]!.push(planet);
    }
  }

  return { byPlanet, byHouse };
}

// ── Internal exports for tests ─────────────────────────

/**
 * Cumulative sub-division widths starting from Ketu (DASHA_ORDER[0]).
 * Exposed for unit tests that pin the proportional widths.
 *
 * @internal
 */
export const _SUB_CUMULATIVE_WIDTHS_FOR_TEST: readonly number[] = (() => {
  const out: number[] = [];
  let cum = 0;
  for (const lord of DASHA_ORDER) {
    cum += subWidth(lord);
    out.push(cum);
  }
  return out;
})();
