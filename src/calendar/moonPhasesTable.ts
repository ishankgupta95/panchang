// Engine-free reader for a Moon-phases table.
//
// Ships as a separate entry point (`panchang-ts/moon-phases`) that imports NO
// astronomy code, so an app can read a table without pulling the engine into
// its client bundle.
//
// **No table is bundled.** Phases are astronomical instants — the same
// worldwide — but assigning each to a *calendar date* needs a timezone, and any
// table shipped here would go stale. Build your own with
// `buildMoonPhasesTable` (from the main `panchang-ts` entry, which does use the
// engine), cache the JSON at your build time, and pass it to the accessors
// below.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).

import type {
  MoonPhasesFile,
  MoonPhasesTableLanguage,
  MoonPhaseTableDay,
  MoonPhaseTableEntry,
  MoonPhaseTableEntryRaw,
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

/**
 * Inclusive Gregorian year range a table covers.
 *
 * Read straight off `_meta`; provided so callers can range-check without
 * reaching into the file shape.
 */
export function getMoonPhasesYearRange(
  source: MoonPhasesFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

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
 * @param source Table to read from — a {@link buildMoonPhasesTable} result you
 *               built and cached. Required: nothing is bundled.
 * @param year   Gregorian year.
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getMoonPhasesForYear(
  source: MoonPhasesFile,
  year: number,
  lang: MoonPhasesTableLanguage = 'en',
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
 * @param source Table to read from. Required: nothing is bundled.
 * @param date   Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *               reference timezone) or a `Date` (its local calendar date in the
 *               table's reference timezone is used).
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getMoonPhasesForDate(
  source: MoonPhasesFile,
  date: string | Date,
  lang: MoonPhasesTableLanguage = 'en',
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
