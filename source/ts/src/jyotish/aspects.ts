import type { AspectMap, BirthChart, GrahaName, PlanetPlacement } from '../types/jyotish';

/** 0-based house offsets, beyond the universal 7th. BPHS Ch. 26. */
const SPECIAL_OFFSETS: Record<GrahaName, readonly number[]> = {
  Sun:     [],
  Moon:    [],
  Mars:    [3, 7],
  Mercury: [],
  Jupiter: [4, 8],
  Venus:   [],
  Saturn:  [2, 9],
  Rahu:    [],
  Ketu:    [],
};

/** Node 5th/9th aspects: BV Raman / KP convention, not BPHS. */
const NODE_5_9_OFFSETS: readonly number[] = [4, 8];

export interface AspectsOptions {
  /** `'7-only'` (default, BPHS-literal) or `'5-and-9'` (BV Raman / KP). */
  nodeAspects?: '7-only' | '5-and-9';
}

/** Houses aspected by each graha: the universal 7th plus the special BPHS Ch. 26 aspects. */
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
  const offsets: number[] = [6];

  const special = SPECIAL_OFFSETS[planet.planet];
  for (const o of special) offsets.push(o);

  if (nodeAspects === '5-and-9' && (planet.planet === 'Rahu' || planet.planet === 'Ketu')) {
    for (const o of NODE_5_9_OFFSETS) offsets.push(o);
  }

  const houses = offsets.map((o) => ((planet.house - 1 + o) % 12) + 1);
  return Array.from(new Set(houses)).sort((a, b) => a - b);
}
