// No runtime imports: a value import here would pull the engine into the
// engine-free `panchang-ts/festivals` entry that reads these types.

export type FestivalsTableLanguage = 'en' | 'hi';

export type FestivalsTableType =
  | 'major'
  | 'minor'
  | 'ekadashi'
  | 'smarta_ekadashi'
  | 'vaishnava_ekadashi'
  | 'pradosha'
  | 'sankranti'
  | 'eclipse';

export type LocalizedString = Partial<Record<FestivalsTableLanguage, string>>;

/** Deduplicated across the whole table. */
export interface FestivalDictEntry {
  key: string;
  type: FestivalsTableType;
  name: LocalizedString;
  description?: LocalizedString;
}

export interface FestivalTableEntry {
  key: string;
  name: string;
  type: FestivalsTableType;
  description?: string;
}

export interface FestivalTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  festivals: FestivalTableEntry[];
}

/** A day as it sits in the emitted JSON: indices into `_dict`. */
export interface PackedFestivalTableDay {
  date: string;
  festivals: number[];
}

export interface FestivalTableMeta {
  /** `2` = dictionary-encoded layout; absent = v1, still accepted by the reader. */
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

export interface FestivalsFile {
  _meta: FestivalTableMeta;
  _dict: FestivalDictEntry[];
  years: Record<string, PackedFestivalTableDay[]>;
}

// v1, still readable: consumers cache these files; `key` flattens to `''`.

export interface FestivalTableEntryRaw {
  name: LocalizedString;
  type: FestivalsTableType;
  description?: LocalizedString;
}

export interface RawFestivalTableDay {
  date: string;
  festivals: FestivalTableEntryRaw[];
}

export interface FestivalsFileV1 {
  _meta: Omit<FestivalTableMeta, 'format'>;
  years: Record<string, RawFestivalTableDay[]>;
}

export type AnyFestivalsFile = FestivalsFile | FestivalsFileV1;
