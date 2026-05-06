import { NAKSHATRA_SPAN } from '../utils/constants';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeLagna } from './lagna';
import { validateLocation, validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { DashaLord, MahaDasha, AntarDasha, PratyantarDasha, VimshottariDashaResult } from '../types/jyotish';

// ── Vimshottari cycle constants ──────────────────────────────────────────────

/** Dasha years for each lord, in cycle order (total = 120). */
export const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu:    7,
  Venus:  20,
  Sun:     6,
  Moon:   10,
  Mars:    7,
  Rahu:   18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};

/** Cycle order (Ketu starts). */
export const DASHA_ORDER: DashaLord[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];

/**
 * Nakshatra ruler — one per nakshatra, repeating the 9-planet cycle.
 * Index 0 = Ashwini → Ketu.
 */
export const NAKSHATRA_LORD: DashaLord[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/**
 * Compute the complete Vimshottari Dasha sequence from the birth moment.
 *
 * The 120-year cycle is seeded by the nakshatra-lord at birth; the first
 * mahadasha is a partial balance (elapsed fraction of the birth nakshatra is
 * subtracted), and subsequent mahadashas follow the classical cycle order.
 * Each mahadasha is further subdivided into 9 antardashas proportionally.
 *
 * @param birthDate          UTC birth time.
 * @param moonSiderealLon    Sidereal longitude of the Moon at birth [0, 360).
 * @returns                  `VimshottariDashaResult` — starting lord + 9
 *                           mahadashas with antardashas.
 *
 * @example
 * ```typescript
 * import { computeVimshottariDasha, getSiderealMoonLongitude } from 'panchang-ts';
 *
 * const birth = new Date('1990-06-15T10:30:00Z');
 * const moonLon = getSiderealMoonLongitude(birth, 'lahiri');
 * const dasha = computeVimshottariDasha(birth, moonLon);
 * dasha.startLord;                // e.g. "Venus"
 * dasha.mahadashas[0].lord;       // same as startLord
 * dasha.mahadashas[0].antardashas.length; // 9
 * ```
 */
export function computeVimshottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
): VimshottariDashaResult {
  const nakIdx = Math.floor(moonSiderealLon / NAKSHATRA_SPAN);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  // Fraction of current nakshatra already elapsed at birth
  const elapsedFraction = degInNak / NAKSHATRA_SPAN;

  const startLord = NAKSHATRA_LORD[nakIdx]!;
  const startLordIdx = DASHA_ORDER.indexOf(startLord);
  const startLordYears = DASHA_YEARS[startLord];

  // Remaining duration of the starting dasha at birth (in ms)
  const balanceMs = (1 - elapsedFraction) * startLordYears * MS_PER_YEAR;

  // Build full 120-year sequence
  const mahaDashas: MahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());

  for (let i = 0; i < 9; i++) {
    const lordIdx = (startLordIdx + i) % 9;
    const lord = DASHA_ORDER[lordIdx]!;
    const years = DASHA_YEARS[lord];

    // First dasha: starts at birth, may be partial
    const durationMs = i === 0 ? balanceMs : years * MS_PER_YEAR;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);

    // Antardasha sub-periods (proportional share of the mahadasha)
    const antarDashas: AntarDasha[] = buildAntarDashas(lord, startDate, durationMs);

    mahaDashas.push({ lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  // If we want a full 120-year arc, continue after the first partial cycle
  // (the cycle repeats). For practical purposes 9 mahaDashas is sufficient.
  // Clients wanting the full arc can call multiple times or extend here.

  // Find current mahadasha
  const now = new Date();
  const currentIndex = mahaDashas.findIndex(
    (md) => now >= md.startDate && now < md.endDate,
  );

  return {
    currentMahaDashaLord: mahaDashas[Math.max(0, currentIndex)]!.lord,
    currentIndex: Math.max(0, currentIndex),
    mahaDashas,
  };
}

/**
 * Ergonomic wrapper: compute Vimshottari Dasha directly from a birth timestamp
 * without asking the caller to pre-compute sidereal Moon longitude.
 *
 * @param birthDate      UTC birth instant.
 * @param ayanamsaType   Ayanamsa system. Defaults to `'lahiri'`.
 * @returns              `VimshottariDashaResult` — same shape as
 *                       {@link computeVimshottariDasha}.
 *
 * @example
 * ```ts
 * const dasha = computeVimshottariDashaFromBirth(new Date('1990-06-15T04:30:00Z'));
 * console.log(dasha.currentMahaDashaLord);
 * ```
 */
export function computeVimshottariDashaFromBirth(
  birthDate: Date,
  ayanamsaType: AyanamsaType = 'lahiri',
): VimshottariDashaResult {
  const moonSid = getSiderealMoonLongitude(birthDate, ayanamsaType);
  return computeVimshottariDasha(birthDate, moonSid);
}

/**
 * Compute the 9 pratyantar (third-level) dashas inside an antardasha.
 *
 * Same proportional split as antardasha within a mahadasha:
 *   pratyantar.lord cycles 9 planets starting from the antardasha lord,
 *   each pratyantar's duration = (lord_years / 120) × antardasha duration.
 *
 * @param antardasha   The antardasha to subdivide.
 * @returns            9 pratyantar periods covering the full antardasha.
 *
 * @example
 * ```typescript
 * const dasha = computeVimshottariDashaFromBirth(birthDate);
 * const ad = dasha.mahaDashas[0].antarDashas[0];
 * const pratyantars = computeVimshottariPratyantar(ad);
 * pratyantars.forEach(p => console.log(p.lord, p.startDate, p.endDate));
 * ```
 */
export function computeVimshottariPratyantar(antardasha: AntarDasha): PratyantarDasha[] {
  const lordIdx = DASHA_ORDER.indexOf(antardasha.lord);
  if (lordIdx < 0) {
    throw new Error(`Invalid antardasha lord: ${antardasha.lord}`);
  }
  const totalMs = antardasha.endDate.getTime() - antardasha.startDate.getTime();
  const out: PratyantarDasha[] = [];
  let cursor = new Date(antardasha.startDate.getTime());
  for (let i = 0; i < 9; i++) {
    const subLord = DASHA_ORDER[(lordIdx + i) % 9]!;
    const subYears = DASHA_YEARS[subLord];
    const subMs = (subYears / 120) * totalMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + subMs);
    out.push({ lord: subLord, startDate, endDate });
    cursor = endDate;
  }
  return out;
}

