
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

/** Inclusive Gregorian year range a table covers. */
export function readMuhurtaYearRange(
  source: MuhurtaFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

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
    factors: d.f.map(i => dict[i]).filter((f): f is NonNullable<typeof f> => f !== undefined),
  }));
}

/** Scored days for a year, ordered by date; `null` when out of range. */
export function readMuhurtaForYear(
  source: MuhurtaFile,
  year: number,
): MuhurtaTableDay[] | null {
  return flatten(source, String(year));
}

/** @param date ISO `YYYY-MM-DD`, or a `Date` read in the table's reference timezone. */
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

export function readBestMuhurtaDays(
  source: MuhurtaFile,
  limit: number = 10,
): MuhurtaTableDay[] {
  const all: MuhurtaTableDay[] = [];
  for (const yearKey of Object.keys(source.years)) {
    const days = flatten(source, yearKey);
    if (days) all.push(...days);
  }
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
