// Shared types for the app-built festival tables.
//
// This module has NO runtime imports on purpose: it is consumed both by
// `festivalsTable.ts` (the engine-free reader behind `panchang-ts/festivals`)
// and by `buildFestivalsTable.ts` (which imports the engine). Keeping the types
// here lets each side import only what it needs, so the lightweight
// `panchang-ts/festivals` entry never pulls in the engine.

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

/**
 * ## Why the emitted table is dictionary-encoded
 *
 * A table is the file a consumer caches and parses in *their* app, so its
 * parse-time and memory cost lands on them — and that is exactly the constraint
 * that bites on Hermes, where a table used to arrive as several hundred KB of
 * object literal parsed at startup.
 *
 * The v1 format repeated every localized string at every occurrence. Measured
 * on a 2,112-entry table: **83 unique name objects and 59 unique descriptions**.
 * Since a festival's key, type, name and description move together, the whole
 * tuple is deduplicated as one {@link FestivalDictEntry} and each day holds
 * nothing but indices into that dictionary.
 *
 * Gzip already hid most of this on the wire, so the win is parse time and
 * resident memory, not download size.
 */
export interface FestivalDictEntry {
  /**
   * Stable, locale-independent identifier — the same `key` the engine puts on
   * `FestivalInfo`. v1 tables did not carry it, which made the table both
   * larger *and* less useful than engine output.
   */
  key: string;
  type: FestivalsTableType;
  name: LocalizedString;
  description?: LocalizedString;
}

/** A festival emission flattened to the caller's requested locale. */
export interface FestivalTableEntry {
  key: string;
  name: string;
  type: FestivalsTableType;
  description?: string;
}

/** Festivals for a single local calendar date, flattened to one locale. */
export interface FestivalTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  festivals: FestivalTableEntry[];
}

/** A day as it sits in the emitted JSON: indices into `_dict`. */
export interface PackedFestivalTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  /** Indices into {@link FestivalsFile._dict}. */
  festivals: number[];
}

/** Metadata stamped at generation time. */
export interface FestivalTableMeta {
  /**
   * Table format version. `2` is the dictionary-encoded layout introduced in
   * v5; absent means a v1 table, which the reader still accepts.
   */
  format?: 2;
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

/** The emitted festival table. */
export interface FestivalsFile {
  _meta: FestivalTableMeta;
  _dict: FestivalDictEntry[];
  years: Record<string, PackedFestivalTableDay[]>;
}

// ── v1, still readable ───────────────────────────────────────────────────────
//
// Tables built before v5 inlined every string and carried no `key`. Consumers
// cache these files, so a v5 upgrade that silently misread one would be worse
// than a loud failure. The reader detects and flattens both; only `key` is
// unavailable from a v1 table, and it comes back as `''`.

/** A v1 festival emission: strings inlined, no key. */
export interface FestivalTableEntryRaw {
  name: LocalizedString;
  type: FestivalsTableType;
  description?: LocalizedString;
}

/** A v1 day. */
export interface RawFestivalTableDay {
  date: string;
  festivals: FestivalTableEntryRaw[];
}

/** A v1 table. */
export interface FestivalsFileV1 {
  _meta: Omit<FestivalTableMeta, 'format'>;
  years: Record<string, RawFestivalTableDay[]>;
}

/** Either format, as accepted by the readers. */
export type AnyFestivalsFile = FestivalsFile | FestivalsFileV1;
