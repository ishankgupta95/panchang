
import { computeFestivalsInRange } from './yearly';
import { utcDateMs } from '../utils/timezone';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion } from '../types/options';
import type {
  FestivalDictEntry,
  FestivalsFile,
  FestivalsTableLanguage,
  LocalizedString,
  PackedFestivalTableDay,
} from './festivalsTableTypes';

export interface BuildFestivalsTableOptions {
  location: GeoLocation;
  /** Minutes east of UTC (`330` for IST). */
  timezoneOffsetMinutes: number;
  startYear: number;
  endYear: number;
  /** Defaults to `['en', 'hi']`; any other code throws `RangeError`. */
  languages?: readonly FestivalsTableLanguage[];
  ayanamsa?: AyanamsaType;
  masaSystem?: MasaSystem;
  region?: FestivalRegion;
  referenceLocation?: string;
  generatedAt?: string;
  note?: string;
}

const DEFAULT_NOTE =
  'Pre-computed festival table. Eclipses are excluded because visibility ' +
  'is location-dependent; use getUpcomingEclipses for those.';

function toDateKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dedups on the whole tuple: a description is not a function of the key (Raksha Bandhan's varies). */
class FestivalDictionary {
  readonly entries: FestivalDictEntry[] = [];
  private readonly index = new Map<string, number>();

  intern(entry: FestivalDictEntry): number {
    const id = JSON.stringify([entry.key, entry.type, entry.name, entry.description ?? null]);
    const seen = this.index.get(id);
    if (seen !== undefined) return seen;
    const next = this.entries.length;
    this.entries.push(entry);
    this.index.set(id, next);
    return next;
  }
}

/** Dictionary-encoded festival table for an inclusive year range; eclipses are dropped. */
export function buildFestivalsTable(
  opts: BuildFestivalsTableOptions,
): FestivalsFile {
  const {
    location,
    timezoneOffsetMinutes,
    startYear,
    endYear,
    languages = ['en', 'hi'],
    ayanamsa = 'lahiri',
    masaSystem = 'purnimanta',
    region = 'all',
    referenceLocation = '',
    generatedAt = '',
    note = DEFAULT_NOTE,
  } = opts;

  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) {
    throw new RangeError('startYear and endYear must be integers');
  }
  if (startYear > endYear) {
    throw new RangeError(`startYear (${startYear}) must be ≤ endYear (${endYear})`);
  }
  if (languages.length === 0) {
    throw new RangeError('languages must contain at least one locale');
  }
  for (const lang of languages) {
    if (lang !== 'en' && lang !== 'hi') {
      throw new RangeError(`languages must be drawn from en, hi; got ${JSON.stringify(lang)}`);
    }
  }

  const years: Record<string, PackedFestivalTableDay[]> = {};
  const dict = new FestivalDictionary();

  for (let year = startYear; year <= endYear; year++) {
    years[String(year)] = buildYear(
      year, location, timezoneOffsetMinutes, languages,
      ayanamsa, masaSystem, region, dict,
    );
  }

  return {
    _meta: {
      format: 2,
      referenceLocation,
      latitude: location.latitude,
      longitude: location.longitude,
      timezoneOffsetMinutes,
      ayanamsa,
      masaSystem,
      region,
      languages: [...languages],
      startYear,
      endYear,
      generatedAt,
      note,
    },
    _dict: dict.entries,
    years,
  };
}

function buildYear(
  year: number,
  location: GeoLocation,
  offsetMinutes: number,
  languages: readonly FestivalsTableLanguage[],
  ayanamsa: AyanamsaType,
  masaSystem: MasaSystem,
  region: FestivalRegion,
  dict: FestivalDictionary,
): PackedFestivalTableDay[] {
  const westShift = offsetMinutes < 0 ? offsetMinutes * 60_000 : 0;
  const start = new Date(utcDateMs(year, 0, 1) - westShift);
  const end = new Date(utcDateMs(year, 11, 31) - westShift);

  const runs = languages.map(language =>
    computeFestivalsInRange(start, end, location, {
      timezone: offsetMinutes,
      ayanamsa,
      masaSystem,
      region,
      language,
    }),
  );

  const len = runs[0]!.length;
  for (let i = 1; i < runs.length; i++) {
    if (runs[i]!.length !== len) {
      throw new Error(
        `language-run length mismatch for ${year}: ` +
        `${languages[0]}=${len} ${languages[i]}=${runs[i]!.length}`,
      );
    }
  }

  const byDate = new Map<string, number[]>();
  for (let i = 0; i < len; i++) {
    const base = runs[0]![i]!;
    if (base.festival.type === 'eclipse') continue;

    const name: LocalizedString = {};
    let description: LocalizedString | undefined;
    for (let l = 0; l < languages.length; l++) {
      const f = runs[l]![i]!.festival;
      name[languages[l]!] = f.name;
      if (f.description) {
        description ??= {};
        description[languages[l]!] = f.description;
      }
    }

    const entry: FestivalDictEntry = {
      key: base.festival.key,
      type: base.festival.type,
      name,
    };
    if (description) entry.description = description;

    const dateKey = toDateKey(base.date, offsetMinutes);
    let bucket = byDate.get(dateKey);
    if (!bucket) {
      bucket = [];
      byDate.set(dateKey, bucket);
    }
    bucket.push(dict.intern(entry));
  }

  return [...byDate.keys()]
    .sort()
    .map(date => ({ date, festivals: byDate.get(date)! }));
}