function buildAntarDashas(
  mahaLord: DashaLord,
  mahaStart: Date,
  mahaDurationMs: number,
): AntarDasha[] {
  const mahaIdx = DASHA_ORDER.indexOf(mahaLord);
  const antarDashas: AntarDasha[] = [];
  let cursor = new Date(mahaStart.getTime());

  for (let i = 0; i < 9; i++) {
    const antarLordIdx = (mahaIdx + i) % 9;
    const antarLord = DASHA_ORDER[antarLordIdx]!;
    const antarYears = DASHA_YEARS[antarLord];
    // Antardasha proportion: (antarLord years / 120) * mahadasha duration
    const antarMs = (antarYears / 120) * mahaDurationMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + antarMs);
    antarDashas.push({ lord: antarLord, startDate, endDate });
    cursor = endDate;
  }

  return antarDashas;
}

// ── Ashtottari Dasha ──────────────────────────────────

/**
 * Eight-lord Ashtottari cycle. Total = 6 + 15 + 8 + 17 + 10 + 19 + 12 + 21 = 108 years.
 * Cycle order matches Satya Acharya's classical sequence (no Ketu).
 */
export const ASHTOTTARI_ORDER: readonly DashaLord[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Saturn', 'Jupiter', 'Rahu', 'Venus',
];

export const ASHTOTTARI_YEARS: Record<string, number> = {
  Sun: 6, Moon: 15, Mars: 8, Mercury: 17,
  Saturn: 10, Jupiter: 19, Rahu: 12, Venus: 21,
};

