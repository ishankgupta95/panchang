import type { FestivalInfo } from '../types/elements';
import type { FestivalRegion } from '../types/options';

export type { FestivalRegion };

export type FestivalDateRule =
  | 'sunrise'
  | 'madhyahna'
  | 'aparahna'
  | 'aparahna-full'
  | 'pradosha'
  | 'nishita'
  | 'janmashtami-nishita'
  | 'chandrodaya';

/**
 * How the day is chosen when a {@link DayGeometry} is supplied; `dateRule` is the sample test used without
 * one. Windows: madhyahna is the third fifth of the daytime, pradosha the first fifth of the night, nishita
 * the 8th of 15 night muhurtas, arunodaya the 96 minutes before sunrise. A sunrise rule with no `select`
 * takes the first of two udaya days.
 */
type TithiSelection =
  /** Every day whose sunrise holds the tithi, vriddhi days included (Phagli, pending a regional capture). */
  | 'udaya-each'
  /** The later of two udaya days (Tritiya vratas joined with Chaturthi, Rath Yatra's Dwitiya with Tritiya). */
  | 'udaya-last'
  /** The first udaya day with 3 muhurtas of the tithi after sunrise, else the day the tithi begins. */
  | 'trimuhurta'
  /** The day whose window holds more of the tithi, the earlier on a tie; no overlap falls back to udaya. */
  | 'madhyahna'
  | 'pradosha'
  | 'daytime'
  /** The last day whose window touches the tithi (Rama Navami rejects Ashtami-viddha Navami). */
  | 'madhyahna-last'
  | 'aparahna-last'
  /** The first full aparahna, else the larger overlap; none, udaya. Then `udayaNakshatra` may move it a day. */
  | 'aparahna'
  /** One full nishita wins, two full the later, else the larger overlap; none, the civil day it begins. */
  | 'nishita'
  /** The first day whose arunodaya touches the tithi, else the day it begins. */
  | 'arunodaya'
  /** The first day whose sunrise + 2/5 daytime (end of sangava) follows the tithi's start. */
  | 'sangava-start'
  /** The first day whose sunset less 2 muhurtas follows the tithi's start. */
  | 'navami-start'
  /** The Holika Dahan ladder on Phalguna Purnima: pradosha free of Bhadra, else Bhadra-puchha. */
  | 'holika';

/** `skip` and `shift-to-nija` are deliberately identical: one Nija per masa index per year. */
type AdhikaBehaviour = 'skip' | 'shift-to-nija' | 'observe-in-both';

/** Keyed by exactly one of: masa+tithi, solarMasa+nakshatra, masa+nakshatra, masa+vara. */
interface FestivalRule {
  key: string;
  type: 'major' | 'minor';
  masa?: number;
  tithi?: number;
  solarMasa?: number;
  nakshatra?: number;
  vara?: number;
  dateRule?: FestivalDateRule;
  bhadraExclude?: boolean;
  adhikaBehaviour?: AdhikaBehaviour;
  /** Naming only. Diwali is "Kartika Amavasya" Purnimanta, "Ashwin" Amanta. */
  namingSystem?: 'amanta' | 'purnimanta';
  /** Allow-list; omitted → pan-Indian. `'all'` marks a listed rule universal. */
  regions?: readonly FestivalRegion[];
  tithiRange?: readonly [number, number];
  /** Kshaya anchor: `contain` gives it to the day that holds it, `exclude` drops it. */
  kshayaRule?: 'contain' | 'exclude';
  /** Confine the anchor to one paksha, judged on the sunrise tithi. */
  paksha?: 'shukla' | 'krishna';
  /** Which day wins when the anchor pervades the kala on two consecutive days. Default first. */
  kalaPrefers?: 'first' | 'last';
  /** Kala the anchor NAKSHATRA must pervade. Default sunrise; Sama Upakarma is aparahna. */
  nakshatraDateRule?: FestivalDateRule;
  /** Second choice, used only when the anchor is absent from the rest of the paksha. */
  fallbackNakshatra?: number;
  /** Day choice with a day geometry. */
  select?: TithiSelection;
  /** The festival falls `anchorOffset` days after the day chosen for `anchorTithi` (default `tithi`). */
  anchorTithi?: number;
  anchorOffset?: number;
  /** A later udaya day holding this nakshatra at sunrise and in the kala takes over from a day without it. */
  udayaNakshatra?: number;
  /** The `vara` falls in the 7 days ending on this tithi's udaya day. */
  varaBeforeTithi?: number;
  /** masa+vara only: judge the month in the caller's masaSystem (Nepal: the solar month), not always amanta. */
  followsMasaSystem?: boolean;
}

interface SankrantiRegionalRule {
  key: string;
  regions: readonly FestivalRegion[];
  type: 'major' | 'minor';
}

const SANKRANTI_REGIONAL: Readonly<Record<number, readonly SankrantiRegionalRule[]>> = {
  0: [
    { key: 'puthandu',         regions: ['tamil-nadu'],           type: 'major' },
    { key: 'bohag_bihu',       regions: ['assam'],                type: 'major' },
  ],
  3: [
    { key: 'dakshinayana',     regions: ['all'],                  type: 'minor' },
    { key: 'raja_sankranti',   regions: ['odisha'],               type: 'major' },
    { key: 'harela',           regions: ['uttarakhand'],          type: 'major' },
  ],
  4: [
    { key: 'singh_sankranti',  regions: ['odisha', 'bihar', 'jharkhand', 'nepal'], type: 'minor' },
  ],
  5: [
    { key: 'sair',             regions: ['himachal-pradesh'],     type: 'minor' },
  ],
  6: [
    { key: 'kati_bihu',        regions: ['assam'],                type: 'minor' },
  ],
  9: [
    { key: 'makar_sankranti',    regions: ['all'],                type: 'major' },
    { key: 'pongal',             regions: ['tamil-nadu'],         type: 'major' },
    { key: 'uttarayan',          regions: ['gujarat'],            type: 'major' },
    { key: 'magh_bihu',          regions: ['assam'],              type: 'major' },
    { key: 'ayyappa_makara_jyothi', regions: ['kerala'],          type: 'major' },
  ],
};

const LOHRI_REGIONS: readonly FestivalRegion[] = ['punjab', 'haryana', 'himachal-pradesh'];

/** Raja Parba: the days before, of and after Karka Sankranti; no 4th day. */
const RAJA_REGIONS: readonly FestivalRegion[] = ['odisha'];

/** Karthigai Deepam replaces that day's Masik Karthigai; elsewhere the day stays Masik Karthigai. */
const KARTHIGAI_DEEPAM_REGIONS: readonly FestivalRegion[] = ['tamil-nadu'];

/**
 * Chandra masa (Amanta) 0=Chaitra … 11=Phalguna; tithi 0=Shukla Pratipada … 14=Purnima …
 * 15=Krishna Pratipada … 29=Amavasya; nakshatra 0=Ashwini … 26=Revati; solar masa 0=Mesha … 11=Meena.
 */
