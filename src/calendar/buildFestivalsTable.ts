// Build a festival table for an arbitrary location. This is the engine-side
// counterpart to the bundled-JSON lookup in `festivalsTable.ts`.
//
// Use it to pre-compute a location-specific table once and cache it — the
// intended pattern for an offline app serving users outside IST, where
// festival dates can shift by ±1 day. Compute the table for the user's
// actual location on first use (a few seconds on-device), persist the
// returned JSON, and read it back through `getFestivalsForYear` /
// `getFestivalsForDate` by passing it as their `source` argument.

import { getFestivalsInRange } from './yearly';
import type { GeoLocation } from '../types/location';
import type { AyanamsaType, MasaSystem, FestivalRegion } from '../types/options';
import type {
  FestivalsFile,
  FestivalsTableLanguage,
  FestivalTableEntryRaw,
  LocalizedString,
  RawFestivalTableDay,
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
 * Compute a festival table for the given location and year range.
 *
 * Runs the festival engine once per requested language and zips the runs
 * by emission index (festival selection is language-independent, so the
 * runs align). Eclipses are dropped — their visibility is location-specific
 * and better served by `getUpcomingEclipses`.
 *
 * @returns A {@link FestivalsFile} ready to serialize, cache, and feed back
 *          into the `getFestivalsForYear` / `getFestivalsForDate` accessors
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

  const years: Record<string, RawFestivalTableDay[]> = {};

  for (let year = startYear; year <= endYear; year++) {
    years[String(year)] = buildYear(
      year, location, timezoneOffsetMinutes, languages,
      ayanamsa, masaSystem, region,
    );
  }

  return {
    _meta: {
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
): RawFestivalTableDay[] {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  // One engine run per locale; selection is locale-independent so the runs
  // emit the same festivals in the same order — we zip them by index.
  const runs = languages.map(language =>
    getFestivalsInRange(start, end, location, {
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

  const byDate = new Map<string, FestivalTableEntryRaw[]>();
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

    const key = toDateKey(base.date, offsetMinutes);
    let bucket = byDate.get(key);
    if (!bucket) {
      bucket = [];
      byDate.set(key, bucket);
    }
    const entry: FestivalTableEntryRaw = { name, type: base.festival.type };
    if (description) entry.description = description;
    bucket.push(entry);
  }

  return [...byDate.keys()]
    .sort()
    .map(date => ({ date, festivals: byDate.get(date)! }));
}
