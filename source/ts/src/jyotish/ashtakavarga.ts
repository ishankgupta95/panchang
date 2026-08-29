import {
  ASHTAKAVARGA_CONTRIBUTORS, ASHTAKAVARGA_RECEIVERS,
  BENEFIC_OFFSETS, EKADHIPATYA_PAIRS, TRIKONA_TRIADS,
  type AshtakavargaContributor, type AshtakavargaReceiver,
} from './ashtakavargaTables';
import type {
  AshtakavargaResult, BhinnashtakaGrid, BirthChart,
} from '../types/jyotish';

/**
 * The per-graha Bhinnashtaka grids and their Sarvashtaka sum (BPHS Ch. 66);
 * Rahu and Ketu neither receive nor contribute.
 *
 * @param options `{ reductions: true }` adds the Trikona- and Ekadhipatya-Sodhana grids (BPHS Ch. 67, Santhanam recension).
 */
export function computeAshtakavarga(
  chart: BirthChart,
  options: { reductions?: boolean } = {},
): AshtakavargaResult {
  const contributorRashi = collectContributorRashis(chart);
  const occupied = collectOccupiedRashis(chart);

  const bhinnashtaka = {} as Record<AshtakavargaReceiver, BhinnashtakaGrid>;
  for (const receiver of ASHTAKAVARGA_RECEIVERS) {
    bhinnashtaka[receiver] = bhinnashtakaFor(receiver, contributorRashi);
  }

  const sarvashtaka = sumGrids(ASHTAKAVARGA_RECEIVERS.map((r) => bhinnashtaka[r]));

  const result: AshtakavargaResult = { sarvashtaka, bhinnashtaka };

  if (options.reductions) {
    const reducedBhinn = {} as Record<AshtakavargaReceiver, BhinnashtakaGrid>;
    for (const receiver of ASHTAKAVARGA_RECEIVERS) {
      reducedBhinn[receiver] = applyReductions(bhinnashtaka[receiver], occupied);
    }
    result.reduced = {
      sarvashtaka: sumGrids(ASHTAKAVARGA_RECEIVERS.map((r) => reducedBhinn[r])),
      bhinnashtaka: reducedBhinn,
    };
  }

  return result;
}

function collectContributorRashis(chart: BirthChart): Record<AshtakavargaContributor, number> {
  const out = {} as Record<AshtakavargaContributor, number>;
  out.Lagna = chart.lagna.rashi.index;
  for (const placement of chart.planets) {
    if (placement.planet === 'Rahu' || placement.planet === 'Ketu') continue;
    out[placement.planet] = placement.rashi.index;
  }
  return out;
}

function collectOccupiedRashis(chart: BirthChart): ReadonlySet<number> {
  const out = new Set<number>();
  for (const placement of chart.planets) {
    if (placement.planet === 'Rahu' || placement.planet === 'Ketu') continue;
    out.add(placement.rashi.index);
  }
  return out;
}

function bhinnashtakaFor(
  receiver: AshtakavargaReceiver,
  contributorRashi: Record<AshtakavargaContributor, number>,
): BhinnashtakaGrid {
  const grid = new Array<number>(12).fill(0);
  const lookup = BENEFIC_OFFSETS[receiver];
  for (const contributor of ASHTAKAVARGA_CONTRIBUTORS) {
    const baseRashi = contributorRashi[contributor];
    const offsets = lookup[contributor];
    for (const offset of offsets) {
      const target = (baseRashi + offset - 1) % 12;
      grid[target]! += 1;
    }
  }
  return grid;
}

function sumGrids(grids: readonly BhinnashtakaGrid[]): BhinnashtakaGrid {
  const out = new Array<number>(12).fill(0);
  for (const g of grids) {
    for (let i = 0; i < 12; i++) out[i]! += g[i]!;
  }
  return out;
}

// Trikona first, then Ekadhipatya. Commentaries are unanimous on the order.
function applyReductions(
  grid: BhinnashtakaGrid,
  occupied: ReadonlySet<number>,
): BhinnashtakaGrid {
  const stage1 = applyTrikonaSodhana(grid);
  return applyEkadhipatyaSodhana(stage1, occupied);
}

// Subtracting each triad's minimum means a zero cell reduces nothing, which is
// PVR's Rule 1; zeroing the whole triad instead is what no reference does.
function applyTrikonaSodhana(grid: BhinnashtakaGrid): BhinnashtakaGrid {
  const out = grid.slice();
  for (const triad of TRIKONA_TRIADS) {
    const m = Math.min(out[triad[0]]!, out[triad[1]]!, out[triad[2]]!);
    out[triad[0]]! -= m;
    out[triad[1]]! -= m;
    out[triad[2]]! -= m;
  }
  return out;
}

// PVR Narasimha Rao / PyJHora form: the one-occupied case REPLACES the vacant
// cell with the occupied value when it is greater rather than zeroing it.
function applyEkadhipatyaSodhana(
  grid: BhinnashtakaGrid,
  occupied: ReadonlySet<number>,
): BhinnashtakaGrid {
  const out = grid.slice();
  for (const pair of EKADHIPATYA_PAIRS) {
    const [a, b] = pair;
    const aOcc = occupied.has(a);
    const bOcc = occupied.has(b);

    if (out[a]! === 0 || out[b]! === 0) continue;
    if (aOcc && bOcc) continue;

    if (!aOcc && !bOcc) {
      if (out[a]! !== out[b]!) {
        const m = Math.min(out[a]!, out[b]!);
        out[a] = m;
        out[b] = m;
      } else {
        out[a] = 0;
        out[b] = 0;
      }
      continue;
    }

    const occIdx = aOcc ? a : b;
    const vacIdx = aOcc ? b : a;
    out[vacIdx] = out[vacIdx]! <= out[occIdx]! ? 0 : out[occIdx]!;
  }
  return out;
}

export const _bhinnashtakaForTest = bhinnashtakaFor;
export const _applyTrikonaSodhanaForTest = applyTrikonaSodhana;
export const _applyEkadhipatyaSodhanaForTest = applyEkadhipatyaSodhana;
