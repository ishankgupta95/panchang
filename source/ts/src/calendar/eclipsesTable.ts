// Engine-free reader: astronomy imports here would drag the engine into a client bundle.

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

export function readEclipsesYearRange(
  source: EclipsesFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

function flatten(
  raw: EclipseTableEntryRaw,
  lang: EclipsesTableLanguage,
): EclipseTableEntry {
  const name = raw.name[lang] ?? Object.values(raw.name)[0] ?? '';
  const out: EclipseTableEntry = {
    name,
    kind: raw.kind,
    subtype: raw.subtype,
    start: raw.start,
    peak: raw.peak,
    end: raw.end,
    obscuration: raw.obscuration,
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

/** Eclipse days for a year; `null` out of range, `[]` in range with none. */
export function readEclipsesForYear(
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

/** Eclipses on one date, matched on the peak's local date. */
export function readEclipsesForDate(
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

/** @deprecated Renamed to {@link readEclipsesForYear} in v5. */
export const getEclipsesForYear = readEclipsesForYear;

/** @deprecated Renamed to {@link readEclipsesForDate} in v5. */
export const getEclipsesForDate = readEclipsesForDate;

/** @deprecated Renamed to {@link readEclipsesYearRange} in v5. */
export const getEclipsesYearRange = readEclipsesYearRange;
