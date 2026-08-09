// Shared types for app-built muhurta tables.
//
// This module has NO runtime imports on purpose: it is consumed both by
// `muhurtaTable.ts` (the engine-free reader behind `panchang-ts/muhurta`) and by
// `buildMuhurtaTable.ts` (which imports the engine). `MuhurtaFactor` lives here
// rather than in `engine.ts` so the reader can name it without pulling the
// engine in; `engine.ts` re-exports it, so nothing moved for consumers.

/** Locales a table may carry. */
export type MuhurtaTableLanguage = 'en' | 'hi';

/**
 * One scoring input, in machine-readable form.
 *
 * `MuhurtaScore.reasons` renders these as English sentences, which makes it
 * unsuitable for a localized UI or for programmatic filtering. `factors`
 * carries the same information without the prose: a stable `code`, the axis it
 * came from, the index that triggered it, and its effect on the score.
 */
export interface MuhurtaFactor {
  /** Stable identifier, e.g. `'auspicious_tithi'`, `'bhadra'`, `'jwalamukhi'`. */
  code: string;
  /** Which panchang axis produced it. `'exclusion'` means the day was zeroed. */
  axis: 'tithi' | 'nakshatra' | 'vara' | 'karana' | 'yoga' | 'specialYoga'
    | 'varaTithiYoga' | 'exclusion';
  /** The element index that triggered it, when the axis has one. */
  index?: number;
  /** Points contributed. Negative lowers the score; 0 for a hard exclusion. */
  delta: number;
}

/** A scored day, flattened for the caller. */
export interface MuhurtaTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  /** 0..100 — the higher, the more auspicious for this occasion. */
  score: number;
  /** True when the day clears all hard exclusions and lands in a positive band. */
  passes: boolean;
  factors: MuhurtaFactor[];
}

/**
 * A scored day as it sits in the emitted JSON.
 *
 * Factors repeat heavily — the same `(code, axis, index, delta)` tuple recurs on
 * every day sharing a tithi or nakshatra — so they are interned into `_dict` and
 * referenced by index, the same encoding the festival and Moon-phase tables use.
 * Keys are terse for the same reason: this file is parsed on the consumer's
 * device.
 */
export interface PackedMuhurtaTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  /** Score, 0..100. */
  s: number;
  /** 1 when the day passes, 0 when it does not. */
  p: 0 | 1;
  /** Indices into {@link MuhurtaFile._dict}. */
  f: number[];
}

/** Metadata stamped at generation time. */
export interface MuhurtaTableMeta {
  /** Table format version. `2` matches the other v5 dictionary-encoded tables. */
  format: 2;
  /** The rule's stable `occasion` identifier, e.g. `'vivah'`. */
  occasion: string;
  /** The rule's human-readable name, when it had one. */
  occasionName?: string;
  referenceLocation: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  ayanamsa: string;
  masaSystem: string;
  startYear: number;
  endYear: number;
  /**
   * When false, only days that pass the rule are stored — which is the point of
   * a muhurta table and typically an order of magnitude smaller.
   */
  includeFailures: boolean;
  generatedAt: string;
  note: string;
}

/** The emitted muhurta table. One table covers one occasion. */
export interface MuhurtaFile {
  _meta: MuhurtaTableMeta;
  _dict: MuhurtaFactor[];
  years: Record<string, PackedMuhurtaTableDay[]>;
}
