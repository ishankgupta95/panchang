export type AyanamsaType =
  | 'lahiri'
  | 'raman'
  | 'krishnamurti'
  | 'true-chitra'
  | 'thirukanitham';
export type Language = 'en' | 'hi';
export type MasaSystem = 'purnimanta' | 'amanta';

/** Default `'whole-sign'`; `'placidus-kp'` throws `PanchangError` ('CIRCUMPOLAR') above |φ| ≈ 66.5°. */
export type HouseSystem = 'whole-sign' | 'equal' | 'placidus-kp';

export interface BirthChartOptions {
  /** Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Defaults to `'en'`. */
  language?: Language;
  houseSystem?: HouseSystem;
  /** Rahu/Ketu node model; default `'mean'` (Meeus polynomial). */
  nodeType?: 'mean' | 'true';
}

/** Default `'all'`; a narrower value keeps that region's festivals plus pan-Indian ones, and `sankranti` always. */
export type FestivalRegion =
  | 'all'
  | 'tamil-nadu'
  | 'kerala'
  | 'karnataka'
  | 'andhra-pradesh'
  | 'telangana'
  | 'west-bengal'
  | 'odisha'
  | 'assam'
  | 'bihar'
  | 'jharkhand'
  | 'gujarat'
  | 'maharashtra'
  | 'goa'
  | 'rajasthan'
  | 'punjab'
  | 'haryana'
  | 'himachal-pradesh'
  | 'uttarakhand'
  | 'uttar-pradesh'
  | 'madhya-pradesh'
  | 'nepal';

/** @deprecated Use the equivalent {@link FestivalRegion} value; `'north-india'` maps to `'all'`. Removal in v6. */
export type LegacyFestivalRegion = 'tamil' | 'bengal' | 'north-india';

export interface InstantPanchangOptions {
  ayanamsa?: AyanamsaType;
  language?: Language;
  computeEndTimes?: boolean;
  /** Default `'purnimanta'` (North Indian). */
  masaSystem?: MasaSystem;
  /** Janma Moon rashi, 0 = Mesha … 11 = Meena. Omit to skip `chandraBalam`. */
  janmaRashi?: number;
  /** Janma nakshatra, 0 = Ashwini … 26 = Revati. Omit to skip `tarabala`. */
  janmaNakshatra?: number;
  region?: FestivalRegion | LegacyFestivalRegion;
}

/** A skipped section leaves its fields at their empty value (`null` or `[]`), never partially filled. */
export type PanchangSection = 'festivals' | 'eclipse' | 'moonTimes' | 'lunarWindows';

export interface PanchangOptions extends InstantPanchangOptions {
  /** UTC offset in minutes (e.g. 330 for IST) or a tz string. */
  timezone: number | string;
  /** Defaults to all sections; narrowing is output-neutral to the millisecond. */
  sections?: readonly PanchangSection[];
}
