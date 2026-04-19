import type { FestivalInfo } from '../types/elements';

/**
 * Canonical time-of-day at which a festival's qualifying tithi must prevail.
 *
 * - `sunrise`     — tithi-at-sunrise (default; most Shukla-paksha tithi festivals).
 * - `madhyahna`   — tithi at mid-day (e.g. Akshaya Tritiya, Ganesh Chaturthi).
 * - `aparahna`    — tithi in late afternoon (~4th of 5 day-parts; Raksha Bandhan).
 * - `pradosha`    — tithi at sunset / early evening (Diwali, Dhanteras, Pradosha Vrata).
 * - `nishita`     — tithi at local midnight (Janmashtami, Maha Shivaratri).
 * - `chandrodaya` — tithi at moonrise (Karva Chauth, Sankashti Chaturthi).
 */
export type FestivalDateRule =
  | 'sunrise'
  | 'madhyahna'
  | 'aparahna'
  | 'pradosha'
  | 'nishita'
  | 'chandrodaya';

/**
 * Classical behaviour when the target month becomes Adhika (leap).
 *
 * - `skip`           — Adhika is not observed; wait for Nija (default; most festivals).
 * - `shift-to-nija`  — Observe in the Nija masa that immediately follows Adhika.
 * - `observe-in-both`— Observe in both Adhika and Nija (e.g., Ekadashi is recurring).
 */
type AdhikaBehaviour = 'skip' | 'shift-to-nija' | 'observe-in-both';

/**
 * Regional scope for region-specific festival variants (primarily regional
 * Sankranti names like Pongal/Vishu/Baisakhi). `'all'` (default) emits every
 * region's variant; narrower values filter to that region only.
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

/**
 * A festival rule keyed by one of:
 *   - (chandra-masa + tithi)
 *   - (solar-masa + nakshatra)
 *   - (chandra-masa + nakshatra)        — e.g. Rig/Sama Upakarma
 *   - (chandra-masa + vara)             — e.g. Shravan Somvar, Mangala Gauri
 * Exactly one matching strategy is used per rule.
 */
interface FestivalRule {
  key: string;
  type: 'major' | 'minor';
  /** Amanta Chandra masa 0–11 for tithi- or chandraMasa+nakshatra/vara rules */
  masa?: number;
  /** Tithi 0–29 for tithi-based festivals */
  tithi?: number;
  /** Solar-masa (Sun's sidereal rashi) 0–11 for nakshatra-based festivals */
  solarMasa?: number;
  /** Nakshatra 0–26 for nakshatra-based festivals */
  nakshatra?: number;
  /** Vara 0–6 (0=Sunday…6=Saturday) for chandraMasa+vara recurring rules */
  vara?: number;
  /** Canonical time at which the qualifying index must hold. Defaults to `sunrise`. */
  dateRule?: FestivalDateRule;
  /** When true, emit an exclusion notice if Bhadra kala overlaps this Hindu day. */
  bhadraExclude?: boolean;
  /** Adhika-masa policy for this festival. Defaults to `'skip'`. */
  adhikaBehaviour?: AdhikaBehaviour;
  /**
   * System under which this festival's masa is traditionally named. Purely
   * cosmetic: Krishna-paksha festivals are named by the following Purnimanta
   * masa (e.g., Diwali is "Kartika Amavasya" in Purnimanta convention and
   * "Ashwin Amavasya" in Amanta). Registry matching stays Amanta-indexed.
   */
  namingSystem?: 'amanta' | 'purnimanta';
}

/**
 * Regional Sankranti name registry, keyed by solar rashi index. Each rashi
 * transit can map to multiple regional festival names (e.g. Makara → Makar
 * Sankranti, Pongal, Uttarayan, Bihu, Ayyappa Makara Jyothi). Filtered at
 * emit time by `ctx.region`.
 */
interface SankrantiRegionalRule {
  key: string;
  region: FestivalRegion;
  type: 'major' | 'minor';
}

