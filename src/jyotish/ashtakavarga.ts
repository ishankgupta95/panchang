import {
  ASHTAKAVARGA_CONTRIBUTORS, ASHTAKAVARGA_RECEIVERS,
  BENEFIC_OFFSETS, EKADHIPATYA_PAIRS, TRIKONA_TRIADS,
  type AshtakavargaContributor, type AshtakavargaReceiver,
} from './ashtakavargaTables';
import type {
  AshtakavargaResult, BhinnashtakaGrid, BirthChart,
} from '../types/jyotish';

/**
 * Compute Ashtakavarga — per-graha Bhinnashtaka grids and the summed
 * Sarvashtaka grid for a natal chart (BPHS Ch. 66).
 *
 * For each receiver graha G ∈ {Sun, Moon, Mars, Mercury, Jupiter, Venus,
 * Saturn} and each contributor C ∈ {Sun..Saturn, Lagna}, the canonical
 * BENEFIC_OFFSETS table lists the 1-based offsets at which C donates a
 * benefic dot (bindu) into G's grid. Each contributor placed in rashi
 * `S_rashi` deposits one bindu in rashi `(S_rashi + offset - 1) mod 12`
 * for every offset listed. Sum across the 8 contributors → Bhinnashtaka(G);
 * sum across the 7 receivers → Sarvashtaka.
 *
 * The grids depend only on the *rashi indices* of the 7 visible grahas and
 * the lagna — degree-within-rashi is irrelevant. Rahu and Ketu are not
 * receivers and not contributors in the classical Parashara scheme.
 *
 * **Reductions** (opt-in via `{ reductions: true }`, BPHS Ch. 67):
 *   - *Trikona Sodhana* — within each elemental triad (Aries/Leo/Sag,
 *     Taurus/Virgo/Cap, Gem/Lib/Aqua, Cancer/Scorpio/Pisces), if any cell
 *     is 0 in a given Bhinnashtaka grid, all three cells become 0;
 *     otherwise subtract the minimum value from all three.
 *   - *Ekadhipatya Sodhana* — within each pair of rashis sharing one
 *     graha-lord (Aries+Scorpio, Taurus+Libra, Gemini+Virgo,
 *     Sagittarius+Pisces, Capricorn+Aquarius), with reference to which
 *     of the two rashis is occupied by a graha (Sun..Saturn) in the
 *     natal chart, zero-out the un-occupied or lower cell. Cancer and Leo
 *     have unique lords and are excluded.
 *
 * The reduction logic implements the most-cited Santhanam BPHS Ch. 67
 * formulation. Multiple recensions of the rule exist in the classical
 * literature; the form below is what the test fixtures pin.
 *
 * @param chart   Natal D1 chart from `computeRashiChart`. The 7 visible
 *                grahas + Lagna provide the contributor positions.
 * @param options `{ reductions?: boolean }` — set true to also return the
 *                Trikona+Ekadhipatya-reduced grids alongside the unreduced.
 *
 * @example
 * ```typescript
 * import { computeRashiChart, computeAshtakavarga } from 'panchang-ts';
 *
 * const chart = computeRashiChart(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * const av = computeAshtakavarga(chart);
 * av.sarvashtaka;             // 12 cells, 0..56 each, sum = 336
 * av.bhinnashtaka.Jupiter;    // Jupiter's 12-cell grid, sum = 56
 *
 * const withReductions = computeAshtakavarga(chart, { reductions: true });
 * withReductions.reduced!.sarvashtaka;  // post-Sodhana totals
 * ```
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

// ── Contributor / occupancy collection ────────────────

/**
 * Map every contributor (the 7 visible grahas + Lagna) to its 0-based
 * rashi index in the natal chart.
 */
function collectContributorRashis(chart: BirthChart): Record<AshtakavargaContributor, number> {
  const out = {} as Record<AshtakavargaContributor, number>;
  out.Lagna = chart.lagna.rashi.index;
  for (const placement of chart.planets) {
    if (placement.planet === 'Rahu' || placement.planet === 'Ketu') continue;
    out[placement.planet] = placement.rashi.index;
  }
  return out;
}

/**
 * Set of rashi indices (0..11) occupied by any visible graha (Sun..Saturn).
 * Used by Ekadhipatya Sodhana — Rahu/Ketu and Lagna do not count as
 * "occupants" in the classical reduction rule.
 */
function collectOccupiedRashis(chart: BirthChart): ReadonlySet<number> {
  const out = new Set<number>();
  for (const placement of chart.planets) {
    if (placement.planet === 'Rahu' || placement.planet === 'Ketu') continue;
    out.add(placement.rashi.index);
  }
  return out;
}

