import type { FestivalInfo } from '../types/elements';
import type { FestivalRegion } from '../types/options';

export type { FestivalRegion };

/**
 * Canonical time-of-day at which a festival's qualifying tithi must prevail.
 *
 * - `sunrise`     — tithi-at-sunrise (default; most Shukla-paksha tithi festivals).
 * - `madhyahna`   — tithi at mid-day (e.g. Akshaya Tritiya, Ganesh Chaturthi).
 * - `aparahna`    — tithi in late afternoon (~4th of 5 day-parts; Raksha Bandhan).
 * - `aparahna-full` — Vijayadashami's ladder: the day the tithi covers the
 *                  ENTIRE aparahna kala wins; when neither day does, the day
 *                  the tithi ends wins (para-viddha). See `prevailsInKala`.
 * - `pradosha`    — tithi at sunset / early evening (Diwali, Dhanteras, Pradosha Vrata).
 * - `nishita`     — tithi at local midnight (Maha Shivaratri).
 * - `janmashtami-nishita` — Janmashtami's Smarta ladder: the udaya-Ashtami
 *                  day wins when Ashtami or Rohini touches its nishita
 *                  muhurta, else the day Ashtami covers nishita. See
 *                  `prevailsInKala`.
 * - `chandrodaya` — tithi at moonrise (Karva Chauth, Sankashti Chaturthi).
 */
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
 * Classical behaviour when the target month becomes Adhika (leap).
 *
 * - `skip`           — Adhika is not observed; wait for Nija (default; most festivals).
 * - `shift-to-nija`  — Observe in the Nija masa that immediately follows Adhika.
 * - `observe-in-both`— Observe in both Adhika and Nija (e.g., Ekadashi is recurring).
 */
type AdhikaBehaviour = 'skip' | 'shift-to-nija' | 'observe-in-both';

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
  /**
   * Regional scope. Omitted → pan-Indian (always emits). When set, the
   * festival emits only if `ctx.region` is `'all'` or appears in this list.
   * Include `'all'` explicitly to mark a rule as universal even when present.
   */
  regions?: readonly FestivalRegion[];
  /**
   * Tithi-range gate for `(masa + vara)` rules whose target day is a specific
   * weekday within a sub-window of the lunar month — e.g. Varamahalakshmi
   * is the *last Friday* of Shravana Shukla paksha before Purnima, which
   * falls when (masa=4, vara=5, tithi ∈ [7, 13]).
   *
   * Pair `[startInclusive, endInclusive]` against the rule's `dateRule` tithi
   * (defaults to sunrise). Rules without `tithiRange` ignore the field.
   */
  tithiRange?: readonly [number, number];
}

/**
 * Regional Sankranti name registry, keyed by solar rashi index. Each rashi
 * transit can map to multiple regional festival names (e.g. Makara → Makar
 * Sankranti, Pongal, Uttarayan, Magh Bihu, Ayyappa Makara Jyothi). Filtered
 * at emit time by `ctx.region`.
 *
 * `regions` is an allow-list. An entry containing `'all'` emits universally
 * (e.g. pan-Indian Dakshinayana); otherwise the entry emits only when
 * `ctx.region` is `'all'` or appears in the list.
 */
interface SankrantiRegionalRule {
  key: string;
  regions: readonly FestivalRegion[];
  type: 'major' | 'minor';
}

