export type AyanamsaType = 'lahiri' | 'raman' | 'krishnamurti';
export type Language = 'en' | 'hi';
export type Precision = 'standard' | 'high';
export type MasaSystem = 'purnimanta' | 'amanta';

/**
 * Regional scope for region-specific festival variants. Default `'all'` emits
 * every regional variant; narrower values filter to festivals scoped to that
 * region (or pan-Indian festivals, which always emit). The canonical
 * `sankranti` event is always emitted regardless of this setting.
 *
 * State-slug naming: each value corresponds to an Indian state (or `nepal`
 * for Nepali panchang usage). The single pre-v2.1 direction-based value
 * `'north-india'` and the ethno-linguistic slugs `'tamil'` and `'bengal'`
 * are still accepted as inputs ({@link LegacyFestivalRegion}) and mapped
 * to their canonical equivalents at entry-point resolution time.
 */
export type FestivalRegion =
  | 'all'
  // South
  | 'tamil-nadu'
  | 'kerala'
  | 'karnataka'
  | 'andhra-pradesh'
  | 'telangana'
  // East
  | 'west-bengal'
  | 'odisha'
  | 'assam'
  | 'bihar'
  | 'jharkhand'
  // West
  | 'gujarat'
  | 'maharashtra'
  | 'goa'
  | 'rajasthan'
  // North / Central
  | 'punjab'
  | 'haryana'
  | 'himachal-pradesh'
  | 'uttarakhand'
  | 'uttar-pradesh'
  | 'madhya-pradesh'
  // Neighbour
  | 'nepal';

/**
 * Pre-v2.1 region identifiers accepted for back-compat. These are mapped
 * to canonical {@link FestivalRegion} values by `resolveRegionAlias` before
 * festival filtering. Slated for removal in v3.
 *
 * - `'tamil'`       → `'tamil-nadu'`
 * - `'bengal'`      → `'west-bengal'`
 * - `'north-india'` → `'all'` (Makar Sankranti is pan-Indian; use explicit
 *                              state slugs for Lohri / Govardhan / Bhai Dooj)
 *
 * @deprecated Use the equivalent {@link FestivalRegion} value. Removal in v3.
 */
export type LegacyFestivalRegion = 'tamil' | 'bengal' | 'north-india';

export interface PanchangOptions {
  timezone: number | string;
  ayanamsa?: AyanamsaType;
  language?: Language;
  computeEndTimes?: boolean;
  precision?: Precision;
  /** Lunar month naming system. Default: `'purnimanta'` (North Indian). */
  masaSystem?: MasaSystem;
  /**
   * Native's janma (birth) Moon rashi index (0 = Mesha … 11 = Meena). When
   * provided, the result includes `chandraBalam` computed against the current
   * chandraRashi. Omit to skip Chandra Balam entirely.
   */
  janmaRashi?: number;
  /**
   * Regional scope for region-specific festival variants. Default `'all'`.
   * See {@link FestivalRegion} for supported regions; pre-v2.1 values
   * ({@link LegacyFestivalRegion}) are accepted and mapped internally.
   */
  region?: FestivalRegion | LegacyFestivalRegion;
}

export interface InstantPanchangOptions {
  ayanamsa?: AyanamsaType;
  language?: Language;
  computeEndTimes?: boolean;
  precision?: Precision;
  /** Lunar month naming system. Default: `'purnimanta'` (North Indian). */
  masaSystem?: MasaSystem;
  /**
   * Native's janma (birth) Moon rashi index (0 = Mesha … 11 = Meena). When
   * provided, the result includes `chandraBalam` computed against the current
   * chandraRashi. Omit to skip Chandra Balam entirely.
   */
  janmaRashi?: number;
  /**
   * Regional scope for region-specific festival variants. Default `'all'`.
   * See {@link FestivalRegion} for supported regions; pre-v2.1 values
   * ({@link LegacyFestivalRegion}) are accepted and mapped internally.
   */
  region?: FestivalRegion | LegacyFestivalRegion;
}
