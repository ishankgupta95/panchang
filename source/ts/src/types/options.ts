export type AyanamsaType =
  | 'lahiri'
  | 'raman'
  | 'krishnamurti'
  | 'true-chitra'
  | 'thirukanitham';
export type Language = 'en' | 'hi';
export type MasaSystem = 'purnimanta' | 'amanta';

/** Default `'whole-sign'`; beyond the polar circles (|φ| > about 66.56°) `'placidus-kp'` can throw
 *  `PanchangError` ('CIRCUMPOLAR' or 'PLACIDUS_DIVERGED'). */
export type HouseSystem = 'whole-sign' | 'equal' | 'placidus-kp';

export interface BirthChartOptions {
  /** Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Defaults to `'en'`. */
  language?: Language;
  /** Defaults to `'whole-sign'`. Any other string, `''` included, throws `INVALID_INPUT` (the Go port reads its empty string as the default). */
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
  /** Default `true`. `false` leaves every anga `endTime` null and each daily anga list at its sunrise entry; the daily `specialYogas` still cover every tithi and nakshatra of the day. */
  computeEndTimes?: boolean;
  /** Default `'purnimanta'` (North Indian). */
  masaSystem?: MasaSystem;
  /** Janma Moon rashi, 0 = Mesha … 11 = Meena. Omit (or pass `null`) to skip `chandraBalam`. */
  janmaRashi?: number;
  /** Janma nakshatra, 0 = Ashwini … 26 = Revati. Omit (or pass `null`) to skip `tarabala`. */
  janmaNakshatra?: number;
  region?: FestivalRegion | LegacyFestivalRegion;
}

/**
 * An optional block of the daily result. A skipped section leaves its own fields at their empty value
 * (`null` or `[]`), with these couplings: `'festivals'` also fills `moon.rise` and `inauspicious.bhadra`,
 * which it needs, and `'eclipse'` adds its grahan entry to `festivals` even when `'festivals'` is off
 * (so `['festivals']` alone lists no grahan).
 */
export type PanchangSection = 'festivals' | 'eclipse' | 'moonTimes' | 'lunarWindows';

export interface PanchangOptions extends InstantPanchangOptions {
  /**
   * UTC offset in minutes (e.g. 330 for IST) or a tz string. Required: untyped JS that omits it gets the host's
   * zone, where the Go port reports INVALID_TIMEZONE. `''` and `'Local'` are not IANA names and throw
   * TIMEZONE_RESOLUTION_FAILED here, while Go's Zone("") reads UTC and Zone("Local") the host's zone.
   */
  timezone: number | string;
  /** Defaults to all sections. A narrowed call's values equal the full call's to the millisecond, except that `festivals` lacks the grahan entry unless `'eclipse'` is requested too. */
  sections?: readonly PanchangSection[];
}
