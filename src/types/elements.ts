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

// ── Daily mode wrappers ───────────────────────────────

interface DailyElementBase {
  startTime: Date | null;
  isActiveAtSunrise: boolean;
}

export interface DailyTithiInfo extends TithiInfo, DailyElementBase {}
export interface DailyNakshatraInfo extends NakshatraInfo, DailyElementBase {}
export type DailyYogaInfo = YogaInfo & DailyElementBase;
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

// ── Do Ghati Muhurta ──────────────────────────────────

export interface DoGhatiSlot extends TimePeriod {
  /**
   * 0–29 global slot index. 0–14 are daytime (Rudra…Bhaga),
   * 15–29 are nighttime (Ishwara…Samirana).
   */
  index: number;
  name: string;
  quality: ChoghadiyaQuality;
  /** Localized display name for the quality (e.g. "शुभ" in Hindi) */
  qualityName: string;
}

export interface DoGhatiInfo {
  /** 15 equal slots from sunrise to sunset (indices 0–14) */
  day: DoGhatiSlot[];
  /** 15 equal slots from sunset to next sunrise (indices 15–29) */
  night: DoGhatiSlot[];
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
  /** Vikram Samvat year (increments at Chaitra Shukla Pratipada) */
  vikramSamvat: number;
  /** Shaka Samvat year (same new-year point, offset 135 years behind VS) */
  shakaSamvat: number;
  /** 60-year Jovian cycle (Samvatsara) name for the Vikram era, e.g. "Siddharthi". */
  vikramSamvatsara: string;
  /** 60-year Jovian cycle (Samvatsara) name for the Shaka era, e.g. "Parabhava". */
  shakaSamvatsara: string;
}

// ── Special Yogas (auspicious day detection) ─────────

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

// ── Festivals ────────────────────────────────────────

export interface FestivalInfo {
  /**
   * Stable, language-independent identifier — e.g. `'diwali'`,
   * `'makar_sankranti'`, `'sankashti_chaturthi'`.
   *
   * `name` is already localized, so it is not safe to match on: the same
   * festival is `"Diwali"` under `language: 'en'` and `"दिवाली"` under `'hi'`.
   * Use `key` to filter, attach icons, or deep-link, and `name` only to
   * display. Keys are treated as part of the public contract and will not be
   * renamed without a major version.
   */
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
  /** Smarta-only: when Ekadashi is Dashami-viddha, the Dwadashi fast day. */
  deferralDate?: Date;
}

// ── Eclipse (Grahan) ─────────────────────────────────

export type EclipseSubtype = 'partial' | 'total' | 'annular' | 'penumbral';

export interface EclipseInfo {
  kind: 'solar' | 'lunar';
  subtype: EclipseSubtype;
  /** UTC time the eclipse's observable phase begins. */
  start: Date;
  /** UTC time of greatest eclipse. */
  peak: Date;
  /** UTC time the eclipse's observable phase ends. */
  end: Date;
  /** True when the body is above the horizon at peak for the observer's location. */
  visibleFromLocation: boolean;
  /** Fraction of the disc obscured at peak, range [0, 1]. */
  magnitude: number;
  /** Pre-eclipse impurity window start (sutak), or null when no sutak applies (penumbral lunar eclipse). */
  sutakStart: Date | null;
  /** End of sutak (moksha) — umbral last contact; null for penumbral lunar eclipses. */
  sutakEnd: Date | null;
  description: string;
}

// ── Bhadra Kala (Vishti karana window) ───────────────

export interface BhadraInfo {
  start: Date;
  end: Date;
  /**
   * Bhadra's residence — a stable machine-readable key, not display text.
   * Use {@link BhadraInfo.locationName} to show it to a user.
   */
  location: 'earth' | 'heaven' | 'paatal';
  /** Localized display name for {@link BhadraInfo.location}. */
  locationName: string;
  isActive: boolean;
}

// ── Ganda Mula (root nakshatra) ──────────────────────

/**
 * Detection of the Moon being in one of the 6 "gaṇḍānta-mūla" nakshatras —
 * a classical inauspicious window for new beginnings (births, journeys,
 * housewarmings) per Smarta muhurta literature (Muhurta-chintamani / BPHS).
 *
 * The 6 root nakshatras are Ashwini (0), Ashlesha (8), Magha (9), Jyeshtha
 * (17), Mula (18), and Revati (26). Mula and Jyeshtha — the gaṇḍānta pair
 * spanning the Vrischika/Dhanus rashi boundary — are classed *severe*; the
 * other four are *mild*.
 *
 * Discriminated on `active`: when `active === true`, `nakshatraName` and
 * `severity` are guaranteed present and the type narrows automatically.
 */
export type GandaMulaInfo =
  | { active: false }
  | { active: true; nakshatraName: string; severity: 'mild' | 'severe' };

// ── Anandadi Yoga (Vara × Nakshatra) ─────────────────

/**
 * Anandadi Yoga — the 28-name cycle formed by the day-of-week × nakshatra
 * combination per Muhurta-chintamani Ch. 4. The day's anandadi yoga is a
 * pure function of `(varaIndex, nakshatraIndex)` and is exposed in both
 * daily and instant panchang results.
 */
export interface AnandadiYogaInfo {
  /** Index in the 28-name cycle (0 = Ananda … 27 = Vardhamana). */
  index: number;
  /** Localized yoga name. */
  name: string;
  /** Classical quality of the yoga. */
  quality: ChoghadiyaQuality;
}
