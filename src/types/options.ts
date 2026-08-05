export type AyanamsaType =
  | 'lahiri'
  | 'raman'
  | 'krishnamurti'
  | 'true-chitra'
  | 'thirukanitham';
export type Language = 'en' | 'hi';
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

/**
 * An optional, individually-skippable block of `getDailyPanchang` work.
 *
 * Only the blocks backed by *ephemeris searches* are listed here — those are
 * the ones with measurable cost. Everything else a daily panchang returns
 * (the five elements, slot systems, muhurtas, inauspicious periods, masa /
 * samvat / rashi) is arithmetic over the sunrise-sunset-nextSunrise triplet
 * and is always computed, because skipping it would save nothing.
 *
 * - `'festivals'`    — festival detection. The most expensive block: it needs
 *                      the prior day's sunrise/sunset, the following day's
 *                      transit, per-kala tithi anchors, and the prior day's
 *                      Chandra Masa.
 * - `'eclipse'`      — eclipse overlapping the Hindu day.
 * - `'moonTimes'`    — `moonrise` / `moonset`.
 * - `'lunarWindows'` — Bhadra, Varjyam and Panchaka-Rahita windows, each of
 *                      which binary-searches lunar longitude across the day.
 *
 * Omitting a section leaves its result fields at their documented empty value
 * (`null`, or `[]`), never a partially-filled one — so this is purely a
 * cost/detail trade, not a change in the result's shape.
 */
export type PanchangSection = 'festivals' | 'eclipse' | 'moonTimes' | 'lunarWindows';

export interface PanchangOptions extends InstantPanchangOptions {
  /** UTC offset in minutes (e.g. 330 for IST) or a tz string. Required. */
  timezone: number | string;
  /**
   * Which optional, ephemeris-backed sections to compute. Defaults to all of
   * them, so omitting this is exactly the pre-existing behaviour.
   *
   * Pass a narrower list when a caller only needs part of the result — a
   * date-scanner reading nothing but the tithi at sunrise, say, or a calendar
   * builder that wants festivals but no moon times.
   *
   * ```typescript
   * // Tithi-only scan: skips every ephemeris search the day doesn't need.
   * getDailyPanchang(d, loc, { timezone: 330, sections: [], computeEndTimes: false });
   * ```
   *
   * See {@link PanchangSection} for what each value covers and why the rest of
   * the result is always computed.
   *
   * **Narrowing is exactly output-neutral.** Every field a narrowed run does
   * compute is identical — to the millisecond — to what a full run would have
   * produced; narrowing only decides what is *skipped*, never what a computed
   * value is. This holds because `LongitudeCache` memoizes on the exact
   * instant, so its contents can never depend on which blocks ran first.
   *
   * (This was not always so. While the memo keyed on a 60-second bucket but
   * stored the value computed at the first instant to fall in it, transition
   * times could shift by up to 63 s depending on which sections were requested,
   * and the element *count* could differ on a day whose last element was
   * shorter than the search tolerance. Both are fixed.)
   */
  sections?: readonly PanchangSection[];
}
