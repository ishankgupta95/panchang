
export type EclipsesTableLanguage = 'en' | 'hi';

export type EclipseTableKind = 'solar' | 'lunar';

/** `penumbral` is lunar-only; `annular` is solar-only. */
export type EclipseTableSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export type LocalizedString = Partial<Record<EclipsesTableLanguage, string>>;

/** Sutak kāla: emitted only for eclipses visible from the location. */
export interface EclipseSutak {
  /** ISO UTC: 12h before first contact for solar, 9h for lunar. */
  start: string;
  /** ISO UTC: coincides with the eclipse's end (moksha). */
  end: string;
}

/** One eclipse as it sits in the JSON, every locale present. */
export interface EclipseTableEntryRaw {
  name: LocalizedString;
  kind: EclipseTableKind;
  subtype: EclipseTableSubtype;
  /** ISO UTC: first contact (penumbral for lunar, partial begin for solar). */
  start: string;
  peak: string;
  end: string;
  /** Fraction of the disc's **area** covered at peak, [0, 1]; umbral for lunar. */
  obscuration: number;
  /** The *diameter* fraction catalogues publish: >1 total, <0 penumbral lunar. */
  magnitude: number;
  /** Above the horizon during at least one phase. */
  visibleFromLocation: boolean;
  visibleAtPeak: boolean;
  sutak?: EclipseSutak;
  description?: LocalizedString;
}

export interface EclipseTableEntry {
  name: string;
  kind: EclipseTableKind;
  subtype: EclipseTableSubtype;
  start: string;
  peak: string;
  end: string;
  obscuration: number;
  magnitude: number;
  visibleFromLocation: boolean;
  visibleAtPeak: boolean;
  sutak?: EclipseSutak;
  description?: string;
}

export interface RawEclipseTableDay {
  date: string;
  eclipses: EclipseTableEntryRaw[];
}

export interface EclipseTableDay {
  /** ISO `YYYY-MM-DD`, in the table's reference timezone. */
  date: string;
  eclipses: EclipseTableEntry[];
}

export interface EclipseTableMeta {
  referenceLocation: string;
  latitude: number;
  longitude: number;
  timezoneOffsetMinutes: number;
  visibleOnly: boolean;
  languages: readonly EclipsesTableLanguage[];
  startYear: number;
  endYear: number;
  generatedAt: string;
  note: string;
}

export interface EclipsesFile {
  _meta: EclipseTableMeta;
  years: Record<string, RawEclipseTableDay[]>;
}