// ── Bhinnashtaka assembly ─────────────────────────────

/**
 * Walk the 8 contributor lists for a single receiver, depositing bindus at
 * `(contributorRashi + offset - 1) mod 12` for every offset in each list.
 */
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

/** Cell-wise sum of N grids (each 12 cells). */
function sumGrids(grids: readonly BhinnashtakaGrid[]): BhinnashtakaGrid {
  const out = new Array<number>(12).fill(0);
  for (const g of grids) {
    for (let i = 0; i < 12; i++) out[i]! += g[i]!;
  }
  return out;
}

// ── Reductions (BPHS Ch. 67) ──────────────────────────

/**
 * Apply Trikona Sodhana followed by Ekadhipatya Sodhana to a single
 * Bhinnashtaka grid. Returns a new grid (input is not mutated).
 *
 * Per BPHS Ch. 67 the two reductions are applied sequentially in the order
 * given here; classical commentaries are unanimous on Trikona-first.
 */
function applyReductions(
  grid: BhinnashtakaGrid,
  occupied: ReadonlySet<number>,
): BhinnashtakaGrid {
  const stage1 = applyTrikonaSodhana(grid);
  return applyEkadhipatyaSodhana(stage1, occupied);
}

/**
 * Trikona Sodhana — within each elemental triad of rashis 4 houses apart,
 * reduce all three cells in the receiver's grid by their minimum. If any
 * one cell in the triad was already 0, all three become 0. Equivalent
 * formulation: the reduced cell value is `cell - min(triad)` if no cell
 * is zero, else 0.
 */
function applyTrikonaSodhana(grid: BhinnashtakaGrid): BhinnashtakaGrid {
  const out = grid.slice();
  for (const triad of TRIKONA_TRIADS) {
    const a = out[triad[0]]!;
    const b = out[triad[1]]!;
    const c = out[triad[2]]!;
    if (a === 0 || b === 0 || c === 0) {
      out[triad[0]] = 0;
      out[triad[1]] = 0;
      out[triad[2]] = 0;
    } else {
      const m = Math.min(a, b, c);
      out[triad[0]] = a - m;
      out[triad[1]] = b - m;
      out[triad[2]] = c - m;
    }
  }
  return out;
}

/**
 * Ekadhipatya Sodhana — within each pair of rashis sharing a single
 * graha-lord, reduce based on which rashi is occupied (by a graha
 * Sun..Saturn) in the natal chart:
 *
 *   - Both rashis occupied: no change.
 *   - Both rashis vacant: zero out the lower-value cell; if the values
 *     are equal, zero both.
 *   - One occupied, one vacant: zero the vacant cell if its value is
 *     ≥ the occupied cell; if its value is < the occupied cell, zero
 *     out only the vacant cell anyway (the unoccupied rashi cannot
 *     "hold" bindus when its lord-pair sibling has a planet).
 *
 * The "vacant cell zeroed" rule is the most-cited Santhanam BPHS Ch. 67
 * formulation. Cancer (lord Moon) and Leo (lord Sun) are excluded —
 * they have unique rulers.
 */
function applyEkadhipatyaSodhana(
  grid: BhinnashtakaGrid,
  occupied: ReadonlySet<number>,
): BhinnashtakaGrid {
  const out = grid.slice();
  for (const pair of EKADHIPATYA_PAIRS) {
    const [a, b] = pair;
    const aOcc = occupied.has(a);
    const bOcc = occupied.has(b);
    const aVal = out[a]!;
    const bVal = out[b]!;

    if (aOcc && bOcc) {
      // Both occupied — no reduction.
      continue;
    }
    if (!aOcc && !bOcc) {
      // Both vacant — zero the lower cell; zero both if equal.
      if (aVal < bVal) out[a] = 0;
      else if (bVal < aVal) out[b] = 0;
      else { out[a] = 0; out[b] = 0; }
      continue;
    }
    // Exactly one occupied — zero the vacant cell.
    if (!aOcc) out[a] = 0;
    else out[b] = 0;
  }
  return out;
}

// ── Test-only exports ─────────────────────────────────

/** @internal */
export const _bhinnashtakaForTest = bhinnashtakaFor;
/** @internal */
export const _applyTrikonaSodhanaForTest = applyTrikonaSodhana;
/** @internal */
export const _applyEkadhipatyaSodhanaForTest = applyEkadhipatyaSodhana;