const ASHTOTTARI_TOTAL_YEARS = 108;

/**
 * Cumulative nakshatra-position boundaries for each Ashtottari lord, anchored
 * at Krittika = 0 (Krittika begins the Sun-period). Each lord's allocation is
 * proportional to its years: `27 × lord_years / 108`.
 */
const ASHTOTTARI_CUMULATIVE: readonly number[] = (() => {
  const out: number[] = [];
  let cum = 0;
  for (const lord of ASHTOTTARI_ORDER) {
    cum += (ASHTOTTARI_YEARS[lord]! * 27) / ASHTOTTARI_TOTAL_YEARS;
    out.push(cum);
  }
  return out;
})();

/**
 * Compute the complete Ashtottari Dasha sequence from the birth moment.
 *
 * Ashtottari is a 108-year, 8-planet cycle (no Ketu) used in classical Vedic
 * astrology — most authoritatively prescribed when the Moon is in Krishna
 * Paksha at birth, though many modern practitioners apply it as a
 * supplementary timing system to Vimshottari for all charts.
 *
 * **Lord cycle (Satya Acharya):** Sun (6 y) → Moon (15) → Mars (8) → Mercury
 * (17) → Saturn (10) → Jupiter (19) → Rahu (12) → Venus (21).
 *
 * **Starting lord:** anchored at Krittika = Sun. The Moon's nakshatra
 * position relative to Krittika determines the active lord at birth and the
 * elapsed fraction of that lord's period.
 *
 * Antardashas inside each Mahadasha follow the same 8-lord cycle order
 * starting from the Mahadasha lord, with proportional split (`lord_years /
 * 108 × maha_duration`).
 *
 * @param birthDate       UTC birth time.
 * @param moonSiderealLon Sidereal longitude of the Moon at birth [0, 360).
 *
 * @example
 * ```typescript
 * import { computeAshtottariDasha, getSiderealMoonLongitude } from 'panchang-ts';
 * const moonLon = getSiderealMoonLongitude(birthDate, 'lahiri');
 * const ashtottari = computeAshtottariDasha(birthDate, moonLon);
 * ashtottari.mahaDashas[0].lord;     // starting lord at birth
 * ```
 */
