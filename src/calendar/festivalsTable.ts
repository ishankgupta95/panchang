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
//
// Both table formats are accepted — see `festivalsTableTypes.ts` for why v1
// tables (built before v5, with strings inlined and no `key`) still read.

import type {
  AnyFestivalsFile,
  FestivalDictEntry,
  FestivalsFile,
  FestivalsFileV1,
  FestivalsTableLanguage,
  FestivalTableDay,
  FestivalTableEntry,
  FestivalTableEntryRaw,
} from './festivalsTableTypes';

export type {
  FestivalsTableLanguage,
  FestivalsTableType,
  LocalizedString,
  FestivalDictEntry,
  FestivalTableEntry,
  FestivalTableDay,
  FestivalTableMeta,
  PackedFestivalTableDay,
  FestivalsFile,
  FestivalTableEntryRaw,
  RawFestivalTableDay,
  FestivalsFileV1,
  AnyFestivalsFile,
} from './festivalsTableTypes';

/**
 * Inclusive Gregorian year range a table covers.
 *
 * Read straight off `_meta`; provided so callers can range-check without
 * reaching into the file shape.
 */
export function readFestivalsYearRange(
  source: AnyFestivalsFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

function isPacked(source: AnyFestivalsFile): source is FestivalsFile {
  return Array.isArray((source as FestivalsFile)._dict);
}

/** Pick `lang`, falling back to whatever locale the table actually carries. */
function pick(
  s: Partial<Record<FestivalsTableLanguage, string>>,
  lang: FestivalsTableLanguage,
): string {
  // A table generated with `languages: ['en']` and queried with `'hi'` should
  // return the English string rather than an empty one. Names are never empty,
  // so `?? ''` is a last-resort guard.
  return s[lang] ?? Object.values(s)[0] ?? '';
}

function flattenDict(
  entry: FestivalDictEntry,
  lang: FestivalsTableLanguage,
): FestivalTableEntry {
  const out: FestivalTableEntry = {
    key: entry.key,
    name: pick(entry.name, lang),
    type: entry.type,
  };
  if (entry.description) out.description = pick(entry.description, lang);
  return out;
}

function flattenV1(
  raw: FestivalTableEntryRaw,
  lang: FestivalsTableLanguage,
): FestivalTableEntry {
  // v1 tables predate the stable key, so there is nothing truthful to put here.
  const out: FestivalTableEntry = { key: '', name: pick(raw.name, lang), type: raw.type };
  if (raw.description) out.description = pick(raw.description, lang);
  return out;
}

function daysFor(
  source: AnyFestivalsFile,
  yearKey: string,
  lang: FestivalsTableLanguage,
): FestivalTableDay[] | null {
  if (isPacked(source)) {
    const days = source.years[yearKey];
    if (!days) return null;
    const dict = source._dict;
    return days.map(d => ({
      date: d.date,
      // An index outside the dictionary means a corrupt or hand-edited table;
      // drop the entry rather than emit an undefined-shaped object.
      festivals: d.festivals
        .map(i => dict[i])
        .filter((e): e is FestivalDictEntry => e !== undefined)
        .map(e => flattenDict(e, lang)),
    }));
  }
  const days = (source as FestivalsFileV1).years[yearKey];
  if (!days) return null;
  return days.map(d => ({
    date: d.date,
    festivals: d.festivals.map(f => flattenV1(f, lang)),
  }));
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
export function readFestivalsForYear(
  source: AnyFestivalsFile,
  year: number,
  lang: FestivalsTableLanguage = 'en',
): FestivalTableDay[] | null {
  return daysFor(source, String(year), lang);
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
export function readFestivalsForDate(
  source: AnyFestivalsFile,
  date: string | Date,
  lang: FestivalsTableLanguage = 'en',
): FestivalTableEntry[] {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const days = daysFor(source, key.slice(0, 4), lang);
  if (!days) return [];
  return days.find(d => d.date === key)?.festivals ?? [];
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @deprecated Renamed to {@link readFestivalsForYear} in v5, so that reading a
 * *table* and running the *engine* stop sharing a `get*` prefix. Kept through
 * v5; see the README "Upgrading from 4.x" section.
 */
export const getFestivalsForYear = readFestivalsForYear;

/** @deprecated Renamed to {@link readFestivalsForDate} in v5. */
export const getFestivalsForDate = readFestivalsForDate;

/** @deprecated Renamed to {@link readFestivalsYearRange} in v5. */
export const getFestivalsYearRange = readFestivalsYearRange;
