// Static festival table — pre-computed against Varanasi (IST). Ships as a
// separate entry point (`panchang-ts/festivals`) so consumers that only
// need the lookup don't pay the engine cost; this module imports the
// bundled JSON but NOT the engine.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).
//
// The bundled table is IST-only. For users elsewhere (EU / North America /
// rest of world), festival dates can shift by ±1 day because canonical
// times (nishita / pradosha / chandrodaya etc.) are observer-dependent.
// Build a location-specific table at runtime with `buildFestivalsTable`
// (from the main `panchang-ts` entry), cache it, and pass it as the
// `source` argument to the accessors below. See the README "Pre-computed
// table" section for the offline-RN compute-and-cache pattern.

import festivalsData from '../data/festivals.json' with { type: 'json' };
import type {
  FestivalsFile,
  FestivalsTableLanguage,
  FestivalTableDay,
  FestivalTableEntry,
  FestivalTableEntryRaw,
  FestivalTableMeta,
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

const bundled = festivalsData as unknown as FestivalsFile;

/** Metadata describing what the bundled table was generated from. */
export const FESTIVALS_META: FestivalTableMeta = bundled._meta;

/** Inclusive year range covered by the bundled table. */
export const FESTIVALS_YEAR_RANGE = {
  start: bundled._meta.startYear,
  end: bundled._meta.endYear,
} as const;

function flatten(
  raw: FestivalTableEntryRaw,
  lang: FestivalsTableLanguage,
): FestivalTableEntry {
  // Fall back to whatever locale exists if the requested one is missing
  // (e.g. an app-built table generated with `languages: ['en']` queried
  // with `'hi'`). Names are never empty, so `?? ''` is a last-resort guard.
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
 * @param year Gregorian year.
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled India (IST)
 *               table; pass a {@link buildFestivalsTable} result to read a
 *               location-specific table you built and cached.
 */
export function getFestivalsForYear(
  year: number,
  lang: FestivalsTableLanguage = 'en',
  source: FestivalsFile = bundled,
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
 * @param date Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *             reference timezone) or a `Date` (its local calendar date in the
 *             table's reference timezone is used).
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled India (IST)
 *               table; pass a {@link buildFestivalsTable} result for a
 *               location-specific table.
 */
export function getFestivalsForDate(
  date: string | Date,
  lang: FestivalsTableLanguage = 'en',
  source: FestivalsFile = bundled,
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
