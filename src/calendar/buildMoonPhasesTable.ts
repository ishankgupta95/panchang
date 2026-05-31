// Build a Moon-phases table for a given timezone. The engine-side counterpart
// to the bundled-JSON lookup in `moonPhasesTable.ts`, mirroring
// `buildFestivalsTable` / `buildEclipsesTable`.
//
// Lunar phases (new / first quarter / full / last quarter) are astronomical
// *instants* — identical worldwide — so this builder takes no location, only a
// timezone offset to map each instant onto a local calendar date. Use it to
// produce a table for any timezone, cache the JSON, and read it back through
// `getMoonPhasesForYear` / `getMoonPhasesForDate` via their `source` argument.

import { getMoonPhasesInRange } from '../astronomy/moonPhase';
import type {
  MoonPhasesFile,
  MoonPhasesTableLanguage,
  MoonPhaseTableEntryRaw,
  MoonPhaseTableName,
  LocalizedString,
  RawMoonPhaseTableDay,
} from './moonPhasesTableTypes';

export interface BuildMoonPhasesTableOptions {
  /**
   * UTC offset in minutes east of UTC, e.g. `330` for IST, `-300` for US
   * Eastern (EST), `0` for UK/GMT. Used only to group phase instants into local
   * calendar dates; stamped into `_meta`.
   */
  timezoneOffsetMinutes: number;
  /** First Gregorian year to include (inclusive). */
  startYear: number;
  /** Last Gregorian year to include (inclusive). */
  endYear: number;
  /** Locales to emit. Defaults to `['en', 'hi']`. */
  languages?: readonly MoonPhasesTableLanguage[];
  /** Human-readable label for the timezone, stamped into `_meta`. */
  referenceLocation?: string;
  /** ISO timestamp stamped into `_meta.generatedAt`. Defaults to `''`. */
  generatedAt?: string;
  /** Free-text note stamped into `_meta.note`. */
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed Moon-phase table (new / first quarter / full / last quarter). ' +
  'Phases are astronomical instants — the same worldwide; the date column is ' +
  'the instant mapped to the table timezone. New moon = Amavasya, full moon = ' +
  'Purnima. These are precise instants, distinct from the same-named tithis ' +
  '(which are ~24h windows). Times are ISO UTC.';

// Localized name + description per phase.
const PHASE_NAME: Record<MoonPhasesTableLanguage, Record<MoonPhaseTableName, string>> = {
  en: {
    new: 'New Moon',
    first_quarter: 'First Quarter',
    full: 'Full Moon',
    last_quarter: 'Last Quarter',
  },
  hi: {
    new: 'अमावस्या',
    first_quarter: 'शुक्ल पक्ष अर्धचंद्र',
    full: 'पूर्णिमा',
    last_quarter: 'कृष्ण पक्ष अर्धचंद्र',
  },
};
const PHASE_DESC: Record<MoonPhasesTableLanguage, Record<MoonPhaseTableName, string>> = {
  en: {
    new: 'New moon (Amavasya).',
    first_quarter: 'First quarter — waxing half moon.',
    full: 'Full moon (Purnima).',
    last_quarter: 'Last quarter — waning half moon.',
  },
  hi: {
    new: 'अमावस्या — नया चंद्रमा।',
    first_quarter: 'शुक्ल पक्ष अर्धचंद्र।',
    full: 'पूर्णिमा — पूर्ण चंद्रमा।',
    last_quarter: 'कृष्ण पक्ष अर्धचंद्र।',
  },
};

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeEntry(
  phase: MoonPhaseTableName,
  time: Date,
  languages: readonly MoonPhasesTableLanguage[],
): MoonPhaseTableEntryRaw {
  const name: LocalizedString = {};
  const description: LocalizedString = {};
  for (const lang of languages) {
    name[lang] = PHASE_NAME[lang][phase];
    description[lang] = PHASE_DESC[lang][phase];
  }
  return { name, phase, time: time.toISOString(), description };
}

/**
 * Compute a Moon-phases table for the given timezone and year range.
 *
 * Enumerates phase instants across the whole window and buckets each by the
 * local calendar date it falls on (in the reference timezone), so a phase
 * whose UTC instant lands just across a year boundary is filed under the year
 * its local date belongs to. Every in-range year appears as a key.
 *
 * @returns A {@link MoonPhasesFile} ready to serialize, cache, and feed back
 *          into the `getMoonPhasesForYear` / `getMoonPhasesForDate` accessors
 *          via their `source` argument.
 */
export function buildMoonPhasesTable(
  opts: BuildMoonPhasesTableOptions,
): MoonPhasesFile {
  const {
    timezoneOffsetMinutes,
    startYear,
    endYear,
    languages = ['en', 'hi'],
    referenceLocation = '',
    generatedAt = '',
    note = DEFAULT_NOTE,
  } = opts;

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new RangeError('startYear and endYear must be integers');
  }
  if (startYear > endYear) {
    throw new RangeError(`startYear (${startYear}) must be ≤ endYear (${endYear})`);
  }
  if (languages.length === 0) {
    throw new RangeError('languages must contain at least one locale');
  }

  // Widen by a couple of days each side so a phase whose local date is in range
  // but whose UTC instant sits just outside is still caught; per-year bucketing
  // discards any whose local-date year is genuinely out of range.
  const dayMs = 24 * 3600_000;
  const windowStart = new Date(Date.UTC(startYear, 0, 1) - 2 * dayMs);
  const windowEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59, 999) + 2 * dayMs);

  const events = getMoonPhasesInRange(windowStart, windowEnd);

  // Pre-seed every in-range year so no-phase years (none, in practice) still
  // appear, keeping the shape consistent with the other bundled tables.
  const byYear = new Map<string, Map<string, MoonPhaseTableEntryRaw[]>>();
  for (let year = startYear; year <= endYear; year++) {
    byYear.set(String(year), new Map());
  }

  for (const ev of events) {
    const key = toDateKey(ev.time, timezoneOffsetMinutes);
    const dateBuckets = byYear.get(key.slice(0, 4));
    if (!dateBuckets) continue; // local-date year outside [startYear, endYear]
    let bucket = dateBuckets.get(key);
    if (!bucket) {
      bucket = [];
      dateBuckets.set(key, bucket);
    }
    bucket.push(makeEntry(ev.phase, ev.time, languages));
  }

  const years: Record<string, RawMoonPhaseTableDay[]> = {};
  for (const [yearKey, dateBuckets] of byYear) {
    years[yearKey] = [...dateBuckets.keys()]
      .sort()
      .map(date => ({ date, phases: dateBuckets.get(date)! }));
  }

  return {
    _meta: {
      referenceLocation,
      timezoneOffsetMinutes,
      languages: [...languages],
      startYear,
      endYear,
      generatedAt,
      note,
    },
    years,
  };
}