const SANKRANTI_REGIONAL: Readonly<Record<number, readonly SankrantiRegionalRule[]>> = {
  // Mesha (0) — solar new year across regions.
  //
  // Only the traditions that share the generic Sankranti observance day live
  // here. Vaisakhi (Punjab), Vishu (Kerala) and Pohela Boishakh (West Bengal)
  // key off the transit moment differently and land on other dates in some
  // years, so they are emitted from their own context flags below — see the
  // drik 2025–2029 table in dayFestivals.ts.
  0: [
    // Puthandu = the transit-day rule exactly (drik 2025–2029: Apr 14 ×5).
    { key: 'puthandu',         regions: ['tamil-nadu'],           type: 'major' },
    // Bohag Bihu shares the day here for want of a reference: DrikPanchang
    // publishes no Bohag/Rongali Bihu date page, so the Assamese rule could
    // not be pinned to the ≥2-source bar. Assamese practice generally follows
    // the Bengali reckoning (new year the day AFTER the transit's civil day),
    // which would put it with `pohela_boishakh` rather than here — left on the
    // transit day pending a citable source rather than guessed at.
    { key: 'bohag_bihu',       regions: ['assam'],                type: 'major' },
  ],
  // Karka (3) — Dakshinayana (Sun's southward course begins)
  3: [
    { key: 'dakshinayana',     regions: ['all'],                  type: 'minor' },
    // Raja Parba (Odisha) — 4-day monsoon festival; we emit a single-day
    // marker on Karka Sankranti, the most widely cited anchor day.
    { key: 'raja_sankranti',   regions: ['odisha'],               type: 'major' },
    // Harela (Kumaon / Uttarakhand) — observed on Shravana solar-month start.
    { key: 'harela',           regions: ['uttarakhand'],          type: 'major' },
  ],
  // Simha (4) — Singh Sankranti is primarily observed in Odisha, Bihar,
  // and Nepal (as Singhasankranti); not a pan-Indian observance despite
  // the pre-v2.1 tagging.
  4: [
    { key: 'singh_sankranti',  regions: ['odisha', 'bihar', 'jharkhand', 'nepal'], type: 'minor' },
  ],
  // Kanya (5) — Sair (Himachal): first day of the Ashwin solar month.
  5: [
    { key: 'sair',             regions: ['himachal-pradesh'],     type: 'minor' },
  ],
  // Tula (6) — Kati Bihu (Assam): Kartika solar-month start.
  6: [
    { key: 'kati_bihu',        regions: ['assam'],                type: 'minor' },
  ],
  // Makara (9) — Uttarayana / harvest festivals
  9: [
    // Makar Sankranti is pan-Indian (re-scoped from the pre-v2.1 'north-india').
    { key: 'makar_sankranti',    regions: ['all'],                type: 'major' },
    { key: 'pongal',             regions: ['tamil-nadu'],         type: 'major' },
    { key: 'uttarayan',          regions: ['gujarat'],            type: 'major' },
    { key: 'magh_bihu',          regions: ['assam'],              type: 'major' },
    { key: 'ayyappa_makara_jyothi', regions: ['kerala'],          type: 'major' },
  ],
};

/**
 * Lohri — observed on the Hindu day immediately preceding Makara Sankranti.
 * Emitted from `computeFestivals` when `ctx.nextDaySankrantiRashi === 9`.
 */
const LOHRI_REGIONS: readonly FestivalRegion[] = ['punjab', 'haryana', 'himachal-pradesh'];

/**
 * Raja Parba (Odisha) — 3-day monsoon festival anchored on Karka Sankranti:
 *   Day 1 = Pahili Raja  (day BEFORE Karka transit; nextDaySankrantiRashi=3)
 *   Day 2 = Raja Sankranti (transit day; emitted by SANKRANTI_REGIONAL[3])
 *   Day 3 = Basi Raja    (day AFTER Karka transit; prevDaySankrantiRashi=3)
 * The library does not emit the optional 4th day (Vasumati Snana).
 */
