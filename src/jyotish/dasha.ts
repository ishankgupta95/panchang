import { NAKSHATRA_SPAN } from '../utils/constants';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import type { AyanamsaType } from '../types/options';
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
