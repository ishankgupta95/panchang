import type {
  AspectMap, BirthChart, DivisionalChart, GrahaName,
  PlanetPlacement, Yoga, YogaName, YogaType,
} from '../types/jyotish';
import type { Dignity } from './dignity';

/**
 * Yoga catalog — declarative classical-yoga detection rules.
 *
 * Each entry is a `YogaRule`: a name, a type, and an `evaluate` function that
 * inspects the prepared {@link YogaContext} and returns a {@link YogaMatch}
 * (with one or more `reasons[]` strings) or `null`.
 *
 * The catalog is fixed at ~25 yogas; the engine in `yogas.ts` is a thin
 * loop that runs each rule and collects the matches. **Adding a new yoga is
 * a data-only change here** — no engine change required.
 *
 * Sources for individual rules:
 *   - Mahapurusha: BPHS Ch. 36, Phaladeepika Ch. 6 (Pancha Mahapurusha).
 *   - Lunar / Solar yogas: BPHS Ch. 38; B.V. Raman *300 Important
 *     Combinations* §§4–7.
 *   - Raja yogas: BPHS Ch. 39; Sanjay Rath *Crux of Vedic Astrology* Ch. 9.
 *   - Vipareeta Raja Yoga: BPHS Ch. 41 (Harsha / Sarala / Vimala combined
 *     into a single trio rule per the catalog spec in this library).
 *   - Lakshmi / Dhana / Vasumati: BPHS Ch. 40; B.V. Raman §§19–21.
 *   - Vargottama: BPHS Ch. 14 (divisional doctrine).
 *   - Yogakaraka: BPHS Ch. 34; classical Saptarishi notes on lagna lords.
 *   - Neecha Bhanga: BPHS Ch. 36 (multiple sub-rules combined).
 *   - Daridra: BPHS Ch. 41 (negative dhana rule).
 */

// ── House and rashi tables ────────────────────────────

const KENDRA_HOUSES: readonly number[] = [1, 4, 7, 10];
const DUSTHANA_HOUSES: readonly number[] = [6, 8, 12];

/**
 * Rashi-lord (graha) by 0-based rashi index. Hard-coded per the locked
 * 12-rashi → lord map; do not derive on the fly.
 *   0  Aries       — Mars
 *   1  Taurus      — Venus
 *   2  Gemini      — Mercury
 *   3  Cancer      — Moon
 *   4  Leo         — Sun
 *   5  Virgo       — Mercury
 *   6  Libra       — Venus
 *   7  Scorpio     — Mars
 *   8  Sagittarius — Jupiter
 *   9  Capricorn   — Saturn
 *  10  Aquarius    — Saturn
 *  11  Pisces      — Jupiter
 */
const RASHI_LORDS: readonly GrahaName[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

/**
 * Each visible graha's exaltation rashi (0-based). Used by Neecha Bhanga
 * to look up the exaltation-lord. Mirrors the same table in
 * `dignity.ts` — duplicated here to keep the catalog self-contained.
 */
const EXALTATION_RASHI: Record<GrahaName, number | null> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3,
  Venus: 11, Saturn: 6, Rahu: null, Ketu: null,
};

/**
 * Yogakaraka assignments (BPHS Ch. 34). Only six lagnas have a single
 * planet that lords both a kendra and a trikona; other lagnas have no
 * Yogakaraka.
 */
const YOGAKARAKA_BY_LAGNA: Partial<Record<number, GrahaName>> = {
  1: 'Saturn',   // Taurus  — Saturn lords 9 (trikona) + 10 (kendra)
  3: 'Mars',     // Cancer  — Mars   lords 5 (trikona) + 10 (kendra) (Aries+Scorpio rashis)
  4: 'Mars',     // Leo     — Mars   lords 4 (kendra)  + 9 (trikona) (Scorpio+Aries)
  6: 'Saturn',   // Libra   — Saturn lords 4 (kendra)  + 5 (trikona) (Capricorn+Aquarius)
  9: 'Venus',    // Capricorn — Venus lords 5 (trikona) + 10 (kendra) (Taurus+Libra)
  10: 'Venus',   // Aquarius  — Venus lords 4 (kendra)  + 9 (trikona) (Taurus+Libra)
};

/** Natural benefics for Vasumati and similar rules. */
const NATURAL_BENEFICS: readonly GrahaName[] = ['Jupiter', 'Venus', 'Mercury', 'Moon'];

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

