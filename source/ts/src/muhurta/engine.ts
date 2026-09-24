import { getDailyPanchang } from '../core/panchang';
import { computeVaraTithiYogas } from './varaTithiYogas';
import { validateLocation, validateDate, validateLocalYearWindow } from '../utils/validation';
import { localYearWindow, civilDayStepper, clampToSupported } from '../utils/timezone';
import type { MuhurtaFactor } from './muhurtaTableTypes';
import type { GeoLocation } from '../types/location';
import type { Language, AyanamsaType, MasaSystem, PanchangSection } from '../types/options';
import type { DailyPanchangResult } from '../types/panchang';

/**
 * Rule indices: tithi 0..29 (0 = Shukla Pratipada, 29 = Amavasya), nakshatra 0..26
 * (Ashwini = 0), vara 0..6 (Sunday = 0), yoga 0..26 (Vishkambha = 0).
 */
export type { MuhurtaFactor } from './muhurtaTableTypes';

export interface MuhurtaRule {
  occasion: string;
  name?: string;
  auspiciousTithis?: readonly number[];
  inauspiciousTithis?: readonly number[];
  auspiciousNakshatras?: readonly number[];
  inauspiciousNakshatras?: readonly number[];
  auspiciousVaras?: readonly number[];
  inauspiciousVaras?: readonly number[];
  auspiciousYogas?: readonly number[];
  inauspiciousYogas?: readonly number[];
  /** `'ignore'` (the default), `'penalize'` (−15) or `'exclude'`, which vetoes seven whole tithis. */
  bhadra?: 'ignore' | 'penalize' | 'exclude';
  /** @deprecated Use {@link MuhurtaRule.bhadra}; when both are set, `bhadra` wins. */
  excludeBhadra?: boolean;
  /** Tithi 10 / 25 at sunrise. */
  excludeEkadashi?: boolean;
  requirePaksha?: 'shukla' | 'krishna';
  excludeAdhikaMasa?: boolean;
  excludeEclipse?: boolean;
  excludeGandaMula?: boolean;
  /** Only a Panchaka carrying a dosha vetoes; a Wednesday or Thursday spell ("Samanya") has none. */
  excludePanchaka?: boolean;
  /** Score the classical Vara x Tithi yogas at +10 / −15. Defaults to `true`. */
  varaTithiYogas?: boolean;
}

export interface MuhurtaScore {
  date: Date;
  /** 0..100. */
  score: number;
  /** Clears every hard exclusion and scores ≥ 50. */
  passes: boolean;
  /** English diagnostics: unlocalized, not a stable format, branch on `factors`. */
  reasons: string[];
  factors: MuhurtaFactor[];
}

export interface MuhurtaDay extends MuhurtaScore {
  panchang: DailyPanchangResult;
}

