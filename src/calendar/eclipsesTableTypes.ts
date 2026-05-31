// Shared types for the static / app-built eclipse tables.
//
// Mirrors `festivalsTableTypes.ts`: this module has NO runtime imports on
// purpose, so the lightweight `panchang-ts/eclipses` entry (which imports the
// bundled JSON) and `buildEclipsesTable.ts` (which imports the engine) each
// pull in only the types they need — neither side drags in the other's
// runtime cost.

/** Locales a table may carry. */
export type EclipsesTableLanguage = 'en' | 'hi';

/** Eclipsed body. */
export type EclipseTableKind = 'solar' | 'lunar';

/** Eclipse subtype. `penumbral` is lunar-only; `annular` is solar-only. */
export type EclipseTableSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

/** Strings in every bundled locale; consumers select via the `lang` arg. */
export type LocalizedString = Partial<Record<EclipsesTableLanguage, string>>;

/**
 * Pre-eclipse impurity window (sutak / sutak kāla). Present only for eclipses
 * visible from the reference location — sutak does not apply to an eclipse you
 * cannot observe (classical Smarta convention).
 */
export interface EclipseSutak {
  /** ISO UTC — sutak begins (12h before first contact for solar, 9h for lunar). */
  start: string;
  /** ISO UTC — sutak ends; coincides with the eclipse's end (moksha). */
  end: string;
}

/** A single eclipse as it sits in the JSON (all locales). */
export interface EclipseTableEntryRaw {
  /** Localized display name, e.g. "Total Lunar Eclipse" / "पूर्ण चंद्र ग्रहण". */
  name: LocalizedString;
  kind: EclipseTableKind;
  subtype: EclipseTableSubtype;
  /** ISO UTC — start of the observable phase (penumbral start for lunar, partial begin for solar). */
  start: string;
  /** ISO UTC — greatest eclipse. */
  peak: string;
  /** ISO UTC — end of the observable phase. */
  end: string;
  /** Fraction of the disc obscured at peak, range [0, 1]. */
  magnitude: number;
  /**
   * True when the eclipse is observable from the reference location during at
   * least one phase (body above the horizon between first and last contact).
   * This is the inclusion criterion for the bundled visible-only table, so it
   * is always `true` there; on a `visibleOnly: false` build it may be `false`.
   */
  visibleFromLocation: boolean;
  /**
   * True when the eclipsed body is above the horizon at *greatest eclipse* —
   * i.e. the peak itself is observable, not just an edge phase at moon/sunrise
   * or moon/sunset. Stricter than `visibleFromLocation`.
   */
  visibleAtPeak: boolean;
  /** Sutak window — present only when the eclipse warrants it (see notes). */
  sutak?: EclipseSutak;
  /** Localized one-line description. */
  description?: LocalizedString;
}

/** A single eclipse flattened to the caller's requested locale. */
export interface EclipseTableEntry {
  name: string;
  kind: EclipseTableKind;
  subtype: EclipseTableSubtype;
  start: string;
  peak: string;
  end: string;
  magnitude: number;
  visibleFromLocation: boolean;
  visibleAtPeak: boolean;
  sutak?: EclipseSutak;
  description?: string;
}

/** Raw (multi-locale) eclipses for a single local calendar date. */
export interface RawEclipseTableDay {
  /** ISO `YYYY-MM-DD` — the eclipse peak's date in the table's reference timezone. */
  date: string;
  eclipses: EclipseTableEntryRaw[];
}

/** Eclipses for a single local calendar date, flattened to one locale. */
export interface EclipseTableDay {
  /** ISO `YYYY-MM-DD` — the eclipse peak's date in the table's reference timezone. */
  date: string;
  eclipses: EclipseTableEntry[];
}

/** Metadata stamped at generation time. */
export interface EclipseTableMeta {
  referenceLocation: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  /** When true, only eclipses observable from the reference location are included. */
  visibleOnly: boolean;
  languages: readonly EclipsesTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

/** The full on-disk / in-memory eclipse table shape. */
export interface EclipsesFile {
  _meta: EclipseTableMeta;
  years: Record<string, RawEclipseTableDay[]>;
}
