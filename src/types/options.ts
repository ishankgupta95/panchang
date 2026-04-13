export type AyanamsaType = 'lahiri' | 'raman' | 'krishnamurti';
export type Language = 'en' | 'sa' | 'hi';
export type Precision = 'standard' | 'high';
export type MasaSystem = 'purnimanta' | 'amanta';

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
}