const RAJA_REGIONS: readonly FestivalRegion[] = ['odisha'];

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
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major', dateRule: 'janmashtami-nishita', adhikaBehaviour: 'shift-to-nija' },
  // Bhadrapada (5)
  { key: 'ganesh_chaturthi',   masa: 5,  tithi: 3,  type: 'major', dateRule: 'madhyahna' },
  { key: 'anant_chaturdashi',  masa: 5,  tithi: 13, type: 'major' },
  // Ashwin (6)
  { key: 'navaratri',          masa: 6,  tithi: 0,  type: 'major' },
  { key: 'durga_ashtami',      masa: 6,  tithi: 7,  type: 'major' },
  { key: 'maha_navami',        masa: 6,  tithi: 8,  type: 'major' },
  // Vijayadashami keys on APARAHNA, not sunrise: the day Dashami covers the
  // whole aparahna kala, else the day the tithi ends. Verified against 11
  // drik years 2020–2030 (incl. Oct 20 2026 and Oct 9 2027, both of which a
  // sunrise rule mis-dates by one day).
  { key: 'dussehra',           masa: 6,  tithi: 9,  type: 'major', dateRule: 'aparahna-full' },
  { key: 'sharad_purnima',     masa: 6,  tithi: 14, type: 'major' },
  // Ashwin (6) — Krishna Paksha festivals (Amanta: Ashwin; Purnimanta calls these "Kartika")
  //
  // Karva Chauth keys on the Chaturthi prevailing at MOONRISE — the vrat
  // breaks on sighting the moon. Drik 2027 discriminates this from a sunrise
  // rule: Chaturthi Oct 18 17:52 → Oct 19 16:42, moonrise Oct 18 19:30 is
  // inside the tithi while Oct 19's 20:24 is past it → drik day Oct 18, and
  // a sunrise rule says Oct 19. Narak Chaturdashi stays on sunrise: its
  // pre-dawn moon often falls outside the sunrise-to-nextSunrise Hindu day
  // window.
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major', dateRule: 'chandrodaya', namingSystem: 'purnimanta' },
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

  // ── Regional festivals (v2.1 expansion) ─────────────────────
  // Chaitra (0) — Marathi/Konkani New Year; same tithi as Ugadi but
  // emitted as a Maharashtra-specific variant name alongside Ugadi.
  { key: 'gudi_padwa',         masa: 0,  tithi: 0,  type: 'major',
    regions: ['maharashtra', 'goa'] },
  // Chaitra (0) Shukla Tritiya — Gangaur (18-day festival concludes here).
  { key: 'gangaur',            masa: 0,  tithi: 2,  type: 'major',
    regions: ['rajasthan'] },
  // Chaitra (0) Purnima — Karaga festival of Bengaluru.
  { key: 'karaga',             masa: 0,  tithi: 14, type: 'major',
    regions: ['karnataka'] },
  // Ashadha (3) — Bonalu, Sundays at Mahakali temples across Telangana.
  { key: 'bonalu',             masa: 3,  vara: 0,   type: 'minor',
    adhikaBehaviour: 'observe-in-both',
    regions: ['telangana'] },
  // Shravana (4) Shukla Tritiya — Hariyali Teej.
  { key: 'hariyali_teej',      masa: 4,  tithi: 2,  type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'haryana', 'madhya-pradesh'] },
  // Shravana (4) Krishna Tritiya — Kajari Teej (tithi 17 = Krishna Tritiya).
  { key: 'kajari_teej',        masa: 4,  tithi: 17, type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'madhya-pradesh'] },
  // Bhadrapada (5) Shukla Tritiya — Hartalika Teej.
  { key: 'hartalika_teej',     masa: 5,  tithi: 2,  type: 'major',
    regions: ['rajasthan', 'uttar-pradesh', 'bihar', 'maharashtra', 'madhya-pradesh'] },
  // Amanta Kartika (7) Shukla Pratipada — day after Diwali.
  // In Purnimanta convention this is also "Kartika Shukla Pratipada" (naming
  // system aligns), so a namingSystem tag isn't required here.
  { key: 'govardhan_puja',     masa: 7,  tithi: 0,  type: 'major',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'rajasthan', 'gujarat',
              'madhya-pradesh', 'punjab', 'jharkhand'] },
  // Amanta Kartika (7) Shukla Dwitiya — Bhai Dooj.
  { key: 'bhai_dooj',          masa: 7,  tithi: 1,  type: 'major',
    regions: ['uttar-pradesh', 'bihar', 'haryana', 'maharashtra', 'gujarat',
              'rajasthan', 'madhya-pradesh', 'west-bengal', 'jharkhand', 'nepal'] },
  // Phalguna (11) Purnima — Phagli (varies by valley; Purnima anchor).
  { key: 'phagli',             masa: 11, tithi: 14, type: 'minor',
    regions: ['himachal-pradesh'] },
  // Ashadha (3) Shukla Dwitiya — Jagannath Rath Yatra (pan-Indian; cultural
  // epicenter is Puri, Odisha but observed nationwide).
  { key: 'jagannath_rath_yatra', masa: 3, tithi: 1, type: 'major' },
  // Shravana (4) Shukla — Varamahalakshmi: last Friday in Shukla paksha
  // before Purnima. The (masa+vara) match is gated by tithi ∈ [7,13] so
  // only the second Friday of the paksha (the one closest to Purnima) fires.
  { key: 'varamahalakshmi',    masa: 4,  vara: 5,  type: 'major',
    tithiRange: [7, 13],
    regions: ['karnataka', 'andhra-pradesh', 'telangana', 'tamil-nadu'] },
  // Bathukamma (Telangana) — 9-day floral festival from Bhadrapada
  // Amavasya through Ashwin Shukla Navami. We emit start (Engili Pula
  // Bathukamma, masa=5/tithi=29) and climax (Saddula Bathukamma, masa=6/
  // tithi=8) markers; intermediate days carry no library-level emission.
  { key: 'bathukamma_start',   masa: 5,  tithi: 29, type: 'major',
    regions: ['telangana'] },
  { key: 'bathukamma_saddula', masa: 6,  tithi: 8,  type: 'major',
    regions: ['telangana'] },
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
  /**
   * Optional: yesterday's tithi at the START of each kala. Needed by the
   * `aparahna-full` ladder (Vijayadashami) to tell "yesterday fully covered
   * the kala" (suppress today) apart from "yesterday only brushed its end"
   * (today, the tithi's end day, emits).
   */
  priorDayTithiByRuleStart?: Partial<Record<FestivalDateRule, number>>;
  /**
   * Optional: Janmashtami nishita features, supplied on Krishna Saptami /
   * Ashtami days. Drives the `janmashtami-nishita` ladder; when absent the
   * rule degrades to plain nishita prevalence.
   */
  janmashtamiNishita?: {
    /** Ashtami touches this day's nishita muhurta. */
    ashtamiAtNishita: boolean;
    /** Rohini touches this day's nishita muhurta. */
    rohiniAtNishita: boolean;
    /** Tomorrow is the udaya-Ashtami day and its nishita has Ashtami or Rohini. */
    nextDayClaims: boolean;
    /** Yesterday was an udaya-Ashtami day that already claimed (vriddha). */
    prevDayClaimed: boolean;
  };
  /** Rashi (0–11) the Sun enters during this Hindu day, or null if no transit. */
  sankrantiRashi?: number | null;
  /**
   * Rashi (0–11) the Sun enters on the NEXT Hindu day, or null if no transit
   * tomorrow. Used for "day before Sankranti" observances — most notably
   * Lohri (day before Makara) and Raja Pahili (day before Karka).
   * Omit from instant-mode callers; the festival simply won't emit.
   */
  nextDaySankrantiRashi?: number | null;
  /**
   * Rashi (0–11) the Sun entered on the PREVIOUS Hindu day, or null if no
   * transit yesterday. Used for "day after Sankranti" observances — currently
   * only Raja Basi (day after Karka transit, 3rd day of Raja Parba).
   * Omit from instant-mode callers; the festival simply won't emit.
   */
  prevDaySankrantiRashi?: number | null;
  /**
   * Vaisakhi (Punjab/Haryana): true on the CIVIL day containing the Mesha
   * transit — which is the day before the generic Sankranti day when the
   * transit falls between sunset and midnight (drik 2028: Apr 13, not Apr 14).
   */
  vaisakhiToday?: boolean;
  /**
   * Vishu (Kerala): true on the day of the first sunrise at or after the Mesha
   * transit — the day after the generic Sankranti day for a daylight transit
   * (drik 2026 and 2027: Apr 15, not Apr 14).
   */
  vishuToday?: boolean;
  /**
   * Pohela Boishakh (West Bengal): true on the day after the Mesha transit's
   * civil day; the transit day itself is Chaitra Sankranti, the last day of
   * the outgoing year (drik 2025/2026/2027/2029: Apr 15).
   */
  pohelaBoishakhToday?: boolean;
  /**
   * True when the Ekadashi at sunrise is Dashami-viddha (i.e., Dashami was
   * active at arunodaya, ~96 minutes before sunrise). The Smarta fast is still
   * observed on this udaya-vyapini day; it is the Vaishnava fast that rejects
   * a viddha Ekadashi and defers to tomorrow's Dwadashi.
   */
  ekadashiDashamiViddha?: boolean;
  /**
   * True when yesterday was a Dashami-viddha Ekadashi-at-sunrise day and
   * today is Dwadashi-at-sunrise — the Vaishnava fast lands here.
   */
  vaishnavaDwadashiToday?: boolean;
  /**
   * True when the whole Ekadashi tithi falls between today's and tomorrow's
   * sunrises (sunrise holds Dashami, next sunrise Dwadashi). The Smarta fast
   * is observed TODAY — the day the tithi begins — per DrikPanchang's
   * published kshaya cases (e.g. Devutthana Ekadashi 2026-11-20).
   */
  ekadashiKshayaToday?: boolean;
  /**
   * True the day after a kshaya Ekadashi (yesterday's sunrise held Dashami,
   * today's holds Dwadashi). The Vaishnava ("Gauna") fast is observed today.
   */
  ekadashiGaunaToday?: boolean;
  /**
   * True on the first day of a VRIDDHA DWADASHI (Pakshavardhini) that follows
   * an ordinary Ekadashi-at-sunrise day: yesterday's sunrise held Ekadashi,
   * today's and tomorrow's both hold the same Dwadashi. The Smarta fast stayed
   * on yesterday's Ekadashi; the alternate (Vaishnava) fast is observed today.
   */
  ekadashiVriddhaDwadashiToday?: boolean;
  /**
   * True on an Ekadashi-at-sunrise day whose following Dwadashi is vriddha
   * (prevails at the next two sunrises). The Vaishnava fast moves to that
   * Dwadashi, so this day carries the Smarta fast alone.
   */
  ekadashiVriddhaDwadashiTomorrow?: boolean;
  /**
   * True when tomorrow's sunrise holds Ekadashi but the sunrise after that
   * holds Trayodashi — a kshaya Dwadashi (Trisprisha). With no sunrise inside
   * Dwadashi there is no valid parana morning, and the fast (all traditions)
   * advances to today, the day the Ekadashi tithi begins (drik: Pausha
   * Putrada 2027 = Jan 18).
   */
  ekadashiTrisprishaToday?: boolean;
  /**
   * True on the Ekadashi-at-sunrise day whose following Dwadashi is kshaya
   * (next sunrise already Trayodashi): the fast was observed yesterday, so
   * this day emits no Ekadashi entries.
   */
  ekadashiTrisprishaYesterday?: boolean;
  /**
   * True when Ekadashi prevails at today's AND tomorrow's sunrise (vriddha).
   * No fast is observed today — the observance is tomorrow's Mahadwadashi
   * (drik lists nothing on the first day; e.g. 2026-05-26 vs 05-27).
   */
  ekadashiVriddhaFirstDay?: boolean;
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

  /**
   * Classical **vyapini** test: does `targetTithi` prevail over `dateRule`'s
   * kala today, without having already been claimed by yesterday?
   *
   * Sampling only the kala's midpoint misses days where the tithi covered most
   * of the kala but ended minutes before that midpoint — e.g. Janmashtami 2026
   * at Pune, where Ashtami ran 02:26 IST Sep 4 → 00:14 IST Sep 5: active at
   * nishita *start*, gone ~20 min before nishita midpoint. So a match at either
   * end of the kala counts, and the two dedupe rules below stop the same tithi
   * being emitted on consecutive days.
   *
   * This logic was previously written out three times — once in the registry
   * loop and again for Masik Shivaratri and Vinayaka Chaturthi — with all four
   * conditions repeated verbatim each time. It is the part of the festival
   * engine most likely to need correction against Drik, so it lives in one
   * place.
   */
  const prevailsInKala = (targetTithi: number, dateRule: FestivalDateRule): boolean => {
    if (dateRule === 'janmashtami-nishita') {
      // Drik's Smarta Janmashtami ladder (7 drik years 2024–2030):
      //   1. The UDAYA-Ashtami day (Ashtami at sunrise) wins when Ashtami OR
      //      Rohini touches its nishita muhurta — Rohini alone decided
      //      2027/2029/2030 against the previous day's Ashtami-at-nishita.
      //   2. Otherwise the day Ashtami covers nishita wins, Saptami-viddha
      //      or not (2025: drik prints Aug 15 though Ashtami begins
      //      11:49 PM, because Aug 16's nishita has neither).
      //   3. Rohini alone never pulls the festival onto a Navami day (2028).
      const jn = ctx.janmashtamiNishita;
      if (jn === undefined) {
        // No nishita features supplied (instant mode / bare contexts):
        // degrade to plain nishita prevalence.
        return prevailsInKala(targetTithi, 'nishita');
      }
      if (ctx.tithiIndex === targetTithi) {
        return (jn.ashtamiAtNishita || jn.rohiniAtNishita) && !jn.prevDayClaimed;
      }
      return jn.ashtamiAtNishita && !jn.nextDayClaims;
    }
    if (dateRule === 'aparahna-full') {
      // Vijayadashami's ladder, recovered from 11 drik years (2020–2030):
      //   1. The day the tithi covers the ENTIRE aparahna kala wins
      //      (Dashami at both the 3/5 and 4/5 daylight anchors).
      //   2. Covers both days' aparahna fully (vriddha, ≥ ~26.3 h tithi —
      //      not observed in the sweep): the first day. Drik notes Shravana
      //      nakshatra "plays an important role" there; unvalidatable until
      //      such a year occurs.
      //   3. Covers neither fully → the day the tithi ENDS (para-viddha:
      //      drik 2022 rejected a partial-aparahna first day for a
      //      no-aparahna second day, and 2023 took a partial second day).
      const startTithi = ctx.tithiByRuleStart?.aparahna;
      const endTithi = ctx.tithiByRule?.aparahna;
      const priorStartTithi = ctx.priorDayTithiByRuleStart?.aparahna;
      const priorEndTithi = ctx.priorDayTithiByRule?.aparahna;
      const fullToday = startTithi === targetTithi && endTithi === targetTithi;
      const fullYesterday = priorStartTithi === targetTithi && priorEndTithi === targetTithi;
      if (fullToday) return !fullYesterday;
      if (fullYesterday) return false;
      // Neither day fully covers the kala: emit on the day the tithi ends —
      // it was current earlier today (sunrise, madhyahna, or aparahna start)
      // and gone by the aparahna end.
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
      // Chandrodaya is a single instant, not a span — the span dedupes below
      // can never fire, so the vriddha case (a tithi > ~24.9 h covering two
      // consecutive moonrises) is deduped here: the first day emits.
      if (endTithi === targetTithi) return priorEndTithi !== targetTithi;
      // Fallback: the tithi touches NO moonrise on either day (began after
      // yesterday's moonrise, ended before today's) — fall back to sunrise
      // prevalence. Drik does this: Karwa Chauth 2025 (Delhi), Chaturthi
      // Oct 9 22:54 → Oct 10 19:39 vs moonrises 19:23 / 20:13, drik prints
      // Oct 10. A tithi at today's sunrise can never survive to tomorrow's
      // moonrise (would need > ~38 h), so no forward look is required.
      return ctx.tithiIndex === targetTithi && priorEndTithi !== targetTithi;
    }

    const matchedByEnd = endTithi === targetTithi;
    const matchedByStart =
      dateRule !== 'sunrise' &&
      startTithi !== undefined &&
      startTithi === targetTithi &&
      endTithi !== targetTithi;
    if (!matchedByEnd && !matchedByStart) return false;

    // The tithi only just nudged into today's kala-end, but yesterday's
    // kala-end already held it → yesterday emitted; suppress today.
    if (
      dateRule !== 'sunrise' &&
      startTithi !== undefined &&
      startTithi !== targetTithi &&
      priorEndTithi === targetTithi
    ) return false;

    // Start-only match: the tithi spanned yesterday's kala fully (yesterday
    // matched by end) and is leaving today's — yesterday wins.
    if (matchedByStart && priorEndTithi === targetTithi) return false;

    return true;
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
      // `tithiRange` (optional) further restricts the match to weekdays whose
      // tithi falls within a sub-window of the lunar month — used for
      // Varamahalakshmi (last Friday of Shravana Shukla paksha before Purnima).
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
        // `shift-to-nija`: only observe in Nija following an Adhika (but still OK if no prior Adhika,
        // since the normal year has no Adhika and the festival observes as usual).
        (adhikaBehaviour !== 'shift-to-nija' || !ctx.isAdhika);
      if (masaMatches) {
        match = prevailsInKala(rule.tithi, rule.dateRule ?? 'sunrise');
      }
    }

    if (!match) continue;

    // Regional filter: if the rule restricts its scope, emit only when the
    // caller's region is `'all'` or appears in the rule's allow-list. Rules
    // without `regions` are pan-Indian and emit unconditionally.
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

    // Purnimanta-naming awareness: add description with the Purnimanta masa name
    // for Krishna-paksha festivals that were traditionally named under the
    // Purnimanta convention.
    if (
      rule.namingSystem === 'purnimanta' &&
      ctx.purnimantaMasaName &&
      ctx.amantaMasaName
    ) {
      festival.description = nameResolver('desc_purnimanta_krishna_paksha')
        .replace('{masa}', ctx.purnimantaMasaName);
    }

    // Bhadra exclusion notice (Raksha Bandhan).
    if (rule.bhadraExclude && ctx.bhadra && ctx.formatClock) {
      const bhadraEndStr = ctx.formatClock(ctx.bhadra.end);
      festival.description = nameResolver('desc_bhadra_observe_after')
        .replace('{time}', bhadraEndStr);
    }

    results.push(festival);
  }

  // ── Ekadashi: Smarta + Vaishnava split ────────────────────
  const isEkadashiAtSunrise = ctx.tithiIndex === 10 || ctx.tithiIndex === 25;
  const paksha: 0 | 1 = ctx.tithiIndex === 10 ? 0 : ctx.tithiIndex === 25 ? 1 : 0;

  if (isEkadashiAtSunrise && ctx.ekadashiVriddhaFirstDay) {
    // Vriddha first day: Ekadashi will still be at sunrise tomorrow, and the
    // fast (a Mahadwadashi) is observed then. Nothing emits today.
  } else if (isEkadashiAtSunrise && ctx.ekadashiTrisprishaYesterday) {
    // Trisprisha (kshaya Dwadashi): the Smarta fast was advanced to
    // yesterday, the day the tithi began; today — drik's "Trisparsha
    // Mahadwadashi" — carries the Vaishnava (Gauna) fast only.
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver(ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika)),
    });
  } else if (isEkadashiAtSunrise) {
    // Named Ekadashi (description).
    const namedKey = ekadashiNameKey(ctx.chandraMasaIndex, paksha, ctx.isAdhika);
    const namedDescription = nameResolver(namedKey);

    // Smarta always fasts on the Ekadashi-at-sunrise (udaya-vyapini) day —
    // drik prints the unqualified name there in every split it publishes. The
    // Vaishnava fast leaves this day for tomorrow's Dwadashi in two cases: a
    // Dashami-viddha Ekadashi, and a vriddha (Pakshavardhini) Dwadashi.
    const vaishnavaTomorrow =
      ctx.ekadashiDashamiViddha === true || ctx.ekadashiVriddhaDwadashiTomorrow === true;
    if (!vaishnavaTomorrow) {
      // Neither split applies: Smarta and Vaishnava coincide.
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
    // Trisprisha (kshaya Dwadashi): the Ekadashi begins after this sunrise
    // and the Dwadashi that follows it contains no sunrise, so there is no
    // valid parana morning within Dwadashi — the SMARTA fast advances to
    // today, the day the tithi begins; the Vaishnava (Gauna) fast stays on
    // the Ekadashi-at-sunrise day tomorrow (drik: Devutthana 2025 = Nov 1 +
    // "Trisparsha Mahadwadashi / Vaishnava" Nov 2; Pausha Putrada 2027 =
    // Jan 18 + Gauna/Vaishnava Jan 19).
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
    // Kshaya: the Ekadashi tithi begins after this sunrise and ends before the
    // next one. The Smarta fast is observed today (drik: Yogini 2026-07-10,
    // Devutthana 2026-11-20); the Vaishnava Gauna fast follows tomorrow.
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
    // Day after a kshaya Ekadashi: the Vaishnava (Gauna) fast.
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
    // Vaishnava fast landed on Dwadashi today after yesterday's viddha Ekadashi.
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver('desc_ekadashi_viddha_vaishnava_today'),
    });
  } else if (ctx.ekadashiVriddhaDwadashiToday) {
    // Vriddha (Pakshavardhini) Dwadashi: the Smarta fast was yesterday's
    // Ekadashi; the alternate Vaishnava fast is observed today.
    results.push({
      key: 'vaishnava_ekadashi',
      name: nameResolver('vaishnava_ekadashi'),
      type: 'vaishnava_ekadashi',
      description: nameResolver('desc_ekadashi_vriddha_dwadashi_vaishnava'),
    });
  }

  // ── Sankashti Chaturthi — Krishna Chaturthi (18) at moonrise ──
  // Same vriddha dedupe as Karva Chauth: a Chaturthi covering two
  // consecutive moonrises emits on the first day only.
  if (tithiForRule('chandrodaya') === 18 && priorDayTithiForRule('chandrodaya') !== 18) {
    results.push({ key: 'sankashti_chaturthi', name: nameResolver('sankashti_chaturthi'), type: 'major' });
  }

  // ── Masik Shivaratri (monthly) — Krishna Chaturdashi (28) at nishita ──
  // Suppressed in Nija Magha (where Maha Shivaratri already fires).
  {
    const isMahaShivaratriMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 10;
    if (!isMahaShivaratriMonth && prevailsInKala(28, 'nishita')) {
      results.push({ key: 'masik_shivaratri', name: nameResolver('masik_shivaratri'), type: 'minor' });
    }
  }

  // ── Vinayaka Chaturthi (monthly) — Shukla Chaturthi (3) at madhyahna ──
  // Suppressed in Nija Bhadrapada (where Ganesh Chaturthi already fires).
  {
    const isGaneshChaturthiMonth = !ctx.isAdhika && ctx.chandraMasaIndex === 5;
    if (!isGaneshChaturthiMonth && prevailsInKala(3, 'madhyahna')) {
      results.push({ key: 'vinayaka_chaturthi', name: nameResolver('vinayaka_chaturthi'), type: 'minor' });
    }
  }

  // ── Ravi / Guru Pushya Yoga (mirror into festivals for UX) ──
  // The same detection lives in `computeSpecialYogas`; mirroring here lets
  // apps surface these as "festival-like" auspicious days without extra plumbing.
  if (ctx.nakshatraIndex === 7) {
    if (ctx.varaIndex === 0) {
      results.push({ key: 'ravi_pushya', name: nameResolver('ravi_pushya'), type: 'minor' });
    } else if (ctx.varaIndex === 4) {
      results.push({ key: 'guru_pushya', name: nameResolver('guru_pushya'), type: 'minor' });
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
    results.push({ key: 'masik_karthigai', name: nameResolver('masik_karthigai'), type: 'minor' });
  }

  // ── Pradosha Vrata — Shukla/Krishna Trayodashi at pradosha-kala ──
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

  // ── Sankranti — Sun enters a new rashi during this Hindu day ──
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

    // Regional Sankranti variants (Pongal, Vishu, Baisakhi, Magh Bihu, …).
    // Emitted as additional type-'sankranti' entries so consumers can filter
    // or display them alongside the canonical Sankranti event.
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

  // ── Regional solar new years that do NOT share the transit day ──
  // Vaisakhi keys off the transit's civil day, Vishu off the first sunrise at
  // or after it, Pohela Boishakh off the day after the transit's civil day.
  // The flags are computed in dayFestivals (see the drik 2025–2029 table
  // there); instant-mode callers omit them and simply emit nothing.
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

  // ── Lohri — Hindu day immediately preceding Makara Sankranti ──
  // Fired from `nextDaySankrantiRashi === 9`; the caller (getDailyPanchang)
  // supplies this by checking tomorrow's transit. Scoped to Punjab / Haryana /
  // Himachal; not emitted in instant mode (context field is omitted there).
  if (ctx.nextDaySankrantiRashi === 9) {
    if (region === 'all' || LOHRI_REGIONS.includes(region)) {
      results.push({ key: 'lohri', name: nameResolver('lohri'), type: 'major' });
    }
  }

  // ── Raja Parba day 1 (Pahili Raja) — day before Karka Sankranti ──
  if (ctx.nextDaySankrantiRashi === 3) {
    if (region === 'all' || RAJA_REGIONS.includes(region)) {
      results.push({ key: 'raja_pahili', name: nameResolver('raja_pahili'), type: 'major' });
    }
  }

  // ── Raja Parba day 3 (Basi Raja) — day after Karka Sankranti ──
  if (ctx.prevDaySankrantiRashi === 3) {
    if (region === 'all' || RAJA_REGIONS.includes(region)) {
      results.push({ key: 'raja_basi', name: nameResolver('raja_basi'), type: 'major' });
    }
  }

  return results;
}
