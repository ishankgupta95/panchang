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
 * A festival rule keyed either by (chandra-masa + tithi) or (solar-masa + nakshatra).
 * Exactly one of the two matching strategies is used per rule.
 */
interface FestivalRule {
  key: string;
  type: 'major' | 'minor';
  /** Amanta Chandra masa 0–11 for tithi-based festivals */
  masa?: number;
  /** Tithi 0–29 for tithi-based festivals */
  tithi?: number;
  /** Solar-masa (Sun's sidereal rashi) 0–11 for nakshatra-based festivals */
  solarMasa?: number;
  /** Nakshatra 0–26 for nakshatra-based festivals */
  nakshatra?: number;
  /** Canonical time at which the qualifying index must hold. Defaults to `sunrise`. */
  dateRule?: FestivalDateRule;
}

/**
 * Registry of major pan-Indian Hindu festivals.
 *
 * Chandra Masa indices (Amanta): 0=Chaitra … 11=Phalguna.
 * Tithi indices: 0=Shukla Pratipad … 14=Purnima … 15=Krishna Pratipad … 29=Amavasya.
 * Nakshatra indices: 0=Ashwini … 26=Revati.
 * Solar masa indices: 0=Mesha … 11=Meena.
 */
const FESTIVAL_REGISTRY: readonly FestivalRule[] = [
  // Chaitra (0)
  { key: 'ugadi',              masa: 0,  tithi: 0,  type: 'major' },
  { key: 'rama_navami',        masa: 0,  tithi: 8,  type: 'major', dateRule: 'madhyahna' },
  { key: 'hanuman_jayanti',    masa: 0,  tithi: 14, type: 'major' },
  // Vaishakha (1)
  { key: 'akshaya_tritiya',    masa: 1,  tithi: 2,  type: 'major', dateRule: 'madhyahna' },
  // Ashadha (3)
  { key: 'guru_purnima',       masa: 3,  tithi: 14, type: 'major' },
  // Shravana (4)
  { key: 'nag_panchami',       masa: 4,  tithi: 4,  type: 'minor' },
  // Raksha Bandhan: classical rule is aparahna-vyapini Purnima, but pan-Indian
  // modern observance follows the simpler "Purnima at sunrise" rule (Drik included)
  // because aparahna-vyapini excludes otherwise-valid days where Purnima ends
  // just before aparahna. We use sunrise for compatibility with published panchangs.
  { key: 'raksha_bandhan',     masa: 4,  tithi: 14, type: 'major' },
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major', dateRule: 'nishita' },
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
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major' },
  { key: 'dhanteras',          masa: 6,  tithi: 27, type: 'major', dateRule: 'pradosha' },
  { key: 'narak_chaturdashi',  masa: 6,  tithi: 28, type: 'major' },
  { key: 'diwali',             masa: 6,  tithi: 29, type: 'major', dateRule: 'pradosha' },
  // Kartika (7) — Shukla Paksha
  { key: 'kartika_purnima',    masa: 7,  tithi: 14, type: 'minor' },
  // Magha (10)
  { key: 'vasant_panchami',    masa: 10, tithi: 4,  type: 'major', dateRule: 'madhyahna' },
  { key: 'maha_shivaratri',    masa: 10, tithi: 28, type: 'major', dateRule: 'nishita' },
  // Phalguna (11)
  { key: 'holi',               masa: 11, tithi: 14, type: 'major' },
  // Bhadrapada (5) — end of Pitru Paksha
  { key: 'mahalaya_amavasya',  masa: 5,  tithi: 29, type: 'major' },
  // ── Nakshatra-based (solar-month calendar) ──────────────────
  // Onam — Shravana nakshatra in Simha solar month (Malayalam calendar).
  { key: 'onam',               solarMasa: 4, nakshatra: 21, type: 'major' },
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
  /** Amanta chandra masa 0–11 at sunrise. */
  chandraMasaIndex: number;
  /** True if the chandra masa is Adhika (leap). Most fixed festivals skip Adhika months. */
  isAdhika: boolean;
  /** Vara 0–6. Currently unused in festival rules; reserved. */
  varaIndex: number;
  /** Solar masa 0–11 (Sun's sidereal rashi) at sunrise. Used by nakshatra-based rules. */
  solarMasaIndex: number;
  /** Optional: tithi index at non-sunrise canonical times. Missing entries fall back to tithiIndex. */
  tithiByRule?: Partial<Record<FestivalDateRule, number>>;
  /** Rashi (0–11) the Sun enters during this Hindu day, or null if no transit. */
  sankrantiRashi?: number | null;
  /**
   * True when the Ekadashi at sunrise is Dashami-viddha (i.e., Dashami was
   * active at arunodaya, ~96 minutes before sunrise). Smarta schools shift
   * the fast to the next day in that case; Vaishnava always fasts today.
   */
  ekadashiDashamiViddha?: boolean;
}

/**
 * Detect festivals for a Hindu day (sunrise-to-next-sunrise).
 *
 * Rules are evaluated as follows:
 *   - Tithi-based rules match against tithi at the rule's `dateRule` canonical
 *     time (sunrise, madhyahna, aparahna, pradosha, nishita, or chandrodaya),
 *     falling back to tithi-at-sunrise if the specific canonical time wasn't supplied.
 *   - Nakshatra-based rules match against (solarMasa + nakshatra) at sunrise.
 *   - Ekadashi fires on tithi 10/25 at sunrise, with a description noting
 *     Dashami-viddha (Smarta fast deferred) when applicable.
 *   - Sankashti Chaturthi fires on Krishna Chaturthi (18) at moonrise.
 *   - Pradosha Vrata fires on Shukla or Krishna Trayodashi (12/27) at pradosha-kala.
 *   - Sankranti fires on the Hindu day containing a solar rashi transit.
 *
 * Festivals in the fixed registry are skipped during Adhika (leap) months.
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

  // ── Fixed registry festivals ──────────────────────────────
  if (!ctx.isAdhika) {
    for (const rule of FESTIVAL_REGISTRY) {
      let match = false;
      if (rule.nakshatra !== undefined && rule.solarMasa !== undefined) {
        match = rule.solarMasa === ctx.solarMasaIndex && rule.nakshatra === ctx.nakshatraIndex;
      } else if (rule.masa !== undefined && rule.tithi !== undefined) {
        const effectiveTithi = tithiForRule(rule.dateRule ?? 'sunrise');
        match = rule.masa === ctx.chandraMasaIndex && rule.tithi === effectiveTithi;
      }
      if (match) {
        results.push({ name: nameResolver(rule.key), type: rule.type });
      }
    }
  }

  // ── Ekadashi (every month, both pakshas) ──────────────────
  if (ctx.tithiIndex === 10 || ctx.tithiIndex === 25) {
    results.push({
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
      ...(ctx.ekadashiDashamiViddha
        ? { description: 'Dashami-viddha: Smarta fast observed next day (Dwadashi); Vaishnava fast today.' }
        : {}),
    });
  }

  // ── Sankashti Chaturthi — Krishna Chaturthi (18) at moonrise ──
  if (tithiForRule('chandrodaya') === 18) {
    results.push({ name: nameResolver('sankashti_chaturthi'), type: 'major' });
  }

  // ── Pradosha Vrata — Shukla or Krishna Trayodashi at pradosha-kala ──
  const pradoshaTithi = tithiForRule('pradosha');
  if (pradoshaTithi === 12 || pradoshaTithi === 27) {
    results.push({ name: nameResolver('pradosha'), type: 'pradosha' });
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
  }

  return results;
}