const FESTIVAL_REGISTRY: readonly FestivalRule[] = [
  { key: 'ugadi',              masa: 0,  tithi: 0,  type: 'major' },
  { key: 'rama_navami',        masa: 0,  tithi: 8,  type: 'major', dateRule: 'madhyahna', adhikaBehaviour: 'shift-to-nija',
    select: 'madhyahna-last' },
  { key: 'hanuman_jayanti',    masa: 0,  tithi: 14, type: 'major' },
  { key: 'akshaya_tritiya',    masa: 1,  tithi: 2,  type: 'major', dateRule: 'madhyahna', select: 'trimuhurta' },
  { key: 'parashurama_jayanti', masa: 1, tithi: 2,  type: 'major', dateRule: 'madhyahna', select: 'pradosha' },
  { key: 'guru_purnima',       masa: 3,  tithi: 14, type: 'major' },
  { key: 'nag_panchami',       masa: 4,  tithi: 4,  type: 'minor', select: 'trimuhurta' },
  { key: 'raksha_bandhan',     masa: 4,  tithi: 14, type: 'major', bhadraExclude: true, select: 'trimuhurta' },
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major', dateRule: 'janmashtami-nishita', adhikaBehaviour: 'shift-to-nija' },
  { key: 'ganesh_chaturthi',   masa: 5,  tithi: 3,  type: 'major', dateRule: 'madhyahna', select: 'madhyahna' },
  { key: 'anant_chaturdashi',  masa: 5,  tithi: 13, type: 'major' },
  { key: 'navaratri',          masa: 6,  tithi: 0,  type: 'major' },
  { key: 'durga_ashtami',      masa: 6,  tithi: 7,  type: 'major' },
  { key: 'maha_navami',        masa: 6,  tithi: 8,  type: 'major', select: 'navami-start' },
  { key: 'dussehra',           masa: 6,  tithi: 9,  type: 'major', dateRule: 'aparahna-full', select: 'aparahna',
    udayaNakshatra: 21 },
  { key: 'sharad_purnima',     masa: 6,  tithi: 14, type: 'major' },
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major', dateRule: 'chandrodaya', namingSystem: 'purnimanta' },
  { key: 'dhanteras',          masa: 6,  tithi: 27, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta',
    select: 'pradosha' },
  { key: 'narak_chaturdashi',  masa: 6,  tithi: 28, type: 'major', namingSystem: 'purnimanta',
    select: 'arunodaya' },
  { key: 'diwali',             masa: 6,  tithi: 29, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta',
    select: 'pradosha' },
  { key: 'kartika_purnima',    masa: 7,  tithi: 14, type: 'minor' },
  { key: 'vasant_panchami',    masa: 10, tithi: 4,  type: 'major', dateRule: 'madhyahna', select: 'sangava-start' },
  { key: 'maha_shivaratri',    masa: 10, tithi: 28, type: 'major', dateRule: 'nishita', select: 'nishita' },
  { key: 'holika_dahan',       masa: 11, tithi: 14, type: 'major', select: 'holika' },
  { key: 'holi',               masa: 11, tithi: 14, type: 'major', select: 'holika', anchorOffset: 1 },
  { key: 'mahalaya_amavasya',  masa: 5,  tithi: 29, type: 'major' },
  { key: 'chhath_nahay_khay',       masa: 7, tithi: 3, type: 'major', anchorTithi: 5, anchorOffset: -2 },
  { key: 'chhath_kharna',           masa: 7, tithi: 4, type: 'major', anchorTithi: 5, anchorOffset: -1 },
  { key: 'chhath_sandhya_arghya',   masa: 7, tithi: 5, type: 'major' },
  { key: 'chhath_usha_arghya',      masa: 7, tithi: 6, type: 'major', anchorTithi: 5, anchorOffset: 1 },
  { key: 'vat_savitri_amavasya', masa: 1, tithi: 29, type: 'major',
    dateRule: 'aparahna', kalaPrefers: 'last', select: 'aparahna-last' },
  { key: 'vat_savitri_purnima',  masa: 2, tithi: 14, type: 'major' },
  { key: 'yajur_upakarma',       masa: 4, tithi: 14, type: 'major', select: 'trimuhurta' },
  { key: 'shravan_somvar',   masa: 4,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both', followsMasaSystem: true },
  { key: 'mangala_gauri',    masa: 4,  vara: 2, type: 'minor', adhikaBehaviour: 'observe-in-both', followsMasaSystem: true },
  { key: 'kartik_somvar',    masa: 7,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both', followsMasaSystem: true },
  { key: 'magha_shanivar',   masa: 10, vara: 6, type: 'minor', adhikaBehaviour: 'observe-in-both', followsMasaSystem: true },
  { key: 'onam',               solarMasa: 4, nakshatra: 21, type: 'major', adhikaBehaviour: 'observe-in-both' },
  { key: 'rig_upakarma',       masa: 4, nakshatra: 21, type: 'major',
    paksha: 'shukla', fallbackNakshatra: 12 },
  { key: 'sama_upakarma',      masa: 5, nakshatra: 12, type: 'major',
    paksha: 'shukla', nakshatraDateRule: 'aparahna' },

  { key: 'gudi_padwa',         masa: 0,  tithi: 0,  type: 'major',
    regions: ['maharashtra', 'goa'] },
  { key: 'gangaur',            masa: 0,  tithi: 2,  type: 'major', select: 'udaya-last',
    regions: ['rajasthan'] },
  { key: 'karaga',             masa: 0,  tithi: 14, type: 'major',
    regions: ['karnataka'] },
  { key: 'bonalu',             masa: 3,  vara: 0,   type: 'minor',
    adhikaBehaviour: 'observe-in-both',
    regions: ['telangana'] },
  { key: 'hariyali_teej',      masa: 4,  tithi: 2,  type: 'major', select: 'udaya-last',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'haryana', 'madhya-pradesh'] },
  { key: 'kajari_teej',        masa: 4,  tithi: 17, type: 'major', select: 'udaya-last',
    regions: ['rajasthan', 'uttar-pradesh', 'madhya-pradesh'] },
  { key: 'hartalika_teej',     masa: 5,  tithi: 2,  type: 'major', select: 'udaya-last',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'maharashtra', 'madhya-pradesh'] },
  { key: 'govardhan_puja',     masa: 7,  tithi: 0,  type: 'major', select: 'daytime',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'rajasthan', 'gujarat',
              'madhya-pradesh', 'punjab', 'jharkhand'] },
  { key: 'bhai_dooj',          masa: 7,  tithi: 1,  type: 'major', select: 'aparahna-last',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'maharashtra', 'gujarat',
              'rajasthan', 'madhya-pradesh', 'west-bengal', 'jharkhand', 'nepal'] },
  { key: 'phagli',             masa: 11, tithi: 14, type: 'minor', select: 'udaya-each',
    regions: ['himachal-pradesh'], kshayaRule: 'exclude' },
  { key: 'jagannath_rath_yatra', masa: 3, tithi: 1, type: 'major', select: 'udaya-last' },
  { key: 'varamahalakshmi',    masa: 4,  vara: 5,  type: 'major',
    tithiRange: [7, 13], varaBeforeTithi: 14,
    regions: ['karnataka', 'andhra-pradesh', 'telangana', 'tamil-nadu'] },
  { key: 'bathukamma_start',   masa: 5,  tithi: 29, type: 'major',
    regions: ['telangana'] },
  { key: 'bathukamma_saddula', masa: 6,  tithi: 7,  type: 'major',
    regions: ['telangana'] },
];

