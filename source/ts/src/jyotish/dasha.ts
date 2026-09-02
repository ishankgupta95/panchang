import { NAKSHATRA_SPAN, nakshatraOf } from '../utils/constants';
import { getSiderealMoonLongitude } from '../astronomy/moon';
import { computeLagna } from './lagna';
import { computeRashiChart } from './charts';
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
 * @param moonSiderealLon Sidereal Moon longitude at birth, [0, 360).
 */
export function computeVimshottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): VimshottariDashaResult {
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
      antarDashas = buildAntarDashas(lord, virtualStart, fullDurationMs, startDate.getTime());
    } else {
      endDate = new Date(cursor.getTime() + fullDurationMs);
      antarDashas = buildAntarDashas(lord, startDate, fullDurationMs, startDate.getTime());
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

/** The 9 pratyantar (third-level) dashas filling an antardasha, cycling from the antardasha lord. */
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
 * @param moonSiderealLon Sidereal Moon longitude at birth, [0, 360).
 */
export function computeAshtottariDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): VimshottariDashaResult {
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
    const durationMs = i === 0 ? balanceMs : years * MS_PER_YEAR;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const antarDashas = buildAshtottariAntarDashas(lord, startDate, durationMs);
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
 * @param moonSiderealLon Sidereal Moon longitude at birth, [0, 360).
 */
export function computeYoginiDasha(
  birthDate: Date,
  moonSiderealLon: number,
  asOfDate?: Date,
): YoginiDashaResult {
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
    const durationMs = i === 0 ? balanceMs : years * MS_PER_YEAR;
    const startDate = new Date(cursor.getTime());
    const endDate = new Date(cursor.getTime() + durationMs);
    const antarDashas = buildYoginiAntarDashas(yogini, startDate, durationMs);
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

/** Per-rashi Chara years, "9-8-7" by modality (Achyutananda / Jaimini Sutras Ch. 1). */
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
 * Chara (Jaimini) Dasha from birth: sign-based from the lagna's rashi, always running forward
 * (the Achyutananda "Karaka Chara" variant), never reversed for even-rashi lagnas.
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
 * Narayan-style Jaimini Dasha: a Chara skeleton run in the direction set by the lagna's pada parity;
 * `{ duration: 'variable' }` swaps the fixed modality years for Sanjay Rath's sign-to-lord-distance rules.
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

/** Sanjay Rath's variable-duration rules (*Narayana Dasa*) as a rashi → years function. */
function buildVariableDurationFn(
  birthDate: Date,
  location: GeoLocation,
  ayanamsa: AyanamsaType,
): (rashi: number) => number {
  const chart = computeRashiChart(birthDate, location, { ayanamsa, houseSystem: 'whole-sign' });
  const planetRashi = new Map<GrahaName, number>();
  for (const p of chart.planets) planetRashi.set(p.planet, p.rashi.index);

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

  /** Floored at 0: a debilitated lord in the dasha rashi itself would go negative. */
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
