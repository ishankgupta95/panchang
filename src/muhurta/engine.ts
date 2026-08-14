import { getDailyPanchang } from '../core/panchang';
import { computeVaraTithiYogas } from './varaTithiYogas';
import { validateLocation, validateDate } from '../utils/validation';
import { resolveUtcOffset } from '../utils/timezone';
import type { MuhurtaFactor } from './muhurtaTableTypes';
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
export type { MuhurtaFactor } from './muhurtaTableTypes';

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
  /**
   * How Bhadra (Vishti karana) affects the day. Defaults to `'ignore'`.
   *
   * Bhadra is classically a *window* to avoid within a day, not a whole-day
   * disqualifier — and because Vishti karana sits at fixed positions in the
   * tithi cycle, vetoing the whole day removes seven tithis outright
   * (Shukla Chaturthi / Ekadashi / Chaturdashi and Krishna Tritiya /
   * Shashthi / Dashami / Trayodashi), among them tithis the same sources
   * list as *preferred*. `'penalize'` is therefore the better default for a
   * day-granularity score; read `panchang.inauspicious.bhadra` for the
   * interval and schedule around it.
   *
   * - `'ignore'`   — Bhadra does not affect the score.
   * - `'penalize'` — soft −15, the same weight as any inauspicious axis.
   * - `'exclude'`  — hard veto: score 0, `passes: false`.
   */
  bhadra?: 'ignore' | 'penalize' | 'exclude';
  /**
   * Bhadra (Vishti karana) on the day disqualifies it.
   *
   * @deprecated Use {@link MuhurtaRule.bhadra} instead — `excludeBhadra: true`
   * is exactly `bhadra: 'exclude'`. Kept working indefinitely; when both are
   * set, `bhadra` wins.
   */
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
  /**
   * Panchaka (Moon in last 5 nakshatras) disqualifies the day.
   *
   * Only a Panchaka that actually carries a dosha disqualifies: a spell that
   * began on a Wednesday or Thursday ("Samanya") has no named affliction, and
   * vetoing it would reject days the tradition does not object to. Read
   * `panchang.inauspicious.panchakaInfo` for which of the five is running.
   */
  excludePanchaka?: boolean;
  /**
   * Score the classical Vara x Tithi yogas (Siddha, Amrita, Dagdha, Visha,
   * Hutasana, Krakacha, Samvartaka). Defaults to `true`.
   *
   * These are occasion-independent — they qualify *any* undertaking — so they
   * live on the engine rather than in each rule's lists. Each matched yoga
   * contributes its own factor: `+10` auspicious, `-15` inauspicious, the same
   * weights as the per-anga axes. Where an auspicious and an inauspicious yoga
   * both fire (a documented ambiguity in the sources — see
   * {@link computeVaraTithiYogas}) the two simply net out.
   *
   * Set `false` for the pure per-anga scoring used before v5.1.
   */
  varaTithiYogas?: boolean;
}

/** Per-day score result. */
export interface MuhurtaScore {
  /** Calendar date evaluated. */
  date: Date;
  /** 0..100 — the higher, the more auspicious for this occasion. */
  score: number;
  /** True when the day clears all hard exclusions and lands in a positive band. */
  passes: boolean;
  /**
   * Brief English notes on which factors raised or lowered the score.
   *
   * Diagnostic output — these are **not** localized and are not a stable
   * format. Use {@link MuhurtaScore.factors} for anything a user will see or
   * that code will branch on.
   */
  reasons: string[];
  /** The same factors, structured. Safe to localize and to filter on. */
  factors: MuhurtaFactor[];
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
  // Scoring reads only elements, vara, chandramasa, gandaMula, panchaka,
  // specialYogas, plus Bhadra ('lunarWindows') and the eclipse overlap. It
  // never returns the panchang, so festivals and moon times can be skipped.
  // End times must stay ON: `computeSpecialYogasOverDay` needs the
  // post-sunrise nakshatra windows to detect vara×nakshatra yogas that
  // begin after sunrise (amrit_siddhi / sarvartha_siddhi / jwalamukhi), and
  // `computeEndTimes: false` silently dropped them — scoreMuhurta disagreed
  // with computeAuspiciousDatesInRange by their ±5/−10 deltas (MU-1,
  // 2026-08-14 audit; repro: vivah, Delhi, 2027-05-04 → 50 vs 60).
  const panchang = getDailyPanchang(date, location, {
    ...options,
    sections: ['eclipse', 'lunarWindows'],
  });
  if (panchang === null) {
    return {
      date,
      score: 0,
      passes: false,
      reasons: ['polar location with no sunrise — Hindu day undefined'],
      factors: [{ code: 'no_sunrise', axis: 'exclusion', delta: 0 }],
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
    // Deliberately NOT section-trimmed, unlike `scoreMuhurta`: every returned
    // day carries its `panchang` for callers to drill into, and that field is
    // documented as the full result. Trimming would quietly hollow it out.
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
  const factors: MuhurtaFactor[] = [];
  let score = 50; // neutral baseline
  let passes = true;

  const tithiAtSunrise = p.angas.tithis[0]!.index;
  const nakAtSunrise = p.angas.nakshatras[0]!.index;
  const yogaAtSunrise = p.angas.yogas[0]!.index;
  const varaIdx = p.angas.vara.index;

  // `bhadra` supersedes the deprecated `excludeBhadra` when both are set.
  const bhadraMode = rule.bhadra ?? (rule.excludeBhadra ? 'exclude' : 'ignore');

  // Hard exclusions (zero score immediately if matched).
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

  // Auspicious / inauspicious matches — soft scoring.
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

  // Vara x Tithi yogas — the combination layer. Auspicious and inauspicious
  // matches can co-occur; both are surfaced and allowed to net out, because
  // no source ranks the tables against each other.
  if (rule.varaTithiYogas !== false) {
    for (const vty of computeVaraTithiYogas(varaIdx, tithiAtSunrise)) {
      const delta = vty.polarity === 'auspicious' ? 10 : -15;
      score += delta;
      reasons.push(`${vty.type} yoga (vara x tithi, ${vty.polarity})`);
      factors.push({ code: `vara_tithi_${vty.type}`, axis: 'varaTithiYoga', delta });
    }
  }

  // Bhadra as a soft factor: the day stays usable, but the caller should
  // schedule outside `panchang.inauspicious.bhadra`.
  if (bhadraMode === 'penalize' && p.inauspicious.bhadra !== null) {
    score -= 15;
    reasons.push('Bhadra Kala active during part of the day');
    factors.push({ code: 'bhadra', axis: 'karana', delta: -15 });
  }

  // Special yoga bonuses — Amrit Siddhi / Sarvartha Siddhi / Ravi Pushya /
  // Guru Pushya are universally auspicious; surface them as +5 bonus.
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

  // Clamp to 0..100, decide passes.
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

/**
 * Every scored day in the local calendar year `year`.
 *
 * The single-year shape a consumer reaches for first; a thin wrapper over
 * {@link computeAuspiciousDatesInRange}.
 *
 * @example
 * ```typescript
 * const days = computeAuspiciousDatesForYear(2027, vivahRule, DELHI, { timezone: 330 });
 * ```
 */
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

/**
 * @deprecated Renamed to {@link computeAuspiciousDatesInRange} in v5, so that
 * running the *engine* and reading a *table* stop sharing a prefix, and so the
 * muhurta family matches festivals / eclipses / Moon phases. Kept through v5;
 * see the README "Upgrading from 4.x" section.
 */
export const findAuspiciousDates = computeAuspiciousDatesInRange;
