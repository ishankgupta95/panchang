import { NAKSHATRA_SPAN, nakshatraOf } from '../utils/constants';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeLagna } from './lagna';
import { computeRashiChart } from './charts';
import { validateLocation, validateDate } from '../utils/validation';
import type { AyanamsaType } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { DashaLord, GrahaName, MahaDasha, AntarDasha, PratyantarDasha, VimshottariDashaResult } from '../types/jyotish';

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
 * dasha.currentMahaDashaLord;
 * dasha.mahaDashas[0].lord;
 * dasha.mahaDashas[0].antarDashas.length; // 9
 * ```
 */
export function computeVimshottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
): VimshottariDashaResult {
  validateDate(birthDate);
  const nakIdx = nakshatraOf(moonSiderealLon);
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
    const fullDurationMs = years * MS_PER_YEAR;

    const startDate = new Date(cursor.getTime());
    let endDate: Date;
    let antarDashas: AntarDasha[];

    if (i === 0) {
      // Partial first mahadasha (balance of the birth-nakshatra lord). It began
      // `elapsed` before birth; its antardashas run at their FULL durations from
      // that virtual start, and we display only the portion from birth onward.
      // So the antardasha current at birth appears truncated and the remaining
      // ones at full length — the classical balance method. (Scaling every
      // antardasha proportionally into the balance, as before, reported the
      // wrong bhukti lord/dates for anyone not born at the nakshatra start.)
      endDate = new Date(cursor.getTime() + balanceMs);
      const virtualStart = new Date(birthDate.getTime() - (fullDurationMs - balanceMs));
      antarDashas = buildAntarDashas(lord, virtualStart, fullDurationMs, startDate.getTime());
    } else {
      endDate = new Date(cursor.getTime() + fullDurationMs);
      antarDashas = buildAntarDashas(lord, startDate, fullDurationMs, startDate.getTime());
    }

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

/**
 * Build the antardashas of a mahadasha.
 *
 * Antardashas always run at their full proportional durations
 * `(antarYears / 120) × mahaFullDurationMs` from the mahadasha's (virtual)
 * start. `clipStartMs` is the first instant to display: antardashas ending at
 * or before it are dropped, and the one straddling it is truncated to begin at
 * it. For a complete mahadasha pass `clipStartMs = mahaVirtualStart`; for the
 * partial first mahadasha pass the birth instant so the elapsed (pre-birth)
 * antardashas fall away and the running one is shown truncated.
 */
function buildAntarDashas(
  mahaLord: DashaLord,
  mahaVirtualStart: Date,
  mahaFullDurationMs: number,
  clipStartMs: number,
): AntarDasha[] {
  const mahaIdx = DASHA_ORDER.indexOf(mahaLord);
  const antarDashas: AntarDasha[] = [];
  let cursor = mahaVirtualStart.getTime();

  for (let i = 0; i < 9; i++) {
    const antarLord = DASHA_ORDER[(mahaIdx + i) % 9]!;
    const antarMs = (DASHA_YEARS[antarLord] / 120) * mahaFullDurationMs;
    const adStart = cursor;
    const adEnd = cursor + antarMs;
    cursor = adEnd;
    // Skip antardashas fully elapsed before the display window (pre-birth
    // portion of a partial first mahadasha); truncate the straddling one.
    if (adEnd <= clipStartMs) continue;
    const displayStart = adStart < clipStartMs ? clipStartMs : adStart;
    antarDashas.push({
      lord: antarLord,
      startDate: new Date(displayStart),
      endDate: new Date(adEnd),
    });
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
 * Nakshatra indices (0 = Ashwini) allocated to each Ashtottari lord, in
 * {@link ASHTOTTARI_ORDER} order — the classical GROUP allocation: each of
 * the four malefics (Sun, Mars, Saturn, Rahu) rules four nakshatras, each
 * benefic (Moon, Mercury, Jupiter, Venus) three, with Sun's group seeded at
 * Ardra (the "Ardradi" reckoning).
 *
 * Sources (independent implementations, identical longitude spans):
 * PyJHora `ashtottari.py` (`ashtottari_adhipathi_dict_seed`, seed star 6 =
 * Ardra; 27-star form — Saturn: P.Ashadha, U.Ashadha, Shravana) and
 * Maitreya 8 `AshtottariDasa.cpp` (28-star form counting Abhijit inside
 * Saturn's group). The two differ only in whether Abhijit is *named*:
 * Abhijit's arc lies wholly inside [P.Ashadha start, Shravana end], so
 * Saturn's group covers the same 40° either way and lord-at-birth plus
 * balance agree. Jyotish literature states the same structure ("all the
 * malefics have been allocated four nakshatras each, the benefics three").
 *
 * The pre-audit implementation split the zodiac PROPORTIONALLY to each
 * lord's years from a Krittika anchor (Sun's segment = 1.5 nakshatras from
 * Krittika, etc.) — matching no consulted source; every lord-at-birth it
 * produced outside Sun's first half-nakshatra was potentially wrong.
 */
export const ASHTOTTARI_NAKSHATRA_GROUPS: readonly (readonly number[])[] = [
  [5, 6, 7, 8],     // Sun     — Ardra, Punarvasu, Pushya, Ashlesha
  [9, 10, 11],      // Moon    — Magha, P.Phalguni, U.Phalguni
  [12, 13, 14, 15], // Mars    — Hasta, Chitra, Swati, Vishakha
  [16, 17, 18],     // Mercury — Anuradha, Jyeshtha, Mula
  [19, 20, 21],     // Saturn  — P.Ashadha, U.Ashadha, Shravana (incl. Abhijit's arc)
  [22, 23, 24],     // Jupiter — Dhanishta, Shatabhisha, P.Bhadra
  [25, 26, 0, 1],   // Rahu    — U.Bhadra, Revati, Ashwini, Bharani
  [2, 3, 4],        // Venus   — Krittika, Rohini, Mrigashira
];

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
 * **Starting lord:** the Moon's birth nakshatra selects the lord via the
 * classical group allocation {@link ASHTOTTARI_NAKSHATRA_GROUPS} (Ardradi:
 * Sun's four nakshatras begin at Ardra; malefics rule four nakshatras each,
 * benefics three). The elapsed fraction of the *group* fixes the balance:
 * `balance = (1 − elapsedFractionOfGroup) × lord_years`.
 *
 * Antardashas inside each Mahadasha follow the same 8-lord cycle order
 * starting from the Mahadasha lord, with proportional split (`lord_years /
 * 108 × maha_duration`) — PyJHora's default convention; Maitreya 8 runs
 * Ashtottari bhuktis in the reverse direction, a variant not exposed here.
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
  const nakIdx = nakshatraOf(moonSiderealLon);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedInNak = degInNak / NAKSHATRA_SPAN;

  // Classical group allocation: the birth nakshatra's group names the lord;
  // the fraction of the group already traversed fixes the balance.
  const lordIdx = ASHTOTTARI_NAKSHATRA_GROUPS.findIndex((g) => g.includes(nakIdx));
  const group = ASHTOTTARI_NAKSHATRA_GROUPS[lordIdx]!;
  const startLord = ASHTOTTARI_ORDER[lordIdx]!;
  const posInGroup = group.indexOf(nakIdx);
  const elapsedInLord = (posInGroup + elapsedInNak) / group.length; // 0..1
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
 * **Starting Yogini:** the classical Devi-Bhagavata formula — add 3 to the
 * 1-based janma nakshatra number and take the remainder mod 8; remainder 1
 * = Mangala, 2 = Pingala, …, 0 = Sankata. In 0-based terms:
 * `startYoginiIdx = (nakIdx + 3) % 8`, so Ashwini → Bhramari, Pushya →
 * Dhanya, Anuradha → Bhramari (the standard worked examples). Confirmed
 * against vedicastro.com's Yogini primer (Anuradha, #17 → Bhramari) and
 * PyJHora `yogini.py`, whose per-Yogini star lists ({6,14,22} → Mangala,
 * {1,9,17,25} → Bhramari, …) are exactly this formula. The pre-audit code
 * used `nakIdx % 8` (Ashwini → Mangala), which mis-assigned the starting
 * Yogini for every birth — off by three positions in the cycle.
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
  const nakIdx = nakshatraOf(moonSiderealLon);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedFraction = degInNak / NAKSHATRA_SPAN;

  // (1-based nakshatra + 3) mod 8, remainder 1 = Mangala … 0 = Sankata —
  // which reduces to (nakIdx + 3) % 8 in 0-based index terms.
  const startYoginiIdx = (nakIdx + 3) % 8;
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

// ── Narayan Dasha (Jaimini sign-dasha with padi direction) ─

/**
 * Vishama-pada (odd-padi) rashis — those whose Narayan-Dasha cycle
 * proceeds **forward** (zodiacal) from lagna.
 *
 * Per Sanjay Rath, *Narayana Dasa* (Sagar Publications): a rashi is
 * vishama-pada iff its first navamsa falls in a movable sign. The
 * resulting set is Aries, Taurus, Gemini, Libra, Scorpio, Sagittarius.
 */
export const VISHAMA_PADA_RASHIS: ReadonlySet<number> = new Set([0, 1, 2, 6, 7, 8]);

/**
 * Sama-pada (even-padi) rashis — those whose Narayan-Dasha cycle
 * proceeds **backward** (anti-zodiacal) from lagna. Cancer, Leo,
 * Virgo, Capricorn, Aquarius, Pisces.
 */
export const SAMA_PADA_RASHIS: ReadonlySet<number> = new Set([3, 4, 5, 9, 10, 11]);

/** One Mahadasha period in the Narayan (Jaimini) system. */
export interface NarayanMahaDasha {
  /** Rashi index 0..11 (0 = Mesha … 11 = Meena). */
  rashi: number;
  /** Sign-lord planet (parallel to Vimshottari's `lord`). */
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  /** Duration in years (7, 8, or 9 — same as Chara). */
  years: number;
}

export interface NarayanDashaResult {
  /** Direction the cycle advances from `startingRashi`. */
  direction: 'forward' | 'backward';
  /** Lagna's rashi — first dasha begins here. */
  startingRashi: number;
  /** Index 0..11 (into `mahaDashas`) of the dasha active at the evaluation time. */
  currentIndex: number;
  /** Rashi active at the evaluation time. */
  currentRashi: number;
  /** 12 mahadasha periods covering ~96 years from birth. */
  mahaDashas: NarayanMahaDasha[];
}

/**
 * Compute a **simplified Narayan-style Jaimini Dasha** from the birth
 * moment.
 *
 * **What this implements.** A Chara-Dasha skeleton with the
 * Narayan-style **vishama-pada / sama-pada** parity-direction rule
 * applied:
 *
 *   - **Vishama-pada (odd-padi)** lagna in {Aries, Taurus, Gemini, Libra,
 *     Scorpio, Sagittarius} → cycle proceeds **forward** (zodiacal).
 *   - **Sama-pada (even-padi)** lagna in {Cancer, Leo, Virgo, Capricorn,
 *     Aquarius, Pisces} → cycle proceeds **backward** (anti-zodiacal).
 *
 * Years per rashi follow {@link CHARA_RASHI_YEARS} (Movable 9, Fixed 8,
 * Dual 7) — the **fixed Chara-modality durations**, NOT the variable
 * sign-to-lord-distance durations of the full Sanjay-Rath / BPHS
 * Narayan Dasa. Lord assignment is the rashi's natural lord.
 *
 * Antardasha breakdown is not exposed.
 *
 * **Opt-in variable durations** (Phase 34e item 4). Pass
 * `{ duration: 'variable' }` as the fourth argument to switch to the
 * full Sanjay Rath rule set per *Narayana Dasa* (Sagar Publications):
 *
 *   - **Rule 2** — `years = count(rashi → lord_rashi, direction) − 1`,
 *     direction zodiacal for vimsapada / anti-zodiacal for samapada.
 *   - **Rule 3** — exaltation of the lord adds +1 year; debilitation
 *     subtracts 1; result capped at 12 (floored at 0). Exaltation /
 *     debilitation uses the **Manteswara convention** for Rahu/Ketu
 *     (Rahu exalted in Gemini, Ketu in Sagittarius — NOT Parashara's
 *     Taurus/Scorpio variant, which Sanjay Rath explicitly excludes
 *     for Phalita Dasa).
 *   - **Rule 4** — Scorpio (Mars+Ketu) and Aquarius (Saturn+Rahu)
 *     dual-lord cases: (a) both in dasha sign → 12 years; (b) both
 *     jointly elsewhere → apply Rule 2 to that joint sign; (c) one
 *     in dasha sign, other elsewhere → apply Rule 2 to the *other*
 *     lord; (d) both elsewhere in different signs → use the
 *     **stronger** sign's lord for the count, with strength compared
 *     by Source 1 Rule 2 (planet count) and Source 2 Rule 1 (M/J/
 *     own-lord Rasi-Drishti aspect factors). Final deterministic
 *     tiebreak: natural Manteswara lord (Mars for Scorpio, Saturn
 *     for Aquarius). The rarer Strength Source 1 Rules 3, 4, 6, 7,
 *     8 (planet status, modality, lord degrees, even/odd, higher
 *     dasha period) are documented in
 *     `notes/phase34e-narayan-research.md` as deferred — they are
 *     vanishingly rare in practice.
 *
 * **Still NOT modelled (vs the full Sanjay-Rath standard):**
 *
 *   - **Strength-based starting rashi.** The classical rule starts from
 *     the *stronger of Lagna or 7th house* (decided by 8 hierarchical
 *     strength criteria). This implementation always starts from Lagna
 *     regardless of `options.duration`.
 *   - **Second cycle of dashas** (Rule 5 — years_2nd = 12 − years_1st
 *     for the 13th..24th dashas). The library always returns exactly
 *     12 mahadashas.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param ayanamsa  Ayanamsa system (default `'lahiri'`).
 *
 * @example
 * ```typescript
 * import { computeNarayanDasha } from 'panchang-ts';
 * const narayan = computeNarayanDasha(birthDate, location);
 * narayan.direction;            // 'forward' | 'backward'
 * narayan.mahaDashas[0].rashi;  // lagna rashi
 * narayan.mahaDashas[1].rashi;  // 2nd or 12th from lagna depending on direction
 * ```
 *
 * **Sources.** *Jaimini Upadesa Sutras* Ch. 2 (parity rule).
 * Variable-duration full algorithm: Sanjay Rath, *Narayana Dasa* (Sagar
 * Publications) — not implemented here.
 */
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa?: AyanamsaType,
): NarayanDashaResult;
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType | undefined,
  options: { duration: 'variable' },
): NarayanDashaResult;
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType = 'lahiri',
  options?: { duration?: 'fixed' | 'variable' },
): NarayanDashaResult {
  validateDate(birthDate);
  validateLocation(location);

  const variable = options?.duration === 'variable';

  // ASC + planet placements (only needed in variable mode, but we already
  // call computeLagna anyway for starting rashi + direction).
  const lagna = computeLagna(birthDate, location, ayanamsa);
  const startingRashi = lagna.rashi.index;
  const direction: 'forward' | 'backward' = VISHAMA_PADA_RASHIS.has(startingRashi)
    ? 'forward'
    : 'backward';

  // Build the duration computer: fixed (existing 9/8/7) or variable
  // (Sanjay Rath Rules 2 + 3 + 4 + Source-1-Rule-2 + Source-2-Rule-1).
  const durationFor = variable
    ? buildVariableDurationFn(birthDate, location, ayanamsa)
    : (rashi: number) => CHARA_RASHI_YEARS[rashi]!;

  const mahaDashas: NarayanMahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());
  for (let i = 0; i < 12; i++) {
    const rashi = direction === 'forward'
      ? (startingRashi + i) % 12
      : (startingRashi - i + 12) % 12;
    const years = durationFor(rashi);
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
    direction,
    startingRashi,
    currentIndex: idx,
    currentRashi: mahaDashas[idx]!.rashi,
    mahaDashas,
  };
}

// ── Narayan variable-duration helpers (Sanjay Rath, *Narayana Dasa*) ─

/**
 * Exaltation rashi per graha — Manteswara convention (used by Sanjay
 * Rath specifically for Phalita Dasa like Narayan; NOT Parashara's
 * convention which has Rahu exalted in Taurus).
 */
const NARAYAN_EXALTATION_RASHI: Record<GrahaName, number> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3,
  Venus: 11, Saturn: 6, Rahu: 2, Ketu: 8,
};
const NARAYAN_DEBILITATION_RASHI: Record<GrahaName, number> = {
  Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9,
  Venus: 5, Saturn: 0, Rahu: 8, Ketu: 2,
};

/** Primary (non-dual) sign lord per rashi index. */
const RASHI_PRIMARY_LORD: GrahaName[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

/** Modality per rashi: 0=movable, 1=fixed, 2=dual. */
const RASHI_MODALITY: readonly number[] = [
  0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2,
];

/**
 * Rasi Drishti (sign sight) per Sanjay Rath, *Narayana Dasa* Table 4
 * (chapter II note: "Only Rasi drishti should be used"). Each sign
 * aspects exactly 3 other signs:
 *
 *   - Movable signs aspect the 3 fixed signs (excluding adjacent fixed).
 *   - Fixed signs aspect the 3 movable signs (excluding adjacent movable).
 *   - Dual signs aspect the other 3 dual signs.
 *
 * @returns `true` iff `aspectingRashi` aspects `targetRashi` by Rasi
 *          Drishti. Returns `false` when both rashis are the same.
 */
function rasiDrishti(aspectingRashi: number, targetRashi: number): boolean {
  if (aspectingRashi === targetRashi) return false;
  const aMod = RASHI_MODALITY[aspectingRashi]!;
  const tMod = RASHI_MODALITY[targetRashi]!;
  if (aMod === 2) return tMod === 2;        // dual → dual
  if (aMod === 0) return tMod === 1;        // movable → fixed
  if (aMod === 1) return tMod === 0;        // fixed → movable
  return false;
}

/**
 * Inclusive count from `src` to `dst` in the given direction.
 * - `zodiacal` (vimsapada): forward, wraps mod 12.
 * - `anti` (samapada): backward, wraps mod 12.
 *
 * Inclusive: src counts as 1. So count(src=src) = 1.
 */
function inclusiveSignCount(src: number, dst: number, anti: boolean): number {
  return anti ? ((src - dst + 12) % 12) + 1 : ((dst - src + 12) % 12) + 1;
}

/**
 * Count "more planets in sign" (Strength Source 1 Rule 2). Includes
 * the lord itself if placed in the sign.
 */
function planetsInRashi(planetRashi: Map<GrahaName, number>, rashi: number): number {
  let n = 0;
  for (const r of planetRashi.values()) if (r === rashi) n++;
  return n;
}

/**
 * Count "aspect factors" for Strength Source 2 Rule 1 — number of
 * sign-aspects by Mercury, Jupiter, or the sign's own dispositor
 * (rashi-lord), measured by Rasi Drishti. Each contributing factor
 * adds 1. Max 3 factors (one per planet); two of M/J/Lord may overlap
 * (e.g. Mercury is the natural lord of Gemini, so for the Gemini
 * sign the Mercury factor and own-lord factor would coincide — they
 * are counted separately to match Sanjay Rath's example reasoning).
 */
function countMJLAspectFactors(
  rashi: number,
  planetRashi: Map<GrahaName, number>,
): number {
  let factors = 0;
  const mercuryRashi = planetRashi.get('Mercury');
  const jupiterRashi = planetRashi.get('Jupiter');
  const ownLord = RASHI_PRIMARY_LORD[rashi]!;
  const ownLordRashi = planetRashi.get(ownLord);
  if (mercuryRashi !== undefined && rasiDrishti(mercuryRashi, rashi)) factors++;
  if (jupiterRashi !== undefined && rasiDrishti(jupiterRashi, rashi)) factors++;
  if (ownLordRashi !== undefined && rasiDrishti(ownLordRashi, rashi)) factors++;
  return factors;
}

/**
 * Compare strength of two rashis per Sanjay Rath's stated priority:
 *
 *   1. Source 1 Rule 2 — more planets → stronger.
 *   2. Source 2 Rule 1 — more M/J/own-lord aspect factors → stronger.
 *
 * Returns `1` if A stronger, `-1` if B stronger, `0` if tied (caller
 * falls back to deterministic natural-lord tiebreak). Three further
 * strength rules (modality, planet status, lord degrees) are
 * documented in `notes/phase34e-narayan-research.md` as deferred.
 */
function compareRashiStrength(
  rashiA: number,
  rashiB: number,
  planetRashi: Map<GrahaName, number>,
): -1 | 0 | 1 {
  const pa = planetsInRashi(planetRashi, rashiA);
  const pb = planetsInRashi(planetRashi, rashiB);
  if (pa > pb) return 1;
  if (pa < pb) return -1;
  const fa = countMJLAspectFactors(rashiA, planetRashi);
  const fb = countMJLAspectFactors(rashiB, planetRashi);
  if (fa > fb) return 1;
  if (fa < fb) return -1;
  return 0;
}

/**
 * Build a per-rashi → years function implementing the full Sanjay
 * Rath variable-duration rules (Rules 2 + 3 + 4(a–d)). Closed over a
 * fresh `BirthChart` so it can be re-invoked per dasha rashi without
 * recomputing planet positions.
 */
function buildVariableDurationFn(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType,
): (rashi: number) => number {
  const chart = computeRashiChart(birthDate, location, { ayanamsa, houseSystem: 'whole-sign' });
  const planetRashi = new Map<GrahaName, number>();
  for (const p of chart.planets) planetRashi.set(p.planet, p.rashi.index);

  function durationFor(rashi: number): number {
    // Rule 4 dispatch for the two dual-lord rashis (Scorpio + Aquarius).
    if (rashi === 7 || rashi === 10) {
      const [lordA, lordB]: [GrahaName, GrahaName] = rashi === 7
        ? ['Mars', 'Ketu']
        : ['Saturn', 'Rahu'];
      const ra = planetRashi.get(lordA)!;
      const rb = planetRashi.get(lordB)!;

      if (ra === rashi && rb === rashi) return 12;          // Rule 4(a)
      if (ra === rb)                    return baseAndAdjust(rashi, lordA, ra);  // Rule 4(b)
      if (ra === rashi)                 return baseAndAdjust(rashi, lordB, rb);  // Rule 4(c)
      if (rb === rashi)                 return baseAndAdjust(rashi, lordA, ra);  // Rule 4(c)

      // Rule 4(d) — both lords in different non-dasha signs.
      const cmp = compareRashiStrength(ra, rb, planetRashi);
      if (cmp > 0)  return baseAndAdjust(rashi, lordA, ra);
      if (cmp < 0)  return baseAndAdjust(rashi, lordB, rb);
      // Final deterministic fallback — natural Manteswara lord wins.
      // (Mars for Scorpio, Saturn for Aquarius — both = lordA in the
      // ordering above.)
      return baseAndAdjust(rashi, lordA, ra);
    }

    const lord = RASHI_PRIMARY_LORD[rashi]!;
    const lordRashi = planetRashi.get(lord)!;
    return baseAndAdjust(rashi, lord, lordRashi);
  }

  /**
   * Rule 2 base count − 1, then Rule 3 (exalt +1 / debilit −1 / cap 12).
   * The result is also floored at 0 to prevent a degenerate-negative
   * dasha (count=1, lord-in-rashi-itself, debilitated → base=0, adj=−1
   * → floor to 0).
   */
  function baseAndAdjust(rashi: number, lord: GrahaName, lordRashi: number): number {
    const anti = !VISHAMA_PADA_RASHIS.has(rashi);
    const base = inclusiveSignCount(rashi, lordRashi, anti) - 1;
    let years = base;
    if (NARAYAN_EXALTATION_RASHI[lord] === lordRashi) years += 1;
    else if (NARAYAN_DEBILITATION_RASHI[lord] === lordRashi) years -= 1;
    return Math.min(12, Math.max(0, years));
  }

  return durationFor;
}
