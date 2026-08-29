// No runtime imports on purpose: the engine-free reader `muhurtaTable.ts` consumes
// this too, so `MuhurtaFactor` lives here rather than in `engine.ts`.

export type MuhurtaTableLanguage = 'en' | 'hi';

/** The localizable form of `MuhurtaScore.reasons`. */
export interface MuhurtaFactor {
  code: string;
  /** `'exclusion'` means the day was zeroed. */
  axis: 'tithi' | 'nakshatra' | 'vara' | 'karana' | 'yoga' | 'specialYoga'
    | 'varaTithiYoga' | 'exclusion';
  index?: number;
  /** Points contributed; 0 for a hard exclusion. */
  delta: number;
}

export interface MuhurtaTableDay {
  /** ISO `YYYY-MM-DD` in the table's reference timezone. */
  date: string;
  /** 0..100. */
  score: number;
  passes: boolean;
  factors: MuhurtaFactor[];
}

/** A scored day as it sits in the emitted JSON: factors interned, keys terse. */
export interface PackedMuhurtaTableDay {
  date: string;
  /** Score, 0..100. */
  s: number;
  /** 1 = passes. */
  p: 0 | 1;
  /** Indices into {@link MuhurtaFile._dict}. */
  f: number[];
}

export interface MuhurtaTableMeta {
  format: 2;
  occasion: string;
  occasionName?: string;
  referenceLocation: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  ayanamsa: string;
  masaSystem: string;
  startYear: number;
  endYear: number;
  /** When false, only days that pass the rule are stored. */
  includeFailures: boolean;
  generatedAt: string;
  note: string;
}

export interface MuhurtaFile {
  _meta: MuhurtaTableMeta;
  _dict: MuhurtaFactor[];
  years: Record<string, PackedMuhurtaTableDay[]>;
}
