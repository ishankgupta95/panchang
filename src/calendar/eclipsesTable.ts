// Engine-free reader for an eclipse table.
//
// Ships as a separate entry point (`panchang-ts/eclipses`) that imports NO
// astronomy code, so an app can read a table without pulling the engine into
// its client bundle.
//
// **No table is bundled.** Which eclipses are *visible* — and therefore which
// carry a sutak window — is location-dependent, so a table computed for one
// place is wrong elsewhere, and any table shipped here would also go stale.
// Build your own with `buildEclipsesTable` (from the main `panchang-ts` entry,
// which does use the engine), cache the JSON at your build time, and pass it to
// the accessors below.
//
// Each entry carries text in one or more locales; choose via the optional
// `lang` argument on the accessors (defaults to `'en'`).

import type {
  EclipsesFile,
  EclipsesTableLanguage,
  EclipseTableDay,
  EclipseTableEntry,
  EclipseTableEntryRaw,
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

/**
 * Inclusive Gregorian year range a table covers.
 *
 * Read straight off `_meta`; provided so callers can range-check without
 * reaching into the file shape.
 */
export function getEclipsesYearRange(
  source: EclipsesFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

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
 * @param source Table to read from — a {@link buildEclipsesTable} result you
 *               built and cached. Required: nothing is bundled.
 * @param year   Gregorian year.
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getEclipsesForYear(
  source: EclipsesFile,
  year: number,
  lang: EclipsesTableLanguage = 'en',
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
 * @param source Table to read from. Required: nothing is bundled.
 * @param date   Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *               reference timezone) or a `Date` (its local calendar date in the
 *               table's reference timezone is used).
 * @param lang   `'en'` (default) or `'hi'`.
 */
export function getEclipsesForDate(
  source: EclipsesFile,
  date: string | Date,
  lang: EclipsesTableLanguage = 'en',
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