const SANKRANTI_REGIONAL: Readonly<Record<number, readonly SankrantiRegionalRule[]>> = {
  // Mesha (0) — solar new year across regions
  0: [
    { key: 'baisakhi',         region: 'punjab',      type: 'major' },
    { key: 'vishu',            region: 'kerala',      type: 'major' },
    { key: 'pohela_boishakh',  region: 'bengal',      type: 'major' },
    { key: 'puthandu',         region: 'tamil',       type: 'major' },
  ],
  // Karka (3) — Dakshinayana (Sun's southward course begins)
  3: [
    { key: 'dakshinayana',     region: 'all',         type: 'minor' },
  ],
  // Simha (4)
  4: [
    { key: 'singh_sankranti',  region: 'all',         type: 'minor' },
  ],
  // Makara (9) — Uttarayana / harvest festivals
  9: [
    { key: 'makar_sankranti',    region: 'north-india', type: 'major' },
    { key: 'pongal',             region: 'tamil',       type: 'major' },
    { key: 'uttarayan',          region: 'gujarat',     type: 'major' },
    { key: 'bihu',               region: 'assam',       type: 'major' },
    { key: 'ayyappa_makara_jyothi', region: 'kerala',   type: 'major' },
  ],
};

/**
 * Registry of major pan-Indian Hindu festivals.
 *
 * Chandra Masa indices (Amanta): 0=Chaitra … 11=Phalguna.
 * Tithi indices: 0=Shukla Pratipada … 14=Purnima … 15=Krishna Pratipada … 29=Amavasya.
 * Nakshatra indices: 0=Ashwini … 26=Revati.
 * Solar masa indices: 0=Mesha … 11=Meena.
 */
