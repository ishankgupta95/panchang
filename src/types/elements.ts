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
  paksha: string;
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

// ── Rashi (zodiac sign) ───────────────────────────────

export interface RashiInfo {
  /** 0 = Mesha … 11 = Meena */
  index: number;
  name: string;
}

// ── Chandra Masa (lunar month) ────────────────────────

export interface ChandraMasaInfo {
  /** Month index in the active system (0 = Chaitra … 11 = Phalguna) */
  index: number;
  /** Translated month name in the active system */
  name: string;
  /** True when two new moons fall in the same solar month (extra/leap month) */
  isAdhika: boolean;
  /** Which system `index`/`name` represent */
  system: 'purnimanta' | 'amanta';
  /** Month index in the Amanta (South-Indian) system */
  amantaIndex: number;
  /** Month name in the Amanta system */
  amantaName: string;
  /** Month index in the Purnimanta (North-Indian) system */
  purnimantaIndex: number;
  /** Month name in the Purnimanta system */
  purnimantaName: string;
}

// ── Choghadiya ────────────────────────────────────────

export type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

export interface ChoghadiyaSlot extends TimePeriod {
  /** 0–6: index within the 7-name Choghadiya cycle */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  /** Localized display name for the quality (e.g. "शुभ" in Hindi) */
  qualityName: string;
}

export interface ChoghadiyaInfo {
  /** 8 equal slots from sunrise to sunset */
  day: ChoghadiyaSlot[];
  /** 8 equal slots from sunset to next sunrise */
  night: ChoghadiyaSlot[];
}

// ── Gowri Panchangam ──────────────────────────────────

export interface GowriSlot extends TimePeriod {
  /** 0–7: index within the 8-name Gowri cycle */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  /** Localized display name for the quality (e.g. "शुभ" in Hindi) */
  qualityName: string;
}

export interface GowriInfo {
  /** 8 equal slots from sunrise to sunset */
  day: GowriSlot[];
  /** 8 equal slots from sunset to next sunrise */
  night: GowriSlot[];
}

// ── Hora (planetary hours) ────────────────────────────

export interface HoraSlot extends TimePeriod {
  /** 0–6 in Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars */
  planetIndex: number;
  planet: string;
}

export interface HoraInfo {
  /** 12 equal horas from sunrise to sunset */
  day: HoraSlot[];
  /** 12 equal horas from sunset to next sunrise */
  night: HoraSlot[];
}

// ── Samvat (Hindu year eras) ──────────────────────────

export interface SamvatInfo {
  /** Vikram Samvat year (increments at Chaitra Shukla Pratipad ≈ April) */
  vikramSamvat: number;
  /** Shaka Samvat year (same new-year point, offset 135 years behind VS) */
  shakaSamvat: number;
}

// ── Special Yogas (auspicious day detection) ─────────

export interface SpecialYogaInfo {
  name: string;
  type: 'amrit_siddhi' | 'sarvartha_siddhi' | 'ravi_pushya' | 'guru_pushya';
}

// ── Festivals ────────────────────────────────────────

export interface FestivalInfo {
  name: string;
  type: 'major' | 'minor' | 'ekadashi' | 'pradosha' | 'sankranti';
  description?: string;
}
