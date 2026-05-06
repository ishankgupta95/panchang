import { getDailyPanchang } from '../core/panchang';
import { validateLocation, validateDate } from '../utils/validation';
import type { GeoLocation } from '../types/location';
import type { Language, AyanamsaType, MasaSystem } from '../types/options';
import type { DailyPanchangResult } from '../types/panchang';

/**
 * Declarative description of an auspicious-occasion rule. The engine scores
 * each candidate day on how well it matches this rule and surfaces a
 * 0-to-100 score plus boolean `passes`.
 *
 * Numeric indices match the rest of panchang-ts:
 *   - tithi: 0..29 (0 = Shukla Pratipada … 14 = Purnima … 15 = Krishna
 *     Pratipada … 29 = Amavasya).
 *   - nakshatra: 0..26 (Ashwini=0).
 *   - vara: 0..6 (Sunday=0).
 *   - yoga: 0..26 (Vishkambha=0).
 *
 * Hard exclusions (`exclude*`) reduce the score to 0 and set `passes: false`
 * when matched. Auspicious / inauspicious lists shift the score in the
 * direction implied by their name. Unmatched fields contribute neutrally.
 */
export interface MuhurtaRule {
  /** Stable identifier — e.g. `'vivah'`, `'grihaPravesh'`. Used in result output. */
  occasion: string;
  /** Human-readable display name (en). Optional; `occasion` is used as fallback. */
  name?: string;
  auspiciousTithis?: readonly number[];
  inauspiciousTithis?: readonly number[];
  auspiciousNakshatras?: readonly number[];
  inauspiciousNakshatras?: readonly number[];
  auspiciousVaras?: readonly number[];
  inauspiciousVaras?: readonly number[];
  auspiciousYogas?: readonly number[];
  inauspiciousYogas?: readonly number[];
  /** Bhadra (Vishti karana) on the day disqualifies it. */
  excludeBhadra?: boolean;
  /** Ekadashi (tithi 10 / 25) on the day disqualifies it. */
  excludeEkadashi?: boolean;
  /** Restrict to one paksha. */
  requirePaksha?: 'shukla' | 'krishna';
  /** Adhika (intercalary) lunar months disqualify the day. */
  excludeAdhikaMasa?: boolean;
  /** Eclipse (solar or lunar) overlap disqualifies the day. */
  excludeEclipse?: boolean;
  /** Ganda Mula nakshatras (severity-aware). */
  excludeGandaMula?: boolean;
  /** Panchaka (Moon in last 5 nakshatras) disqualifies the day. */
  excludePanchaka?: boolean;
}

/** Per-day score result. */
export interface MuhurtaScore {
  /** Calendar date evaluated. */
  date: Date;
  /** 0..100 — the higher, the more auspicious for this occasion. */
  score: number;
  /** True when the day clears all hard exclusions and lands in a positive band. */
  passes: boolean;
  /** Brief notes on which factors raised or lowered the score. */
  reasons: string[];
}

/** Per-day result returned by `findAuspiciousDates`. */
export interface MuhurtaDay extends MuhurtaScore {
  /** The full panchang for the day, for callers that want to drill in. */
  panchang: DailyPanchangResult;
}

