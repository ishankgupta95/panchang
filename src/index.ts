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
export {
  computeVimshottariDasha, computeVimshottariDashaFromBirth,
  computeAshtottariDasha, computeYoginiDasha, computeCharaDasha,
  ASHTOTTARI_ORDER, ASHTOTTARI_YEARS,
  YOGINI_ORDER, YOGINI_YEARS, YOGINI_PLANET,
  CHARA_RASHI_YEARS,
} from './jyotish/dasha';
export type {
  YoginiName, YoginiMahaDasha, YoginiAntarDasha, YoginiDashaResult,
  CharaMahaDasha, CharaDashaResult,
} from './jyotish/dasha';
export { computeChandraBalam } from './jyotish/chandraBalam';
export { computeTarabala } from './jyotish/tarabala';
export { computeLagna } from './jyotish/lagna';
export { computeBhava } from './jyotish/bhava';
export { computeRashiChart, computeNavamsa } from './jyotish/charts';
export { computeDivisionalChart } from './jyotish/divisionals';
export { computeAshtakoot } from './jyotish/matching';
export type { NatalMoon, KootName, KootScore, AshtakootResult } from './jyotish/matching';
export { computeMangalDosha, computeKaalSarp, computePitruDosha } from './jyotish/doshas';
export { computeSadeSati } from './jyotish/sadeSati';
export { computeDignity } from './jyotish/dignity';
export type { Dignity } from './jyotish/dignity';
export { computeVimshottariPratyantar } from './jyotish/dasha';
export { computeAspects } from './jyotish/aspects';
export type { AspectsOptions } from './jyotish/aspects';
export { computeShadbala, computeBhavaBala } from './jyotish/shadbala';
export { computeAshtakavarga } from './jyotish/ashtakavarga';
export { computeYogas } from './jyotish/yogas';
export type { ComputeYogasOptions } from './jyotish/yogas';
export { computeJaiminiKarakas } from './jyotish/karakas';

// Astronomy utilities
export { computeSunrise as getSunrise, computeSunset as getSunset } from './astronomy/sunrise';
export { getMoonrise, getMoonset } from './astronomy/moonrise';
export { getSiderealSunLongitude } from './astronomy/sun';
export { getSiderealMoonLongitude } from './astronomy/moon';
export { computeAyanamsa as getAyanamsa } from './astronomy/ayanamsa';

// Inauspicious periods & muhurta
export { computeRahuKalam, computeGulikaKalam, computeYamaganda } from './core/inauspicious';
export { computeVarjyam } from './core/varjyam';
export { computeGandaMula } from './core/gandaMula';
export { computeAnandadiYoga } from './core/anandadiYoga';
export { computePanchakaRahita } from './core/panchakaRahita';
export { computeDoGhati } from './core/doGhati';
export {
  computeAbhijitMuhurta, computeBrahmaMuhurta,
  computeVijayaMuhurta, computeGodhuliMuhurta,
  computeNishitaMuhurta, computeAmritKala,
  computeMadhyahna, computePratahSandhya, computeSayahnaSandhya,
} from './core/muhurta';
export { computeGowriPanchangam } from './core/gowri';

// Eclipses (Grahan)
export {
  getUpcomingSolarEclipse, getUpcomingLunarEclipse, getEclipseDuringDay,
} from './astronomy/eclipse';

// Muhurta scoring engine + stock rules
export { scoreMuhurta, findAuspiciousDates } from './muhurta/engine';
export type {
  MuhurtaRule, MuhurtaScore, MuhurtaDay, MuhurtaScoreOptions,
} from './muhurta/engine';
export {
  vivahRule, grihaPraveshRule, namakaranaRule, vidyarambhRule,
  vahanKharidiRule, annaprashanRule, mundanRule, upanayanamRule,
  karnavedhaRule, aksharabhyasamRule, seemanthamRule, shopOpeningRule,
  travelStartRule, STOCK_MUHURTA_RULES,
} from './muhurta/rules';

// Calendar conversion + yearly listings
export {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear, computeSamvat,
} from './calendar/convert';
export type { HinduCalendarCoords, ConvertOptions } from './calendar/convert';
export {
  getEkadashiDatesForYear, getSankrantisForYear,
  getFestivalsInRange, getUpcomingEclipses,
} from './calendar/yearly';
export type {
  YearlyListingOptions, FestivalDay, SankrantiEvent,
} from './calendar/yearly';

// Types
export type {
  GeoLocation,
  PanchangOptions, InstantPanchangOptions, BirthChartOptions,
  AyanamsaType, Language, Precision, MasaSystem, FestivalRegion, LegacyFestivalRegion,
  HouseSystem,
  DailyPanchangResult, InstantPanchangResult,
  TithiInfo, NakshatraInfo, YogaInfo, KaranaInfo, VaraInfo, MasaInfo,
  DailyTithiInfo, DailyNakshatraInfo, DailyYogaInfo, DailyKaranaInfo,
  ChandraMasaInfo, SamvatInfo, RashiInfo,
  ChoghadiyaSlot, ChoghadiyaInfo, ChoghadiyaQuality,
  DoGhatiSlot, DoGhatiInfo,
  HoraSlot, HoraInfo,
  GowriSlot, GowriInfo,
  SpecialYogaInfo, FestivalInfo,
  BhadraInfo,
  GandaMulaInfo,
  AnandadiYogaInfo,
  TimePeriod,
  PanchangErrorCode,
  // Jyotish types
  GrahaName, GrahaPosition, PlanetaryPositions,
  DashaLord, AntarDasha, PratyantarDasha, MahaDasha, VimshottariDashaResult,
  ChandraBalamInfo, TarabalaInfo,
  LagnaInfo, HouseInfo, BhavaChart,
  PlanetPlacement, BirthChart, DivisionalChart, Divisional,
  MangalDoshaInfo, SadeSatiInfo,
  AspectMap, PlanetShadbala, ShadbalaResult,
  KaalSarpDoshaInfo, KaalSarpSubtype, PitruDoshaInfo,
  AshtakavargaResult, BhinnashtakaGrid,
  Yoga, YogaName, YogaType,
  KarakaName, JaiminiKarakas,
  BhavaBalaPerHouse, BhavaBalaResult,
} from './types';

// Errors
export { PanchangError } from './types/errors';