// ── Public yoga-rule shape ────────────────────────────

/**
 * Context passed to every rule's `evaluate`. Built once per
 * `computeYogas` invocation in `yogas.ts`.
 */
export interface YogaContext {
  chart: BirthChart;
  /** Dignity of each visible graha in its natal rashi. */
  dignity: Record<GrahaName, Dignity>;
  /** Aspect map (houses 1..12 aspected by each graha). */
  aspects: AspectMap;
  /**
   * D9 navamsa chart. Only Vargottama needs it; other rules ignore the
   * field. When omitted, Vargottama is silently skipped.
   */
  navamsa?: DivisionalChart;
  /** Convenience: planet placement keyed by `GrahaName`. */
  planetByName: Record<GrahaName, PlanetPlacement>;
  /** Lagna rashi index, 0..11. */
  lagnaRashi: number;
}

/** Result of a positive rule evaluation. */
export interface YogaMatch {
  reasons: string[];
  /**
   * Optional bhanga (cancellation) annotation produced by rules that
   * carry classical cancellation logic. Surfaced on the output `Yoga`
   * verbatim by the engine in `yogas.ts`. See
   * `notes/phase34c-research.md` for the per-yoga rule sourcing.
   */
  bhanga?: { applies: boolean; reasons: string[] };
}

/** Single rule entry — a name + type + evaluator. */
export interface YogaRule {
  name: YogaName;
  type: YogaType;
  evaluate: (ctx: YogaContext) => YogaMatch | null;
}

// ── Helpers (catalog-private) ─────────────────────────

/**
 * Lord of the rashi N houses from lagna (1-indexed; house 1 = lagna).
 * For lagna in rashi `L` and house `H`, the rashi is `(L + H - 1) mod 12`,
 * whose lord is `RASHI_LORDS[(L + H - 1) mod 12]`.
 */
function houseLord(lagnaRashi: number, house: number): GrahaName {
  return RASHI_LORDS[(lagnaRashi + house - 1) % 12]!;
}

/**
 * 1..12 offset from `sourceRashi` to `targetRashi` (inclusive). E.g.
 * `rashiOffsetFromTo(0, 0)` → 1 (same rashi), `(0, 11)` → 12,
 * `(11, 0)` → 2.
 */
function rashiOffsetFromTo(sourceRashi: number, targetRashi: number): number {
  return ((targetRashi - sourceRashi + 12) % 12) + 1;
}

/** True if the given dignity counts as own-or-stronger (own/moolatrikona/exalted). */
function isOwnOrExalted(d: Dignity): boolean {
  return d === 'own' || d === 'moolatrikona' || d === 'exalted';
}

const HOUSE_ORDINAL: readonly string[] = [
  '', '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
];

// ── Mahapurusha (5 yogas) ─────────────────────────────

/**
 * Generic Mahapurusha rule constructor. Fires when the named planet is
 * own/moolatrikona/exalted AND in a kendra (1, 4, 7, 10) from lagna.
 *
 * Carries a bhanga rule (M1): if Sun OR Moon is in the same rashi as the
 * yoga-causing planet, the yoga is classically cancelled. Source: BPHS-
 * attributed multi-pandit consensus (mypandit, powerofastro, BPHS
 * shloka cited via search summaries). See
 * `notes/phase34c-research.md` §2.
 */
function mahapurushaRule(name: YogaName, planet: GrahaName): YogaRule {
  return {
    name,
    type: 'mahapurusha',
    evaluate: (ctx) => {
      const p = ctx.planetByName[planet];
      const dignity = ctx.dignity[planet];
      if (!isOwnOrExalted(dignity)) return null;
      if (!KENDRA_HOUSES.includes(p.house)) return null;
      return {
        reasons: [`${planet} ${dignity} in ${p.rashi.name}, in kendra (house ${p.house})`],
        bhanga: mahapurushaBhanga(ctx, planet, p.rashi.index, p.rashi.name),
      };
    },
  };
}

/**
 * Bhanga (Rule M1) — Sun or Moon conjunct (same rashi as) the
 * yoga-causing planet. Returns the bhanga annotation in the
 * `{ applies, reasons }` shape regardless of trigger; `applies: false`
 * with empty `reasons` signals "rule was evaluated and did not fire".
 */