/** Named by (amantaMasa, paksha): paksha 0 = Shukla (tithi 10), 1 = Krishna (tithi 25). */
const EKADASHI_NAMES: readonly (readonly [string, string])[] = [
  ['kamada',     'papamochani'],
  ['mohini',     'varuthini'],
  ['nirjala',    'apara'],
  ['devshayani', 'yogini'],
  ['putrada',    'kamika'],       // Putrada = Pavitra
  ['parivartini','aja'],
  ['pashankusha','indira'],
  ['prabodhini', 'rama'],
  ['mokshada',   'utpanna'],
  ['pausha_putrada', 'saphala'],
  ['jaya',       'shattila'],
  ['amalaki',    'vijaya'],
];

const ADHIKA_EKADASHI_NAMES: readonly [string, string] = ['padmini', 'parama'];

/** Named Pradosha by vara; sources disagree on paksha, so vara alone names it. */
const PRADOSHA_NAMES: readonly string[] = [
  'ravi_pradosha',
  'som_pradosha',
  'bhauma_pradosha',
  'saumya_pradosha',
  'guru_pradosha',
  'bhrigu_pradosha',
  'shani_pradosha',
];

/** One Hindu day, epoch milliseconds. */
export interface KalaDay {
  sunrise: number;
  sunset: number;
  nextSunrise: number;
}

/** The days around today and the instants the tithi-selection rules measure kala windows against. */
export interface DayGeometry {
  today: KalaDay;
  /** Hindu day `k` days from today (`day(0)` is `today`); `null` past a polar gap. */
  day: (k: number) => KalaDay | null;
  tithiAt: (ms: number) => number;
  nakshatraAt: (ms: number) => number;
  /**
   * The instant, to 1 s, at which the Moon-Sun elongation reaches `deg` for the crossing nearest `nearMs`.
   * Bracketed on a fixed 6 h grid, so every day that asks gets the same instant.
   */
  elongationReaches: (deg: number, nearMs: number) => number;
  /** Local civil day number of an instant (days since 1970-01-01 local). */
  localDay: (ms: number) => number;
}

/** Index fields are taken at sunrise. */
export interface FestivalComputeContext {
  tithiIndex: number;
  nakshatraIndex: number;
  /** Krittika's day: the first day it holds a sunset, else the day it holds a sunrise. Absent: Krittika at sunrise. */
  masikKarthigaiToday?: boolean;
  /** Of the Masik Karthigai days in Tamil Karthigai (Sun in Vrischika at sunset), the one nearest that month's full moon. Lazy. */
  karthigaiDeepamToday?: () => boolean;
  /** Nakshatra at each kala's opening and closing instant, mirroring the tithi ladder. */
  nakshatraByRule?: Partial<Record<FestivalDateRule, number>>;
  nakshatraByRuleStart?: Partial<Record<FestivalDateRule, number>>;
  /** Nakshatra at YESTERDAY's sunrise, for the vriddha guard. */
  priorDayNakshatraIndex?: number;
  /** Nakshatra at TOMORROW's sunrise: a solar-month nakshatra touching neither sunrise is kshaya today. */
  nextDayNakshatraIndex?: number;
  /** Solar masa at YESTERDAY's sunrise, so a vriddha pair straddling the month start keeps its in-month day. */
  priorDaySolarMasaIndex?: number;
  /** Another transit of the nakshatra gets a day later in today's solar month. Lazy: only a solar-month rule asks. */
  nakshatraLaterInSolarMonth?: (nakshatra: number) => boolean;
  /** Nakshatras on a sunrise in the rest of this paksha. Lazy: only `fallbackNakshatra` asks. */
  remainingPakshaSunriseNakshatras?: () => ReadonlySet<number>;
  /** Tithi at TOMORROW's kala samples. Lazy: only a `kalaPrefers: 'last'` rule asks. */
  nextDayTithiByRule?: () => {
    start: Partial<Record<FestivalDateRule, number>>;
    end: Partial<Record<FestivalDateRule, number>>;
  };
  /** Nakshatra at TOMORROW's kala samples, for the later-day dedupe. Lazy. */
  nextDayNakshatraByRule?: () => {
    start: Partial<Record<FestivalDateRule, number>>;
    end: Partial<Record<FestivalDateRule, number>>;
  };
  /** Tithis current at neither sunrise. Omitted by the location-free call site in `panchang.ts`. */
  kshayaTithiIndices?: ReadonlySet<number>;
  /** Amanta masa at the NEXT sunrise. Read only for a kshaya Shukla Pratipada. */
  nextDayMasaIndex?: number;
  nextDayIsAdhika?: boolean;
  /** Lazy amanta masa at the NEXT sunrise, for a span that opens a month after today's sunrise. */
  nextDayMasa?: () => { index: number; isAdhika: boolean };
  /** Absent (the instant path), every rule falls back to its `dateRule` samples. */
  dayGeometry?: DayGeometry;
  /** Amanta. */
  chandraMasaIndex: number;
  /** Month for `followsMasaSystem` rules: the caller's masaSystem, or the Nepali solar month. Absent: amanta. */
  varaMasaIndex?: number;
  amantaMasaName?: string;
  purnimantaMasaName?: string;
  isAdhika: boolean;
  varaIndex: number;
  solarMasaIndex: number;
  /** Missing entries fall back to `tithiIndex`. */
  tithiByRule?: Partial<Record<FestivalDateRule, number>>;
  /** Kala START tithi; `tithiByRule` holds the end. */
  tithiByRuleStart?: Partial<Record<FestivalDateRule, number>>;
  priorDayTithiByRule?: Partial<Record<FestivalDateRule, number>>;
  priorDayTithiByRuleStart?: Partial<Record<FestivalDateRule, number>>;
  /** Absent, `janmashtami-nishita` degrades to plain nishita prevalence. */
  janmashtamiNishita?: {
    ashtamiAtNishita: boolean;
    rohiniAtNishita: boolean;
    /** Tomorrow is the udaya-Ashtami day and its nishita has Ashtami or Rohini. */
    nextDayClaims: boolean;
    /** Yesterday was an udaya-Ashtami day that already claimed (vriddha). */
    prevDayClaimed: boolean;
  };
  sankrantiRashi?: number | null;
  nextDaySankrantiRashi?: number | null;
  prevDaySankrantiRashi?: number | null;
  vaisakhiToday?: boolean;
  vishuToday?: boolean;
  pohelaBoishakhToday?: boolean;
  /** Dashami still active at arunodaya (~96 min before sunrise). */
  ekadashiDashamiViddha?: boolean;
  vaishnavaDwadashiToday?: boolean;
  /** The whole Ekadashi tithi falls between two sunrises. */
  ekadashiKshayaToday?: boolean;
  /** Day after a kshaya Ekadashi: the Vaishnava ("Gauna") fast. */
  ekadashiGaunaToday?: boolean;
  ekadashiVriddhaDwadashiToday?: boolean;
  ekadashiVriddhaDwadashiTomorrow?: boolean;
  /** Trisprisha: no sunrise inside Dwadashi, so the fast advances to day 1. */
  ekadashiTrisprishaToday?: boolean;
  ekadashiTrisprishaYesterday?: boolean;
  /** Ekadashi at today's AND tomorrow's sunrise: the fast is tomorrow, unless `ekadashiVriddhaTrisprisha`. */
  ekadashiVriddhaFirstDay?: boolean;
  /** Vriddha day 1 whose Dwadashi touches no sunrise: the Smarta fast is today, the Vaishnava tomorrow. */
  ekadashiVriddhaTrisprisha?: boolean;
  bhadra?: { start: Date; end: Date } | null;
  /** Already offset-adjusted for local display. */
  formatClock?: (d: Date) => string;
  region?: FestivalRegion;
}

