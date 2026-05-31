// Static eclipse table — pre-computed against Varanasi (IST), India-visible
// eclipses only. Ships as a separate entry point (`panchang-ts/eclipses`) so
// consumers that only need the lookup don't pay the engine cost; this module
// imports the bundled JSON but NOT the engine.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).
//
// The bundled table is Varanasi-only. Which eclipses are *visible* — and thus
// carry a sutak window — is location-dependent, so users elsewhere should
// build a location-specific table at runtime with `buildEclipsesTable` (from
// the main `panchang-ts` entry), cache it, and pass it as the `source`
// argument to the accessors below.

import eclipsesData from '../data/eclipses.json' with { type: 'json' };
import type {
  EclipsesFile,
  EclipsesTableLanguage,
  EclipseTableDay,
  EclipseTableEntry,
  EclipseTableEntryRaw,
  EclipseTableMeta,
} from './eclipsesTableTypes';

export type {
  EclipsesTableLanguage,
  EclipseTableKind,
  EclipseTableSubtype,
  EclipseSutak,
  EclipseTableEntryRaw,
  EclipseTableEntry,
  EclipseTableDay,
  EclipseTableMeta,
  RawEclipseTableDay,
  EclipsesFile,
} from './eclipsesTableTypes';

const bundled = eclipsesData as unknown as EclipsesFile;

/** Metadata describing what the bundled table was generated from. */
export const ECLIPSES_META: EclipseTableMeta = bundled._meta;

/** Inclusive year range covered by the bundled table. */
export const ECLIPSES_YEAR_RANGE = {
  start: bundled._meta.startYear,
  end: bundled._meta.endYear,
} as const;

function flatten(
  raw: EclipseTableEntryRaw,
  lang: EclipsesTableLanguage,
): EclipseTableEntry {
  // Fall back to whatever locale exists if the requested one is missing
  // (e.g. an app-built table generated with `languages: ['en']` queried
  // with `'hi'`). Names are never empty, so `?? ''` is a last-resort guard.
  const name = raw.name[lang] ?? Object.values(raw.name)[0] ?? '';
  const out: EclipseTableEntry = {
    name,
    kind: raw.kind,
    subtype: raw.subtype,
    start: raw.start,
    peak: raw.peak,
    end: raw.end,
    magnitude: raw.magnitude,
    visibleFromLocation: raw.visibleFromLocation,
    visibleAtPeak: raw.visibleAtPeak,
  };
  if (raw.sutak) out.sutak = raw.sutak;
  if (raw.description) {
    out.description = raw.description[lang] ?? Object.values(raw.description)[0] ?? '';
  }
  return out;
}

/**
 * Eclipse days for a Gregorian year, flattened to the requested locale.
 *
 * Returns `null` if `year` is outside the table's range, or an empty array if
 * the year is in range but had no (visible) eclipses.
 *
 * @param year Gregorian year.
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled Varanasi table;
 *               pass a {@link buildEclipsesTable} result to read a
 *               location-specific table you built and cached.
 */
export function getEclipsesForYear(
  year: number,
  lang: EclipsesTableLanguage = 'en',
  source: EclipsesFile = bundled,
): EclipseTableDay[] | null {
  const days = source.years[String(year)];
  if (!days) return null;
  return days.map(d => ({
    date: d.date,
    eclipses: d.eclipses.map(e => flatten(e, lang)),
  }));
}

/**
 * Eclipses on a specific date, flattened to the requested locale.
 *
 * Returns an empty array if the date has no eclipse or is outside the table's
 * range. The date is matched against the eclipse peak's local date.
 *
 * @param date Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *             reference timezone) or a `Date` (its local calendar date in the
 *             table's reference timezone is used).
 * @param lang `'en'` (default) or `'hi'`.
 * @param source Table to read from. Defaults to the bundled Varanasi table;
 *               pass a {@link buildEclipsesTable} result for a
 *               location-specific table.
 */
export function getEclipsesForDate(
  date: string | Date,
  lang: EclipsesTableLanguage = 'en',
  source: EclipsesFile = bundled,
): EclipseTableEntry[] {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const yearKey = key.slice(0, 4);
  const days = source.years[yearKey];
  if (!days) return [];
  const day = days.find(d => d.date === key);
  return day ? day.eclipses.map(e => flatten(e, lang)) : [];
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
