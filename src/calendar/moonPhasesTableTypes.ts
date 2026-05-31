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

/** A single Moon-phase event as it sits in the JSON (all locales). */
export interface MoonPhaseTableEntryRaw {
  /** Localized display name, e.g. "Full Moon" / "पूर्णिमा". */
  name: LocalizedString;
  phase: MoonPhaseTableName;
  /** ISO UTC instant of the phase (global; only its local date is tz-dependent). */
  time: string;
  /** Localized one-line description. */
  description?: LocalizedString;
}

/** A single Moon-phase event flattened to the caller's requested locale. */
export interface MoonPhaseTableEntry {
  name: string;
  phase: MoonPhaseTableName;
  time: string;
  description?: string;
}

/** Raw (multi-locale) Moon phases for a single local calendar date. */
export interface RawMoonPhaseTableDay {
  /** ISO `YYYY-MM-DD` — the phase instant's date in the table's reference timezone. */
  date: string;
  phases: MoonPhaseTableEntryRaw[];
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
  referenceLocation: string;
  timezoneOffsetMinutes: number;
  languages: readonly MoonPhasesTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

/** The full on-disk / in-memory Moon-phases table shape. */
export interface MoonPhasesFile {
  _meta: MoonPhaseTableMeta;
  years: Record<string, RawMoonPhaseTableDay[]>;
}