const FESTIVAL_REGISTRY: readonly FestivalRule[] = [
  // Chaitra (0)
  { key: 'ugadi',              masa: 0,  tithi: 0,  type: 'major' },
  { key: 'rama_navami',        masa: 0,  tithi: 8,  type: 'major', dateRule: 'madhyahna', adhikaBehaviour: 'shift-to-nija' },
  { key: 'hanuman_jayanti',    masa: 0,  tithi: 14, type: 'major' },
  // Vaishakha (1)
  // Akshaya Tritiya and Parashurama Jayanti share Vaishakha Shukla Tritiya;
  // both are observed on the madhyahna-vyapini day (when the tithi prevails at midday).
  { key: 'akshaya_tritiya',    masa: 1,  tithi: 2,  type: 'major', dateRule: 'madhyahna' },
  { key: 'parashurama_jayanti', masa: 1, tithi: 2,  type: 'major', dateRule: 'madhyahna' },
  // Ashadha (3)
  { key: 'guru_purnima',       masa: 3,  tithi: 14, type: 'major' },
  // Shravana (4)
  { key: 'nag_panchami',       masa: 4,  tithi: 4,  type: 'minor' },
  // Raksha Bandhan: classical rule is aparahna-vyapini Purnima, but pan-Indian
  // modern observance follows the simpler "Purnima at sunrise" rule (Drik included)
  // because aparahna-vyapini excludes otherwise-valid days where Purnima ends
  // just before aparahna. We use sunrise for compatibility with published panchangs.
  // Bhadra kala disqualifies tying of the rakhi; we emit an exclusion notice.
  { key: 'raksha_bandhan',     masa: 4,  tithi: 14, type: 'major', bhadraExclude: true },
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major', dateRule: 'nishita', adhikaBehaviour: 'shift-to-nija' },
  // Bhadrapada (5)
  { key: 'ganesh_chaturthi',   masa: 5,  tithi: 3,  type: 'major', dateRule: 'madhyahna' },
  { key: 'anant_chaturdashi',  masa: 5,  tithi: 13, type: 'major' },
  // Ashwin (6)
  { key: 'navaratri',          masa: 6,  tithi: 0,  type: 'major' },
  { key: 'durga_ashtami',      masa: 6,  tithi: 7,  type: 'major' },
  { key: 'maha_navami',        masa: 6,  tithi: 8,  type: 'major' },
  { key: 'dussehra',           masa: 6,  tithi: 9,  type: 'major' },
  { key: 'sharad_purnima',     masa: 6,  tithi: 14, type: 'major' },
  // Ashwin (6) — Krishna Paksha festivals (Amanta: Ashwin; Purnimanta calls these "Kartika")
  //
  // Karva Chauth and Narak Chaturdashi are classically chandrodaya (moonrise)
  // festivals, but in practice (a) published panchangs including Drik use
  // "tithi-at-sunrise" as the simple inclusive rule; (b) Narak Chaturdashi's
  // pre-dawn moon often falls outside the sunrise-to-nextSunrise Hindu day
  // window. We therefore use sunrise here. The 'chandrodaya' dateRule is
  // retained in the type system for custom use and for Sankashti Chaturthi.
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major', namingSystem: 'purnimanta' },
  { key: 'dhanteras',          masa: 6,  tithi: 27, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta' },
  { key: 'narak_chaturdashi',  masa: 6,  tithi: 28, type: 'major', namingSystem: 'purnimanta' },
  { key: 'diwali',             masa: 6,  tithi: 29, type: 'major', dateRule: 'pradosha', namingSystem: 'purnimanta' },
  // Kartika (7) — Shukla Paksha
  { key: 'kartika_purnima',    masa: 7,  tithi: 14, type: 'minor' },
  // Magha (10)
  { key: 'vasant_panchami',    masa: 10, tithi: 4,  type: 'major', dateRule: 'madhyahna' },
  { key: 'maha_shivaratri',    masa: 10, tithi: 28, type: 'major', dateRule: 'nishita' },
  // Phalguna (11)
  { key: 'holi',               masa: 11, tithi: 14, type: 'major' },
  // Bhadrapada (5) — end of Pitru Paksha
  { key: 'mahalaya_amavasya',  masa: 5,  tithi: 29, type: 'major' },
  // ── Chhath Puja (Kartika Shukla Chaturthi→Saptami) ─────────
  { key: 'chhath_nahay_khay',       masa: 7, tithi: 3, type: 'major' },
  { key: 'chhath_kharna',           masa: 7, tithi: 4, type: 'major' },
  { key: 'chhath_sandhya_arghya',   masa: 7, tithi: 5, type: 'major', dateRule: 'pradosha' },
  { key: 'chhath_usha_arghya',      masa: 7, tithi: 6, type: 'major' },
  // ── Vat Savitri (Jyeshtha masa, N India Amavasya + S India Purnima) ──
  { key: 'vat_savitri_amavasya', masa: 2, tithi: 29, type: 'major' },
  { key: 'vat_savitri_purnima',  masa: 2, tithi: 14, type: 'major' },
  // ── Yajur Upakarma (Shravana Purnima, shares the day with Raksha Bandhan) ──
  { key: 'yajur_upakarma',       masa: 4, tithi: 14, type: 'major' },
  // ── Month+weekday recurring (Shravan Somvar etc.) ──────────
  { key: 'shravan_somvar',   masa: 4,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'mangala_gauri',    masa: 4,  vara: 2, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'kartik_somvar',    masa: 7,  vara: 1, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  { key: 'magha_shanivar',   masa: 10, vara: 6, type: 'minor', adhikaBehaviour: 'observe-in-both' },
  // ── Nakshatra-based (solar-month calendar) ──────────────────
  // Onam — Shravana nakshatra in Simha solar month (Malayalam calendar).
  { key: 'onam',               solarMasa: 4, nakshatra: 21, type: 'major' },
  // ── Nakshatra + Chandra-masa (Upakarma variants) ─────────────
  // Rig Upakarma — Shravana nakshatra (21) in Shravana chandra masa (4).
  { key: 'rig_upakarma',       masa: 4, nakshatra: 21, type: 'major' },
  // Sama Upakarma — Hasta nakshatra (12) in Bhadrapada chandra masa (5).
  { key: 'sama_upakarma',      masa: 5, nakshatra: 12, type: 'major' },
];

/**
 * Named Ekadashi lookup, keyed by (amantaMasa, paksha).
 * Paksha: 0 = Shukla (tithi 10), 1 = Krishna (tithi 25).
 * Adhika: special "Padmini" (Shukla) and "Parama" (Krishna) overrides.
 */
const EKADASHI_NAMES: readonly (readonly [string, string])[] = [
  ['kamada',     'papamochani'],  // 0  Chaitra
  ['mohini',     'varuthini'],    // 1  Vaishakha
  ['nirjala',    'apara'],        // 2  Jyeshtha
  ['devshayani', 'yogini'],       // 3  Ashadha
  ['putrada',    'kamika'],       // 4  Shravana (Putrada = Pavitra)
  ['parivartini','aja'],          // 5  Bhadrapada
  ['pashankusha','indira'],       // 6  Ashwin
  ['prabodhini', 'rama'],         // 7  Kartika
  ['mokshada',   'utpanna'],      // 8  Margashirsha
  ['pausha_putrada', 'saphala'],  // 9  Pausha
  ['jaya',       'shattila'],     // 10 Magha
  ['amalaki',    'vijaya'],       // 11 Phalguna
];

/** Adhika-masa Ekadashi names (Padmini and Parama). */
const ADHIKA_EKADASHI_NAMES: readonly [string, string] = ['padmini', 'parama'];

/**
 * Named Pradosha by (vara, paksha). Vara 0 = Sunday … 6 = Saturday.
 * Paksha: 0 = Shukla, 1 = Krishna. Same vara keeps the same variant name
 * across both pakshas (only paksha changes in display); convention varies
 * by source so we emit the single weekday-keyed variant.
 */
const PRADOSHA_NAMES: readonly string[] = [
  'ravi_pradosha',   // 0 Sunday    (Bhanu / Ravi)
  'som_pradosha',    // 1 Monday    (Som / Induvara)
  'bhauma_pradosha', // 2 Tuesday   (Bhauma)
  'saumya_pradosha', // 3 Wednesday (Saumya / Budha)
  'guru_pradosha',   // 4 Thursday  (Guru)
  'bhrigu_pradosha', // 5 Friday    (Bhrigu / Shukra)
  'shani_pradosha',  // 6 Saturday  (Shani)
];

/**
 * Context supplied to `computeFestivals`. Panchang-level elements are precomputed
 * in `getDailyPanchang` / `getInstantPanchang` and handed in; this keeps the
 * registry evaluation pure and testable.
 */
export interface FestivalComputeContext {
  /** Tithi 0–29 at sunrise (the default rule). */
  tithiIndex: number;
  /** Nakshatra 0–26 at sunrise. */
  nakshatraIndex: number;
  /**
   * Optional: set of nakshatra indices that occur during the Hindu day
   * (sampled at sunrise / midday / sunset / nishita). Used by rules that
   * fire whenever a given nakshatra prevails any time during the day —
   * e.g. Masik Karthigai = Krittika anywhere on the day.
   */
  nakshatraIndicesInDay?: ReadonlySet<number>;
  /** Amanta chandra masa 0–11 at sunrise. */
  chandraMasaIndex: number;
  /** Purnimanta chandra masa 0–11 at sunrise (for cosmetic naming). */
  purnimantaMasaIndex?: number;
  /** Translated chandra masa names keyed by Amanta and Purnimanta index. */
  amantaMasaName?: string;
  purnimantaMasaName?: string;
  /** True if the chandra masa is Adhika (leap). */
  isAdhika: boolean;
  /** True if the chandra masa *immediately prior* was Adhika with the same index. */
  priorMasaWasAdhika?: boolean;
  /** Vara 0–6. */
  varaIndex: number;
  /** Solar masa 0–11 (Sun's sidereal rashi) at sunrise. Used by nakshatra-based rules. */
  solarMasaIndex: number;
  /** Optional: tithi index at non-sunrise canonical times. Missing entries fall back to tithiIndex. */
  tithiByRule?: Partial<Record<FestivalDateRule, number>>;
  /**
   * Optional: tithi at the START of each non-sunrise kala. When both start
   * and end of a kala match the target tithi, the tithi "prevails" across
   * the full kala and the festival is emitted. When only the end matches
   * (tithi started during the kala), we check `priorDayTithiByRule` to
   * decide whether yesterday already claimed the festival.
   */
  tithiByRuleStart?: Partial<Record<FestivalDateRule, number>>;
  /**
   * Optional: yesterday's tithiByRule values. Used by the long-tithi dedupe
   * heuristic — if yesterday had both start+end matching the target tithi,
   * the festival was already emitted yesterday and today is suppressed.
   */
  priorDayTithiByRule?: Partial<Record<FestivalDateRule, number>>;
  /** Rashi (0–11) the Sun enters during this Hindu day, or null if no transit. */
  sankrantiRashi?: number | null;
  /**
   * True when the Ekadashi at sunrise is Dashami-viddha (i.e., Dashami was
   * active at arunodaya, ~96 minutes before sunrise). Smarta schools shift
   * the fast to the next day in that case; Vaishnava always fasts today.
   */
  ekadashiDashamiViddha?: boolean;
  /**
   * True when yesterday was a Dashami-viddha Ekadashi-at-sunrise day and
   * today is Dwadashi-at-sunrise — the Smarta fast lands here.
   */
  smartaDwadashiToday?: boolean;
  /**
   * Moonrise within the Hindu day, if any. Used to annotate chandrodaya-rule
   * festivals with a human-friendly moonrise timestamp.
   */
  moonriseInDay?: Date | null;
  /** Bhadra window overlapping today's Hindu day, if any. */
  bhadra?: { start: Date; end: Date } | null;
  /** Format callback for Bhadra end time — already offset-adjusted local display. */
  formatClock?: (d: Date) => string;
  /**
   * Regional scope for regional-Sankranti variants (Pongal, Vishu, Baisakhi,
   * etc.). Defaults to `'all'` — every region's variant is emitted when the
   * underlying Sankranti fires. Narrower values filter to that region only.
   * Region `'all'` tagged entries (Dakshinayana, Singh Sankranti) always emit.
   */
  region?: FestivalRegion;
}

function ekadashiNameKey(masaIndex: number, paksha: 0 | 1, isAdhika: boolean): string {
  if (isAdhika) return `ekadashi_${ADHIKA_EKADASHI_NAMES[paksha]}`;
  const names = EKADASHI_NAMES[masaIndex];
  if (!names) return 'ekadashi';
  return `ekadashi_${names[paksha]}`;
}

/**
 * Detect festivals for a Hindu day (sunrise-to-next-sunrise).
 *
 * Rules are evaluated as follows:
 *   - Tithi-based rules match against tithi at the rule's `dateRule` canonical
 *     time, with a long-tithi dedupe heuristic: when a rule's tithi prevails
 *     at the kala's END but started DURING the kala, and yesterday already
 *     had the same tithi prevailing throughout its kala, today is suppressed.
 *   - Nakshatra-based rules match against (solarMasa + nakshatra) at sunrise.
 *   - Ekadashi emits Smarta and Vaishnava variants on the correct days:
 *       non-viddha day: both variants + the generic `ekadashi` event.
 *       viddha day: Vaishnava today; Smarta deferred to tomorrow (Dwadashi).
 *   - Sankashti Chaturthi fires on Krishna Chaturthi (18) at moonrise.
 *   - Pradosha Vrata fires on Shukla or Krishna Trayodashi (12/27) at
 *     pradosha-kala, with a vara-specific variant name in `description`.
 *   - Sankranti fires on the Hindu day containing a solar rashi transit.
 *
 * Adhika-masa behaviour is per-rule: `skip` (default), `shift-to-nija`
 * (observe in the Nija masa immediately following an Adhika), or
 * `observe-in-both` (e.g., Ekadashi, Pradosha, Sankashti).
 */
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

  // ── Fixed registry festivals ──────────────────────────────
  for (const rule of FESTIVAL_REGISTRY) {
    const adhikaBehaviour: AdhikaBehaviour = rule.adhikaBehaviour ?? 'skip';

    // Adhika gate: decide whether the rule should be evaluated at all on this day.
    if (ctx.isAdhika && adhikaBehaviour === 'skip') continue;
    if (ctx.isAdhika && adhikaBehaviour === 'shift-to-nija') continue;

    let match = false;
    if (rule.nakshatra !== undefined && rule.solarMasa !== undefined) {
      match = rule.solarMasa === ctx.solarMasaIndex && rule.nakshatra === ctx.nakshatraIndex;
    } else if (rule.nakshatra !== undefined && rule.masa !== undefined) {
      // Nakshatra + Chandra-masa composite (Rig/Sama Upakarma).
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      match = masaMatches && rule.nakshatra === ctx.nakshatraIndex;
    } else if (rule.vara !== undefined && rule.masa !== undefined) {
      // Chandra-masa + Vara recurring (Shravan Somvar, Mangala Gauri, …).
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      match = masaMatches && rule.vara === ctx.varaIndex;
    } else if (rule.masa !== undefined && rule.tithi !== undefined) {
      const masaMatches =
        rule.masa === ctx.chandraMasaIndex &&
        // `shift-to-nija`: only observe in Nija following an Adhika (but still OK if no prior Adhika,
        // since the normal year has no Adhika and the festival observes as usual).
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      if (masaMatches) {
        const dateRule = rule.dateRule ?? 'sunrise';
        const effectiveTithi = tithiForRule(dateRule);
        if (effectiveTithi === rule.tithi) {
          // Long-tithi dedupe — suppress if yesterday already claimed it.
          const startTithi = tithiForRuleStart(dateRule);
          const priorEndTithi = priorDayTithiForRule(dateRule);
          if (
            dateRule !== 'sunrise' &&
            startTithi !== undefined &&
            startTithi !== rule.tithi &&
            priorEndTithi === rule.tithi
          ) {
            // Tithi started DURING today's kala; yesterday's kala-end also
            // matched the target → yesterday already emitted, suppress today.
            continue;
          }
          match = true;
        }
      }
    }

    if (!match) continue;

    const festival: FestivalInfo = { name: nameResolver(rule.key), type: rule.type };

    // Purnimanta-naming awareness: add description with the Purnimanta masa name
    // for Krishna-paksha festivals that were traditionally named under the
    // Purnimanta convention.
    if (
      rule.namingSystem === 'purnimanta' &&
      ctx.purnimantaMasaName &&
      ctx.amantaMasaName
    ) {
      festival.description = `Purnimanta: ${ctx.purnimantaMasaName} Krishna Paksha`;
    }

    // Bhadra exclusion notice (Raksha Bandhan).
    if (rule.bhadraExclude && ctx.bhadra && ctx.formatClock) {
      const bhadraEndStr = ctx.formatClock(ctx.bhadra.end);
      festival.description = `Observe after Bhadra ends at ${bhadraEndStr}`;
    }

    results.push(festival);
  }

  // ── Ekadashi: Smarta + Vaishnava split ────────────────────
  const isEkadashiAtSunrise = ctx.tithiIndex === 10 || ctx.tithiIndex === 25;
  const paksha: 0 | 1 = ctx.tithiIndex === 10 ? 0 : ctx.tithiIndex === 25 ? 1 : 0;

  if (isEkadashiAtSunrise) {
    // Named Ekadashi (description).
    const namedKey = ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika);
    const namedDescription = nameResolver(namedKey);

    // Vaishnava always fasts on the Ekadashi-at-sunrise day.
    results.push({
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: namedDescription,
    });

    if (ctx.ekadashiDashamiViddha) {
      // Smarta deferred to tomorrow (Dwadashi).
      const deferral: FestivalInfo = {
        name: nameResolver('smarta_ekadashi'),
        type: 'smarta_ekadashi',
        description: `${namedDescription} — deferred to Dwadashi (Dashami-viddha)`,
      };
      results.push(deferral);
      // Generic `ekadashi` with note for ergonomics.
      results.push({
        name: nameResolver('ekadashi'),
        type: 'ekadashi',
        description: 'Dashami-viddha: Smarta fast observed next day (Dwadashi); Vaishnava fast today.',
      });
    } else {
      // Non-viddha: Smarta and Vaishnava coincide.
      results.push({
        name: nameResolver('smarta_ekadashi'),
        type: 'smarta_ekadashi',
        description: namedDescription,
      });
      results.push({
        name: nameResolver('ekadashi'),
        type: 'ekadashi',
        description: namedDescription,
      });
    }
  } else if (ctx.smartaDwadashiToday) {
    // Smarta fast landed on Dwadashi today after yesterday's viddha Ekadashi.
    results.push({
      name: nameResolver('smarta_ekadashi'),
      type: 'smarta_ekadashi',
      description: 'Dashami-viddha Ekadashi: Smarta fast observed today (Dwadashi).',
    });
  }

  // ── Sankashti Chaturthi — Krishna Chaturthi (18) at moonrise ──
  if (tithiForRule('chandrodaya') === 18) {
    results.push({ name: nameResolver('sankashti_chaturthi'), type: 'major' });
  }

  // ── Masik Shivaratri (monthly) — Krishna Chaturdashi (28) at nishita ──
  // Suppressed in Nija Magha (where Maha Shivaratri already fires).
  const nishitaTithi = tithiForRule('nishita');
  if (nishitaTithi === 28) {
    const isMahaShivaratriMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 10;
    if (!isMahaShivaratriMonth) {
      // Long-tithi dedupe parallel to the registry loop: suppress today if
      // tithi started during today's kala AND yesterday's kala already held it.
      const startTithi = ctx.tithiByRuleStart?.nishita;
      const priorEndTithi = ctx.priorDayTithiByRule?.nishita;
      const suppressed =
        startTithi !== undefined &&
        startTithi !== 28 &&
        priorEndTithi === 28;
      if (!suppressed) {
        results.push({ name: nameResolver('masik_shivaratri'), type: 'minor' });
      }
    }
  }

  // ── Vinayaka Chaturthi (monthly) — Shukla Chaturthi (3) at madhyahna ──
  // Suppressed in Nija Bhadrapada (where Ganesh Chaturthi already fires).
  const madhyahnaTithi = tithiForRule('madhyahna');
  if (madhyahnaTithi === 3) {
    const isGaneshChaturthiMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 5;
    if (!isGaneshChaturthiMonth) {
      const startTithi = ctx.tithiByRuleStart?.madhyahna;
      const priorEndTithi = ctx.priorDayTithiByRule?.madhyahna;
      const suppressed =
        startTithi !== undefined &&
        startTithi !== 3 &&
        priorEndTithi === 3;
      if (!suppressed) {
        results.push({ name: nameResolver('vinayaka_chaturthi'), type: 'minor' });
      }
    }
  }

  // ── Ravi / Guru Pushya Yoga (mirror into festivals for UX) ──
  // The same detection lives in `computeSpecialYogas`; mirroring here lets
  // apps surface these as "festival-like" auspicious days without extra plumbing.
  if (ctx.nakshatraIndex === 7) {
    if (ctx.varaIndex === 0) {
      results.push({ name: nameResolver('ravi_pushya'), type: 'minor' });
    } else if (ctx.varaIndex === 4) {
      results.push({ name: nameResolver('guru_pushya'), type: 'minor' });
    }
  }

  // ── Masik Karthigai — monthly observance on Krittika-nakshatra day ──
  // South Indian (primarily Tamil) tradition: lamps are lit on every day the
  // Moon transits Krittika, with the annual Karthigai Deepam falling on the
  // Krittika-Purnima conjunction in Kartika masa. We emit this whenever
  // Krittika (index 2) is present at any sampled point during the Hindu day,
  // not strictly at sunrise — the Drik convention since Krittika typically
  // takes over after sunrise on at least one day per lunar month.
  const krittikaPrevails =
    ctx.nakshatraIndex === 2 ||
    (ctx.nakshatraIndicesInDay !== undefined && ctx.nakshatraIndicesInDay.has(2));
  if (krittikaPrevails) {
    results.push({ name: nameResolver('masik_karthigai'), type: 'minor' });
  }

  // ── Pradosha Vrata — Shukla/Krishna Trayodashi at pradosha-kala ──
  const pradoshaTithi = tithiForRule('pradosha');
  if (pradoshaTithi === 12 || pradoshaTithi === 27) {
    const variantKey = PRADOSHA_NAMES[ctx.varaIndex] ?? 'pradosha';
    results.push({
      name: nameResolver('pradosha'),
      type: 'pradosha',
      description: nameResolver(variantKey),
    });
  }

  // ── Sankranti — Sun enters a new rashi during this Hindu day ──
  if (ctx.sankrantiRashi !== undefined && ctx.sankrantiRashi !== null) {
    const rashiName = rashiNameResolver
      ? rashiNameResolver(ctx.sankrantiRashi)
      : `Rashi ${ctx.sankrantiRashi}`;
    results.push({
      name: nameResolver('sankranti'),
      type: 'sankranti',
      description: rashiName,
    });

    // Regional Sankranti variants (Pongal, Vishu, Baisakhi, Bihu, …).
    // Emitted as additional type-'sankranti' entries so consumers can filter
    // or display them alongside the canonical Sankranti event.
    const region: FestivalRegion = ctx.region ?? 'all';
    const regionalRules = SANKRANTI_REGIONAL[ctx.sankrantiRashi];
    if (regionalRules) {
      for (const r of regionalRules) {
        if (region !== 'all' && r.region !== 'all' && r.region !== region) continue;
        results.push({
          name: nameResolver(r.key),
          type: 'sankranti',
          description: rashiName,
        });
      }
    }
  }

  return results;
}
