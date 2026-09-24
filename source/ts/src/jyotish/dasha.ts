import { NAKSHATRA_SPAN, nakshatraOf } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeLagna } from './lagna';
import { siderealGrahaLongitudes } from './planets';
import { validateLocation, validateDate } from '../utils/validation';
import { PanchangError } from '../types/errors';
import type { AyanamsaType } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { DashaLord, GrahaName, MahaDasha, AntarDasha, PratyantarDasha, VimshottariDashaResult } from '../types/jyotish';

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

export const DASHA_ORDER: DashaLord[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];

export const NAKSHATRA_LORD: DashaLord[] = [
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
  'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury',
];

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Wraps a finite longitude into [0, 360), so 360 reads as 0 and -0.5 as 359.5; the identity on [0, 360). */
function resolveMoonLongitude(moonSiderealLon: number): number {
  if (!Number.isFinite(moonSiderealLon)) {
    throw new PanchangError(
      `moonSiderealLon must be a finite number, got ${moonSiderealLon}`,
      'INVALID_INPUT',
    );
  }
  return normalize360(moonSiderealLon);
}

/** Deliberately skips `validateDate`: its 1900-2100 bound guards ephemeris accuracy, not table lookup. */
function resolveAsOf(asOfDate: Date | undefined): Date {
  if (asOfDate === undefined) return new Date();
  if (!(asOfDate instanceof Date) || isNaN(asOfDate.getTime())) {
    throw new PanchangError(`Invalid asOfDate: ${String(asOfDate)}`, 'INVALID_DATE');
  }
  return asOfDate;
}

/**
 * Vimshottari Dasha from birth: 9 mahadashas over 120 years, the first being the balance of the birth-nakshatra lord.
 * @param moonSiderealLon Sidereal Moon longitude at birth in degrees, [0, 360). A finite value outside that range is
 *   wrapped into it; NaN or an infinity throws `PanchangError` `INVALID_INPUT`.
 */
