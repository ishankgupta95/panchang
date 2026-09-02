
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

export function readFestivalsYearRange(
  source: AnyFestivalsFile,
): { start: number; end: number } {
  return { start: source._meta.startYear, end: source._meta.endYear };
}

function isPacked(source: AnyFestivalsFile): source is FestivalsFile {
  return Array.isArray((source as FestivalsFile)._dict);
}

function pick(
  s: Partial<Record<FestivalsTableLanguage, string>>,
  lang: FestivalsTableLanguage,
): string {
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

/** Festival days for a year; `null` when out of range. */
export function readFestivalsForYear(
  source: AnyFestivalsFile,
  year: number,
  lang: FestivalsTableLanguage = 'en',
): FestivalTableDay[] | null {
  return daysFor(source, String(year), lang);
}

/** Festival emissions for one date; a string must be ISO `YYYY-MM-DD`. */
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

/** @deprecated Renamed to {@link readFestivalsForYear} in v5. */
export const getFestivalsForYear = readFestivalsForYear;

/** @deprecated Renamed to {@link readFestivalsForDate} in v5. */
export const getFestivalsForDate = readFestivalsForDate;

/** @deprecated Renamed to {@link readFestivalsYearRange} in v5. */
export const getFestivalsYearRange = readFestivalsYearRange;