function mahapurushaBhanga(
  ctx: YogaContext,
  planet: GrahaName,
  planetRashi: number,
  planetRashiName: string,
): { applies: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const luminary of ['Sun', 'Moon'] as const) {
    if (ctx.planetByName[luminary].rashi.index === planetRashi) {
      reasons.push(`${planet} conjunct ${luminary} in ${planetRashiName}`);
    }
  }
  return { applies: reasons.length > 0, reasons };
}

// ── Lunar yogas (Moon-based) ──────────────────────────

/**
 * Combustion threshold (degrees) for the Gajakesari bhanga check.
 * Matches the Chesta Bala combustion threshold convention
 * documented in `src/jyotish/shadbala.ts`. BPHS / Phaladeepika split
 * between 10° and 12°; the 10° anchor matches our internal
 * convention for consistency.
 */
const JUPITER_COMBUSTION_ARC_DEG = 10;

const GAJAKESARI_RULE: YogaRule = {
  name: 'Gajakesari',
  type: 'lunar',
  evaluate: (ctx) => {
    const moon = ctx.planetByName.Moon;
    const jup = ctx.planetByName.Jupiter;
    const offset = rashiOffsetFromTo(moon.rashi.index, jup.rashi.index);
    if (offset !== 1 && offset !== 4 && offset !== 7 && offset !== 10) return null;
    const desc = offset === 1 ? '1st (conjunct)' : `${HOUSE_ORDINAL[offset]}`;

    // Bhanga (Rules G1 + G2). Multi-pandit consensus + BPHS attribution:
    // Jupiter combust (within 10° of Sun) OR Jupiter debilitated cancels
    // Gajakesari. Both can fire simultaneously (Jupiter combust AND
    // debilitated when Sun + Jupiter conjunct in Capricorn). See
    // `notes/phase34c-research.md` §3.
    const bhangaReasons: string[] = [];
    const sun = ctx.planetByName.Sun;
    // Angular distance to Sun, wrapped to [0, 180]. 0 = conjunction.
    const angularDistance = Math.abs(((jup.longitude - sun.longitude + 540) % 360) - 180);
    if (angularDistance <= JUPITER_COMBUSTION_ARC_DEG) {
      bhangaReasons.push(`Jupiter combust (within ${JUPITER_COMBUSTION_ARC_DEG}° of Sun)`);
    }
    if (ctx.dignity.Jupiter === 'debilitated') {
      bhangaReasons.push(`Jupiter debilitated in ${jup.rashi.name}`);
    }

    return {
      reasons: [`Jupiter in ${desc} from Moon (kendra)`],
      bhanga: { applies: bhangaReasons.length > 0, reasons: bhangaReasons },
    };
  },
};

/** Returns visible grahas (excluding the named exclusions) at the given rashi-offset from `fromRashi`. */
function planetsAtOffsetFrom(
  ctx: YogaContext,
  fromRashi: number,
  offset: number,
  exclude: readonly GrahaName[],
): GrahaName[] {
  const out: GrahaName[] = [];
  for (const p of ctx.chart.planets) {
    if (exclude.includes(p.planet)) continue;
    if (p.planet === 'Rahu' || p.planet === 'Ketu') continue;
    if (rashiOffsetFromTo(fromRashi, p.rashi.index) === offset) out.push(p.planet);
  }
  return out;
}

const SUNAPHA_RULE: YogaRule = {
  name: 'Sunapha',
  type: 'lunar',
  evaluate: (ctx) => {
    const moonRashi = ctx.planetByName.Moon.rashi.index;
    const planets = planetsAtOffsetFrom(ctx, moonRashi, 2, ['Sun', 'Moon']);
    if (planets.length === 0) return null;
    return { reasons: [`${planets.join(', ')} in 2nd from Moon`] };
  },
};

const ANAPHA_RULE: YogaRule = {
  name: 'Anapha',
  type: 'lunar',
  evaluate: (ctx) => {
    const moonRashi = ctx.planetByName.Moon.rashi.index;
    const planets = planetsAtOffsetFrom(ctx, moonRashi, 12, ['Sun', 'Moon']);
    if (planets.length === 0) return null;
    return { reasons: [`${planets.join(', ')} in 12th from Moon`] };
  },
};

