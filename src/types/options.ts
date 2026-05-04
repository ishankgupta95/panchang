export type AyanamsaType =
  | 'lahiri'
  | 'raman'
  | 'krishnamurti'
  | 'true-chitra'
  | 'thirukanitham';
export type Language = 'en' | 'hi';
export type Precision = 'standard' | 'high';
export type MasaSystem = 'purnimanta' | 'amanta';

/**
 * House (bhava) system used to derive the 12 house cusps from the lagna.
 *
 * - `'whole-sign'` (default, classical Vedic) — each rashi is exactly one
 *    house starting from the lagna's sign. House cusps fall at 0° of each
 *    rashi.
 * - `'equal'` — each house spans exactly 30°, starting at the lagna's exact
 *    degree. House cusps are lagna, lagna+30°, lagna+60°, …
 * - `'placidus-kp'` — Placidus cusps (used in KP astrology). The above-
 *    horizon ecliptic arc between Asc and MC is divided into thirds in
 *    semi-arc time, with the same partitioning mirrored below the horizon.
 *    Undefined for circumpolar latitudes (|φ| ≳ 66.5°); the API throws
 *    `PanchangError` ('CIRCUMPOLAR') in that case.
 */
export type HouseSystem = 'whole-sign' | 'equal' | 'placidus-kp';

/**
 * Options for birth-chart computations (lagna, bhava, divisional charts,
 * planetary positions). Distinct from {@link InstantPanchangOptions} because
 * birth-chart APIs do not depend on a panchang's daily window — only on the
 * birth instant and location.
 */
export interface BirthChartOptions {
  /** Sidereal system. Defaults to `'lahiri'`. */
  ayanamsa?: AyanamsaType;
  /** Output language for `name` fields. Defaults to `'en'`. */
  language?: Language;
  /** House system for `computeBhava` / chart helpers. Defaults to `'whole-sign'`. */
  houseSystem?: HouseSystem;
  /**
   * Rahu/Ketu node calculation:
   *   - `'mean'` (default) — fast Meeus polynomial; ±0.5° typical, ±2° worst.
   *   - `'true'` — Meeus + dominant periodic correction; ±0.6° typical.
   */
  nodeType?: 'mean' | 'true';
}

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

/**
 * Common options shared by `getInstantPanchang` and `getDailyPanchang`.
 * `getDailyPanchang` extends this with a required `timezone`.
 */
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
   * Native's janma (birth) Moon nakshatra index (0 = Ashwini … 26 = Revati).
   * When provided, the result includes `tarabala` — the 9-tara cycle position
   * of the transit Moon's nakshatra relative to janma. Omit to skip Tarabala.
   */
  janmaNakshatra?: number;
  /**
   * Regional scope for region-specific festival variants. Default `'all'`.
   * See {@link FestivalRegion} for supported regions; pre-v2.1 values
   * ({@link LegacyFestivalRegion}) are accepted and mapped internally.
   */
  region?: FestivalRegion | LegacyFestivalRegion;
}

export interface PanchangOptions extends InstantPanchangOptions {
  /** UTC offset in minutes (e.g. 330 for IST) or a tz string. Required. */
  timezone: number | string;
}
