import { computeAspects } from './aspects';
import { computeDignity, type Dignity } from './dignity';
import { YOGA_CATALOG, type YogaContext } from './yogasCatalog';
import type {
  BirthChart, DivisionalChart, GrahaName, PlanetPlacement,
  Yoga, YogaType,
} from '../types/jyotish';

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

export interface ComputeYogasOptions {
  /** Omit or leave empty to evaluate the whole catalog. */
  types?: readonly YogaType[];

  /** D9 chart for the Vargottama rule; without it Vargottama is silently skipped. */
  navamsa?: DivisionalChart;

  /** Forwarded to {@link computeAspects}; defaults to BPHS-literal `'7-only'`. */
  nodeAspects?: '7-only' | '5-and-9';
}

/** Named classical yogas present in a natal D1 chart; names are transliterated proper nouns, not locale-resolved. */
export function computeYogas(chart: BirthChart, options: ComputeYogasOptions = {}): Yoga[] {
  const ctx = buildContext(chart, options);

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

  const aspects = computeAspects(chart, { nodeAspects: options.nodeAspects ?? '7-only' });

  return {
    chart,
    dignity,
    aspects,
    navamsa: options.navamsa,
    planetByName,
    lagnaRashi: chart.lagna.rashi.index,
  };
}
