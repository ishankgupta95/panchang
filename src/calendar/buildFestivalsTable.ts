// Build a festival table for an arbitrary location. This is the engine-side
// counterpart to the bundled-JSON lookup in `festivalsTable.ts`.
//
// Use it to pre-compute a location-specific table once and cache it — the
// intended pattern for an offline app serving users outside IST, where
// festival dates can shift by ±1 day. Compute the table for the user's
// actual location on first use (a few seconds on-device), persist the
// returned JSON, and read it back through `getFestivalsForYear` /
// `getFestivalsForDate` by passing it as their `source` argument.

import { computeFestivalsInRange } from './yearly';
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
  /** Observer coordinates. */
  location: GeoLocation;
  /**
   * UTC offset in minutes east of UTC, e.g. `330` for IST, `-300` for US
   * Eastern (EST), `0` for UK/GMT. Used both to compute the panchang and to
   * group emissions into local calendar dates; stamped into `_meta`.
   */
  timezoneOffsetMinutes: number;
  /** First Gregorian year to include (inclusive). */
  startYear: number;
  /** Last Gregorian year to include (inclusive). */
  endYear: number;
  /** Locales to emit. Defaults to `['en', 'hi']`. */
  languages?: readonly FestivalsTableLanguage[];
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Lunar month naming. Defaults to `'purnimanta'`. */
  masaSystem?: MasaSystem;
  /** Regional scope. Defaults to `'all'`. */
  region?: FestivalRegion;
  /** Human-readable label for the location, stamped into `_meta`. */
  referenceLocation?: string;
  /** ISO timestamp stamped into `_meta.generatedAt`. Defaults to `''`. */
  generatedAt?: string;
  /** Free-text note stamped into `_meta.note`. */
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

/**
 * Interns unique festival descriptors so each day can hold indices instead of
 * repeating every localized string at every occurrence.
 *
 * The whole `(key, type, name, description)` tuple is the dedup unit, not the
 * name alone: a festival's description is not a pure function of its key —
 * Raksha Bandhan carries a different note depending on whether Bhadra overlaps
 * the day — so keying on the name would merge entries that differ.
 */
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

/**
 * Compute a festival table for the given location and year range.
 *
 * Runs the festival engine once per requested language and zips the runs
 * by emission index (festival selection is language-independent, so the
 * runs align). Eclipses are dropped — their visibility is location-specific
 * and better served by `getUpcomingEclipses`.
 *
 * The emitted table is dictionary-encoded and carries each festival's stable
 * `key`; see `festivalsTableTypes.ts` for why.
 *
 * @returns A {@link FestivalsFile} ready to serialize, cache, and feed back
 *          into the `readFestivalsForYear` / `readFestivalsForDate` accessors
 *          via their `source` argument.
 */
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

  const years: Record<string, PackedFestivalTableDay[]> = {};
  // One dictionary across the whole table, not one per year: most festivals
  // recur annually, so sharing it is where the compression comes from.
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
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  // One engine run per locale; selection is locale-independent so the runs
  // emit the same festivals in the same order — we zip them by index.
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
