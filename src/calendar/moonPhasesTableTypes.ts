// Shared types for the static / app-built Moon-phases tables.
//
// Mirrors `festivalsTableTypes.ts` / `eclipsesTableTypes.ts`: NO runtime
// imports, so the lightweight `panchang-ts/moon-phases` entry (bundled JSON)
// and the engine-side `buildMoonPhasesTable` each import only the types they
// need. The phase-name union is re-declared here (rather than imported from
// `astronomy/moonPhase`, which pulls in the engine) to keep this side clean.

/** Locales a table may carry. */
export type MoonPhasesTableLanguage = 'en' | 'hi';

/** The four principal lunar phases (quarters), in astronomical order. */
export type MoonPhaseTableName = 'new' | 'first_quarter' | 'full' | 'last_quarter';

/** Strings in every bundled locale; consumers select via the `lang` arg. */
export type LocalizedString = Partial<Record<MoonPhasesTableLanguage, string>>;

/**
 * A unique phase descriptor, referenced by index from each event.
 *
 * There are exactly four of these in any table — the name and description are
 * pure functions of `phase` — against 396 events in a typical decade, so the v1
 * format repeated four distinct localized strings a hundred times each. See
 * `festivalsTableTypes.ts` for why this is a parse-time and memory win rather
 * than a download one.
 */
export interface MoonPhaseDictEntry {
  phase: MoonPhaseTableName;
  /** Localized display name, e.g. "Full Moon" / "पूर्णिमा". */
  name: LocalizedString;
  /** Localized one-line description. */
  description?: LocalizedString;
}

/** A single Moon-phase event flattened to the caller's requested locale. */
export interface MoonPhaseTableEntry {
  name: string;
  phase: MoonPhaseTableName;
  /** ISO UTC instant of the phase (global; only its local date is tz-dependent). */
  time: string;
  description?: string;
}

/** A phase event as it sits in the emitted JSON. */
export interface PackedMoonPhaseEvent {
  /** Index into {@link MoonPhasesFile._dict}. */
  i: number;
  /**
   * The phase instant as epoch milliseconds.
   *
   * A number rather than the ISO string the reader hands back: with only four
   * dictionary entries against several hundred events, the timestamp *is* the
   * table, and `1704974240000` costs 13 characters where
   * `"2024-01-11T11:57:20.000Z"` costs 26. The conversion is exact in both
   * directions, so the resolved `time` string is unchanged.
   */
  t: number;
}

/** Moon phases for a single local calendar date, as emitted. */
export interface PackedMoonPhaseTableDay {
  /** ISO `YYYY-MM-DD` — the phase instant's date in the table's reference timezone. */
  date: string;
  phases: PackedMoonPhaseEvent[];
}

/** Moon phases for a single local calendar date, flattened to one locale. */
export interface MoonPhaseTableDay {
  /** ISO `YYYY-MM-DD` — the phase instant's date in the table's reference timezone. */
  date: string;
  phases: MoonPhaseTableEntry[];
}

/**
 * Metadata stamped at generation time. Lunar phases are location-independent
 * instants, so there are no coordinates here — only the timezone that maps each
 * instant to a calendar date.
 */
export interface MoonPhaseTableMeta {
  /**
   * Table format version. `2` is the dictionary-encoded layout introduced in
   * v5; absent means a v1 table, which the reader still accepts.
   */
  format?: 2;
  referenceLocation: string;
  timezoneOffsetMinutes: number;
  languages: readonly MoonPhasesTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

/** The emitted Moon-phases table. */
export interface MoonPhasesFile {
  _meta: MoonPhaseTableMeta;
  _dict: MoonPhaseDictEntry[];
  years: Record<string, PackedMoonPhaseTableDay[]>;
}

// ── v1, still readable ───────────────────────────────────────────────────────
//
// Tables built before v5 inlined every string. Consumers cache these files, so
// a v5 upgrade that silently misread one would be worse than a loud failure.

/** A v1 phase event: strings inlined. */
export interface MoonPhaseTableEntryRaw {
  name: LocalizedString;
  phase: MoonPhaseTableName;
  time: string;
  description?: LocalizedString;
}

/** A v1 day. */
export interface RawMoonPhaseTableDay {
  date: string;
  phases: MoonPhaseTableEntryRaw[];
}

/** A v1 table. */
export interface MoonPhasesFileV1 {
  _meta: Omit<MoonPhaseTableMeta, 'format'>;
  years: Record<string, RawMoonPhaseTableDay[]>;
}

/** Either format, as accepted by the readers. */
export type AnyMoonPhasesFile = MoonPhasesFile | MoonPhasesFileV1;
