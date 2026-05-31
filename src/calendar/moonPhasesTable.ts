// Static Moon-phases table — pre-computed for IST (India). Ships as a separate
// entry point (`panchang-ts/moon-phases`) so consumers that only need phase
// dates don't pay the engine cost; this module imports the bundled JSON but
// NOT the engine.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).
//
// Phases are astronomical instants — the same worldwide — so the only thing
// that is "India" about the bundled table is the timezone used to assign each
// instant to a calendar date. For another timezone, build one with
// `buildMoonPhasesTable` (from the main `panchang-ts` entry) and pass it as the
// `source` argument below.

import moonPhasesData from '../data/moonPhases.json' with { type: 'json' };
import type {
  MoonPhasesFile,
  MoonPhasesTableLanguage,
  MoonPhaseTableDay,
  MoonPhaseTableEntry,
  MoonPhaseTableEntryRaw,
  MoonPhaseTableMeta,
} from './moonPhasesTableTypes';

export type {
  MoonPhasesTableLanguage,
  MoonPhaseTableName,
  MoonPhaseTableEntryRaw,
  MoonPhaseTableEntry,
  MoonPhaseTableDay,
  MoonPhaseTableMeta,
  RawMoonPhaseTableDay,
  MoonPhasesFile,
} from './moonPhasesTableTypes';

const bundled = moonPhasesData as unknown as MoonPhasesFile;

/** Metadata describing what the bundled table was generated from. */
export const MOON_PHASES_META: MoonPhaseTableMeta = bundled._meta;

/** Inclusive year range covered by the bundled table. */
export const MOON_PHASES_YEAR_RANGE = {
  start: bundled._meta.startYear,
  end: bundled._meta.endYear,
} as const;

function flatten(
  raw: MoonPhaseTableEntryRaw,
  lang: MoonPhasesTableLanguage,
): MoonPhaseTableEntry {
  const name = raw.name[lang] ?? Object.values(raw.name)[0] ?? '';
  const out: MoonPhaseTableEntry = { name, phase: raw.phase, time: raw.time };
  if (raw.description) {
    out.description = raw.description[lang] ?? Object.values(raw.description)[0] ?? '';
  }
  return out;
}

/**
 * Moon-phase days for a Gregorian year, flattened to the requested locale.
 *
 * Returns `null` if `year` is outside the table's range.
 *
 * @param year Gregorian year.
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled IST table; pass a
 *               {@link buildMoonPhasesTable} result to read a table you built
 *               for another timezone.
 */
export function getMoonPhasesForYear(
  year: number,
  lang: MoonPhasesTableLanguage = 'en',
  source: MoonPhasesFile = bundled,
): MoonPhaseTableDay[] | null {
  const days = source.years[String(year)];
  if (!days) return null;
  return days.map(d => ({
    date: d.date,
    phases: d.phases.map(p => flatten(p, lang)),
  }));
}

/**
 * Moon phases on a specific date, flattened to the requested locale.
 *
 * Returns an empty array if the date has no phase event or is outside the
 * table's range. The date is matched against the phase instant's local date.
 *
 * @param date Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *             reference timezone) or a `Date` (its local calendar date in the
 *             table's reference timezone is used).
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled IST table.
 */
export function getMoonPhasesForDate(
  date: string | Date,
  lang: MoonPhasesTableLanguage = 'en',
  source: MoonPhasesFile = bundled,
): MoonPhaseTableEntry[] {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const yearKey = key.slice(0, 4);
  const days = source.years[yearKey];
  if (!days) return [];
  const day = days.find(d => d.date === key);
  return day ? day.phases.map(p => flatten(p, lang)) : [];
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
