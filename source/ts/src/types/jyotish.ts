import type { NakshatraInfo, RashiInfo } from './elements';

export type GrahaName =
  | 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn'
  | 'Rahu' | 'Ketu';

export interface GrahaPosition {
  planet: GrahaName;
  siderealLongitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
  nakshatra: NakshatraInfo;
  isRetrograde: boolean;
}

export interface PlanetaryPositions {
  sun: GrahaPosition;
  moon: GrahaPosition;
  mars: GrahaPosition;
  mercury: GrahaPosition;
  jupiter: GrahaPosition;
  venus: GrahaPosition;
  saturn: GrahaPosition;
  rahu: GrahaPosition;
  ketu: GrahaPosition;
}

export type DashaLord =
  | 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
  | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

export interface AntarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

export interface PratyantarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

export interface MahaDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  years: number;
  antarDashas: AntarDasha[];
}

export interface VimshottariDashaResult {
  currentMahaDashaLord: DashaLord;
  currentIndex: number;
  /** 120 years from birth; the first entry may start mid-cycle. */
  mahaDashas: MahaDasha[];
}

/** BPHS Ch. 3: Shubha in houses 1, 3, 6, 7, 10, 11 from the janma rashi. */
export interface ChandraBalamInfo {
  house: number;
  quality: 'strong' | 'weak';
  englishName: string;
  name: string;
}

export interface LagnaInfo {
  siderealLongitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
  nakshatra: { index: number; name: string };
  pada: number;
}

export interface SripatiLagnaInfo extends LagnaInfo {
  /** `cusps[i]` is the bhava madhya of bhava `i+1`. */
  cusps: number[];
}

export interface HouseInfo {
  house: number;
  cuspLongitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
}

export interface BhavaChart {
  system: 'whole-sign' | 'equal' | 'placidus-kp';
  houses: HouseInfo[];
  /** Equals `houses[0].cuspLongitude` under `'equal'` only. */
  ascendantLongitude: number;
  /** The true MC, the same under all three systems; the 10th cusp only under `'placidus-kp'`. */
  mcLongitude: number;
}

/** In a divisional chart the longitude/degree fields are the transformed ones. */
export interface PlanetPlacement {
  planet: GrahaName;
  longitude: number;
  rashi: RashiInfo;
  degreeInRashi: number;
  house: number;
  isRetrograde: boolean;
}

export interface BirthChart {
  divisional: 'D1';
  lagna: LagnaInfo;
  bhava: BhavaChart;
  planets: PlanetPlacement[];
  /** The same objects as `planets`; mutations are shared. */
  byPlanet: Readonly<Record<GrahaName, PlanetPlacement>>;
}

export type Divisional = 'D2' | 'D3' | 'D7' | 'D9' | 'D10' | 'D12' | 'D30';

/** Always whole-sign anchored to the divisional lagna: vargas are not cuspal. */
export interface DivisionalChart {
  divisional: Divisional;
  lagnaRashi: RashiInfo;
  planets: PlanetPlacement[];
}

/** How many of Lagna, Moon and Venus flag Mars: `'anshik'` = 1 or 2, `'purna'` = 3. */
export type MangalDoshaSeverity = 'none' | 'anshik' | 'purna';

/** Mars in houses 1, 2, 4, 7, 8 or 12 from lagna, Moon or Venus, unless a cancellation applies. */
export interface MangalDoshaInfo {
  afflicted: boolean;
  /** Independent of cancellations, so `'anshik'` can pair with `afflicted: false`. */
  severity: MangalDoshaSeverity;
  fromLagna: { afflicted: boolean; house: number };
  fromMoon:  { afflicted: boolean; house: number };
  fromVenus: { afflicted: boolean; house: number };
  cancellations: string[];
}

export interface MangalCompatibility {
  boy: MangalDoshaInfo;
  girl: MangalDoshaInfo;
  /** True only when exactly one native is Manglik. */
  afflicted: boolean;
  cancellations: string[];
  description: string;
}

/** Transit Saturn through the 12th (phase 1), 1st (2) and 2nd (3) rashis from the natal Moon. */
export interface SadeSatiInfo {
  active: boolean;
  phase: 1 | 2 | 3 | null;
  currentArcStart: Date | null;
  currentArcEnd: Date | null;
  /** Only set when not currently active. */
  nextArcStart: Date | null;
}

export interface TarabalaInfo {
  /** 0..8 from the janma nakshatra, the 9-tara cycle repeating over the 27. */
  taraIndex: number;
  englishName: string;
  name: string;
  /** 'inauspicious' for Vipat (2) / Pratyari (4) / Vadha (6); 'auspicious' otherwise */
  quality: 'auspicious' | 'inauspicious';
}

/** Aspected houses counted from the graha's own house, not from the lagna (BPHS Ch. 26). */
export interface AspectMap {
  Sun: number[];
  Moon: number[];
  Mars: number[];
  Mercury: number[];
  Jupiter: number[];
  Venus: number[];
  Saturn: number[];
  Rahu: number[];
  Ketu: number[];
}

/** BPHS Ch. 27, in Virupas (1 Rupa = 60 Virupas). */
export interface PlanetShadbala {
  sthana: number;
  dig: number;
  kala: number;
  chesta: number;
  naisargika: number;
  drik: number;
  total: number;
}

export interface ShadbalaResult {
  Sun: PlanetShadbala;
  Moon: PlanetShadbala;
  Mars: PlanetShadbala;
  Mercury: PlanetShadbala;
  Jupiter: PlanetShadbala;
  Venus: PlanetShadbala;
  Saturn: PlanetShadbala;
}

