// Engine-free reader for a festival table.
//
// Ships as a separate entry point (`panchang-ts/festivals`) that imports NO
// astronomy code, so an app can read a table without pulling the engine into
// its client bundle.
//
// **No table is bundled.** Festival dates depend on the observer — canonical
// times (nishita / pradosha / chandrodaya) are location-dependent, so a table
// computed for one place can be ±1 day wrong elsewhere, and any table shipped
// here would also go stale. Build your own with `buildFestivalsTable` (from the
// main `panchang-ts` entry, which does use the engine), cache the JSON at your
// build time, and pass it to the accessors below. See the README
// "Pre-computed table" section for the compute-and-cache pattern.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).

import type {
  FestivalsFile,
  FestivalsTableLanguage,
  FestivalTableDay,
  FestivalTableEntry,
  FestivalTableEntryRaw,
} from './festivalsTableTypes';

export type {
  FestivalsTableLanguage,
  FestivalsTableType,
  LocalizedString,
  FestivalTableEntryRaw,
  FestivalTableEntry,
  FestivalTableDay,
  FestivalTableMeta,
  RawFestivalTableDay,
  FestivalsFile,
} from './festivalsTableTypes';

/**
 * Inclusive Gregorian year range a table covers.
 *
 * Read straight off `_meta`; provided so callers can range-check without
 * reaching into the file shape.
 */
export function getFestivalsYearRange(
  source: FestivalsFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

function flatten(
  raw: FestivalTableEntryRaw,
  lang: FestivalsTableLanguage,
): FestivalTableEntry {
  // Fall back to whatever locale exists if the requested one is missing
  // (e.g. a table generated with `languages: ['en']` queried with `'hi'`).
  // Names are never empty, so `?? ''` is a last-resort guard.
  const name = raw.name[lang] ?? Object.values(raw.name)[0] ?? '';
  const out: FestivalTableEntry = { name, type: raw.type };
  if (raw.description) {
    out.description = raw.description[lang] ?? Object.values(raw.description)[0] ?? '';
  }
  return out;
}

/**
 * Festival days for a Gregorian year, flattened to the requested locale.
 *
 * Returns `null` if `year` is outside the table's range.
 *
 * @param source Table to read from — a {@link buildFestivalsTable} result you
 *               built and cached. Required: nothing is bundled.
 * @param year   Gregorian year.
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getFestivalsForYear(
  source: FestivalsFile,
  year: number,
  lang: FestivalsTableLanguage = 'en',
): FestivalTableDay[] | null {
  const days = source.years[String(year)];
  if (!days) return null;
  return days.map(d => ({
    date: d.date,
    festivals: d.festivals.map(f => flatten(f, lang)),
  }));
}

/**
 * Festival emissions for a specific date, flattened to the requested locale.
 *
 * Returns an empty array if the date has no festivals or is outside the
 * table's range.
 *
 * @param source Table to read from. Required: nothing is bundled.
 * @param date   Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *               reference timezone) or a `Date` (its local calendar date in the
 *               table's reference timezone is used).
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getFestivalsForDate(
  source: FestivalsFile,
  date: string | Date,
  lang: FestivalsTableLanguage = 'en',
): FestivalTableEntry[] {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const yearKey = key.slice(0, 4);
  const days = source.years[yearKey];
  if (!days) return [];
  const day = days.find(d => d.date === key);
  return day ? day.festivals.map(f => flatten(f, lang)) : [];
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
