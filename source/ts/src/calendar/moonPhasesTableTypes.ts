
export type MoonPhasesTableLanguage = 'en' | 'hi';

export type MoonPhaseTableName = 'new' | 'first_quarter' | 'full' | 'last_quarter';

export type LocalizedString = Partial<Record<MoonPhasesTableLanguage, string>>;

/** Exactly four per table, referenced by index. */
export interface MoonPhaseDictEntry {
  phase: MoonPhaseTableName;
  name: LocalizedString;
  description?: LocalizedString;
}

export interface MoonPhaseTableEntry {
  name: string;
  phase: MoonPhaseTableName;
  /** ISO UTC instant; the phase is global, only its local date is tz-dependent. */
  time: string;
  description?: string;
}

export interface PackedMoonPhaseEvent {
  /** Index into {@link MoonPhasesFile._dict}. */
  i: number;
  /** The phase instant as epoch milliseconds. */
  t: number;
}

export interface PackedMoonPhaseTableDay {
  date: string;
  phases: PackedMoonPhaseEvent[];
}

export interface MoonPhaseTableDay {
  date: string;
  phases: MoonPhaseTableEntry[];
}

/** No coordinates: lunar phases are location-independent instants. */
export interface MoonPhaseTableMeta {
  /** `2` = dictionary-encoded layout; absent = v1, still accepted by the reader. */
  format?: 2;
  referenceLocation: string;
  timezoneOffsetMinutes: number;
  languages: readonly MoonPhasesTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

export interface MoonPhasesFile {
  _meta: MoonPhaseTableMeta;
  _dict: MoonPhaseDictEntry[];
  years: Record<string, PackedMoonPhaseTableDay[]>;
}

export interface MoonPhaseTableEntryRaw {
  name: LocalizedString;
  phase: MoonPhaseTableName;
  time: string;
  description?: LocalizedString;
}

export interface RawMoonPhaseTableDay {
  date: string;
  phases: MoonPhaseTableEntryRaw[];
}

export interface MoonPhasesFileV1 {
  _meta: Omit<MoonPhaseTableMeta, 'format'>;
  years: Record<string, RawMoonPhaseTableDay[]>;
}

export type AnyMoonPhasesFile = MoonPhasesFile | MoonPhasesFileV1;
