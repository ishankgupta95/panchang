// ── Public API for panchang-ts ────────────────────────

// Primary entry points
export { getInstantPanchang } from './core/panchang';

// Astronomy utilities
export { computeSunrise as getSunrise, computeSunset as getSunset } from './astronomy/sunrise';
export { getSiderealSunLongitude } from './astronomy/sun';
export { getSiderealMoonLongitude } from './astronomy/moon';
export { computeAyanamsa as getAyanamsa } from './astronomy/ayanamsa';

// Types
export type {
  GeoLocation,
  PanchangOptions, InstantPanchangOptions,
  AyanamsaType, Language, Precision,
  DailyPanchangResult, InstantPanchangResult,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, MasaInfo,
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  TimePeriod,
  PanchangErrorCode,
} from './types';

// Errors
export { PanchangError } from './types/errors';
