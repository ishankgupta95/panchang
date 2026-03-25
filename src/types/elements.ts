export interface TimePeriod {
  start: Date;
  end: Date;
}

interface ElementBase {
  index: number;
  name: string;
  completionPercentage: number;
  endTime: Date | null;
}

export interface TithiInfo extends ElementBase {
  paksha: 'Shukla' | 'Krishna';
  number: number;
}

export interface NakshatraInfo extends ElementBase {
  pada: number;
  degreesInNakshatra: number;
}

export interface YogaInfo extends ElementBase {}

export interface KaranaInfo extends ElementBase {
  type: 'fixed' | 'movable';
}

export interface VaraInfo {
  index: number;
  name: string;
  shortName: string;
  englishName: string;
}

// ── Daily mode wrappers ───────────────────────────────

interface DailyElementBase {
  startTime: Date | null;
  isActiveAtSunrise: boolean;
}

export interface DailyTithiInfo extends TithiInfo, DailyElementBase {}
export interface DailyNakshatraInfo extends NakshatraInfo, DailyElementBase {}
export interface DailyYogaInfo extends YogaInfo, DailyElementBase {}
export interface DailyKaranaInfo extends KaranaInfo, DailyElementBase {}

// ── Chandra Masa (lunar month) ────────────────────────

export interface ChandraMasaInfo {
  /** 0 = Chaitra … 11 = Phalguna (Amanta / South-Indian system) */
  index: number;
  /** Translated month name (Amanta) */
  name: string;
  /** True when two new moons fall in the same solar month (extra/leap month) */
  isAdhika: boolean;
  /** Month index in the Purnimanta (North-Indian) system */
  purnimantaIndex: number;
  /** Month name in the Purnimanta system */
  purnimantaName: string;
}

// ── Samvat (Hindu year eras) ──────────────────────────

export interface SamvatInfo {
  /** Vikram Samvat year (increments at Chaitra Shukla Pratipad ≈ April) */
  vikramSamvat: number;
  /** Shaka Samvat year (same new-year point, offset 135 years behind VS) */
  shakaSamvat: number;
}