export interface MuhurtaScoreOptions {
  /** UTC offset in minutes, or an IANA zone name. */
  timezone: number | string;
  /** Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  language?: Language;
  /** Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
}

/** Everything {@link scoreFromPanchang} reads beyond the sections every day computes: the
 * eclipse, and the Bhadra that `lunarWindows` brings. No value depends on which sections were
 * asked for (INTERPOLATE_ALWAYS in `core/panchang.ts`), so these score a day as a full one does. */
const SCORED_SECTIONS: readonly PanchangSection[] = ['eclipse', 'lunarWindows'];

/**
 * Score one day against a muhurta rule; baseline 50, exclusions zero it outright.
 * @param date Any `Date` within the local calendar day to evaluate.
 */
export function scoreMuhurta(
  date: Date,
  location: GeoLocation,
  rule: MuhurtaRule,
  options: MuhurtaScoreOptions,
): MuhurtaScore {
  validateDate(date);
  validateLocation(location);
  const panchang = getDailyPanchang(date, location, {
    ...options,
    sections: SCORED_SECTIONS,
  });
  if (panchang === null) {
    return {
      date,
      score: 0,
      passes: false,
      reasons: ['polar location with no sunrise, Hindu day undefined'],
      factors: [{ code: 'no_sunrise', axis: 'exclusion', delta: 0 }],
    };
  }
  return scoreFromPanchang(panchang, rule);
}

/**
 * Every civil day of `options.timezone` from `start` to `end` inclusive, each at start's local
 * time of day, best score first; failures omitted unless asked for.
 */
export function computeAuspiciousDatesInRange(
  rule: MuhurtaRule,
  start: Date,
  end: Date,
  location: GeoLocation,
  options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[] {
  validateDate(start);
  validateDate(end);
  validateLocation(location);
  if (start.getTime() > end.getTime()) {
    throw new RangeError(`start (${start.toISOString()}) must be ≤ end (${end.toISOString()})`);
  }
  return scoreCivilDays(rule, start.getTime(), end.getTime(), location, options);
}

export function scoreCivilDays(
  rule: MuhurtaRule,
  startMs: number,
  endMs: number,
  location: GeoLocation,
  options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[] {
  const out: MuhurtaDay[] = [];
  const next = civilDayStepper(startMs, options.timezone);
  for (let t = next(); t <= endMs; t = next()) {
    const panchang = getDailyPanchang(new Date(clampToSupported(t)), location, options);
    if (panchang === null) continue;
    const result = scoreFromPanchang(panchang, rule);
    if (result.passes || options.includeFailures) {
      out.push({ ...result, panchang });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/**
 * @internal {@link scoreCivilDays} for a caller that keeps only the scores, as `buildMuhurtaTable`
 * does: each day is built with {@link SCORED_SECTIONS} and no anga end times (the special yogas are
 * found from the tithi and nakshatra spans either way), which scores it exactly as the full day
 * does, and no panchang is kept. The same days in the same order.
 */
export function scoreOnlyCivilDays(
  rule: MuhurtaRule,
  startMs: number,
  endMs: number,
  location: GeoLocation,
  options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaScore[] {
  const out: MuhurtaScore[] = [];
  const dayOptions = { ...options, sections: SCORED_SECTIONS, computeEndTimes: false };
  const next = civilDayStepper(startMs, options.timezone);
  for (let t = next(); t <= endMs; t = next()) {
    const panchang = getDailyPanchang(new Date(clampToSupported(t)), location, dayOptions);
    if (panchang === null) continue;
    const result = scoreFromPanchang(panchang, rule);
    if (result.passes || options.includeFailures) out.push(result);
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

function scoreFromPanchang(p: DailyPanchangResult, rule: MuhurtaRule): MuhurtaScore {
  const reasons: string[] = [];
  const factors: MuhurtaFactor[] = [];
  let score = 50;
  let passes = true;

  const tithiAtSunrise = p.angas.tithis[0]!.index;
  const nakAtSunrise = p.angas.nakshatras[0]!.index;
  const yogaAtSunrise = p.angas.yogas[0]!.index;
  const varaIdx = p.angas.vara.index;

  const bhadraMode = rule.bhadra ?? (rule.excludeBhadra ? 'exclude' : 'ignore');

  if (bhadraMode === 'exclude' && p.inauspicious.bhadra !== null) {
    return zero(p.date, 'Bhadra Kala active on this day', 'bhadra');
  }
  if (rule.excludeEkadashi) {
    const isEkadashi = tithiAtSunrise === 10 || tithiAtSunrise === 25;
    if (isEkadashi) {
      return zero(p.date, 'Ekadashi tithi at sunrise', 'ekadashi');
    }
  }
  if (rule.excludeEclipse && p.eclipse !== null) {
    return zero(p.date, `Eclipse overlap (${p.eclipse.subtype})`, 'eclipse');
  }
  if (rule.excludeAdhikaMasa && p.calendar.chandramasa.isAdhika) {
    return zero(p.date, 'Adhika (intercalary) lunar month', 'adhika_masa');
  }
  if (rule.excludeGandaMula && p.inauspicious.gandaMula.active) {
    return zero(p.date, `Ganda Mula nakshatra (${p.inauspicious.gandaMula.severity})`, 'ganda_mula');
  }
  const pk = p.inauspicious.panchakaInfo;
  if (rule.excludePanchaka && pk.active && pk.isDosha) {
    return zero(p.date, `Panchaka active (${pk.type})`, 'panchaka');
  }
  if (rule.requirePaksha) {
    const paksha = tithiAtSunrise < 15 ? 'shukla' : 'krishna';
    if (paksha !== rule.requirePaksha) {
      return zero(p.date, `paksha is ${paksha}, rule requires ${rule.requirePaksha}`, 'paksha');
    }
  }

  if (rule.auspiciousTithis?.includes(tithiAtSunrise)) {
    score += 10;
    reasons.push(`auspicious tithi (${tithiAtSunrise})`);
    factors.push({ code: 'auspicious_tithi', axis: 'tithi', index: tithiAtSunrise, delta: 10 });
  } else if (rule.inauspiciousTithis?.includes(tithiAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious tithi (${tithiAtSunrise})`);
    factors.push({ code: 'inauspicious_tithi', axis: 'tithi', index: tithiAtSunrise, delta: -15 });
  }

  if (rule.auspiciousNakshatras?.includes(nakAtSunrise)) {
    score += 10;
    reasons.push(`auspicious nakshatra (${nakAtSunrise})`);
    factors.push({ code: 'auspicious_nakshatra', axis: 'nakshatra', index: nakAtSunrise, delta: 10 });
  } else if (rule.inauspiciousNakshatras?.includes(nakAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious nakshatra (${nakAtSunrise})`);
    factors.push({ code: 'inauspicious_nakshatra', axis: 'nakshatra', index: nakAtSunrise, delta: -15 });
  }

  if (rule.auspiciousVaras?.includes(varaIdx)) {
    score += 10;
    reasons.push(`auspicious vara (${varaIdx})`);
    factors.push({ code: 'auspicious_vara', axis: 'vara', index: varaIdx, delta: 10 });
  } else if (rule.inauspiciousVaras?.includes(varaIdx)) {
    score -= 15;
    reasons.push(`inauspicious vara (${varaIdx})`);
    factors.push({ code: 'inauspicious_vara', axis: 'vara', index: varaIdx, delta: -15 });
  }

  if (rule.auspiciousYogas?.includes(yogaAtSunrise)) {
    score += 10;
    reasons.push(`auspicious yoga (${yogaAtSunrise})`);
    factors.push({ code: 'auspicious_yoga', axis: 'yoga', index: yogaAtSunrise, delta: 10 });
  } else if (rule.inauspiciousYogas?.includes(yogaAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious yoga (${yogaAtSunrise})`);
    factors.push({ code: 'inauspicious_yoga', axis: 'yoga', index: yogaAtSunrise, delta: -15 });
  }

  if (rule.varaTithiYogas !== false) {
    for (const vty of computeVaraTithiYogas(varaIdx, tithiAtSunrise)) {
      const delta = vty.polarity === 'auspicious' ? 10 : -15;
      score += delta;
      reasons.push(`${vty.type} yoga (vara x tithi, ${vty.polarity})`);
      factors.push({ code: `vara_tithi_${vty.type}`, axis: 'varaTithiYoga', delta });
    }
  }

  if (bhadraMode === 'penalize' && p.inauspicious.bhadra !== null) {
    score -= 15;
    reasons.push('Bhadra Kala active during part of the day');
    factors.push({ code: 'bhadra', axis: 'karana', delta: -15 });
  }

  for (const sy of p.specialYogas) {
    if (sy.type === 'amrit_siddhi' || sy.type === 'sarvartha_siddhi'
      || sy.type === 'ravi_pushya' || sy.type === 'guru_pushya') {
      score += 5;
      reasons.push(`${sy.type} bonus`);
      factors.push({ code: sy.type, axis: 'specialYoga', delta: 5 });
    }
    if (sy.type === 'jwalamukhi') {
      score -= 10;
      reasons.push('Jwalamukhi yoga penalty');
      factors.push({ code: 'jwalamukhi', axis: 'specialYoga', delta: -10 });
    }
  }

  score = Math.max(0, Math.min(100, score));
  passes = score >= 50;

  return {
    date: p.date,
    score,
    passes,
    reasons,
    factors,
  };
}

function zero(date: Date, reason: string, code: string): MuhurtaScore {
  return {
    date,
    score: 0,
    passes: false,
    reasons: [reason],
    factors: [{ code, axis: 'exclusion', delta: 0 }],
  };
}

/** Every scored day in the local calendar year `year`, each queried at its local midnight. */
export function computeAuspiciousDatesForYear(
  year: number,
  rule: MuhurtaRule,
  location: GeoLocation,
  options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const [start, end] = localYearWindow(year, options.timezone);
  validateLocalYearWindow(year, start, end);
  validateLocation(location);
  return scoreCivilDays(rule, start, end, location, options);
}

/** @deprecated Renamed to {@link computeAuspiciousDatesInRange} in v5. */
export const findAuspiciousDates = computeAuspiciousDatesInRange;