type KalaWindow = (d: KalaDay) => readonly [number, number];

const ARUNODAYA_MS = 96 * 60_000;

/** Pradosha is three night muhurtas, nishita the 8th of fifteen. */
const KALA: Readonly<Record<'madhyahna' | 'aparahna' | 'pradosha' | 'nishita' | 'daytime' | 'arunodaya', KalaWindow>> = {
  madhyahna: (d) => [
    Math.trunc(d.sunrise + ((d.sunset - d.sunrise) * 2) / 5),
    Math.trunc(d.sunrise + ((d.sunset - d.sunrise) * 3) / 5),
  ],
  aparahna: (d) => [
    Math.trunc(d.sunrise + ((d.sunset - d.sunrise) * 3) / 5),
    Math.trunc(d.sunrise + ((d.sunset - d.sunrise) * 4) / 5),
  ],
  pradosha: (d) => [d.sunset, Math.trunc(d.sunset + (d.nextSunrise - d.sunset) / 5)],
  nishita: (d) => [
    Math.trunc(d.sunset + ((d.nextSunrise - d.sunset) * 7) / 15),
    Math.trunc(d.sunset + ((d.nextSunrise - d.sunset) * 8) / 15),
  ],
  daytime: (d) => [d.sunrise, d.sunset],
  arunodaya: (d) => [d.sunrise - ARUNODAYA_MS, d.sunrise],
};

interface TithiSpan {
  start: number;
  end: number;
}