export function computeVimshottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): VimshottariDashaResult {
  moonSiderealLon = resolveMoonLongitude(moonSiderealLon);
  validateDate(birthDate);
  const nakIdx = nakshatraOf(moonSiderealLon);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedFraction = degInNak / NAKSHATRA_SPAN;

  const startLord = NAKSHATRA_LORD[nakIdx]!;
  const startLordIdx = DASHA_ORDER.indexOf(startLord);
  const startLordYears = DASHA_YEARS[startLord];

  const balanceMs = (1 - elapsedFraction) * startLordYears * MS_PER_YEAR;

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
      endDate = new Date(cursor.getTime() + balanceMs);
      const virtualStart = new Date(birthDate.getTime() - (fullDurationMs - balanceMs));
      antarDashas = buildAntarDashas(
        lord, virtualStart, fullDurationMs, startDate.getTime(), endDate.getTime());
    } else {
      endDate = new Date(cursor.getTime() + fullDurationMs);
      antarDashas = buildAntarDashas(
        lord, startDate, fullDurationMs, startDate.getTime(), endDate.getTime());
    }

    mahaDashas.push({ lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  const now = resolveAsOf(asOfDate);
  const currentIndex = mahaDashas.findIndex(
    (md) => now >= md.startDate && now < md.endDate,
  );

  return {
    currentMahaDashaLord: mahaDashas[Math.max(0, currentIndex)]!.lord,
    currentIndex: Math.max(0, currentIndex),
    mahaDashas,
  };
}

/** {@link computeVimshottariDasha} with the sidereal Moon longitude computed from the birth instant. */
export function computeVimshottariDashaFromBirth(
  birthDate: Date,
  ayanamsaType: AyanamsaType = 'lahiri',
  asOfDate?: Date,
): VimshottariDashaResult {
  const moonSid = getSiderealMoonLongitude(birthDate, ayanamsaType);
  return computeVimshottariDasha(birthDate, moonSid, asOfDate);
}

/**
 * The 9 pratyantar (third-level) dashas filling an antardasha, cycling from the antardasha lord.
 * The span given is split as if it were a whole antardasha, so the birth antardasha
 * (`mahaDashas[0].antarDashas[0]`, clipped at birth) needs {@link computeVimshottariPratyantarIn}.
 * An unknown lord throws `INVALID_INPUT`, an Invalid Date `INVALID_DATE`.
 */
export function computeVimshottariPratyantar(antardasha: AntarDasha): PratyantarDasha[] {
  const lordIdx = DASHA_ORDER.indexOf(antardasha.lord);
  if (lordIdx < 0) {
    throw new PanchangError(`Invalid antardasha lord: ${antardasha.lord}`, 'INVALID_INPUT');
  }
  validateDate(antardasha.startDate, 'any');
  validateDate(antardasha.endDate, 'any');
  const startMs = antardasha.startDate.getTime();
  const endMs = antardasha.endDate.getTime();
  return buildPratyantars(lordIdx, endMs - startMs, startMs, startMs, endMs);
}

/**
 * The pratyantars of an antardasha of `mahaDasha` (only its lord is read): the full antardasha,
 * ending at `antardasha.endDate`, is split and those over before `antardasha.startDate` dropped,
 * so the birth antardasha's list starts with the pratyantar running at birth. An antardasha within
 * a millisecond of its full length gets exactly {@link computeVimshottariPratyantar}'s list.
 * An unknown lord throws `INVALID_INPUT`, an Invalid Date `INVALID_DATE`.
 */
export function computeVimshottariPratyantarIn(
  mahaDasha: MahaDasha,
  antardasha: AntarDasha,
): PratyantarDasha[] {
  const lordIdx = DASHA_ORDER.indexOf(antardasha.lord);
  if (lordIdx < 0) {
    throw new PanchangError(`Invalid antardasha lord: ${antardasha.lord}`, 'INVALID_INPUT');
  }
  if (DASHA_ORDER.indexOf(mahaDasha.lord) < 0) {
    throw new PanchangError(`Invalid mahadasha lord: ${mahaDasha.lord}`, 'INVALID_INPUT');
  }
  validateDate(antardasha.startDate, 'any');
  validateDate(antardasha.endDate, 'any');
  const startMs = antardasha.startDate.getTime();
  const endMs = antardasha.endDate.getTime();
  const spanMs = endMs - startMs;
  const fullMs = (DASHA_YEARS[antardasha.lord] / 120) * (DASHA_YEARS[mahaDasha.lord] * MS_PER_YEAR);
  const splitMs = fullMs - spanMs > 1 ? fullMs : spanMs;
  return buildPratyantars(lordIdx, splitMs, endMs - splitMs, startMs, endMs);
}

function buildPratyantars(
  lordIdx: number,
  fullMs: number,
  virtualStartMs: number,
  clipStartMs: number,
  endMs: number,
): PratyantarDasha[] {
  const lords: DashaLord[] = [];
  const lengthsMs: number[] = [];
  for (let i = 0; i < 9; i++) {
    const subLord = DASHA_ORDER[(lordIdx + i) % 9]!;
    lords.push(subLord);
    lengthsMs.push((DASHA_YEARS[subLord] / 120) * fullMs);
  }
  return tileSubPeriods(lengthsMs, virtualStartMs, clipStartMs, endMs)
    .map((p) => ({ lord: lords[p.index]!, startDate: p.startDate, endDate: p.endDate }));
}

/**
 * Lays sub-periods of `lengthsMs` end to end from `virtualStartMs`, drops those over by
 * `clipStartMs`, starts the next there and ends the last exactly at `endMs`, so the list
 * tiles its parent. The cursor keeps its fraction; only the published Dates truncate.
 */
function tileSubPeriods(
  lengthsMs: readonly number[],
  virtualStartMs: number,
  clipStartMs: number,
  endMs: number,
): { index: number; startDate: Date; endDate: Date }[] {
  const out: { index: number; startDate: Date; endDate: Date }[] = [];
  const last = lengthsMs.length - 1;
  let cursor = virtualStartMs;
  for (let i = 0; i <= last; i++) {
    const start = cursor;
    cursor = cursor + lengthsMs[i]!;
    const end = i === last ? endMs : cursor;
    if (end <= clipStartMs) continue;
    out.push({
      index: i,
      startDate: new Date(start < clipStartMs ? clipStartMs : start),
      endDate: new Date(end),
    });
  }
  return out;
}

function buildAntarDashas(
  mahaLord: DashaLord,
  mahaVirtualStart: Date,
  mahaFullDurationMs: number,
  clipStartMs: number,
  mahaEndMs: number,
): AntarDasha[] {
  const mahaIdx = DASHA_ORDER.indexOf(mahaLord);
  const lords: DashaLord[] = [];
  const lengthsMs: number[] = [];
  for (let i = 0; i < 9; i++) {
    const antarLord = DASHA_ORDER[(mahaIdx + i) % 9]!;
    lords.push(antarLord);
    lengthsMs.push((DASHA_YEARS[antarLord] / 120) * mahaFullDurationMs);
  }
  return tileSubPeriods(lengthsMs, mahaVirtualStart.getTime(), clipStartMs, mahaEndMs)
    .map((p) => ({ lord: lords[p.index]!, startDate: p.startDate, endDate: p.endDate }));
}

/** Satya Acharya's eight-lord sequence (no Ketu). */
export const ASHTOTTARI_ORDER: readonly DashaLord[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Saturn', 'Jupiter', 'Rahu', 'Venus',
];

export const ASHTOTTARI_YEARS: Record<string, number> = {
  Sun: 6, Moon: 15, Mars: 8, Mercury: 17,
  Saturn: 10, Jupiter: 19, Rahu: 12, Venus: 21,
};

const ASHTOTTARI_TOTAL_YEARS = 108;

/** The classical Ardradi allocation: nakshatra indices (0 = Ashwini) per {@link ASHTOTTARI_ORDER} lord. */
export const ASHTOTTARI_NAKSHATRA_GROUPS: readonly (readonly number[])[] = [
  [5, 6, 7, 8],
  [9, 10, 11],
  [12, 13, 14, 15],
  [16, 17, 18],
  [19, 20, 21],
  [22, 23, 24],
  [25, 26, 0, 1],
  [2, 3, 4],
];

/**
 * Ashtottari Dasha from birth: a 108-year, 8-planet cycle prescribed for Krishna Paksha births.
 * @param moonSiderealLon Sidereal Moon longitude at birth in degrees, [0, 360). A finite value outside that range is
 *   wrapped into it; NaN or an infinity throws `PanchangError` `INVALID_INPUT`.
 */
export function computeAshtottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): VimshottariDashaResult {
  moonSiderealLon = resolveMoonLongitude(moonSiderealLon);
  validateDate(birthDate);
  const nakIdx = nakshatraOf(moonSiderealLon);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedInNak = degInNak / NAKSHATRA_SPAN;

  const lordIdx = ASHTOTTARI_NAKSHATRA_GROUPS.findIndex((g) => g.includes(nakIdx));
  const group = ASHTOTTARI_NAKSHATRA_GROUPS[lordIdx]!;
  const startLord = ASHTOTTARI_ORDER[lordIdx]!;
  const posInGroup = group.indexOf(nakIdx);
  const elapsedInLord = (posInGroup + elapsedInNak) / group.length;
  const balanceMs = (1 - elapsedInLord) * ASHTOTTARI_YEARS[startLord]! * MS_PER_YEAR;

  const mahaDashas: MahaDasha[] = [];
  let cursor = new Date(birthDate.getTime());
  for (let i = 0; i < 8; i++) {
    const lord = ASHTOTTARI_ORDER[(lordIdx + i) % 8]!;
    const years = ASHTOTTARI_YEARS[lord]!;
    const fullDurationMs = years * MS_PER_YEAR;
    const durationMs = i === 0 ? balanceMs : fullDurationMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const virtualStart = i === 0
      ? new Date(birthDate.getTime() - (fullDurationMs - balanceMs))
      : startDate;
    const antarDashas = buildAshtottariAntarDashas(
      lord, virtualStart, fullDurationMs, startDate.getTime(), endDate.getTime());
    mahaDashas.push({ lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  const now = resolveAsOf(asOfDate);
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
  mahaVirtualStart: Date,
  mahaFullDurationMs: number,
  clipStartMs: number,
  mahaEndMs: number,
): AntarDasha[] {
  const mahaIdx = ASHTOTTARI_ORDER.indexOf(mahaLord);
  const lords: DashaLord[] = [];
  const lengthsMs: number[] = [];
  for (let i = 0; i < 8; i++) {
    const antarLord = ASHTOTTARI_ORDER[(mahaIdx + i) % 8]!;
    const antarYears = ASHTOTTARI_YEARS[antarLord]!;
    lords.push(antarLord);
    lengthsMs.push((antarYears / ASHTOTTARI_TOTAL_YEARS) * mahaFullDurationMs);
  }
  return tileSubPeriods(lengthsMs, mahaVirtualStart.getTime(), clipStartMs, mahaEndMs)
    .map((p) => ({ lord: lords[p.index]!, startDate: p.startDate, endDate: p.endDate }));
}

/** The 8 Yoginis, in classical order. */
export type YoginiName =
  | 'Mangala' | 'Pingala' | 'Dhanya' | 'Bhramari'
  | 'Bhadrika' | 'Ulka' | 'Siddha' | 'Sankata';

export const YOGINI_YEARS: Record<YoginiName, number> = {
  Mangala: 1, Pingala: 2, Dhanya: 3, Bhramari: 4,
  Bhadrika: 5, Ulka: 6, Siddha: 7, Sankata: 8,
};

export const YOGINI_ORDER: readonly YoginiName[] = [
  'Mangala', 'Pingala', 'Dhanya', 'Bhramari',
  'Bhadrika', 'Ulka', 'Siddha', 'Sankata',
];

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

export interface YoginiMahaDasha {
  yogini: YoginiName;
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
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
 * Yogini Dasha from birth: a 36-year cycle of eight Yoginis (Sanjay Rath, *Yogini Dashas*).
 * @param moonSiderealLon Sidereal Moon longitude at birth in degrees, [0, 360). A finite value outside that range is
 *   wrapped into it; NaN or an infinity throws `PanchangError` `INVALID_INPUT`.
 */
export function computeYoginiDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): YoginiDashaResult {
  moonSiderealLon = resolveMoonLongitude(moonSiderealLon);
  validateDate(birthDate);
  const nakIdx = nakshatraOf(moonSiderealLon);
  const degInNak = moonSiderealLon - nakIdx * NAKSHATRA_SPAN;
  const elapsedFraction = degInNak / NAKSHATRA_SPAN;

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
    const fullDurationMs = years * MS_PER_YEAR;
    const durationMs = i === 0 ? balanceMs : fullDurationMs;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const virtualStart = i === 0
      ? new Date(birthDate.getTime() - (fullDurationMs - balanceMs))
      : startDate;
    const antarDashas = buildYoginiAntarDashas(
      yogini, virtualStart, fullDurationMs, startDate.getTime(), endDate.getTime());
    mahaDashas.push({ yogini, lord, startDate, endDate, years, antarDashas });
    cursor = endDate;
  }

  const now = resolveAsOf(asOfDate);
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
  mahaVirtualStart: Date,
  mahaFullDurationMs: number,
  clipStartMs: number,
  mahaEndMs: number,
): YoginiAntarDasha[] {
  const mahaIdx = YOGINI_ORDER.indexOf(mahaYogini);
  const yoginis: YoginiName[] = [];
  const lengthsMs: number[] = [];
  for (let i = 0; i < 8; i++) {
    const yogini = YOGINI_ORDER[(mahaIdx + i) % 8]!;
    const yoginiYears = YOGINI_YEARS[yogini];
    yoginis.push(yogini);
    lengthsMs.push((yoginiYears / YOGINI_TOTAL_YEARS) * mahaFullDurationMs);
  }
  return tileSubPeriods(lengthsMs, mahaVirtualStart.getTime(), clipStartMs, mahaEndMs)
    .map((p) => {
      const yogini = yoginis[p.index]!;
      return { yogini, lord: YOGINI_PLANET[yogini], startDate: p.startDate, endDate: p.endDate };
    });
}

/**
 * Per-rashi Chara years, fixed by modality whatever the chart: movable 9, fixed 8, dual 7 (96 in all).
 * Not the Jaimini count (J.S. 1.1.28: signs from the rashi to its lord, less one) of K.N. Rao's Chara
 * or Sanjay Rath's Narayana dasha; `computeNarayanDasha` with `{ duration: 'variable' }` implements that.
 */
export const CHARA_RASHI_YEARS: readonly number[] = [
  9,
  8,
  7,
  9,
  8,
  7,
  9,
  8,
  7,
  9,
  8,
  7,
];

const CHARA_RASHI_LORD: readonly DashaLord[] = [
  'Mars',
  'Venus',
  'Mercury',
  'Moon',
  'Sun',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Saturn',
  'Jupiter',
];

export interface CharaMahaDasha {
  /** 0 = Mesha … 11 = Meena. */
  rashi: number;
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  years: number;
}

export interface CharaDashaResult {
  currentIndex: number;
  currentRashi: number;
  mahaDashas: CharaMahaDasha[];
}

/**
 * Chara (Jaimini) Dasha from birth: twelve rashi periods from the lagna's rashi, always running
 * forward, each lasting its {@link CHARA_RASHI_YEARS} entry. A fixed scheme: the chart only picks
 * the starting rashi. It is not the Chara dasha of K.N. Rao or P.V.R. Narasimha Rao, whose years come
 * from each sign's lord and whose direction depends on the chart.
 */
export function computeCharaDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType = 'lahiri',
  asOfDate?: Date,
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

  const now = resolveAsOf(asOfDate);
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

/** Vishama-pada rashis (first navamsa in a movable sign), whose cycle runs forward from lagna. */
export const VISHAMA_PADA_RASHIS: ReadonlySet<number> = new Set([0, 1, 2, 6, 7, 8]);

/** Sama-pada (even-padi) rashis, whose cycle runs backward from lagna. */
export const SAMA_PADA_RASHIS: ReadonlySet<number> = new Set([3, 4, 5, 9, 10, 11]);

export interface NarayanMahaDasha {
  /** 0 = Mesha … 11 = Meena. */
  rashi: number;
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  years: number;
}

export interface NarayanDashaResult {
  direction: 'forward' | 'backward';
  /** Lagna's rashi: the first dasha begins here. */
  startingRashi: number;
  currentIndex: number;
  currentRashi: number;
  mahaDashas: NarayanMahaDasha[];
}

/**
 * Narayan-style Jaimini Dasha: a Chara skeleton run in the direction set by the lagna's pada parity.
 * By default each rashi takes its fixed {@link CHARA_RASHI_YEARS} entry; `{ duration: 'variable' }`
 * applies Sanjay Rath's sign-to-lord-distance rules instead (a lord in its own rashi gives 12 years).
 */
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa?: AyanamsaType,
  options?: { asOfDate?: Date },
): NarayanDashaResult;
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType | undefined,
  options: { duration: 'variable'; asOfDate?: Date },
): NarayanDashaResult;
export function computeNarayanDasha(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType = 'lahiri',
  options?: { duration?: 'fixed' | 'variable'; asOfDate?: Date },
): NarayanDashaResult {
  validateDate(birthDate);
  validateLocation(location);

  const variable = options?.duration === 'variable';

  const lagna = computeLagna(birthDate, location, ayanamsa);
  const startingRashi = lagna.rashi.index;
  const direction: 'forward' | 'backward' = VISHAMA_PADA_RASHIS.has(startingRashi)
    ? 'forward'
    : 'backward';

  const durationFor = variable
    ? buildVariableDurationFn(birthDate, ayanamsa)
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

  const now = resolveAsOf(options?.asOfDate);
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

/** Manteswara convention (Sanjay Rath, Phalita Dasa): Rahu exalted in Gemini, not Taurus as in `dignity.ts`. */
const NARAYAN_EXALTATION_RASHI: Record<GrahaName, number> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3,
  Venus: 11, Saturn: 6, Rahu: 2, Ketu: 8,
};
const NARAYAN_DEBILITATION_RASHI: Record<GrahaName, number> = {
  Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9,
  Venus: 5, Saturn: 0, Rahu: 8, Ketu: 2,
};

