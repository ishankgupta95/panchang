import { scoreOnlyCivilDays, type MuhurtaRule } from './engine';
import { validateLocation, validateLocalYearWindow } from '../utils/validation';
import { utcDateMs } from '../utils/timezone';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, Language } from '../types/options';
import type {
  MuhurtaFactor,
  MuhurtaFile,
  PackedMuhurtaTableDay,
} from './muhurtaTableTypes';

export interface BuildMuhurtaTableOptions {
  rule: MuhurtaRule;
  location: GeoLocation;
  /** Minutes east of UTC, e.g. `330` for IST; also groups days into local dates. */
  timezoneOffsetMinutes: number;
  /** Inclusive. */
  startYear: number;
  /** Inclusive. */
  endYear: number;
  includeFailures?: boolean;
  ayanamsa?: AyanamsaType;
  masaSystem?: MasaSystem;
  language?: Language;
  referenceLocation?: string;
  /** ISO timestamp. */
  generatedAt?: string;
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed muhurta table for one occasion at one location. Scores are ' +
  'location- and rule-dependent, so a table built for one place and rule says ' +
  'nothing about another.';

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

/** Muhurta table for one rule, location and year range, read back through `panchang-ts/muhurta`. */
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
    const start = utcDateMs(year, 0, 1) - timezoneOffsetMinutes * 60_000;
    const end = utcDateMs(year + 1, 0, 1) - 1 - timezoneOffsetMinutes * 60_000;
    validateLocalYearWindow(year, start, end);

    const scored = scoreOnlyCivilDays(rule, start, end, location, {
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