export interface MuhurtaScoreOptions {
  /** UTC offset in minutes. Required (panchang-ts never assumes a timezone). */
  timezone: number | string;
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Output language for `name` strings on intermediate panchang values. */
  language?: Language;
  /** Lunar month naming system. Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
}

/**
 * Score a single date against a muhurta rule.
 *
 * Returns 100 when every auspicious axis matches and no exclusion fires.
 * Each auspicious match adds 10 points; each inauspicious match subtracts
 * 15. Hard exclusions zero the score and set `passes: false`. The final
 * score is clamped to [0, 100].
 *
 * @param date     Any `Date` within the local calendar day to evaluate.
 * @param location Observer coordinates.
 * @param rule     Rule to score against.
 * @param options  Settings — `timezone` is required.
 *
 * @example
 * ```typescript
 * import { scoreMuhurta, vivahRule } from 'panchang-ts';
 * const r = scoreMuhurta(new Date('2026-05-10'), DELHI, vivahRule, { timezone: 330 });
 * if (r.passes) console.log('Auspicious for vivaha — score', r.score);
 * ```
 */
export function scoreMuhurta(
  date: Date,
  location: GeoLocation,
  rule: MuhurtaRule,
  options: MuhurtaScoreOptions,
): MuhurtaScore {
  validateDate(date);
  validateLocation(location);
  const panchang = getDailyPanchang(date, location, options);
  if (panchang === null) {
    return {
      date,
      score: 0,
      passes: false,
      reasons: ['polar location with no sunrise — Hindu day undefined'],
    };
  }
  return scoreFromPanchang(panchang, rule);
}

/**
 * Find auspicious dates for a rule across a date range.
 *
 * Iterates day-by-day from `start` to `end` (inclusive), scoring each day
 * via {@link scoreMuhurta}. Days that pass the rule are sorted by score
 * descending. Days that fail are not included unless `includeFailures` is
 * true.
 *
 * @param rule     Rule to score against.
 * @param start    Inclusive start date.
 * @param end      Inclusive end date.
 * @param location Observer coordinates.
 * @param options  Settings — `timezone` is required.
 *
 * @example
 * ```typescript
 * const dates = findAuspiciousDates(
 *   vivahRule,
 *   new Date('2026-05-01'),
 *   new Date('2026-05-31'),
 *   DELHI,
 *   { timezone: 330 },
 * );
 * console.log(dates.length, 'auspicious days; top score', dates[0]?.score);
 * ```
 */
export function findAuspiciousDates(
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

// ── Internal scoring engine ──────────────────────────

function scoreFromPanchang(p: DailyPanchangResult, rule: MuhurtaRule): MuhurtaScore {
  const reasons: string[] = [];
  let score = 50; // neutral baseline
  let passes = true;

  const tithiAtSunrise = p.tithis[0]!.index;
  const nakAtSunrise = p.nakshatras[0]!.index;
  const yogaAtSunrise = p.yogas[0]!.index;
  const varaIdx = p.vara.index;

  // Hard exclusions (zero score immediately if matched).
  if (rule.excludeBhadra && p.bhadra !== null) {
    return zero(p.date, 'Bhadra Kala active on this day');
  }
  if (rule.excludeEkadashi) {
    const isEkadashi = tithiAtSunrise === 10 || tithiAtSunrise === 25;
    if (isEkadashi) {
      return zero(p.date, 'Ekadashi tithi at sunrise');
    }
  }
  if (rule.excludeEclipse && p.eclipse !== null) {
    return zero(p.date, `Eclipse overlap (${p.eclipse.subtype})`);
  }
  if (rule.excludeAdhikaMasa && p.chandramasa.isAdhika) {
    return zero(p.date, 'Adhika (intercalary) lunar month');
  }
  if (rule.excludeGandaMula && p.gandaMula.active) {
    return zero(p.date, `Ganda Mula nakshatra (${p.gandaMula.severity})`);
  }
  if (rule.excludePanchaka && p.panchaka) {
    return zero(p.date, 'Panchaka active');
  }
  if (rule.requirePaksha) {
    const paksha = tithiAtSunrise < 15 ? 'shukla' : 'krishna';
    if (paksha !== rule.requirePaksha) {
      return zero(p.date, `paksha is ${paksha}, rule requires ${rule.requirePaksha}`);
    }
  }

  // Auspicious / inauspicious matches — soft scoring.
  if (rule.auspiciousTithis?.includes(tithiAtSunrise)) {
    score += 10;
    reasons.push(`auspicious tithi (${tithiAtSunrise})`);
  } else if (rule.inauspiciousTithis?.includes(tithiAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious tithi (${tithiAtSunrise})`);
  }

  if (rule.auspiciousNakshatras?.includes(nakAtSunrise)) {
    score += 10;
    reasons.push(`auspicious nakshatra (${nakAtSunrise})`);
  } else if (rule.inauspiciousNakshatras?.includes(nakAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious nakshatra (${nakAtSunrise})`);
  }

  if (rule.auspiciousVaras?.includes(varaIdx)) {
    score += 10;
    reasons.push(`auspicious vara (${varaIdx})`);
  } else if (rule.inauspiciousVaras?.includes(varaIdx)) {
    score -= 15;
    reasons.push(`inauspicious vara (${varaIdx})`);
  }

  if (rule.auspiciousYogas?.includes(yogaAtSunrise)) {
    score += 10;
    reasons.push(`auspicious yoga (${yogaAtSunrise})`);
  } else if (rule.inauspiciousYogas?.includes(yogaAtSunrise)) {
    score -= 15;
    reasons.push(`inauspicious yoga (${yogaAtSunrise})`);
  }

  // Special yoga bonuses — Amrit Siddhi / Sarvartha Siddhi / Ravi Pushya /
  // Guru Pushya are universally auspicious; surface them as +5 bonus.
  for (const sy of p.specialYogas) {
    if (sy.type === 'amrit_siddhi' || sy.type === 'sarvartha_siddhi'
      || sy.type === 'ravi_pushya' || sy.type === 'guru_pushya') {
      score += 5;
      reasons.push(`${sy.type} bonus`);
    }
    if (sy.type === 'jwalamukhi') {
      score -= 10;
      reasons.push('Jwalamukhi yoga penalty');
    }
  }

  // Clamp to 0..100, decide passes.
  score = Math.max(0, Math.min(100, score));
  passes = score >= 50;

  return {
    date: p.date,
    score,
    passes,
    reasons,
  };
}

function zero(date: Date, reason: string): MuhurtaScore {
  return { date, score: 0, passes: false, reasons: [reason] };
}