export type KaalSarpSubtype =
  | 'anant' | 'kulik' | 'vasuki' | 'shankhpal'
  | 'padma' | 'mahapadma' | 'takshak' | 'karkotak'
  | 'shankhachud' | 'ghatak' | 'vishdhar' | 'sheshnag';

export interface KaalSarpDoshaInfo {
  /** True only when all 7 visible planets are between Rahu and Ketu. */
  afflicted: boolean;
  subtype: KaalSarpSubtype | null;
  /** Paritha: exactly one planet outside the axis. */
  partial: boolean;
  rahuHouse: number;
  ketuHouse: number;
}

/** Triggers: Sun conjunct Rahu or Saturn, Rahu in the 9th, or the 9th lord conjunct Rahu. */
export interface PitruDoshaInfo {
  afflicted: boolean;
  reasons: string[];
}

/** 12 cells (0 = Mesha … 11 = Meena), 0..8 bindus each from the 8 contributors. */
export type BhinnashtakaGrid = number[];

export interface AshtakavargaResult {
  /** Cell-wise sum of the 7 Bhinnashtakas, 0..56. */
  sarvashtaka: BhinnashtakaGrid;
  bhinnashtaka: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, BhinnashtakaGrid>;
  /** Trikona + Ekadhipatya Sodhana (BPHS Ch. 67); only with `{ reductions: true }`. */
  reduced?: {
    sarvashtaka: BhinnashtakaGrid;
    bhinnashtaka: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, BhinnashtakaGrid>;
  };
}

export type YogaType =
  | 'mahapurusha'
  | 'lunar'
  | 'solar'
  | 'raja'
  | 'dhana'
  | 'special'
  | 'cancellation'
  | 'negative';

/** Transliterated proper nouns, intentionally not locale-resolved. */
export type YogaName =
  | 'Ruchaka'
  | 'Bhadra'
  | 'Hamsa'
  | 'Malavya'
  | 'Sasha'
  | 'Gajakesari'
  | 'Sunapha'
  | 'Anapha'
  | 'Durudhura'
  | 'Kemadruma'
  | 'Budha-Aditya'
  | 'Veshi'
  | 'Vasi'
  | 'Ubhayachari'
  | 'Raja Yoga'
  | 'Dharma-Karmadhipati'
  | 'Vipareeta Raja Yoga'
  | 'Lakshmi Yoga'
  | 'Dhana Yoga (2-11)'
  | 'Dhana Yoga (5-9)'
  | 'Vasumati Yoga'
  | 'Vargottama'
  | 'Yogakaraka'
  | 'Neecha Bhanga'
  | 'Daridra Yoga';

export interface Yoga {
  name: YogaName;
  type: YogaType;
  reasons: string[];
  /** Only on the Mahapurusha yogas and Gajakesari; a matched yoga can still have `applies: true`. */
  bhanga?: { applies: boolean; reasons: string[] };
}

/** The 7 Chara Karakas, Parashara variant, ranked from the highest degree-in-rashi down. */
export type KarakaName =
  | 'Atmakaraka'
  | 'Amatyakaraka'
  | 'Bhratrukaraka'
  | 'Matrukaraka'
  | 'Putrakaraka'
  | 'Gnatikaraka'
  | 'Darakaraka';

export type JaiminiKarakas = Record<KarakaName, GrahaName>;

/** Jaimini variant: Pitrukaraka inserted at rank 5, between Matrukaraka and Putrakaraka. */
export type Karaka8Name = KarakaName | 'Pitrukaraka';

/** Adds Rahu, whose effective degree is `30 − degreeInRashi` because it is permanently retrograde. */
export type Jaimini8Karakas = Record<Karaka8Name, GrahaName>;

/** BPHS Ch. 27 house strength in Virupas; `drik` is clamped to ≥ 0. */
export interface BhavaBalaPerHouse {
  bhavadhipati: number;
  dik: number;
  drik: number;
  sthana: number;
  total: number;
}

export interface BhavaBalaResult {
  houses: BhavaBalaPerHouse[];
}

/** Upadesa Sutras Ch. 1: count from the bhava as many houses as the bhava is from its lord. */
export interface Arudha {
  bhava: number;
  arudhaRashi: number;
  arudhaRashiName: string;
  arudhaLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
}

/** Rates from sunrise: `'hora'` 30°/h, `'ghati'` 75°/h, `'bhava'` 15°/h. */
export type SpecialLagnaKind = 'hora' | 'ghati' | 'bhava' | 'sripati';

export interface UpagrahaPosition {
  longitude: number;
  rashi: number;
  rashiName: string;
  /** Whole-sign house 1..12 from the natal lagna. */
  house: number;
}

export interface Upagrahas {
  /** Start of Saturn's eighth of the day or of the night (BPHS Ch. 5). */
  gulika: UpagrahaPosition;
  /** Midpoint of that same eighth. */
  mandi: UpagrahaPosition;
  dhuma: UpagrahaPosition;
  vyatipata: UpagrahaPosition;
  parivesha: UpagrahaPosition;
  indrachapa: UpagrahaPosition;
  upaketu: UpagrahaPosition;
}

export interface ArgalaPerBhava {
  bhava: number;
  argala: PlanetPlacement[];
  virodhargala: PlanetPlacement[];
  /** The 5/9 trine variant, only under `{ includeTrikonargala: true }`; Ketu's role is reversed. */
  trikona?: {
    sources: PlanetPlacement[];
    virodhakas: PlanetPlacement[];
  };
}
