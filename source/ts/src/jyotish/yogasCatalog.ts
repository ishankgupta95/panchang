import type {
  AspectMap, BirthChart, DivisionalChart, GrahaName,
  PlanetPlacement, Yoga, YogaName, YogaType,
} from '../types/jyotish';
import type { Dignity } from './dignity';

/**
 * Sources per rule group: Mahapurusha: BPHS Ch. 36, Phaladeepika Ch. 6; Lunar / Solar: BPHS Ch. 38,
 * B.V. Raman *300 Important Combinations* §§4-7; Raja: BPHS Ch. 39, Sanjay Rath *Crux of Vedic
 * Astrology* Ch. 9; Vipareeta Raja: BPHS Ch. 41 (Harsha / Sarala / Vimala as one trio rule);
 * Lakshmi / Dhana / Vasumati: BPHS Ch. 40, Raman §§19-21; Vargottama: BPHS Ch. 14;
 * Yogakaraka: BPHS Ch. 34; Neecha Bhanga: BPHS Ch. 36; Daridra: BPHS Ch. 41.
 */

const KENDRA_HOUSES: readonly number[] = [1, 4, 7, 10];
const DUSTHANA_HOUSES: readonly number[] = [6, 8, 12];

const RASHI_LORDS: readonly GrahaName[] = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

/** 0-based; mirrors `dignity.ts`, duplicated to keep the catalog self-contained. */
const EXALTATION_RASHI: Record<GrahaName, number | null> = {
  Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3,
  Venus: 11, Saturn: 6, Rahu: null, Ketu: null,
};

/** BPHS Ch. 34: only these six lagnas have one planet lording both a kendra and a trikona. */
const YOGAKARAKA_BY_LAGNA: Partial<Record<number, GrahaName>> = {
  1: 'Saturn',
  3: 'Mars',
  4: 'Mars',
  6: 'Saturn',
  9: 'Venus',
  10: 'Venus',
};

const NATURAL_BENEFICS: readonly GrahaName[] = ['Jupiter', 'Venus', 'Mercury', 'Moon'];

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

export interface YogaContext {
  chart: BirthChart;
  dignity: Record<GrahaName, Dignity>;
  aspects: AspectMap;
  navamsa?: DivisionalChart;
  planetByName: Record<GrahaName, PlanetPlacement>;
  /** 0..11. */
  lagnaRashi: number;
}

export interface YogaMatch {
  reasons: string[];
  bhanga?: { applies: boolean; reasons: string[] };
}

export interface YogaRule {
  name: YogaName;
  type: YogaType;
  evaluate: (ctx: YogaContext) => YogaMatch | null;
}

/** `house` is 1-indexed; house 1 = lagna. */
function houseLord(lagnaRashi: number, house: number): GrahaName {
  return RASHI_LORDS[(lagnaRashi + house - 1) % 12]!;
}

/** Inclusive 1..12 offset: same rashi → 1, not 0. */
function rashiOffsetFromTo(sourceRashi: number, targetRashi: number): number {
  return ((targetRashi - sourceRashi + 12) % 12) + 1;
}

function isOwnOrExalted(d: Dignity): boolean {
  return d === 'own' || d === 'moolatrikona' || d === 'exalted';
}

const HOUSE_ORDINAL: readonly string[] = [
  '', '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
];

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

/** Sun or Moon in the yoga-causing planet's rashi cancels it; `applies: false` means evaluated, did not fire. */
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

/** BPHS / Phaladeepika split between 10° and 12°; 10° matches `shadbala.ts`. */
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

    const bhangaReasons: string[] = [];
    const sun = ctx.planetByName.Sun;
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
    // Rahu/Ketu excluded per B.V. Raman.
    for (const p of ctx.chart.planets) {
      if (p.planet === 'Moon' || p.planet === 'Rahu' || p.planet === 'Ketu') continue;
      const off = rashiOffsetFromTo(moonRashi, p.rashi.index);
      if (off === 1 || off === 2 || off === 12) return null;
    }
    return {
      reasons: [
        'No planet in 2nd, 12th, or conjunct with Moon (Moon isolated from visible grahas)',
      ],
    };
  },
};

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
        const pairKey = [k, t].sort().join('|');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const kp = ctx.planetByName[k];
        const tp = ctx.planetByName[t];
        if (kp.rashi.index === tp.rashi.index) {
          reasons.push(`Kendra-lord ${k} conjunct trikona-lord ${t} in ${kp.rashi.name}`);
          continue;
        }
        // Sambandha requires a MUTUAL aspect; a one-way special aspect does not form the yoga.
        const kAspectsT = ctx.aspects[k]?.includes(tp.house);
        const tAspectsK = ctx.aspects[t]?.includes(kp.house);
        if (kAspectsT && tAspectsK) {
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

/** 10, not 12: the 12th is a vyaya house (B.V. Raman, *300 Important Combinations* §21). */
const UPACHAYA_HOUSES: readonly number[] = [3, 6, 10, 11];

const VASUMATI_YOGA_RULE: YogaRule = {
  name: 'Vasumati Yoga',
  type: 'dhana',
  evaluate: (ctx) => {
    // Raman: every benefic in an upachaya (not every upachaya filled), from the lagna, not the Moon.
    const placed: string[] = [];
    for (const g of NATURAL_BENEFICS) {
      const p = ctx.planetByName[g];
      if (!UPACHAYA_HOUSES.includes(p.house)) return null;
      placed.push(`${g} (house ${p.house})`);
    }
    return {
      reasons: [`All natural benefics in upachayas from lagna: ${placed.join(', ')}`],
    };
  },
};

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

const KENDRA_OFFSETS_FROM_MOON: ReadonlySet<number> = new Set([1, 4, 7, 10]);

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

      // Rule A: dispositor in a kendra from Lagna OR from Moon (Phaladeepika 7.26).
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

      // Rule B: exaltation-rashi lord in a kendra from Lagna OR Moon (Phaladeepika 7.26).
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

      // Rule C: an exalted graha in a kendra from the debilitated planet (offset 1 = conjunct).
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

      // Rule D: dispositor aspects the debilitated planet's house (Phaladeepika 7.28).
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

/** Catalog order is the order of the `Yoga[]` returned by `computeYogas`. */
export const YOGA_CATALOG: readonly YogaRule[] = [
  mahapurushaRule('Ruchaka', 'Mars'),
  mahapurushaRule('Bhadra', 'Mercury'),
  mahapurushaRule('Hamsa', 'Jupiter'),
  mahapurushaRule('Malavya', 'Venus'),
  mahapurushaRule('Sasha', 'Saturn'),
  GAJAKESARI_RULE,
  SUNAPHA_RULE,
  ANAPHA_RULE,
  DURUDHURA_RULE,
  KEMADRUMA_RULE,
  BUDHA_ADITYA_RULE,
  VESHI_RULE,
  VASI_RULE,
  UBHAYACHARI_RULE,
  RAJA_YOGA_RULE,
  DHARMA_KARMADHIPATI_RULE,
  VIPAREETA_RAJA_RULE,
  LAKSHMI_YOGA_RULE,
  lordsConjunctRule('Dhana Yoga (2-11)', 'dhana', 2, 11),
  lordsConjunctRule('Dhana Yoga (5-9)', 'dhana', 5, 9),
  VASUMATI_YOGA_RULE,
  VARGOTTAMA_RULE,
  YOGAKARAKA_RULE,
  NEECHA_BHANGA_RULE,
  DARIDRA_YOGA_RULE,
];

/** @internal */
export type CatalogYoga = Yoga;
