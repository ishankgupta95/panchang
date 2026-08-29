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
}

interface SankrantiRegionalRule {
  key: string;
  regions: readonly FestivalRegion[];
  type: 'major' | 'minor';
}

const SANKRANTI_REGIONAL: Readonly<Record<number, readonly SankrantiRegionalRule[]>> = {
  // Mesha (0): Vaisakhi, Vishu and Pohela Boishakh key off the transit moment, not this day.
  0: [
    { key: 'puthandu',         regions: ['tamil-nadu'],           type: 'major' },
    // Bohag Bihu sits on the transit day for want of a citable source.
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

/**
 * Chandra masa (Amanta) 0=Chaitra … 11=Phalguna; tithi 0=Shukla Pratipada … 14=Purnima …
 * 15=Krishna Pratipada … 29=Amavasya; nakshatra 0=Ashwini … 26=Revati; solar masa 0=Mesha … 11=Meena.
 */
const FESTIVAL_REGISTRY: readonly FestivalRule[] = [
  { key: 'ugadi',              masa: 0,  tithi: 0,  type: 'major' },
  { key: 'rama_navami',        masa: 0,  tithi: 8,  type: 'major', dateRule: 'madhyahna', adhikaBehaviour: 'shift-to-nija' },
  { key: 'hanuman_jayanti',    masa: 0,  tithi: 14, type: 'major' },
  { key: 'akshaya_tritiya',    masa: 1,  tithi: 2,  type: 'major', dateRule: 'madhyahna' },
  { key: 'parashurama_jayanti', masa: 1, tithi: 2,  type: 'major', dateRule: 'madhyahna' },
  { key: 'guru_purnima',       masa: 3,  tithi: 14, type: 'major' },
  { key: 'nag_panchami',       masa: 4,  tithi: 4,  type: 'minor' },
  // Classically aparahna-vyapini Purnima; modern practice uses Purnima-at-sunrise.
  { key: 'raksha_bandhan',     masa: 4,  tithi: 14, type: 'major', bhadraExclude: true },
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major', dateRule: 'janmashtami-nishita', adhikaBehaviour: 'shift-to-nija' },
  { key: 'ganesh_chaturthi',   masa: 5,  tithi: 3,  type: 'major', dateRule: 'madhyahna' },
  { key: 'anant_chaturdashi',  masa: 5,  tithi: 13, type: 'major' },
  { key: 'navaratri',          masa: 6,  tithi: 0,  type: 'major' },
  { key: 'durga_ashtami',      masa: 6,  tithi: 7,  type: 'major' },
  { key: 'maha_navami',        masa: 6,  tithi: 8,  type: 'major' },
  { key: 'dussehra',           masa: 6,  tithi: 9,  type: 'major', dateRule: 'aparahna-full' },
  { key: 'sharad_purnima',     masa: 6,  tithi: 14, type: 'major' },
  // Narak Chaturdashi stays on sunrise: its pre-dawn moon often falls outside the Hindu day.
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major', dateRule: 'chandrodaya', namingSystem: 'purnimanta' },
  { key: 'dhanteras',          masa: 6,  tithi: 27, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta' },
  { key: 'narak_chaturdashi',  masa: 6,  tithi: 28, type: 'major', namingSystem: 'purnimanta' },
  { key: 'diwali',             masa: 6,  tithi: 29, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta' },
  { key: 'kartika_purnima',    masa: 7,  tithi: 14, type: 'minor' },
  { key: 'vasant_panchami',    masa: 10, tithi: 4,  type: 'major', dateRule: 'madhyahna' },
  { key: 'maha_shivaratri',    masa: 10, tithi: 28, type: 'major', dateRule: 'nishita' },
  { key: 'holi',               masa: 11, tithi: 14, type: 'major' },
  { key: 'mahalaya_amavasya',  masa: 5,  tithi: 29, type: 'major' },
  { key: 'chhath_nahay_khay',       masa: 7, tithi: 3, type: 'major' },
  { key: 'chhath_kharna',           masa: 7, tithi: 4, type: 'major' },
  { key: 'chhath_sandhya_arghya',   masa: 7, tithi: 5, type: 'major', dateRule: 'pradosha' },
  { key: 'chhath_usha_arghya',      masa: 7, tithi: 6, type: 'major' },
  // Vat Savitri: the North observes the Amavasya, the South the Purnima.
  { key: 'vat_savitri_amavasya', masa: 2, tithi: 29, type: 'major' },
  { key: 'vat_savitri_purnima',  masa: 2, tithi: 14, type: 'major' },
  { key: 'yajur_upakarma',       masa: 4, tithi: 14, type: 'major' },
  { key: 'shravan_somvar',   masa: 4,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'mangala_gauri',    masa: 4,  vara: 2, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'kartik_somvar',    masa: 7,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'magha_shanivar',   masa: 10, vara: 6, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'onam',               solarMasa: 4, nakshatra: 21, type: 'major' },
  { key: 'rig_upakarma',       masa: 4, nakshatra: 21, type: 'major' },
  { key: 'sama_upakarma',      masa: 5, nakshatra: 12, type: 'major' },

  { key: 'gudi_padwa',         masa: 0,  tithi: 0,  type: 'major',
    regions: ['maharashtra', 'goa'] },
  { key: 'gangaur',            masa: 0,  tithi: 2,  type: 'major',
    regions: ['rajasthan'] },
  { key: 'karaga',             masa: 0,  tithi: 14, type: 'major',
    regions: ['karnataka'] },
  { key: 'bonalu',             masa: 3,  vara: 0,   type: 'minor',
    adhikaBehaviour: 'observe-in-both',
    regions: ['telangana'] },
  { key: 'hariyali_teej',      masa: 4,  tithi: 2,  type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'haryana', 'madhya-pradesh'] },
  { key: 'kajari_teej',        masa: 4,  tithi: 17, type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'madhya-pradesh'] },
  { key: 'hartalika_teej',     masa: 5,  tithi: 2,  type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'maharashtra', 'madhya-pradesh'] },
  // Amanta and Purnimanta agree on this masa name, so no namingSystem tag.
  { key: 'govardhan_puja',     masa: 7,  tithi: 0,  type: 'major',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'rajasthan', 'gujarat',
              'madhya-pradesh', 'punjab', 'jharkhand'] },
  { key: 'bhai_dooj',          masa: 7,  tithi: 1,  type: 'major',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'maharashtra', 'gujarat',
              'rajasthan', 'madhya-pradesh', 'west-bengal', 'jharkhand', 'nepal'] },
  { key: 'phagli',             masa: 11, tithi: 14, type: 'minor',
    regions: ['himachal-pradesh'] },
  { key: 'jagannath_rath_yatra', masa: 3, tithi: 1, type: 'major' },
  { key: 'varamahalakshmi',    masa: 4,  vara: 5,  type: 'major',
    tithiRange: [7, 13],
    regions: ['karnataka', 'andhra-pradesh', 'telangana', 'tamil-nadu'] },
  // Bathukamma runs 9 days; only its start and climax are emitted.
  { key: 'bathukamma_start',   masa: 5,  tithi: 29, type: 'major',
    regions: ['telangana'] },
  { key: 'bathukamma_saddula', masa: 6,  tithi: 8,  type: 'major',
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

/** Index fields are taken at sunrise. */
export interface FestivalComputeContext {
  tithiIndex: number;
  nakshatraIndex: number;
  nakshatraIndicesInDay?: ReadonlySet<number>;
  /** Amanta. */
  chandraMasaIndex: number;
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
  // Vaisakhi on the transit's CIVIL day, Vishu on the first sunrise at or after
  // it, Pohela Boishakh the day after the transit's civil day.
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
  /** Ekadashi at today's AND tomorrow's sunrise: the fast is tomorrow. */
  ekadashiVriddhaFirstDay?: boolean;
  bhadra?: { start: Date; end: Date } | null;
  /** Already offset-adjusted for local display. */
  formatClock?: (d: Date) => string;
  region?: FestivalRegion;
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
  const prevailsInKala = (targetTithi: number, dateRule: FestivalDateRule): boolean => {
    if (dateRule === 'janmashtami-nishita') {
      // Smarta ladder: the udaya-Ashtami day wins when Ashtami OR Rohini touches
      // its nishita, else the day Ashtami covers nishita (Rohini alone cannot).
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
      // Vijayadashami ladder: the day the tithi covers the ENTIRE aparahna wins
      // (both days full: the first); else the day the tithi ENDS (para-viddha).
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

    if (dateRule === 'chandrodaya') {
      // An instant, not a span: the dedupes below never fire, so vriddha is deduped here.
      if (endTithi === targetTithi) return priorEndTithi !== targetTithi;
      // No forward look needed: reaching tomorrow's moonrise needs a > 38 h tithi.
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
      dateRule !== 'sunrise' &&
      startTithi !== undefined &&
      startTithi !== targetTithi &&
      priorEndTithi === targetTithi
    ) return false;

    if (matchedByStart && priorEndTithi === targetTithi) return false;

    return true;
  };

  for (const rule of FESTIVAL_REGISTRY) {
    const adhikaBehaviour: AdhikaBehaviour = rule.adhikaBehaviour ?? 'skip';

    if (ctx.isAdhika && adhikaBehaviour === 'skip') continue;
    if (ctx.isAdhika && adhikaBehaviour === 'shift-to-nija') continue;

    let match = false;
    if (rule.nakshatra !== undefined && rule.solarMasa !== undefined) {
      match = rule.solarMasa === ctx.solarMasaIndex && rule.nakshatra === ctx.nakshatraIndex;
    } else if (rule.nakshatra !== undefined && rule.masa !== undefined) {
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      match = masaMatches && rule.nakshatra === ctx.nakshatraIndex;
    } else if (rule.vara !== undefined && rule.masa !== undefined) {
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      let inTithiRange = true;
      if (rule.tithiRange !== undefined) {
        const dateRule = rule.dateRule ?? 'sunrise';
        const tithi = tithiForRule(dateRule);
        const [lo, hi] = rule.tithiRange;
        inTithiRange = tithi >= lo && tithi <= hi;
      }
      match = masaMatches && rule.vara === ctx.varaIndex && inTithiRange;
    } else if (rule.masa !== undefined && rule.tithi !== undefined) {
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      if (masaMatches) {
        match = prevailsInKala(rule.tithi, rule.dateRule ?? 'sunrise');
      }
    }

    if (!match) continue;

    if (rule.regions !== undefined) {
      const region: FestivalRegion = ctx.region ?? 'all';
      if (region !== 'all' && !rule.regions.includes('all') && !rule.regions.includes(region)) {
        continue;
      }
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
  }

  const isEkadashiAtSunrise = ctx.tithiIndex === 10 || ctx.tithiIndex === 25;
  const paksha: 0 | 1 = ctx.tithiIndex === 10 ? 0 : ctx.tithiIndex === 25 ? 1 : 0;

  if (isEkadashiAtSunrise && ctx.ekadashiVriddhaFirstDay) {
    // Nothing today: the fast is tomorrow's Mahadwadashi.
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
    // Smarta advances to today, the day the tithi begins; Vaishnava keeps tomorrow.
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

  if (tithiForRule('chandrodaya') === 18 && priorDayTithiForRule('chandrodaya') !== 18) {
    results.push({ key: 'sankashti_chaturthi', name: nameResolver('sankashti_chaturthi'), type: 'major' });
  }

  {
    const isMahaShivaratriMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 10;
    if (!isMahaShivaratriMonth && prevailsInKala(28, 'nishita')) {
      results.push({ key: 'masik_shivaratri', name: nameResolver('masik_shivaratri'), type: 'minor' });
    }
  }

  {
    const isGaneshChaturthiMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 5;
    if (!isGaneshChaturthiMonth && prevailsInKala(3, 'madhyahna')) {
      results.push({ key: 'vinayaka_chaturthi', name: nameResolver('vinayaka_chaturthi'), type: 'minor' });
    }
  }

  // Deliberately duplicates `computeSpecialYogas`.
  if (ctx.nakshatraIndex === 7) {
    if (ctx.varaIndex === 0) {
      results.push({ key: 'ravi_pushya', name: nameResolver('ravi_pushya'), type: 'minor' });
    } else if (ctx.varaIndex === 4) {
      results.push({ key: 'guru_pushya', name: nameResolver('guru_pushya'), type: 'minor' });
    }
  }

  const krittikaPrevails =
    ctx.nakshatraIndex === 2 ||
    (ctx.nakshatraIndicesInDay !== undefined && ctx.nakshatraIndicesInDay.has(2));
  if (krittikaPrevails) {
    results.push({ key: 'masik_karthigai', name: nameResolver('masik_karthigai'), type: 'minor' });
  }

  const pradoshaTithi = tithiForRule('pradosha');
  if (pradoshaTithi === 12 || pradoshaTithi === 27) {
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
