// ── Public API for panchang-ts ────────────────────────
//
// Naming convention:
//   - `get*`     — simple retrievers returning a single value at an instant
//                  (getSunrise, getMoonrise, getAyanamsa, getSidereal*Longitude)
//                  and the two top-level panchang entry points.
//   - `compute*` — synthesize a multi-field structured result from derived
//                  astronomical inputs (computePlanetaryPositions,
//                  computeVimshottariDasha, computeRahuKalam, …).
//
// This file is the sole public surface. Anything not re-exported here is
// @internal and may change in any release. After v1.0.0 every export below
// becomes a semver-stable contract — breaking changes require a major bump.

// Primary entry points
export { getDailyPanchang, getInstantPanchang } from './core/panchang';

// Jyotish (Vedic astrology) — planetary positions, dasha, Chandra Balam
export { computePlanetaryPositions, GRAHA_ABBR } from './jyotish/planets';
export { computeVimshottariDasha, computeVimshottariDashaFromBirth } from './jyotish/dasha';
export { computeChandraBalam } from './jyotish/chandraBalam';

// Astronomy utilities
export { computeSunrise as getSunrise, computeSunset as getSunset } from './astronomy/sunrise';
export { getMoonrise, getMoonset } from './astronomy/moonrise';
export { getSiderealSunLongitude } from './astronomy/sun';
export { getSiderealMoonLongitude } from './astronomy/moon';
export { computeAyanamsa as getAyanamsa } from './astronomy/ayanamsa';

// Inauspicious periods & muhurta
export { computeRahuKalam, computeGulikaKalam, computeYamaganda } from './core/inauspicious';
export { computeAbhijitMuhurta, computeBrahmaMuhurta } from './core/muhurta';
export { computeGowriPanchangam } from './core/gowri';

// Types
export type {
  GeoLocation,
  PanchangOptions, InstantPanchangOptions,
  AyanamsaType, Language, Precision, MasaSystem,
  DailyPanchangResult, InstantPanchangResult,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, MasaInfo,
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  ChandraMasaInfo, SamvatInfo, RashiInfo,
  ChoghadiyaSlot, ChoghadiyaInfo, ChoghadiyaQuality,
  HoraSlot, HoraInfo,
  GowriSlot, GowriInfo,
  SpecialYogaInfo, FestivalInfo,
  BhadraInfo,
  TimePeriod,
  PanchangErrorCode,
  // Jyotish types
  GrahaName, GrahaPosition, PlanetaryPositions,
  DashaLord, AntarDasha, MahaDasha, VimshottariDashaResult,
  ChandraBalamInfo,
} from './types';

// Errors
export { PanchangError } from './types/errors';