const DURUDHURA_RULE: YogaRule = {
  name: 'Durudhura',
  type: 'lunar',
  evaluate: (ctx) => {
    const moonRashi = ctx.planetByName.Moon.rashi.index;
    const second = planetsAtOffsetFrom(ctx, moonRashi, 2, ['Sun', 'Moon']);
    const twelfth = planetsAtOffsetFrom(ctx, moonRashi, 12, ['Sun', 'Moon']);
    if (second.length === 0 || twelfth.length === 0) return null;
    return {
      reasons: [
        `${second.join(', ')} in 2nd from Moon; ${twelfth.join(', ')} in 12th from Moon`,
      ],
    };
  },
};

const KEMADRUMA_RULE: YogaRule = {
  name: 'Kemadruma',
  type: 'lunar',
  evaluate: (ctx) => {
    const moon = ctx.planetByName.Moon;
    const moonRashi = moon.rashi.index;
    // Visible-graha-only sweep (Rahu/Ketu excluded per BV Raman).
    for (const p of ctx.chart.planets) {
      if (p.planet === 'Moon' || p.planet === 'Rahu' || p.planet === 'Ketu') continue;
      const off = rashiOffsetFromTo(moonRashi, p.rashi.index);
      if (off === 1 || off === 2 || off === 12) return null; // conjunct or adjacent
    }
    return {
      reasons: [
        'No planet in 2nd, 12th, or conjunct with Moon (Moon isolated from visible grahas)',
      ],
    };
  },
};

// ── Solar yogas (Sun-based) ───────────────────────────

const BUDHA_ADITYA_RULE: YogaRule = {
  name: 'Budha-Aditya',
  type: 'solar',
  evaluate: (ctx) => {
    const sun = ctx.planetByName.Sun;
    const mer = ctx.planetByName.Mercury;
    if (sun.rashi.index !== mer.rashi.index) return null;
    return { reasons: [`Sun and Mercury conjunct in ${sun.rashi.name}`] };
  },
};

const VESHI_RULE: YogaRule = {
  name: 'Veshi',
  type: 'solar',
  evaluate: (ctx) => {
    const sunRashi = ctx.planetByName.Sun.rashi.index;
    const planets = planetsAtOffsetFrom(ctx, sunRashi, 2, ['Sun', 'Moon']);
    if (planets.length === 0) return null;
    return { reasons: [`${planets.join(', ')} in 2nd from Sun`] };
  },
};

const VASI_RULE: YogaRule = {
  name: 'Vasi',
  type: 'solar',
  evaluate: (ctx) => {
    const sunRashi = ctx.planetByName.Sun.rashi.index;
    const planets = planetsAtOffsetFrom(ctx, sunRashi, 12, ['Sun', 'Moon']);
    if (planets.length === 0) return null;
    return { reasons: [`${planets.join(', ')} in 12th from Sun`] };
  },
};

const UBHAYACHARI_RULE: YogaRule = {
  name: 'Ubhayachari',
  type: 'solar',
  evaluate: (ctx) => {
    const sunRashi = ctx.planetByName.Sun.rashi.index;
    const second = planetsAtOffsetFrom(ctx, sunRashi, 2, ['Sun', 'Moon']);
    const twelfth = planetsAtOffsetFrom(ctx, sunRashi, 12, ['Sun', 'Moon']);
    if (second.length === 0 || twelfth.length === 0) return null;
    return {
      reasons: [
        `${second.join(', ')} in 2nd from Sun; ${twelfth.join(', ')} in 12th from Sun`,
      ],
    };
  },
};

// ── Raja yogas ────────────────────────────────────────

/**
 * Generic Raja Yoga: a kendra-lord and a (distinct) trikona-lord are
 * either conjunct in the same rashi or aspect each other.
 */
