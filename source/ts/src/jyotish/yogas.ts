import { computeAspects } from './aspects';
import { computeDignity, type Dignity } from './dignity';
import { YOGA_CATALOG, type YogaContext } from './yogasCatalog';
import { PanchangError } from '../types/errors';
import type {
  BirthChart, DivisionalChart, GrahaName, PlanetPlacement,
  Yoga, YogaType,
} from '../types/jyotish';

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

const YOGA_TYPES: Readonly<Record<YogaType, true>> = {
  mahapurusha: true, lunar: true, solar: true, raja: true,
  dhana: true, special: true, cancellation: true, negative: true,
};

export interface ComputeYogasOptions {
  /** Omit or leave empty to evaluate the whole catalog; an unknown type throws `INVALID_INPUT`. */
  types?: readonly YogaType[];

  /** D9 chart for the Vargottama rule; without it Vargottama is silently skipped. */
  navamsa?: DivisionalChart;

  /** Forwarded to {@link computeAspects}; defaults to BPHS-literal `'7-only'`. */
  nodeAspects?: '7-only' | '5-and-9';
}

/**
 * Named classical yogas present in a natal D1 chart; names are transliterated proper nouns, not locale-resolved.
 * A lagna rashi index outside 0..11 throws `PanchangError` `INVALID_INPUT`.
 */
export function computeYogas(chart: BirthChart, options: ComputeYogasOptions = {}): Yoga[] {
  const ctx = buildContext(chart, options);
  for (const type of options.types ?? []) {
    if (!Object.prototype.hasOwnProperty.call(YOGA_TYPES, type)) {
      throw new PanchangError(`unknown yoga type "${String(type)}"`, 'INVALID_INPUT');
    }
  }

  const typeFilter = options.types && options.types.length > 0
    ? new Set<YogaType>(options.types)
    : null;

  const out: Yoga[] = [];
  for (const rule of YOGA_CATALOG) {
    if (typeFilter && !typeFilter.has(rule.type)) continue;
    const match = rule.evaluate(ctx);
    if (match) {
      const yoga: Yoga = { name: rule.name, type: rule.type, reasons: match.reasons };
      if (match.bhanga) yoga.bhanga = match.bhanga;
      out.push(yoga);
    }
  }
  return out;
}

function buildContext(chart: BirthChart, options: ComputeYogasOptions): YogaContext {
  const planetByName = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of chart.planets) planetByName[p.planet] = p;

  const dignity = {} as Record<GrahaName, Dignity>;
  for (const g of VISIBLE_GRAHAS) {
    const p = planetByName[g];
    dignity[g] = computeDignity(g, p.rashi.index);
  }
  for (const g of ['Rahu', 'Ketu'] as const) {
    const p = planetByName[g];
    dignity[g] = computeDignity(g, p.rashi.index);
  }
  const lagnaRashi = chart.lagna.rashi.index;
  if (!Number.isInteger(lagnaRashi) || lagnaRashi < 0 || lagnaRashi > 11) {
    throw new PanchangError(`lagna rashi must be integer in [0, 11], got ${lagnaRashi}`, 'INVALID_INPUT');
  }

  const aspects = computeAspects(chart, { nodeAspects: options.nodeAspects ?? '7-only' });

  return {
    chart,
    dignity,
    aspects,
    navamsa: options.navamsa,
    planetByName,
    lagnaRashi,
  };
}
