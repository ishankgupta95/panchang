// Build a muhurta table for one occasion at one location. The engine-side
// counterpart to the reader in `muhurtaTable.ts`, mirroring
// `buildFestivalsTable` / `buildEclipsesTable` / `buildMoonPhasesTable`.
//
// Use it to pre-compute auspicious dates once and ship the JSON, exactly as you
// can for festivals: run the engine at build time (or on first launch), persist
// the result, and read it back through `readMuhurtaForYear` /
// `readMuhurtaForDate` / `readBestMuhurtaDays`.

import { computeAuspiciousDatesInRange, type MuhurtaRule } from './engine';
import { validateLocation } from '../utils/validation';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, Language } from '../types/options';
import type {
  MuhurtaFactor,
  MuhurtaFile,
  PackedMuhurtaTableDay,
} from './muhurtaTableTypes';

export interface BuildMuhurtaTableOptions {
  /** The occasion rule to score every day against. */
  rule: MuhurtaRule;
  /** Observer coordinates. */
  location: GeoLocation;
  /**
   * UTC offset in minutes east of UTC, e.g. `330` for IST. Used both to compute
   * the panchang and to group days into local calendar dates; stamped into
   * `_meta`.
   */
  timezoneOffsetMinutes: number;
  /** First Gregorian year to include (inclusive). */
  startYear: number;
  /** Last Gregorian year to include (inclusive). */
  endYear: number;
  /**
   * Store days that fail the rule too. Defaults to `false` — a muhurta table
   * exists to answer "when is this auspicious", and dropping failures typically
   * shrinks it by an order of magnitude.
   */
  includeFailures?: boolean;
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Lunar month naming. Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
  /** Language passed to the engine while scoring. Defaults to `'en'`. */
  language?: Language;
  /** Human-readable label for the location, stamped into `_meta`. */
  referenceLocation?: string;
  /** ISO timestamp stamped into `_meta.generatedAt`. Defaults to `''`. */
  generatedAt?: string;
  /** Free-text note stamped into `_meta.note`. */
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed muhurta table for one occasion at one location. Scores are ' +
  'location- and rule-dependent, so a table built for one place and rule says ' +
  'nothing about another.';

/**
 * Interns unique scoring factors so each day holds indices rather than repeating
 * the same `(code, axis, index, delta)` tuple. The set is small and highly
 * repetitive — every day sharing a tithi produces the same tithi factor — so the
 * dictionary is a handful of entries against thousands of references.
 */
class FactorDictionary {
  readonly entries: MuhurtaFactor[] = [];
  private readonly index = new Map<string, number>();

  intern(f: MuhurtaFactor): number {
    const id = `${f.code}|${f.axis}|${f.index ?? ''}|${f.delta}`;
    const seen = this.index.get(id);
    if (seen !== undefined) return seen;
    const next = this.entries.length;
    this.entries.push(f);
    this.index.set(id, next);
    return next;
  }
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Compute a muhurta table for the given rule, location and year range.
 *
 * @returns A {@link MuhurtaFile} ready to serialize, cache, and feed back into
 *          the `readMuhurtaForYear` / `readMuhurtaForDate` /
 *          `readBestMuhurtaDays` accessors via their `source` argument.
 *
 * @example
 * ```typescript
 * import { buildMuhurtaTable, vivahRule } from 'panchang-ts';
 * const table = buildMuhurtaTable({
 *   rule: vivahRule,
 *   location: DELHI,
 *   timezoneOffsetMinutes: 330,
 *   startYear: 2026,
 *   endYear: 2030,
 * });
 * // persist JSON.stringify(table), then read it with `panchang-ts/muhurta`
 * ```
 */
export function buildMuhurtaTable(opts: BuildMuhurtaTableOptions): MuhurtaFile {
  const {
    rule,
    location,
    timezoneOffsetMinutes,
    startYear,
    endYear,
    includeFailures = false,
    ayanamsa = 'lahiri',
    masaSystem = 'purnimanta',
    language = 'en',
    referenceLocation = '',
    generatedAt = '',
    note = DEFAULT_NOTE,
  } = opts;

  validateLocation(location);
  // `rule` is required and TypeScript enforces it, but a JavaScript caller who
  // omits it got `Cannot read properties of undefined (reading 'excludeBhadra')`
  // from four frames inside the scorer — the one required input of the four
  // that was not checked here alongside the others.
  if (rule === null || typeof rule !== 'object' || typeof rule.occasion !== 'string') {
    throw new TypeError(
      'buildMuhurtaTable: `rule` is required and must be a MuhurtaRule with an `occasion` string',
    );
  }
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new RangeError('startYear and endYear must be integers');
  }
  if (startYear > endYear) {
    throw new RangeError(`startYear (${startYear}) must be ≤ endYear (${endYear})`);
  }

  const dict = new FactorDictionary();
  const years: Record<string, PackedMuhurtaTableDay[]> = {};

  for (let year = startYear; year <= endYear; year++) {
    // The local-year window, so a day is filed under the year its *local* date
    // belongs to rather than its UTC date.
    const start = new Date(Date.UTC(year, 0, 1) - timezoneOffsetMinutes * 60_000);
    const end = new Date(
      Date.UTC(year, 11, 31, 23, 59, 59, 999) - timezoneOffsetMinutes * 60_000,
    );

    const scored = computeAuspiciousDatesInRange(rule, start, end, location, {
      timezone: timezoneOffsetMinutes,
      ayanamsa,
      masaSystem,
      language,
      includeFailures: true,
    });

    const days: PackedMuhurtaTableDay[] = [];
    for (const day of scored) {
      if (!includeFailures && !day.passes) continue;
      days.push({
        date: toDateKey(day.date, timezoneOffsetMinutes),
        s: day.score,
        p: day.passes ? 1 : 0,
        f: day.factors.map(f => dict.intern(f)),
      });
    }
    // `computeAuspiciousDatesInRange` sorts by score; a table is read by date,
    // so store it that way and let `readBestMuhurtaDays` re-sort on demand.
    days.sort((a, b) => a.date.localeCompare(b.date));
    years[String(year)] = days;
  }

  const meta: MuhurtaFile['_meta'] = {
    format: 2,
    occasion: rule.occasion,
    referenceLocation,
    latitude: location.latitude,
    longitude: location.longitude,
    timezoneOffsetMinutes,
    ayanamsa,
    masaSystem,
    startYear,
    endYear,
    includeFailures,
    generatedAt,
    note,
  };
  if (rule.name !== undefined) meta.occasionName = rule.name;

  return { _meta: meta, _dict: dict.entries, years };
}