export function computeAshtottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
): VimshottariDashaResult {
  validateDate(birthDate);
  const nakIdx = Math.floor(moonSiderealLon / NAKSHATRA_SPAN);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedInNak = degInNak / NAKSHATRA_SPAN;
  // Position from Krittika (index 2) along the 27-nakshatra cycle, 0..27.
  const relPos = (((nakIdx - 2) + 27) % 27) + elapsedInNak;

  // Find which lord segment relPos falls in.
  let lordIdx = 0;
  for (let i = 0; i < ASHTOTTARI_ORDER.length; i++) {
    if (relPos < ASHTOTTARI_CUMULATIVE[i]!) {
      lordIdx = i;
      break;
    }
  }
  const startLord = ASHTOTTARI_ORDER[lordIdx]!;
  const segStart = lordIdx === 0 ? 0 : ASHTOTTARI_CUMULATIVE[lordIdx - 1]!;
  const segWidth = ASHTOTTARI_CUMULATIVE[lordIdx]! - segStart;
  const elapsedInLord = (relPos - segStart) / segWidth; // 0..1
  const balanceMs = (1 - elapsedInLord) * ASHTOTTARI_YEARS[startLord]! * MS_PER_YEAR;

  const mahaDashas: MahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());
  for (let i = 0; i < 8; i++) {
    const lord = ASHTOTTARI_ORDER[(lordIdx + i) % 8]!;
    const years = ASHTOTTARI_YEARS[lord]!;
    const durationMs = i === 0 ? balanceMs : years * MS_PER_YEAR;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const antarDashas = buildAshtottariAntarDashas(lord, startDate, durationMs);
    mahaDashas.push({ lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  const now = new Date();
  const currentIndex = mahaDashas.findIndex(
    (md) => now >= md.startDate && now < md.endDate,
  );
  return {
    currentMahaDashaLord: mahaDashas[Math.max(0, currentIndex)]!.lord,
    currentIndex: Math.max(0, currentIndex),
    mahaDashas,
  };
}

function buildAshtottariAntarDashas(
  mahaLord: DashaLord,
  mahaStart: Date,
  mahaDurationMs: number,
): AntarDasha[] {
  const mahaIdx = ASHTOTTARI_ORDER.indexOf(mahaLord);
  const out: AntarDasha[] = [];
  let cursor = new Date(mahaStart.getTime());
  for (let i = 0; i < 8; i++) {
    const antarLord = ASHTOTTARI_ORDER[(mahaIdx + i) % 8]!;
    const antarYears = ASHTOTTARI_YEARS[antarLord]!;
    const antarMs = (antarYears / ASHTOTTARI_TOTAL_YEARS) * mahaDurationMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + antarMs);
    out.push({ lord: antarLord, startDate, endDate });
    cursor = endDate;
  }
  return out;
}

// ── Yogini Dasha ──────────────────────────────────────

/**
 * Yogini name (1..8 in classical order). Each Yogini has a presiding planet
 * and a fixed duration in years summing to 36.
 */
export type YoginiName =
  | 'Mangala' | 'Pingala' | 'Dhanya' | 'Bhramari'
  | 'Bhadrika' | 'Ulka' | 'Siddha' | 'Sankata';

/** Years allocated to each Yogini. Total = 1+2+3+4+5+6+7+8 = 36. */
export const YOGINI_YEARS: Record<YoginiName, number> = {
  Mangala: 1, Pingala: 2, Dhanya: 3, Bhramari: 4,
  Bhadrika: 5, Ulka: 6, Siddha: 7, Sankata: 8,
};

/** Cycle order of the 8 Yoginis. Starts with Mangala. */
export const YOGINI_ORDER: readonly YoginiName[] = [
  'Mangala', 'Pingala', 'Dhanya', 'Bhramari',
  'Bhadrika', 'Ulka', 'Siddha', 'Sankata',
];

/** Presiding planet of each Yogini, in cycle order. */
export const YOGINI_PLANET: Record<YoginiName, DashaLord> = {
  Mangala:  'Moon',
  Pingala:  'Sun',
  Dhanya:   'Jupiter',
  Bhramari: 'Mars',
  Bhadrika: 'Mercury',
  Ulka:     'Saturn',
  Siddha:   'Venus',
  Sankata:  'Rahu',
};

const YOGINI_TOTAL_YEARS = 36;

/** One Mahadasha period in the Yogini system. */
export interface YoginiMahaDasha {
  yogini: YoginiName;
  /** Presiding planet lord (parallel to Vimshottari's `lord` field). */
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  /** Duration in years. */
  years: number;
  antarDashas: YoginiAntarDasha[];
}

export interface YoginiAntarDasha {
  yogini: YoginiName;
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

export interface YoginiDashaResult {
  currentYogini: YoginiName;
  currentIndex: number;
  mahaDashas: YoginiMahaDasha[];
}

/**
 * Compute the complete Yogini Dasha sequence from the birth moment.
 *
 * Yogini is a 36-year cycle of eight feminine deities (Yoginis), each with a
 * fixed planetary lord and ascending duration (1, 2, 3, …, 8 years). The
 * cycle order is Mangala → Pingala → Dhanya → Bhramari → Bhadrika → Ulka →
 * Siddha → Sankata. Sources: Sanjay Rath, *Yogini Dashas* (1999); Charak,
 * *Predictive Astrology* (Ch. 18).
 *
 * **Starting Yogini:** indexed by the Moon's nakshatra at birth. Ashwini
 * (nakshatra 0) → Mangala (Yogini 0); the cycle then increments mod 8 with
 * each subsequent nakshatra.
 *
 * Each Mahadasha is divided into 8 antardashas in the same 8-Yogini cycle
 * order starting from the Mahadasha Yogini, each antardasha spanning
 * `(yogini_years / 36) × maha_duration`.
 *
 * @param birthDate       UTC birth time.
 * @param moonSiderealLon Sidereal longitude of the Moon at birth [0, 360).
 *
 * @example
 * ```typescript
 * import { computeYoginiDasha, getSiderealMoonLongitude } from 'panchang-ts';
 * const moonLon = getSiderealMoonLongitude(birthDate, 'lahiri');
 * const yogini = computeYoginiDasha(birthDate, moonLon);
 * yogini.mahaDashas[0].yogini;   // e.g. "Bhramari"
 * yogini.mahaDashas[0].lord;     // "Mars" (Bhramari's planet)
 * ```
 */
export function computeYoginiDasha(
  birthDate: Date,
  moonSiderealLon: number,
): YoginiDashaResult {
  validateDate(birthDate);
  const nakIdx = Math.floor(moonSiderealLon / NAKSHATRA_SPAN);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedFraction = degInNak / NAKSHATRA_SPAN;

  const startYoginiIdx = nakIdx % 8;
  const startYogini = YOGINI_ORDER[startYoginiIdx]!;
  const startYears = YOGINI_YEARS[startYogini];
  const balanceMs = (1 - elapsedFraction) * startYears * MS_PER_YEAR;

  const mahaDashas: YoginiMahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());
  for (let i = 0; i < 8; i++) {
    const yogini = YOGINI_ORDER[(startYoginiIdx + i) % 8]!;
    const lord = YOGINI_PLANET[yogini];
    const years = YOGINI_YEARS[yogini];
    const durationMs = i === 0 ? balanceMs : years * MS_PER_YEAR;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const antarDashas = buildYoginiAntarDashas(yogini, startDate, durationMs);
    mahaDashas.push({ yogini, lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  const now = new Date();
  const currentIndex = mahaDashas.findIndex(
    (md) => now >= md.startDate && now < md.endDate,
  );
  return {
    currentYogini: mahaDashas[Math.max(0, currentIndex)]!.yogini,
    currentIndex: Math.max(0, currentIndex),
    mahaDashas,
  };
}

function buildYoginiAntarDashas(
  mahaYogini: YoginiName,
  mahaStart: Date,
  mahaDurationMs: number,
): YoginiAntarDasha[] {
  const mahaIdx = YOGINI_ORDER.indexOf(mahaYogini);
  const out: YoginiAntarDasha[] = [];
  let cursor = new Date(mahaStart.getTime());
  for (let i = 0; i < 8; i++) {
    const yogini = YOGINI_ORDER[(mahaIdx + i) % 8]!;
    const lord = YOGINI_PLANET[yogini];
    const yoginiYears = YOGINI_YEARS[yogini];
    const antarMs = (yoginiYears / YOGINI_TOTAL_YEARS) * mahaDurationMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + antarMs);
    out.push({ yogini, lord, startDate, endDate });
    cursor = endDate;
  }
  return out;
}

// ── Chara Dasha (Jaimini) ─────────────────────────────

/**
 * Per-rashi Chara Dasha years. The "9-8-7" variant (per Achyutananda /
 * Jaimini sutras Ch. 1):
 *
 *   - Movable signs (Aries, Cancer, Libra, Capricorn): 9 years.
 *   - Fixed signs (Taurus, Leo, Scorpio, Aquarius): 8 years.
 *   - Dual signs (Gemini, Virgo, Sagittarius, Pisces): 7 years.
 *
 * Total = 4·9 + 4·8 + 4·7 = 96 years.
 *
 * Several other Chara variants exist (Sundar, Raghava Bhatta, Karaka Chara
 * with Moveable/Fixed reversed, etc.); only the 9-8-7 system is exposed
 * here. See README for a sourcing note.
 */
export const CHARA_RASHI_YEARS: readonly number[] = [
  9, // 0 Aries (movable)
  8, // 1 Taurus (fixed)
  7, // 2 Gemini (dual)
  9, // 3 Cancer (movable)
  8, // 4 Leo (fixed)
  7, // 5 Virgo (dual)
  9, // 6 Libra (movable)
  8, // 7 Scorpio (fixed)
  7, // 8 Sagittarius (dual)
  9, // 9 Capricorn (movable)
  8, // 10 Aquarius (fixed)
  7, // 11 Pisces (dual)
];

/** Sign lord per rashi index (planet name). Matches `RASHI_LORD` in matchingTables but as DashaLord names. */
const CHARA_RASHI_LORD: readonly DashaLord[] = [
  'Mars',    // 0 Aries
  'Venus',   // 1 Taurus
  'Mercury', // 2 Gemini
  'Moon',    // 3 Cancer
  'Sun',     // 4 Leo
  'Mercury', // 5 Virgo
  'Venus',   // 6 Libra
  'Mars',    // 7 Scorpio
  'Jupiter', // 8 Sagittarius
  'Saturn',  // 9 Capricorn
  'Saturn',  // 10 Aquarius
  'Jupiter', // 11 Pisces
];

/** One Mahadasha period in the Chara (Jaimini) system. */
export interface CharaMahaDasha {
  /** Rashi index 0..11 (0 = Mesha … 11 = Meena). */
  rashi: number;
  /** Sign-lord planet (parallel to Vimshottari's `lord`). */
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  /** Duration in years (7, 8, or 9). */
  years: number;
}

export interface CharaDashaResult {
  /** Index 0..11 of the rashi active at the evaluation time. */
  currentIndex: number;
  /** Rashi active at the evaluation time. */
  currentRashi: number;
  /** 12 mahadasha periods covering ~96 years from birth. */
  mahaDashas: CharaMahaDasha[];
}

/**
 * Compute the Chara (Jaimini) Dasha sequence from the birth moment.
 *
 * Chara is a sign-based dasha system from the Jaimini Sutras. Each rashi's
 * period is determined by its modality (movable/fixed/dual) — see
 * {@link CHARA_RASHI_YEARS}. The cycle starts at the lagna's rashi:
 *
 *   - **Direction:** zodiacal (forward) — odd-numbered count from lagna
 *     when lagna is in an odd rashi (Aries=1, Gemini=3, …); reverse when
 *     lagna is in an even rashi (Taurus, Cancer, …). Following the
 *     "Karaka Chara" Achyutananda variant, this implementation uses the
 *     **forward direction always**, which is the simplest and most widely
 *     published variant; opting into reverse-direction mode for even-rashi
 *     lagnas is a documented future extension.
 *
 * Lord assignment per rashi is the rashi's natural lord (Mars for
 * Aries/Scorpio, Venus for Taurus/Libra, etc.). Antardasha breakdown is
 * not exposed in this implementation — the Mahadasha alone is the dominant
 * Jaimini timing layer.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param ayanamsa  Ayanamsa system (default `'lahiri'`).
 *
 * @example
 * ```typescript
 * import { computeCharaDasha } from 'panchang-ts';
 * const chara = computeCharaDasha(birthDate, location);
 * chara.mahaDashas[0].rashi;   // lagna's rashi index
 * chara.mahaDashas[0].lord;    // lagna rashi's lord
 * ```
 */
export function computeCharaDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType = 'lahiri',
): CharaDashaResult {
  validateDate(birthDate);
  validateLocation(location);

  const lagna = computeLagna(birthDate, location, ayanamsa);
  const startRashi = lagna.rashi.index;

  const mahaDashas: CharaMahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());
  for (let i = 0; i < 12; i++) {
    const rashi = (startRashi + i) % 12;
    const years = CHARA_RASHI_YEARS[rashi]!;
    const lord = CHARA_RASHI_LORD[rashi]!;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + years * MS_PER_YEAR);
    mahaDashas.push({ rashi, lord, startDate, endDate, years });
    cursor = endDate;
  }

  const now = new Date();
  const currentIndex = mahaDashas.findIndex(
    (md) => now >= md.startDate && now < md.endDate,
  );
  const idx = Math.max(0, currentIndex);
  return {
    currentIndex: idx,
    currentRashi: mahaDashas[idx]!.rashi,
    mahaDashas,
  };
}
