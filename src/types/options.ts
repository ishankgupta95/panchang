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
}

export interface InstantPanchangOptions {
  ayanamsa?: AyanamsaType;
  language?: Language;
  computeEndTimes?: boolean;
  precision?: Precision;
  /** Lunar month naming system. Default: `'purnimanta'` (North Indian). */
  masaSystem?: MasaSystem;
}