/** Day choice for the tithi rules, measured on the anchor tithi's span against today's and its neighbours' windows. */
function tithiSelector(ctx: FestivalComputeContext, g: DayGeometry) {
  const today = g.today;
  const sunriseTithis = new Map<number, number | null>();
  const sunriseTithi = (k: number): number | null => {
    let t = sunriseTithis.get(k);
    if (t === undefined) {
      const d = g.day(k);
      t = d === null ? null : g.tithiAt(d.sunrise);
      sunriseTithis.set(k, t);
    }
    return t;
  };
  const spans = new Map<number, TithiSpan>();
  const spanOf = (tithi: number): TithiSpan => {
    let sp = spans.get(tithi);
    if (sp === undefined) {
      const near = today.sunrise;
      sp = {
        start: g.elongationReaches(tithi * 12, near),
        end: g.elongationReaches(((tithi + 1) % 30) * 12, near),
      };
      spans.set(tithi, sp);
    }
    return sp;
  };
  /** Today's sunrise tithi less `tithi`, in [-15, 14]. */
  const offset = (tithi: number): number => ((ctx.tithiIndex - tithi + 45) % 30) - 15;
  const overlap = (w: KalaWindow, d: KalaDay | null, sp: TithiSpan): number => {
    if (d === null) return 0;
    const [a, b] = w(d);
    return Math.max(0, Math.min(b, sp.end) - Math.max(a, sp.start));
  };
  const full = (w: KalaWindow, d: KalaDay | null, sp: TithiSpan): boolean => {
    if (d === null) return false;
    const [a, b] = w(d);
    return sp.start <= a && b <= sp.end;
  };
  const udayaIn = (d: KalaDay | null, sp: TithiSpan): boolean =>
    d !== null && sp.start <= d.sunrise && d.sunrise < sp.end;
  const startsIn = (d: KalaDay | null, sp: TithiSpan): boolean =>
    d !== null && d.sunrise <= sp.start && sp.start < d.nextSunrise;
  /** Day `k` is the first whose sunrise the span holds, else the day holding the whole span. */
  const udayaFirstAt = (sp: TithiSpan, k: number): boolean =>
    udayaIn(g.day(k), sp)
      ? !udayaIn(g.day(k - 1), sp)
      : startsIn(g.day(k), sp) && !udayaIn(g.day(k + 1), sp);
  const udayaFirst = (sp: TithiSpan): boolean => udayaFirstAt(sp, 0);

  /** Sunrise samples at day `k`: the tithi at its sunrise, or a kshaya tithi that day holds. */
  const udayaAt = (tithi: number, k: number, last: boolean): boolean => {
    const t = sunriseTithi(k);
    if (t === null) return false;
    if (t === tithi) return sunriseTithi(last ? k + 1 : k - 1) !== tithi;
    const next = sunriseTithi(k + 1);
    return next !== null && (tithi - t + 30) % 30 === 1 && (next - tithi + 30) % 30 === 1;
  };

  const maxOverlap = (tithi: number, w: KalaWindow, fallback: boolean): boolean => {
    const sp = spanOf(tithi);
    const yesterday = g.day(-1);
    const tomorrow = g.day(1);
    const o0 = overlap(w, today, sp);
    const oPrev = overlap(w, yesterday, sp);
    const oNext = overlap(w, tomorrow, sp);
    if (o0 > 0) {
      const f0 = full(w, today, sp);
      const beatsPrev = f0 && full(w, yesterday, sp) ? false : o0 > oPrev;
      const beatsNext = f0 && full(w, tomorrow, sp) ? true : o0 >= oNext;
      return beatsPrev && beatsNext;
    }
    return fallback && oPrev === 0 && oNext === 0 && udayaFirst(sp);
  };

  const lastOverlap = (tithi: number, w: KalaWindow): boolean => {
    const sp = spanOf(tithi);
    const oNext = overlap(w, g.day(1), sp);
    if (overlap(w, today, sp) > 0) return oNext === 0;
    return oNext === 0 && overlap(w, g.day(-1), sp) === 0 && udayaFirst(sp);
  };

  /** Day `k`'s claim: the first full aparahna, else the larger overlap (earlier on a tie), else udaya. */
  const aparahnaLadder = (sp: TithiSpan, k: number): boolean => {
    const w = KALA.aparahna;
    const d = g.day(k);
    const prev = g.day(k - 1);
    const next = g.day(k + 1);
    if (d === null) return false;
    if (full(w, d, sp)) return !full(w, prev, sp);
    if (full(w, prev, sp) || full(w, next, sp)) return false;
    const o = overlap(w, d, sp);
    const oPrev = overlap(w, prev, sp);
    const oNext = overlap(w, next, sp);
    if (o > 0) return o > oPrev && o >= oNext;
    return oPrev === 0 && oNext === 0 && udayaFirstAt(sp, k);
  };

  /**
   * Vijayadashami: a next day with Dashami and the nakshatra at sunrise, and the nakshatra in its aparahna,
   * takes over from a ladder day whose aparahna lacks the nakshatra (Nirnaya Sindhu: udaye dasami kimcit ...
   * sravanarksam yada kale sa tithir vijayabhidha).
   */
  const vijaya = (tithi: number, nakshatra: number | undefined): boolean => {
    const sp = spanOf(tithi);
    if (nakshatra === undefined) return aparahnaLadder(sp, 0);
    const has = (d: KalaDay): boolean => {
      const [a, b] = KALA.aparahna(d);
      return g.nakshatraAt(a) === nakshatra || g.nakshatraAt(b) === nakshatra;
    };
    const moves = (k: number): boolean => {
      const d = g.day(k);
      const next = g.day(k + 1);
      return d !== null && next !== null && udayaIn(next, sp) && g.nakshatraAt(next.sunrise) === nakshatra &&
        !has(d) && has(next);
    };
    if (aparahnaLadder(sp, 0)) return !moves(0);
    return aparahnaLadder(sp, -1) && moves(-1);
  };

  const nishitaLadder = (tithi: number): boolean => {
    const sp = spanOf(tithi);
    const w = KALA.nishita;
    const yesterday = g.day(-1);
    const tomorrow = g.day(1);
    if (full(w, today, sp)) return !full(w, tomorrow, sp);
    if (full(w, yesterday, sp) || full(w, tomorrow, sp)) return false;
    const o0 = overlap(w, today, sp);
    const oPrev = overlap(w, yesterday, sp);
    const oNext = overlap(w, tomorrow, sp);
    if (o0 > 0) return o0 > oPrev && o0 >= oNext;
    return oPrev === 0 && oNext === 0 && g.localDay(sp.start) === g.localDay(today.sunrise);
  };

  const arunodayaFirst = (tithi: number): boolean => {
    const sp = spanOf(tithi);
    const w = KALA.arunodaya;
    const oPrev = overlap(w, g.day(-1), sp);
    if (overlap(w, today, sp) > 0) return oPrev === 0;
    return oPrev === 0 && overlap(w, g.day(1), sp) === 0 && startsIn(today, sp);
  };

  const trimuhurta = (tithi: number): boolean => {
    const sp = spanOf(tithi);
    const lasts = (d: KalaDay): boolean => (sp.end - d.sunrise) * 15 >= (d.sunset - d.sunrise) * 3;
    if (udayaIn(today, sp)) return !udayaIn(g.day(-1), sp) && lasts(today);
    if (!startsIn(today, sp)) return false;
    const tomorrow = g.day(1);
    return tomorrow === null || !udayaIn(tomorrow, sp) || !lasts(tomorrow);
  };

  /** Cut at sunrise + num/den of the daytime: the first day whose cut follows the tithi's start. */
  const startsBefore = (tithi: number, num: number, den: number): boolean => {
    const sp = spanOf(tithi);
    const cut = (d: KalaDay): number => Math.trunc(d.sunrise + ((d.sunset - d.sunrise) * num) / den);
    if (sp.start >= cut(today)) return false;
    const yesterday = g.day(-1);
    return yesterday === null || sp.start >= cut(yesterday);
  };

  let holikaMemo: number | null | undefined;
  /** Holika Dahan's day relative to today: Nirnaya Sindhu's pradosha, Bhadra and prahara ladder. */
  const holikaDay = (): number | null => {
    if (holikaMemo !== undefined) return holikaMemo;
    holikaMemo = null;
    const sp = spanOf(14);
    let k0: number | null = null;
    for (let k = -3; k <= 2 && k0 === null; k++) if (startsIn(g.day(k), sp)) k0 = k;
    if (k0 === null) return null;
    const bhadraEnd = g.elongationReaches(174, today.sunrise);
    const w = KALA.pradosha;
    const bhadraFree = (k: number): boolean => {
      const d = g.day(k);
      if (d === null) return false;
      const [a, b] = w(d);
      return Math.max(a, bhadraEnd) < Math.min(b, sp.end);
    };
    const hits = [k0, k0 + 1].filter((k) => overlap(w, g.day(k), sp) > 0);
    if (hits.length === 2) {
      holikaMemo = bhadraFree(k0) ? k0 : bhadraFree(k0 + 1) ? k0 + 1 : k0;
    } else if (hits.length === 1) {
      const h = hits[0]!;
      const d = g.day(h)!;
      const next = g.day(h + 1);
      holikaMemo = h;
      if (!bhadraFree(h) && bhadraEnd >= Math.trunc(d.sunset + (d.nextSunrise - d.sunset) / 2) && next !== null) {
        const remaining = sp.end - next.sunrise;
        const daytime = next.sunset - next.sunrise;
        const pratipadaLonger = () => g.elongationReaches(192, today.sunrise) - sp.end > sp.end - sp.start;
        if (remaining * 8 >= daytime * 7 || (remaining * 4 >= daytime * 3 && pratipadaLonger())) holikaMemo = h + 1;
      }
    } else {
      holikaMemo = sp.start < g.day(k0)!.sunset ? k0 : k0 + 1;
    }
    return holikaMemo;
  };

  const near = (tithi: number, lo: number, hi: number): boolean => {
    const o = offset(tithi);
    return o >= lo && o <= hi;
  };

  return {
    /** Whether today is the rule's day; masa and adhika are the caller's. */
    selects(rule: FestivalRule, tithi: number): boolean {
      const k = 0 - (rule.anchorOffset ?? 0);
      switch (rule.select) {
        case undefined: return near(tithi, -k - 2, -k + 2) && udayaAt(tithi, k, false);
        case 'udaya-last': return near(tithi, -1, 0) && udayaAt(tithi, 0, true);
        case 'trimuhurta': return near(tithi, -1, 0) && trimuhurta(tithi);
        case 'madhyahna': return near(tithi, -1, 0) && maxOverlap(tithi, KALA.madhyahna, true);
        case 'pradosha': return near(tithi, -1, 0) && maxOverlap(tithi, KALA.pradosha, true);
        case 'daytime': return near(tithi, -1, 0) && maxOverlap(tithi, KALA.daytime, true);
        case 'madhyahna-last': return near(tithi, -1, 0) && lastOverlap(tithi, KALA.madhyahna);
        case 'aparahna-last': return near(tithi, -1, 0) && lastOverlap(tithi, KALA.aparahna);
        case 'aparahna': return near(tithi, -1, 0) && vijaya(tithi, rule.udayaNakshatra);
        case 'nishita': return near(tithi, -1, 0) && nishitaLadder(tithi);
        case 'arunodaya': return near(tithi, -1, 1) && arunodayaFirst(tithi);
        case 'sangava-start': return near(tithi, -1, 0) && startsBefore(tithi, 2, 5);
        case 'navami-start': return near(tithi, -1, 0) && startsBefore(tithi, 13, 15);
        case 'holika': return near(tithi, -1, 2) && holikaDay() === k;
        case 'udaya-each': return ctx.tithiIndex === tithi;
      }
    },
    /** Masa of a span that opens the next month after today's sunrise. */
    nextMonth(): { index: number; isAdhika: boolean } {
      return ctx.nextDayMasa?.() ?? {
        index: ctx.nextDayMasaIndex ?? ctx.chandraMasaIndex,
        isAdhika: ctx.nextDayIsAdhika ?? ctx.isAdhika,
      };
    },
    /** Masik Shivaratri and Pradosh vrat: one day per span; a Trayodashi touching no pradosha has none. */
    shivaratri: (): boolean => near(28, -1, 0) && nishitaLadder(28),
    vinayaka: (): boolean => near(3, -1, 0) && maxOverlap(3, KALA.madhyahna, true),
    pradosh: (tithi: number): boolean => near(tithi, -1, 0) && maxOverlap(tithi, KALA.pradosha, false),
    /** The Friday (or any `vara`) in the 7 days that end on the tithi's udaya day. */
    varaBefore(tithi: number): boolean {
      if (!near(tithi, -9, 0)) return false;
      for (let k = 0; k < 7; k++) if (udayaAt(tithi, k, false)) return true;
      return false;
    },
  };
}

