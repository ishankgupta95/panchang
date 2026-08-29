import { getDailyPanchang } from '../core/panchang';
import { computeVaraTithiYogas } from './varaTithiYogas';
import { validateLocation, validateDate } from '../utils/validation';
import { resolveUtcOffset } from '../utils/timezone';
import type { MuhurtaFactor } from './muhurtaTableTypes';
import type { GeoLocation } from '../types/location';
import type { Language, AyanamsaType, MasaSystem } from '../types/options';
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
  // `lunarWindows` must stay: vara×nakshatra yogas can begin after sunrise.
  const panchang = getDailyPanchang(date, location, {
    ...options,
    sections: ['eclipse', 'lunarWindows'],
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

/** Every day from `start` to `end` inclusive, best score first; failures omitted unless asked for. */
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

  const out: MuhurtaDay[] = [];
  const dayMs = 24 * 3600_000;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const d = new Date(t);
    const panchang = getDailyPanchang(d, location, options);
    if (panchang === null) continue;
    const result = scoreFromPanchang(panchang, rule);
    if (result.passes || options.includeFailures) {
      out.push({ ...result, panchang });
    }
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

  // Auspicious and inauspicious yogas co-occur and net out; no source ranks them.
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

/** Every scored day in the local calendar year `year`. */
export function computeAuspiciousDatesForYear(
  year: number,
  rule: MuhurtaRule,
  location: GeoLocation,
  options: MuhurtaScoreOptions & { includeFailures?: boolean },
): MuhurtaDay[] {
  if (!Number.isInteger(year)) throw new RangeError(`year must be integer, got ${year}`);
  const offset = resolveUtcOffset(options.timezone, new Date(Date.UTC(year, 6, 1)));
  const start = new Date(Date.UTC(year, 0, 1) - offset * 60_000);
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999) - offset * 60_000);
  return computeAuspiciousDatesInRange(rule, start, end, location, options);
}

/** @deprecated Renamed to {@link computeAuspiciousDatesInRange} in v5. */
export const findAuspiciousDates = computeAuspiciousDatesInRange;