const RAJA_YOGA_RULE: YogaRule = {
  name: 'Raja Yoga',
  type: 'raja',
  evaluate: (ctx) => {
    const kendraLords = new Set<GrahaName>();
    for (const h of KENDRA_HOUSES) kendraLords.add(houseLord(ctx.lagnaRashi, h));
    const trikonaLords = new Set<GrahaName>();
    for (const h of [1, 5, 9]) trikonaLords.add(houseLord(ctx.lagnaRashi, h));

    const reasons: string[] = [];
    const seenPairs = new Set<string>();
    for (const k of kendraLords) {
      for (const t of trikonaLords) {
        if (k === t) continue;
        // Canonicalize the pair to avoid emitting both (k,t) and (t,k).
        const pairKey = [k, t].sort().join('|');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const kp = ctx.planetByName[k];
        const tp = ctx.planetByName[t];
        if (kp.rashi.index === tp.rashi.index) {
          reasons.push(`Kendra-lord ${k} conjunct trikona-lord ${t} in ${kp.rashi.name}`);
          continue;
        }
        const kAspectsT = ctx.aspects[k]?.includes(tp.house);
        const tAspectsK = ctx.aspects[t]?.includes(kp.house);
        if (kAspectsT || tAspectsK) {
          reasons.push(`Kendra-lord ${k} and trikona-lord ${t} in mutual aspect`);
        }
      }
    }
    return reasons.length > 0 ? { reasons } : null;
  },
};

const DHARMA_KARMADHIPATI_RULE: YogaRule = {
  name: 'Dharma-Karmadhipati',
  type: 'raja',
  evaluate: (ctx) => {
    const lord9 = houseLord(ctx.lagnaRashi, 9);
    const lord10 = houseLord(ctx.lagnaRashi, 10);
    if (lord9 === lord10) return null;
    const p9 = ctx.planetByName[lord9];
    const p10 = ctx.planetByName[lord10];
    if (p9.rashi.index === p10.rashi.index) {
      return {
        reasons: [`9th lord ${lord9} conjunct 10th lord ${lord10} in ${p9.rashi.name}`],
      };
    }
    const a = ctx.aspects[lord9]?.includes(p10.house);
    const b = ctx.aspects[lord10]?.includes(p9.house);
    if (a && b) {
      return { reasons: [`9th lord ${lord9} and 10th lord ${lord10} in mutual aspect`] };
    }
    return null;
  },
};

const VIPAREETA_RAJA_RULE: YogaRule = {
  name: 'Vipareeta Raja Yoga',
  type: 'raja',
  evaluate: (ctx) => {
    const lord6 = houseLord(ctx.lagnaRashi, 6);
    const lord8 = houseLord(ctx.lagnaRashi, 8);
    const lord12 = houseLord(ctx.lagnaRashi, 12);
    const distinct = Array.from(new Set([lord6, lord8, lord12]));

    const rashiIdxs = distinct.map((l) => ctx.planetByName[l].rashi.index);
    if (!rashiIdxs.every((r) => r === rashiIdxs[0])) return null;

    const housePos = ctx.planetByName[distinct[0]!].house;
    if (!DUSTHANA_HOUSES.includes(housePos)) return null;

    return {
      reasons: [
        `6th/8th/12th lords (${distinct.join(', ')}) conjunct in ${
          ctx.planetByName[distinct[0]!].rashi.name
        } (house ${housePos})`,
      ],
    };
  },
};

const LAKSHMI_YOGA_RULE: YogaRule = {
  name: 'Lakshmi Yoga',
  type: 'raja',
  evaluate: (ctx) => {
    const lord9 = houseLord(ctx.lagnaRashi, 9);
    const dig9 = ctx.dignity[lord9];
    const digV = ctx.dignity.Venus;
    if (!isOwnOrExalted(dig9) || !isOwnOrExalted(digV)) return null;
    return {
      reasons: [`9th lord ${lord9} ${dig9}; Venus ${digV}`],
    };
  },
};

// ── Dhana yogas ───────────────────────────────────────

function lordsConjunctRule(
  name: YogaName,
  type: YogaType,
  h1: number,
  h2: number,
): YogaRule {
  return {
    name,
    type,
    evaluate: (ctx) => {
      const a = houseLord(ctx.lagnaRashi, h1);
      const b = houseLord(ctx.lagnaRashi, h2);
      if (a === b) return null;
      const pa = ctx.planetByName[a];
      const pb = ctx.planetByName[b];
      if (pa.rashi.index !== pb.rashi.index) return null;
      return {
        reasons: [
          `${HOUSE_ORDINAL[h1]} lord ${a} conjunct ${HOUSE_ORDINAL[h2]} lord ${b} in ${pa.rashi.name}`,
        ],
      };
    },
  };
}

