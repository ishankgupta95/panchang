// Engine-free reader for a muhurta table.
//
// Ships as a separate entry point (`panchang-ts/muhurta`) that imports NO
// astronomy code, so an app can read pre-computed auspicious dates without
// pulling the engine into its client bundle. This is the member the table family
// was missing: festivals, eclipses and Moon phases each had a builder and a
// reader; muhurta had neither, so `findAuspiciousDates` had to run the full
// engine on device for every query.
//
// **No table is bundled.** Muhurta scoring is location- and rule-dependent, so
// there is no universal table to ship. Build your own with `buildMuhurtaTable`
// (from the main `panchang-ts` entry, which does use the engine), cache the
// JSON, and pass it to the accessors below.

import type {
  MuhurtaFile,
  MuhurtaTableDay,
} from './muhurtaTableTypes';

export type {
  MuhurtaTableLanguage,
  MuhurtaFactor,
  MuhurtaTableDay,
  PackedMuhurtaTableDay,
  MuhurtaTableMeta,
  MuhurtaFile,
} from './muhurtaTableTypes';

/**
 * Inclusive Gregorian year range a table covers.
 *
 * Read straight off `_meta`; provided so callers can range-check without
 * reaching into the file shape.
 */
export function readMuhurtaYearRange(
  source: MuhurtaFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

/** The occasion a table was built for. */
export function readMuhurtaOccasion(source: MuhurtaFile): string {
  return source._meta.occasion;
}

function flatten(source: MuhurtaFile, yearKey: string): MuhurtaTableDay[] | null {
  const days = source.years[yearKey];
  if (!days) return null;
  const dict = source._dict;
  return days.map(d => ({
    date: d.date,
    score: d.s,
    passes: d.p === 1,
    // An index outside the dictionary means a corrupt or hand-edited table;
    // drop the factor rather than emit an undefined-shaped object.
    factors: d.f.map(i => dict[i]).filter((f): f is NonNullable<typeof f> => f !== undefined),
  }));
}

/**
 * Scored days for a Gregorian year, ordered by date.
 *
 * Returns `null` if `year` is outside the table's range. If the table was built
 * with `includeFailures: false` (the default), only days that pass the rule are
 * present.
 *
 * @param source Table to read from — a {@link buildMuhurtaTable} result you
 *               built and cached. Required: nothing is bundled.
 * @param year   Gregorian year.
 */
export function readMuhurtaForYear(
  source: MuhurtaFile,
  year: number,
): MuhurtaTableDay[] | null {
  return flatten(source, String(year));
}

/**
 * The scored day for a specific date, or `null` when the date is outside the
 * table's range or was not stored (a failing day in a passes-only table).
 *
 * @param source Table to read from. Required: nothing is bundled.
 * @param date   Either an ISO `YYYY-MM-DD` string (interpreted in the table's
 *               reference timezone) or a `Date` (its local calendar date in the
 *               table's reference timezone is used).
 */
export function readMuhurtaForDate(
  source: MuhurtaFile,
  date: string | Date,
): MuhurtaTableDay | null {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const days = flatten(source, key.slice(0, 4));
  if (!days) return null;
  return days.find(d => d.date === key) ?? null;
}

/**
 * The best-scoring days in the table, highest first — the query a muhurta table
 * exists to answer.
 *
 * @param source Table to read from.
 * @param limit  Maximum number of days to return. Defaults to 10.
 */
export function readBestMuhurtaDays(
  source: MuhurtaFile,
  limit: number = 10,
): MuhurtaTableDay[] {
  const all: MuhurtaTableDay[] = [];
  for (const yearKey of Object.keys(source.years)) {
    const days = flatten(source, yearKey);
    if (days) all.push(...days);
  }
  // Ties broken by date so the result is deterministic rather than dependent on
  // object key order.
  all.sort((a, b) => (b.score - a.score) || a.date.localeCompare(b.date));
  return all.slice(0, Math.max(0, limit));
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
