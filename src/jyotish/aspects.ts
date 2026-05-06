import type { AspectMap, BirthChart, GrahaName, PlanetPlacement } from '../types/jyotish';

/**
 * Houses (relative offsets) aspected by each graha *in addition to* the
 * universal 7th aspect. Offsets are 0-based — `0` means "self", which is
 * never aspected; we add 6 (the 7th aspect) explicitly in `computeAspects`.
 *
 * Source: BPHS Ch. 26 ("Drishti Vichar"). Mars sees the 4th and 8th, Jupiter
 * the 5th and 9th, Saturn the 3rd and 10th. The other six grahas (Sun, Moon,
 * Mercury, Venus, Rahu, Ketu in the BPHS-literal reading) have only the
 * universal 7th aspect.
 */
const SPECIAL_OFFSETS: Record<GrahaName, readonly number[]> = {
  Sun:     [],
  Moon:    [],
  Mars:    [3, 7],   // 4th (offset 3) + 8th (offset 7)
  Mercury: [],
  Jupiter: [4, 8],   // 5th + 9th
  Venus:   [],
  Saturn:  [2, 9],   // 3rd + 10th
  Rahu:    [],
  Ketu:    [],
};

/**
 * Optional rule extension: Rahu and Ketu inherit the 5th and 9th aspect of
 * Jupiter / a Jupiter-like reading respectively. Some traditions (e.g.
 * BV Raman, KP) apply this; BPHS does not. Off by default — pass
 * `{ nodeAspects: '5-and-9' }` to enable.
 */
const NODE_5_9_OFFSETS: readonly number[] = [4, 8];

export interface AspectsOptions {
  /**
   * How Rahu / Ketu aspects are computed:
   *   - `'7-only'` (default) — BPHS literal: nodes have only the universal
   *     7th aspect.
   *   - `'5-and-9'` — extends the nodes with 5th and 9th aspects (BV Raman
   *     / KP convention).
   */
  nodeAspects?: '7-only' | '5-and-9';
}

/**
 * Compute the set of houses aspected by every graha in a chart.
 *
 * Every graha aspects the 7th house from itself. The four malefics (Mars,
 * Jupiter, Saturn, plus optionally Rahu / Ketu) gain extra "special"
 * aspects:
 *
 *   - Mars: 4th and 8th from itself.
 *   - Jupiter: 5th and 9th from itself.
 *   - Saturn: 3rd and 10th from itself.
 *   - Rahu / Ketu: 7th only (BPHS); pass `{ nodeAspects: '5-and-9' }` to
 *     opt into the BV Raman / KP convention adding 5th and 9th.
 *
 * Aspects are reported in **chart-house** terms — `chart.planets[i].house`
 * is the source, and the offsets are added modulo 12 to get the destination
 * houses. The output array for each graha is sorted ascending.
 *
 * @param chart   Natal D1 chart (or any chart with a `planets` array of 9
 *                graha placements with `house: 1..12`). Divisional charts
 *                also work — the algorithm is purely house-arithmetic.
 * @param options Aspect rule options.
 *
 * @example
 * ```typescript
 * const chart = computeRashiChart(birthDate, location);
 * const aspects = computeAspects(chart);
 * // Houses aspected by Mars (always includes 7th from Mars):
 * aspects.Mars; // e.g. [4, 8, 11] when Mars is in house 1
 * ```
 */
export function computeAspects(
  chart: BirthChart,
  options: AspectsOptions = {},
): AspectMap {
  const nodeAspects = options.nodeAspects ?? '7-only';
  const out: Partial<Record<GrahaName, number[]>> = {};

  for (const planet of chart.planets) {
    out[planet.planet] = housesAspected(planet, nodeAspects);
  }

  return out as AspectMap;
}

function housesAspected(
  planet: PlanetPlacement,
  nodeAspects: '7-only' | '5-and-9',
): number[] {
  const offsets: number[] = [6]; // universal 7th aspect (offset 6 = +6 houses)

  const special = SPECIAL_OFFSETS[planet.planet];
  for (const o of special) offsets.push(o);

  if (nodeAspects === '5-and-9' && (planet.planet === 'Rahu' || planet.planet === 'Ketu')) {
    for (const o of NODE_5_9_OFFSETS) offsets.push(o);
  }

  // Convert offsets (0-indexed from self) to absolute houses (1..12).
  const houses = offsets.map((o) => ((planet.house - 1 + o) % 12) + 1);
  // Sorted, deduped.
  return Array.from(new Set(houses)).sort((a, b) => a - b);
}
