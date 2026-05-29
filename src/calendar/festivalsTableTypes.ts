// Shared types for the static / app-built festival tables.
//
// This module has NO runtime imports on purpose: it is consumed both by
// `festivalsTable.ts` (which imports the bundled JSON) and by
// `buildFestivalsTable.ts` (which imports the engine). Keeping the types
// here lets each side import only what it needs, so the lightweight
// `panchang-ts/festivals` entry never pulls in the engine and the main
// entry never pulls in the bundled JSON.

/** Locales a table may carry. */
export type FestivalsTableLanguage = 'en' | 'hi';

/** Engine-emitted festival type tags. */
export type FestivalsTableType =
  | 'major'
  | 'minor'
  | 'ekadashi'
  | 'smarta_ekadashi'
  | 'vaishnava_ekadashi'
  | 'pradosha'
  | 'sankranti'
  | 'eclipse';

/** Strings in every bundled locale; consumers select via the `lang` arg. */
export type LocalizedString = Partial<Record<FestivalsTableLanguage, string>>;

/** A single festival emission as it sits in the JSON (all locales). */
export interface FestivalTableEntryRaw {
  name: LocalizedString;
  type: FestivalsTableType;
  description?: LocalizedString;
}

/** A festival emission flattened to the caller's requested locale. */
export interface FestivalTableEntry {
  name: string;
  type: FestivalsTableType;
  description?: string;
}

/** Raw (multi-locale) festivals for a single local calendar date. */
export interface RawFestivalTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  festivals: FestivalTableEntryRaw[];
}

/** Festivals for a single local calendar date, flattened to one locale. */
export interface FestivalTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  festivals: FestivalTableEntry[];
}

/** Metadata stamped at generation time. */
export interface FestivalTableMeta {
  referenceLocation: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  ayanamsa: string;
  masaSystem: string;
  region: string;
  languages: readonly FestivalsTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

/** The full on-disk / in-memory festival table shape. */
export interface FestivalsFile {
  _meta: FestivalTableMeta;
  years: Record<string, RawFestivalTableDay[]>;
}