const VASUMATI_YOGA_RULE: YogaRule = {
  name: 'Vasumati Yoga',
  type: 'dhana',
  evaluate: (ctx) => {
    const required: readonly number[] = [3, 6, 11, 12];
    const filled = new Set<number>();
    for (const p of ctx.chart.planets) {
      if (!NATURAL_BENEFICS.includes(p.planet)) continue;
      if (required.includes(p.house)) filled.add(p.house);
    }
    if (filled.size !== required.length) return null;
    return {
      reasons: ['Natural benefics occupy houses 3, 6, 11, and 12 from lagna'],
    };
  },
};

// ── Special yogas ─────────────────────────────────────

const VARGOTTAMA_RULE: YogaRule = {
  name: 'Vargottama',
  type: 'special',
  evaluate: (ctx) => {
    if (!ctx.navamsa) return null;
    const reasons: string[] = [];
    for (const p of ctx.chart.planets) {
      const d9 = ctx.navamsa.planets.find((np) => np.planet === p.planet);
      if (!d9) continue;
      if (d9.rashi.index === p.rashi.index) {
        reasons.push(`${p.planet} in ${p.rashi.name} in both D1 and D9`);
      }
    }
    return reasons.length > 0 ? { reasons } : null;
  },
};

const YOGAKARAKA_RULE: YogaRule = {
  name: 'Yogakaraka',
  type: 'special',
  evaluate: (ctx) => {
    const planet = YOGAKARAKA_BY_LAGNA[ctx.lagnaRashi];
    if (!planet) return null;
    const p = ctx.planetByName[planet];
    return {
      reasons: [
        `${planet} is Yogakaraka for ${ctx.chart.lagna.rashi.name} lagna (in ${p.rashi.name}, house ${p.house})`,
      ],
    };
  },
};

// ── Cancellation: Neecha Bhanga ───────────────────────

/**
 * Kendra offsets (1-indexed houses 1/4/7/10) for the Phase-34c
 * Moon-kendra extension to Rules A and B.
 */
const KENDRA_OFFSETS_FROM_MOON: ReadonlySet<number> = new Set([1, 4, 7, 10]);

/**
 * Offset (1..12) from `sourceRashi` to `targetRashi`, identical to
 * `rashiOffsetFromTo`. Aliased here for readability inside the
 * Neecha Bhanga rule, where the source is consistently the Moon's
 * rashi.
 */
function houseFromMoon(moonRashi: number, planetRashi: number): number {
  return rashiOffsetFromTo(moonRashi, planetRashi);
}

const NEECHA_BHANGA_RULE: YogaRule = {
  name: 'Neecha Bhanga',
  type: 'cancellation',
  evaluate: (ctx) => {
    const reasons: string[] = [];
    const moonRashi = ctx.planetByName.Moon.rashi.index;

    for (const g of VISIBLE_GRAHAS) {
      if (ctx.dignity[g] !== 'debilitated') continue;
      const p = ctx.planetByName[g];

      // Rule A — dispositor (lord of debilitation rashi) in a kendra
      // from Lagna OR from Moon. Phaladeepika 7.26 specifies "from
      // Lagna OR Moon"; the pre-34c implementation only checked Lagna.
      const dispositor = RASHI_LORDS[p.rashi.index]!;
      if (dispositor !== g) {
        const dpp = ctx.planetByName[dispositor];
        if (KENDRA_HOUSES.includes(dpp.house)) {
          reasons.push(
            `${g} debilitated in ${p.rashi.name}; dispositor ${dispositor} in kendra from Lagna (house ${dpp.house})`,
          );
        } else {
          const moonHouse = houseFromMoon(moonRashi, dpp.rashi.index);
          if (KENDRA_OFFSETS_FROM_MOON.has(moonHouse)) {
            reasons.push(
              `${g} debilitated in ${p.rashi.name}; dispositor ${dispositor} in kendra from Moon (${HOUSE_ORDINAL[moonHouse]} from Moon)`,
            );
          }
        }
      }

      // Rule B — lord of the planet's exaltation rashi in a kendra
      // from Lagna OR from Moon. Same Phaladeepika 7.26 source.
      const exRashi = EXALTATION_RASHI[g];
      if (exRashi !== null) {
        const exLord = RASHI_LORDS[exRashi]!;
        if (exLord !== g) {
          const exp = ctx.planetByName[exLord];
          if (KENDRA_HOUSES.includes(exp.house)) {
            reasons.push(
              `${g} debilitated in ${p.rashi.name}; lord of exaltation rashi ${exLord} in kendra from Lagna (house ${exp.house})`,
            );
          } else {
            const moonHouse = houseFromMoon(moonRashi, exp.rashi.index);
            if (KENDRA_OFFSETS_FROM_MOON.has(moonHouse)) {
              reasons.push(
                `${g} debilitated in ${p.rashi.name}; lord of exaltation rashi ${exLord} in kendra from Moon (${HOUSE_ORDINAL[moonHouse]} from Moon)`,
              );
            }
          }
        }
      }

      // Rule C — an exalted graha sits in a kendra (1/4/7/10) from the
      // debilitated planet's house. Heritage rule (covers the
      // "conjunct exalted" classical sub-case at offset 1).
      for (const other of VISIBLE_GRAHAS) {
        if (other === g) continue;
        if (ctx.dignity[other] !== 'exalted') continue;
        const op = ctx.planetByName[other];
        const off = ((op.house - p.house + 12) % 12) + 1;
        if (off === 1 || off === 4 || off === 7 || off === 10) {
          reasons.push(
            `${g} debilitated in ${p.rashi.name}; exalted ${other} in ${HOUSE_ORDINAL[off]} from ${g} (kendra)`,
          );
        }
      }

      // Rule D (Phase 34c) — dispositor of the debilitated planet
      // aspects the debilitated planet's house. Phaladeepika 7.28,
      // corroborated by aaps.space + pratulogy.
      if (dispositor !== g) {
        const aspectedHouses = ctx.aspects[dispositor];
        if (aspectedHouses && aspectedHouses.includes(p.house)) {
          reasons.push(
            `${g} debilitated in ${p.rashi.name}; dispositor ${dispositor} aspects ${g}`,
          );
        }
      }
    }

    return reasons.length > 0 ? { reasons } : null;
  },
};

