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

/**
 * Options for {@link computeYogas}.
 */
export interface ComputeYogasOptions {
  /**
   * Restrict the catalog to the given subset of types. When omitted (or
   * empty), every yoga in the catalog is evaluated. Filtering happens
   * before rule evaluation, so unsupported types incur zero cost.
   */
  types?: readonly YogaType[];

  /**
   * Optional D9 (Navamsa) chart used by the Vargottama rule. When not
   * supplied, Vargottama is silently skipped — the rest of the catalog
   * runs unchanged.
   */
  navamsa?: DivisionalChart;

  /**
   * Aspect-rule selector forwarded to {@link computeAspects}. Defaults
   * to BPHS-literal `'7-only'` for the nodes.
   */
  nodeAspects?: '7-only' | '5-and-9';
}

/**
 * Detect named classical yogas in a natal D1 chart against a fixed
 * ~25-entry catalog (Pancha Mahapurusha + lunar / solar / raja / dhana /
 * special / cancellation / negative groups).
 *
 * The engine is a thin loop over `YOGA_CATALOG`; **adding a yoga is a
 * data-only change in [src/jyotish/yogasCatalog.ts](src/jyotish/yogasCatalog.ts)**.
 * Each rule is given the chart, precomputed `dignity` / `aspects` (and
 * optionally a D9 chart), and returns a `YogaMatch | null`.
 *
 * Yoga names are English / transliterated proper nouns and are **not**
 * locale-resolved — `'Gajakesari'` reads the same in `'en'` and `'hi'`.
 *
 * @param chart   Natal D1 chart from `computeRashiChart`.
 * @param options Optional filter / D9 / aspect-rule options.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeYogas } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * const yogas = computeYogas(chart);
 * // → [{ name: 'Gajakesari', type: 'lunar', reasons: ['Jupiter in 4th from Moon (kendra)'] }, …]
 *
 * // Restrict to one type
 * const raja = computeYogas(chart, { types: ['raja'] });
 *
 * // Include Vargottama by passing the D9 chart
 * import { computeNavamsa } from 'panchang-ts';
 * const d9 = computeNavamsa(birth, loc);
 * const all = computeYogas(chart, { navamsa: d9 });
 * ```
 */
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
      out.push({ name: rule.name, type: rule.type, reasons: match.reasons });
    }
  }
  return out;
}

// ── Context assembly ──────────────────────────────────

/**
 * Pre-compute the data each rule needs:
 *   - `planetByName` — quick lookup of placement by graha name.
 *   - `dignity`      — `computeDignity` for each visible graha at its natal rashi.
 *   - `aspects`      — `computeAspects` once for the whole chart.
 *   - `lagnaRashi`   — convenience copy for catalog rules.
 */
function buildContext(chart: BirthChart, options: ComputeYogasOptions): YogaContext {
  const planetByName = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of chart.planets) planetByName[p.planet] = p;

  const dignity = {} as Record<GrahaName, Dignity>;
  for (const g of VISIBLE_GRAHAS) {
    const p = planetByName[g];
    dignity[g] = computeDignity(g, p.rashi.index);
  }
  // Rahu/Ketu — included for type coverage; rules don't read them today.
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