function ekadashiNameKey(masaIndex: number, paksha: 0 | 1, isAdhika: boolean): string {
  if (isAdhika) return `ekadashi_${ADHIKA_EKADASHI_NAMES[paksha]}`;
  const names = EKADASHI_NAMES[masaIndex];
  if (!names) return 'ekadashi';
  return `ekadashi_${names[paksha]}`;
}

/** Festivals for a Hindu day (sunrise to next sunrise). */
export function computeFestivals(
  ctx: FestivalComputeContext,
  nameResolver: (key: string) => string,
  rashiNameResolver?: (index: number) => string,
): FestivalInfo[] {
  const results: FestivalInfo[] = [];

  const nakshatraPrevails = (rule: FestivalRule, nakshatra: number): boolean => {
    const dateRule = rule.nakshatraDateRule ?? 'sunrise';
    if (dateRule === 'sunrise') {
      return ctx.nakshatraIndex === nakshatra && ctx.priorDayNakshatraIndex !== nakshatra;
    }
    const prevailsToday =
      ctx.nakshatraByRuleStart?.[dateRule] === nakshatra ||
      ctx.nakshatraByRule?.[dateRule] === nakshatra;
    if (!prevailsToday) return false;
    const next = ctx.nextDayNakshatraByRule?.();
    return (
      next === undefined ||
      (next.start[dateRule] !== nakshatra && next.end[dateRule] !== nakshatra)
    );
  };

  const tithiForRule = (rule: FestivalDateRule): number => {
    if (rule === 'sunrise') return ctx.tithiIndex;
    return ctx.tithiByRule?.[rule] ?? ctx.tithiIndex;
  };
  const tithiForRuleStart = (rule: FestivalDateRule): number | undefined => {
    if (rule === 'sunrise') return ctx.tithiIndex;
    return ctx.tithiByRuleStart?.[rule];
  };
  const priorDayTithiForRule = (rule: FestivalDateRule): number | undefined => {
    if (rule === 'sunrise') return undefined;
    return ctx.priorDayTithiByRule?.[rule];
  };

  /** Vyapini test: EITHER end of the kala counts, so the dedupes below prevent both days. */
  const prevailsInKala = (targetTithi: number, dateRule: FestivalDateRule, prefersLast = false): boolean => {
    if (dateRule === 'janmashtami-nishita') {
      const jn = ctx.janmashtamiNishita;
      if (jn === undefined) {
        return prevailsInKala(targetTithi, 'nishita');
      }
      if (ctx.tithiIndex === targetTithi) {
        return (jn.ashtamiAtNishita || jn.rohiniAtNishita) && !jn.prevDayClaimed;
      }
      return jn.ashtamiAtNishita && !jn.nextDayClaims;
    }
    if (dateRule === 'aparahna-full') {
      const startTithi = ctx.tithiByRuleStart?.aparahna;
      const endTithi = ctx.tithiByRule?.aparahna;
      const priorStartTithi = ctx.priorDayTithiByRuleStart?.aparahna;
      const priorEndTithi = ctx.priorDayTithiByRule?.aparahna;
      const fullToday = startTithi === targetTithi && endTithi === targetTithi;
      const fullYesterday = priorStartTithi === targetTithi && priorEndTithi === targetTithi;
      if (fullToday) return !fullYesterday;
      if (fullYesterday) return false;
      const currentToday =
        ctx.tithiIndex === targetTithi ||
        startTithi === targetTithi ||
        ctx.tithiByRule?.madhyahna === targetTithi;
      return currentToday && endTithi !== targetTithi;
    }
    const endTithi = tithiForRule(dateRule);
    const startTithi = tithiForRuleStart(dateRule);
    const priorEndTithi = priorDayTithiForRule(dateRule);
    if (prefersLast && dateRule !== 'sunrise') {
      const next = ctx.nextDayTithiByRule?.();
      if (next !== undefined && (next.start[dateRule] === targetTithi || next.end[dateRule] === targetTithi)) {
        return false;
      }
    }

    if (dateRule === 'chandrodaya') {
      if (endTithi === targetTithi) return priorEndTithi !== targetTithi;
      return ctx.tithiIndex === targetTithi && priorEndTithi !== targetTithi;
    }

    const matchedByEnd = endTithi === targetTithi;
    const matchedByStart =
      dateRule !== 'sunrise' &&
      startTithi !== undefined &&
      startTithi === targetTithi &&
      endTithi !== targetTithi;
    if (!matchedByEnd && !matchedByStart) return false;

    if (
      !prefersLast &&
      dateRule !== 'sunrise' &&
      startTithi !== undefined &&
      startTithi !== targetTithi &&
      priorEndTithi === targetTithi
    ) return false;

    if (!prefersLast && matchedByStart && priorEndTithi === targetTithi) return false;

    return true;
  };

  const pushRule = (rule: FestivalRule): void => {
    if (rule.regions !== undefined) {
      const region: FestivalRegion = ctx.region ?? 'all';
      if (region !== 'all' && !rule.regions.includes('all') && !rule.regions.includes(region)) return;
    }

    const festival: FestivalInfo = {
      key: rule.key,
      name: nameResolver(rule.key),
      type: rule.type,
    };

    if (
      rule.namingSystem === 'purnimanta' &&
      ctx.purnimantaMasaName &&
      ctx.amantaMasaName
    ) {
      festival.description = nameResolver('desc_purnimanta_krishna_paksha')
        .replace('{masa}', ctx.purnimantaMasaName);
    }

    if (rule.bhadraExclude && ctx.bhadra && ctx.formatClock) {
      const bhadraEndStr = ctx.formatClock(ctx.bhadra.end);
      festival.description = nameResolver('desc_bhadra_observe_after')
        .replace('{time}', bhadraEndStr);
    }

    results.push(festival);
  };

  const selector = ctx.dayGeometry === undefined ? null : tithiSelector(ctx, ctx.dayGeometry);

  for (const rule of FESTIVAL_REGISTRY) {
    const adhikaBehaviour: AdhikaBehaviour = rule.adhikaBehaviour ?? 'skip';
    const dateRule = rule.dateRule ?? 'sunrise';
    if (
      selector !== null &&
      rule.masa !== undefined &&
      rule.tithi !== undefined &&
      rule.select !== 'udaya-each' &&
      (rule.select !== undefined || dateRule === 'sunrise')
    ) {
      const anchor = rule.anchorTithi ?? rule.tithi;
      if (!selector.selects(rule, anchor)) continue;
      const masa = ctx.tithiIndex - anchor > 15
        ? selector.nextMonth()
        : { index: ctx.chandraMasaIndex, isAdhika: ctx.isAdhika };
      if (masa.isAdhika && adhikaBehaviour !== 'observe-in-both') continue;
      if (masa.index !== rule.masa) continue;
      pushRule(rule);
      continue;
    }
    const kshaya =
      rule.masa !== undefined &&
      rule.tithi !== undefined &&
      rule.nakshatra === undefined &&
      rule.vara === undefined &&
      dateRule === 'sunrise' &&
      (rule.kshayaRule ?? 'contain') === 'contain' &&
      ctx.kshayaTithiIndices?.size === 1 &&
      ctx.kshayaTithiIndices.has(rule.tithi);
    /** A kshaya Shukla Pratipada belongs to the month it opens, tomorrow's, so the adhika guards judge that one. */
    const useNextDayMasa = kshaya && rule.tithi === 0;
    const masaIndex = useNextDayMasa ? ctx.nextDayMasaIndex ?? ctx.chandraMasaIndex : ctx.chandraMasaIndex;
    const isAdhika = useNextDayMasa ? ctx.nextDayIsAdhika ?? ctx.isAdhika : ctx.isAdhika;

    if (isAdhika && adhikaBehaviour === 'skip') continue;
    if (isAdhika && adhikaBehaviour === 'shift-to-nija') continue;

    let match = false;
    if (rule.nakshatra !== undefined && rule.solarMasa !== undefined) {
      /** One day per solar month: vriddha takes the first sunrise, kshaya the day holding it, two transits the later. */
      if (rule.solarMasa === ctx.solarMasaIndex) {
        const n = rule.nakshatra;
        const vriddhaSecondDay =
          ctx.priorDayNakshatraIndex === n &&
          (ctx.priorDaySolarMasaIndex ?? ctx.solarMasaIndex) === rule.solarMasa;
        const firstSunrise = ctx.nakshatraIndex === n && !vriddhaSecondDay;
        const kshayaNakshatra =
          ctx.nextDayNakshatraIndex !== undefined &&
          ctx.nakshatraIndex === (n + 26) % 27 &&
          ctx.nextDayNakshatraIndex === (n + 1) % 27;
        match = (firstSunrise || kshayaNakshatra) && ctx.nakshatraLaterInSolarMonth?.(n) !== true;
      }
    } else if (rule.nakshatra !== undefined && rule.masa !== undefined) {
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      const pakshaMatches =
        rule.paksha === undefined || (rule.paksha === 'shukla') === (ctx.tithiIndex < 15);
      if (masaMatches && pakshaMatches) {
        match =
          nakshatraPrevails(rule, rule.nakshatra) ||
          (rule.fallbackNakshatra !== undefined &&
            nakshatraPrevails(rule, rule.fallbackNakshatra) &&
            ctx.remainingPakshaSunriseNakshatras?.().has(rule.nakshatra) === false);
      }
    } else if (rule.vara !== undefined && rule.masa !== undefined) {
      const varaMasa = rule.followsMasaSystem === true
        ? ctx.varaMasaIndex ?? ctx.chandraMasaIndex
        : ctx.chandraMasaIndex;
      const masaMatches =
        rule.masa === varaMasa &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      let inTithiRange = true;
      if (selector !== null && rule.varaBeforeTithi !== undefined) {
        inTithiRange = rule.vara === ctx.varaIndex && selector.varaBefore(rule.varaBeforeTithi);
      } else if (rule.tithiRange !== undefined) {
        const tithi = tithiForRule(dateRule);
        const [lo, hi] = rule.tithiRange;
        inTithiRange = tithi >= lo && tithi <= hi;
      }
      match = masaMatches && rule.vara === ctx.varaIndex && inTithiRange;
    } else if (rule.masa !== undefined && rule.tithi !== undefined) {
      const masaMatches =
        rule.masa === masaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !isAdhika) &&
        (adhikaBehaviour !== 'skip' || !isAdhika);
      if (masaMatches) {
        match = kshaya || prevailsInKala(rule.tithi, dateRule, rule.kalaPrefers === 'last');
      }
    }

    if (!match) continue;
    pushRule(rule);
  }

  const isEkadashiAtSunrise = ctx.tithiIndex === 10 || ctx.tithiIndex === 25;
  const paksha: 0 | 1 = ctx.tithiIndex === 10 ? 0 : ctx.tithiIndex === 25 ? 1 : 0;

  if (isEkadashiAtSunrise && ctx.ekadashiVriddhaTrisprisha) {
    const namedDescription = nameResolver(ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika));
    results.push({
      key: 'smarta_ekadashi',
      name: nameResolver('smarta_ekadashi'),
      type: 'smarta_ekadashi',
      description: namedDescription,
    });
    results.push({
      key: 'ekadashi',
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
      description: namedDescription,
    });
  } else if (isEkadashiAtSunrise && ctx.ekadashiVriddhaFirstDay) {
  } else if (isEkadashiAtSunrise && ctx.ekadashiTrisprishaYesterday) {
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver(ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika)),
    });
  } else if (isEkadashiAtSunrise) {
    const namedKey = ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika);
    const namedDescription = nameResolver(namedKey);

    const vaishnavaTomorrow =
      ctx.ekadashiDashamiViddha === true || ctx.ekadashiVriddhaDwadashiTomorrow === true;
    if (!vaishnavaTomorrow) {
      results.push({
        key: 'vaishnava_ekadashi',
        name: nameResolver('vaishnava_ekadashi'),
        type: 'vaishnava_ekadashi',
        description: namedDescription,
      });
    }
    results.push({
      key: 'smarta_ekadashi',
      name: nameResolver('smarta_ekadashi'),
      type: 'smarta_ekadashi',
      description: namedDescription,
    });
    results.push({
      key: 'ekadashi',
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
      description: ctx.ekadashiDashamiViddha === true
        ? nameResolver('desc_ekadashi_viddha_vaishnava_next')
        : ctx.ekadashiVriddhaDwadashiTomorrow === true
          ? nameResolver('desc_ekadashi_vriddha_dwadashi_next')
          : namedDescription,
    });
  } else if (ctx.ekadashiTrisprishaToday) {
    const triPaksha: 0 | 1 = ctx.tithiIndex === 9 ? 0 : 1;
    const namedDescription = nameResolver(
      ekadashiNameKey(ctx.chandraMasaIndex, triPaksha, ctx.isAdhika),
    );
    results.push({
      key: 'smarta_ekadashi',
      name: nameResolver('smarta_ekadashi'),
      type: 'smarta_ekadashi',
      description: namedDescription,
    });
    results.push({
      key: 'ekadashi',
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
      description: namedDescription,
    });
  } else if (ctx.ekadashiKshayaToday) {
    const kshayaPaksha: 0 | 1 = ctx.tithiIndex === 9 ? 0 : 1;
    const namedDescription = nameResolver(
      ekadashiNameKey(ctx.chandraMasaIndex, kshayaPaksha, ctx.isAdhika),
    );
    results.push({
      key: 'smarta_ekadashi',
      name: nameResolver('smarta_ekadashi'),
      type: 'smarta_ekadashi',
      description: namedDescription,
    });
    results.push({
      key: 'ekadashi',
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
      description: namedDescription,
    });
  } else if (ctx.ekadashiGaunaToday) {
    const gaunaPaksha: 0 | 1 = ctx.tithiIndex === 11 ? 0 : 1;
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver(
        ekadashiNameKey(ctx.chandraMasaIndex, gaunaPaksha, ctx.isAdhika),
      ),
    });
  } else if (ctx.vaishnavaDwadashiToday) {
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver('desc_ekadashi_viddha_vaishnava_today'),
    });
  } else if (ctx.ekadashiVriddhaDwadashiToday) {
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver('desc_ekadashi_vriddha_dwadashi_vaishnava'),
    });
  }

  if (prevailsInKala(18, 'chandrodaya')) {
    results.push({ key: 'sankashti_chaturthi', name: nameResolver('sankashti_chaturthi'), type: 'major' });
  }

  {
    const isMahaShivaratriMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 10;
    if (!isMahaShivaratriMonth && (selector !== null ? selector.shivaratri() : prevailsInKala(28, 'nishita'))) {
      results.push({ key: 'masik_shivaratri', name: nameResolver('masik_shivaratri'), type: 'minor' });
    }
  }

  {
    const isGaneshChaturthiMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 5;
    if (!isGaneshChaturthiMonth && (selector !== null ? selector.vinayaka() : prevailsInKala(3, 'madhyahna'))) {
      results.push({ key: 'vinayaka_chaturthi', name: nameResolver('vinayaka_chaturthi'), type: 'minor' });
    }
  }

  if (ctx.nakshatraIndex === 7) {
    if (ctx.varaIndex === 0) {
      results.push({ key: 'ravi_pushya', name: nameResolver('ravi_pushya'), type: 'minor' });
    } else if (ctx.varaIndex === 4) {
      results.push({ key: 'guru_pushya', name: nameResolver('guru_pushya'), type: 'minor' });
    }
  }

  if (ctx.masikKarthigaiToday ?? ctx.nakshatraIndex === 2) {
    const region: FestivalRegion = ctx.region ?? 'all';
    const deepam =
      (region === 'all' || KARTHIGAI_DEEPAM_REGIONS.includes(region)) &&
      ctx.karthigaiDeepamToday?.() === true;
    results.push(deepam
      ? { key: 'karthigai_deepam', name: nameResolver('karthigai_deepam'), type: 'major' }
      : { key: 'masik_karthigai', name: nameResolver('masik_karthigai'), type: 'minor' });
  }

  const pradoshaTithi = tithiForRule('pradosha');
  if (
    selector !== null
      ? selector.pradosh(12) || selector.pradosh(27)
      : pradoshaTithi === 12 || pradoshaTithi === 27
  ) {
    const variantKey = PRADOSHA_NAMES[ctx.varaIndex] ?? 'pradosha';
    results.push({
      key: 'pradosha',
      name: nameResolver('pradosha'),
      type: 'pradosha',
      description: nameResolver(variantKey),
    });
  }

  const region: FestivalRegion = ctx.region ?? 'all';
  if (ctx.sankrantiRashi !== undefined && ctx.sankrantiRashi !== null) {
    const rashiName = rashiNameResolver
      ? rashiNameResolver(ctx.sankrantiRashi)
      : `Rashi ${ctx.sankrantiRashi}`;
    results.push({
      key: 'sankranti',
      name: nameResolver('sankranti'),
      type: 'sankranti',
      description: rashiName,
    });

    const regionalRules = SANKRANTI_REGIONAL[ctx.sankrantiRashi];
    if (regionalRules) {
      for (const r of regionalRules) {
        if (region !== 'all' && !r.regions.includes('all') && !r.regions.includes(region)) continue;
        results.push({
          key: r.key,
          name: nameResolver(r.key),
          type: 'sankranti',
          description: rashiName,
        });
      }
    }
  }

  {
    const MESHA_NEW_YEARS: readonly {
      flag: boolean | undefined; key: string; regions: readonly FestivalRegion[];
    }[] = [
      { flag: ctx.vaisakhiToday,       key: 'baisakhi',        regions: ['punjab', 'haryana'] },
      { flag: ctx.vishuToday,          key: 'vishu',           regions: ['kerala'] },
      { flag: ctx.pohelaBoishakhToday, key: 'pohela_boishakh', regions: ['west-bengal'] },
    ];
    for (const r of MESHA_NEW_YEARS) {
      if (r.flag !== true) continue;
      if (region !== 'all' && !r.regions.includes(region)) continue;
      results.push({
        key: r.key,
        name: nameResolver(r.key),
        type: 'sankranti',
        description: rashiNameResolver ? rashiNameResolver(0) : 'Rashi 0',
      });
    }
  }

  if (ctx.nextDaySankrantiRashi === 9) {
    if (region === 'all' || LOHRI_REGIONS.includes(region)) {
      results.push({ key: 'lohri', name: nameResolver('lohri'), type: 'major' });
    }
  }

  if (ctx.nextDaySankrantiRashi === 3) {
    if (region === 'all' || RAJA_REGIONS.includes(region)) {
      results.push({ key: 'raja_pahili', name: nameResolver('raja_pahili'), type: 'major' });
    }
  }

  if (ctx.prevDaySankrantiRashi === 3) {
    if (region === 'all' || RAJA_REGIONS.includes(region)) {
      results.push({ key: 'raja_basi', name: nameResolver('raja_basi'), type: 'major' });
    }
  }

  return results;
}