// ── Negative: Daridra ─────────────────────────────────

const DARIDRA_YOGA_RULE: YogaRule = {
  name: 'Daridra Yoga',
  type: 'negative',
  evaluate: (ctx) => {
    const reasons: string[] = [];
    const lord11 = houseLord(ctx.lagnaRashi, 11);
    const p11 = ctx.planetByName[lord11];
    if (p11.house === 12) {
      reasons.push(`11th lord ${lord11} in 12th house`);
    }
    const lord2 = houseLord(ctx.lagnaRashi, 2);
    const p2 = ctx.planetByName[lord2];
    if (DUSTHANA_HOUSES.includes(p2.house)) {
      reasons.push(`2nd lord ${lord2} in dusthana (house ${p2.house})`);
    }
    return reasons.length > 0 ? { reasons } : null;
  },
};

// ── The full catalog (~25 yogas) ──────────────────────

/**
 * The fixed catalog of named yogas, in catalog order. The same order is
 * used to assemble the {@link Yoga[]} output of `computeYogas`.
 */
export const YOGA_CATALOG: readonly YogaRule[] = [
  // 5 Pancha Mahapurusha
  mahapurushaRule('Ruchaka', 'Mars'),
  mahapurushaRule('Bhadra', 'Mercury'),
  mahapurushaRule('Hamsa', 'Jupiter'),
  mahapurushaRule('Malavya', 'Venus'),
  mahapurushaRule('Sasha', 'Saturn'),
  // 5 Lunar
  GAJAKESARI_RULE,
  SUNAPHA_RULE,
  ANAPHA_RULE,
  DURUDHURA_RULE,
  KEMADRUMA_RULE,
  // 4 Solar
  BUDHA_ADITYA_RULE,
  VESHI_RULE,
  VASI_RULE,
  UBHAYACHARI_RULE,
  // 4 Raja
  RAJA_YOGA_RULE,
  DHARMA_KARMADHIPATI_RULE,
  VIPAREETA_RAJA_RULE,
  LAKSHMI_YOGA_RULE,
  // 3 Dhana
  lordsConjunctRule('Dhana Yoga (2-11)', 'dhana', 2, 11),
  lordsConjunctRule('Dhana Yoga (5-9)', 'dhana', 5, 9),
  VASUMATI_YOGA_RULE,
  // 2 Special
  VARGOTTAMA_RULE,
  YOGAKARAKA_RULE,
  // 1 Cancellation
  NEECHA_BHANGA_RULE,
  // 1 Negative
  DARIDRA_YOGA_RULE,
];

/** @internal — convenience type assertion for the engine. */
export type CatalogYoga = Yoga;
