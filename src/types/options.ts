export type AyanamsaType = 'lahiri' | 'raman' | 'krishnamurti';
export type Language = 'en' | 'hi';
export type Precision = 'standard' | 'high';
export type MasaSystem = 'purnimanta' | 'amanta';

/**
 * Regional scope for region-specific festival variants (primarily regional
 * Sankranti names — Pongal, Vishu, Baisakhi, Bihu, Ayyappa Makara Jyothi,
 * etc.). Default `'all'` emits every regional variant; narrower values
 * filter the regional variants to that region. The canonical pan-Indian
 * `sankranti` event is always emitted regardless of this setting.
 */
export type FestivalRegion =
  | 'all'
  | 'north-india'
  | 'tamil'
  | 'kerala'
  | 'bengal'
  | 'punjab'
  | 'gujarat'
  | 'assam'
  | 'maharashtra';

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
   * See {@link FestivalRegion} for supported regions.
   */
  region?: FestivalRegion;
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
   * See {@link FestivalRegion} for supported regions.
   */
  region?: FestivalRegion;
}
