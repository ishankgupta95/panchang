/** `startLocal` / `endLocal` are offset-carrying ISO 8601 in the result's timezone. */
export interface TimePeriod {
  start: Date;
  end: Date;
  startLocal: string;
  endLocal: string;
}

export type Unlocalized<T extends TimePeriod> = Omit<T, 'startLocal' | 'endLocal'>;

export type UtcWindow = Unlocalized<TimePeriod>;

/** `segment` names the half the ordinal counts in (15 each). Only Tuesday's second window is a night one. */
export interface DurMuhurtaPeriod extends TimePeriod {
  segment: 'day' | 'night';
}

export interface UnlocalizedInfo<T extends TimePeriod> {
  day: Unlocalized<T>[];
  night: Unlocalized<T>[];
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

export type YogaInfo = ElementBase;

export interface KaranaInfo extends ElementBase {
  type: 'fixed' | 'movable';
}

export interface VaraInfo {
  index: number;
  name: string;
  shortName: string;
  englishName: string;
}

/** The first `startTime` is the true boundary instant however far before sunrise; a trailing `endTime` is clamped to next sunrise so the segments tile [sunrise, nextSunrise]. */
interface DailyElementBase {
  startTime: Date | null;
  endTimeLocal: string | null;
  startTimeLocal: string | null;
  isActiveAtSunrise: boolean;
}

export interface DailyTithiInfo extends TithiInfo, DailyElementBase {}
export interface DailyNakshatraInfo extends NakshatraInfo, DailyElementBase {}
export type DailyYogaInfo = YogaInfo & DailyElementBase;
export interface DailyKaranaInfo extends KaranaInfo, DailyElementBase {}

export interface RashiInfo {
  /** 0 = Mesha … 11 = Meena */
  index: number;
  name: string;
}

export interface NakshatraIndexInfo {
  /** 0 = Ashwini … 26 = Revati */
  index: number;
  name: string;
}

export interface ChandraMasaInfo {
  /** 0 = Chaitra … 11 = Phalguna, in the active system */
  index: number;
  name: string;
  /** Leap month: two new moons fall in the same solar month */
  isAdhika: boolean;
  system: 'purnimanta' | 'amanta';
  amantaIndex: number;
  amantaName: string;
  purnimantaIndex: number;
  purnimantaName: string;
}

export type ChoghadiyaQuality = 'auspicious' | 'inauspicious' | 'neutral';

export interface ChoghadiyaSlot extends TimePeriod {
  /** 0-6 within the 7-name Choghadiya cycle */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  qualityName: string;
}

export interface ChoghadiyaInfo {
  /** 8 equal slots from sunrise to sunset */
  day: ChoghadiyaSlot[];
  night: ChoghadiyaSlot[];
}

export interface DoGhatiSlot extends TimePeriod {
  /** 0-29 global slot index: 0-14 daytime (Rudra…Bhaga), 15-29 night (Ishwara…Samirana). */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  qualityName: string;
}

export interface DoGhatiInfo {
  day: DoGhatiSlot[];
  night: DoGhatiSlot[];
}

export interface GowriSlot extends TimePeriod {
  /** 0-7 within the 8-name Gowri cycle */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  qualityName: string;
}

export interface GowriInfo {
  /** 8 equal slots from sunrise to sunset */
  day: GowriSlot[];
  night: GowriSlot[];
}

export interface HoraSlot extends TimePeriod {
  /** 0-6 in Chaldean order: Sun, Venus, Mercury, Moon, Saturn, Jupiter, Mars */
  planetIndex: number;
  planet: string;
}

export interface HoraInfo {
  /** 12 equal horas from sunrise to sunset */
  day: HoraSlot[];
  night: HoraSlot[];
}

export interface SamvatInfo {
  /** Increments at Chaitra Shukla Pratipada */
  vikramSamvat: number;
  /** Same new-year point, 135 years behind Vikram */
  shakaSamvat: number;
  /** 60-year Jovian cycle name */
  vikramSamvatsara: string;
  shakaSamvatsara: string;
}

export interface SpecialYogaInfo {
  name: string;
  type:
    | 'amrit_siddhi'
    | 'sarvartha_siddhi'
    | 'ravi_pushya'
    | 'guru_pushya'
    | 'dwipushkar'
    | 'tripushkar'
    | 'jwalamukhi'
    | 'aadal'
    | 'vidaal'
    | 'ravi';
}

export interface FestivalInfo {
  /** Stable language-independent id; match on this, not the localized `name`. */
  key: string;
  name: string;
  type:
    | 'major'
    | 'minor'
    | 'ekadashi'
    | 'smarta_ekadashi'
    | 'vaishnava_ekadashi'
    | 'pradosha'
    | 'sankranti'
    | 'eclipse';
  description?: string;
}

export type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export interface EclipseInfo {
  kind: 'solar' | 'lunar';
  /** Lunar: by umbral magnitude. Solar: as seen from the location, so a total or annular phase entirely below the horizon reads `'partial'`. */
  subtype: EclipseSubtype;
  start: Date;
  peak: Date;
  end: Date;
  startLocal?: string;
  peakLocal?: string;
  endLocal?: string;
  /** Body above the horizon at peak. */
  visibleFromLocation: boolean;
  /** Fraction of the disc's **area** covered at peak, [0, 1], even when the body is below the horizon then; umbral, so penumbral lunar reads 0. */
  obscuration: number;
  /** Fraction of the **diameter** covered at peak, horizon or not: >1 for a total peak, negative for a penumbral lunar. */
  magnitude: number;
  /** Pre-eclipse impurity window start; null when no sutak applies (penumbral lunar). */
  sutakStart: Date | null;
  /** Umbral last contact (moksha); null for penumbral lunar. */
  sutakEnd: Date | null;
  sutakStartLocal?: string | null;
  sutakEndLocal?: string | null;
  /** Subtype, kind, obscuration and visibility; a solar eclipse whose peak is below the horizon is described at the deepest phase seen, at sunrise or sunset. */
  description: string;
}

/** The vasa follows the Moon's rashi, so a rashi transition splits the Bhadra window. */
export interface BhadraVasaSegment {
  start: Date;
  end: Date;
  startLocal?: string;
  endLocal?: string;
  location: 'earth' | 'heaven' | 'paatal';
  locationName: string;
}

export interface BhadraInfo {
  start: Date;
  end: Date;
  startLocal?: string;
  endLocal?: string;
  /** Keyed on the Moon's rashi **at the window's start**; `vasa` has the breakdown. */
  location: 'earth' | 'heaven' | 'paatal';
  locationName: string;
  /** One segment per Moon rashi the window spans, in time order, tiling [start, end]. */
  vasa: BhadraVasaSegment[];
  isActive: boolean;
}

/**
 * Ashwini (0), Ashlesha (8), Magha (9), Jyeshtha (17), Mula (18), Revati (26), per
 * Muhurta-chintamani / BPHS. Mula and Jyeshtha, spanning the Vrischika/Dhanus boundary, are severe.
 */
export type GandaMulaInfo =
  | { active: false }
  | { active: true; nakshatraName: string; severity: 'mild' | 'severe' };

/** `'samanya'` covers a spell begun on a Wednesday or Thursday, which carries no affliction. */
export type PanchakaType = 'roga' | 'raja' | 'agni' | 'chora' | 'mrityu' | 'samanya';

/** Moon from Dhanishtha 3rd pada through Revati; the type is fixed by the weekday the spell *began* on and holds for the whole spell. */
export type PanchakaInfo =
  | { active: false }
  | {
    active: true;
    type: PanchakaType;
    name: string;
    isDosha: boolean;
    /** 0 = Sunday; the vara that fixed the type. */
    onsetVara: number;
  };

/** The 28-name vara × nakshatra cycle, per Muhurta-chintamani Ch. 4. */
export interface AnandadiYogaInfo {
  /** 0 = Ananda … 27 = Vardhamana. */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
}