const RASHI_PRIMARY_LORD: GrahaName[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

/** Modality per rashi: 0=movable, 1=fixed, 2=dual. */
const RASHI_MODALITY: readonly number[] = [
  0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2,
];

/** Rasi Drishti (Sanjay Rath, *Narayana Dasa* Table 4): each sign aspects exactly 3 others. */
function rasiDrishti(aspectingRashi: number, targetRashi: number): boolean {
  if (aspectingRashi === targetRashi) return false;
  if ((aspectingRashi + 1) % 12 === targetRashi
    || (targetRashi + 1) % 12 === aspectingRashi) return false;
  const aMod = RASHI_MODALITY[aspectingRashi]!;
  const tMod = RASHI_MODALITY[targetRashi]!;
  if (aMod === 2) return tMod === 2;
  if (aMod === 0) return tMod === 1;
  if (aMod === 1) return tMod === 0;
  return false;
}

function inclusiveSignCount(src: number, dst: number, anti: boolean): number {
  return anti ? ((src - dst + 12) % 12) + 1 : ((dst - src + 12) % 12) + 1;
}

function planetsInRashi(planetRashi: Map<GrahaName, number>, rashi: number): number {
  let n = 0;
  for (const r of planetRashi.values()) if (r === rashi) n++;
  return n;
}

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

/** `computeRashiChart`'s planet order. */
const GRAHAS_IN_CHART_ORDER: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

/** Sanjay Rath's variable-duration rules (*Narayana Dasa*) as a rashi → years function. */
function buildVariableDurationFn(
  birthDate: Date,
  ayanamsa: AyanamsaType,
): (rashi: number) => number {
  const longitudes = siderealGrahaLongitudes(birthDate, ayanamsa, 'mean');
  const planetRashi = new Map<GrahaName, number>();
  for (const planet of GRAHAS_IN_CHART_ORDER) {
    planetRashi.set(planet, Math.floor(longitudes[planet] / 30));
  }

  function durationFor(rashi: number): number {
    if (rashi === 7 || rashi === 10) {
      const [lordA, lordB]: [GrahaName, GrahaName] = rashi === 7
        ? ['Mars', 'Ketu']
        : ['Saturn', 'Rahu'];
      const ra = planetRashi.get(lordA)!;
      const rb = planetRashi.get(lordB)!;

      if (ra === rashi && rb === rashi) return 12;
      if (ra === rb)                    return baseAndAdjust(rashi, lordA, ra);
      if (ra === rashi)                 return baseAndAdjust(rashi, lordB, rb);
      if (rb === rashi)                 return baseAndAdjust(rashi, lordA, ra);

      const cmp = compareRashiStrength(ra, rb, planetRashi);
      if (cmp > 0)  return baseAndAdjust(rashi, lordA, ra);
      if (cmp < 0)  return baseAndAdjust(rashi, lordB, rb);
      return baseAndAdjust(rashi, lordA, ra);
    }

    const lord = RASHI_PRIMARY_LORD[rashi]!;
    const lordRashi = planetRashi.get(lord)!;
    return baseAndAdjust(rashi, lord, lordRashi);
  }

  /**
   * Rule 2 counts a lord in the rashi itself round the whole zodiac, 13 - 1 = 12; Rule 3(b) caps
   * exalted Mercury in Virgo at 12. The floor is never crossed: the least is 0, Jupiter debilitated
   * in Capricorn for Sagittarius.
   */
  function baseAndAdjust(rashi: number, lord: GrahaName, lordRashi: number): number {
    const anti = !VISHAMA_PADA_RASHIS.has(rashi);
    let years = lordRashi === rashi ? 12 : inclusiveSignCount(rashi, lordRashi, anti) - 1;
    if (NARAYAN_EXALTATION_RASHI[lord] === lordRashi) years += 1;
    else if (NARAYAN_DEBILITATION_RASHI[lord] === lordRashi) years -= 1;
    return Math.min(12, Math.max(0, years));
  }

  return durationFor;
}
