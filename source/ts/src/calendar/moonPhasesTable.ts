
import type {
  AnyMoonPhasesFile,
  MoonPhaseDictEntry,
  MoonPhasesFile,
  MoonPhasesFileV1,
  MoonPhasesTableLanguage,
  MoonPhaseTableDay,
  MoonPhaseTableEntry,
  MoonPhaseTableEntryRaw,
} from './moonPhasesTableTypes';

export type {
  MoonPhasesTableLanguage,
  MoonPhaseTableName,
  MoonPhaseDictEntry,
  MoonPhaseTableEntry,
  MoonPhaseTableDay,
  MoonPhaseTableMeta,
  PackedMoonPhaseEvent,
  PackedMoonPhaseTableDay,
  MoonPhasesFile,
  MoonPhaseTableEntryRaw,
  RawMoonPhaseTableDay,
  MoonPhasesFileV1,
  AnyMoonPhasesFile,
} from './moonPhasesTableTypes';

export function readMoonPhasesYearRange(
  source: AnyMoonPhasesFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

function isPacked(source: AnyMoonPhasesFile): source is MoonPhasesFile {
  return Array.isArray((source as MoonPhasesFile)._dict);
}

function pick(
  s: Partial<Record<MoonPhasesTableLanguage, string>>,
  lang: MoonPhasesTableLanguage,
): string {
  return s[lang] ?? Object.values(s)[0] ?? '';
}

function flattenDict(
  entry: MoonPhaseDictEntry,
  epochMs: number,
  lang: MoonPhasesTableLanguage,
): MoonPhaseTableEntry {
  const out: MoonPhaseTableEntry = {
    name: pick(entry.name, lang),
    phase: entry.phase,
    time: new Date(epochMs).toISOString(),
  };
  if (entry.description) out.description = pick(entry.description, lang);
  return out;
}

function flattenV1(
  raw: MoonPhaseTableEntryRaw,
  lang: MoonPhasesTableLanguage,
): MoonPhaseTableEntry {
  const out: MoonPhaseTableEntry = {
    name: pick(raw.name, lang), phase: raw.phase, time: raw.time,
  };
  if (raw.description) out.description = pick(raw.description, lang);
  return out;
}

function daysFor(
  source: AnyMoonPhasesFile,
  yearKey: string,
  lang: MoonPhasesTableLanguage,
): MoonPhaseTableDay[] | null {
  if (isPacked(source)) {
    const days = source.years[yearKey];
    if (!days) return null;
    const dict = source._dict;
    return days.map(d => ({
      date: d.date,
      phases: d.phases
        .map(p => { const e = dict[p.i]; return e === undefined ? null : flattenDict(e, p.t, lang); })
        .filter((e): e is MoonPhaseTableEntry => e !== null),
    }));
  }
  const days = (source as MoonPhasesFileV1).years[yearKey];
  if (!days) return null;
  return days.map(d => ({ date: d.date, phases: d.phases.map(p => flattenV1(p, lang)) }));
}

/** Moon-phase days for a Gregorian year; `null` outside the table's range. */
export function readMoonPhasesForYear(
  source: AnyMoonPhasesFile,
  year: number,
  lang: MoonPhasesTableLanguage = 'en',
): MoonPhaseTableDay[] | null {
  return daysFor(source, String(year), lang);
}

/** Moon phases on one date; a `Date` is resolved in the table's reference timezone. */
export function readMoonPhasesForDate(
  source: AnyMoonPhasesFile,
  date: string | Date,
  lang: MoonPhasesTableLanguage = 'en',
): MoonPhaseTableEntry[] {
  const key = typeof date === 'string'
    ? date
    : toDateKey(date, source._meta.timezoneOffsetMinutes);
  const days = daysFor(source, key.slice(0, 4), lang);
  if (!days) return [];
  return days.find(d => d.date === key)?.phases ?? [];
}

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** @deprecated Renamed to {@link readMoonPhasesForYear} in v5. */
export const getMoonPhasesForYear = readMoonPhasesForYear;

/** @deprecated Renamed to {@link readMoonPhasesForDate} in v5. */
export const getMoonPhasesForDate = readMoonPhasesForDate;

/** @deprecated Renamed to {@link readMoonPhasesYearRange} in v5. */
export const getMoonPhasesYearRange = readMoonPhasesYearRange;
