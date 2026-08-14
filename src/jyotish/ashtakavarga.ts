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
 * av.sarvashtaka;             // 12 cells, 0..56 each, sum = 337
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
 * reduce all three cells in the receiver's grid by their minimum. When any
 * cell in the triad is already 0 the minimum is 0 and NOTHING is reduced —
 * this IS PVR's Rule 1 ("if a rashi has no bindus, no reduction in the
 * triad") and matches Maitreya 8's plain subtract-the-min. An earlier
 * revision zeroed the whole triad in that case, which no reference does
 * (AV-1, 2026-08-14 audit; repro: (0,3,5) → refs keep (0,3,5), ours gave
 * (0,0,0)).
 */
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

/**
 * Ekadhipatya Sodhana — within each pair of rashis sharing a single
 * graha-lord, reduce based on which rashi is occupied (by a graha
 * Sun..Saturn) in the natal chart. The PVR Narasimha Rao / PyJHora form
 * (which reproduces PVR's published Chart 7 pindas; Maitreya 8 differs
 * only in the one-occupied sub-case, where it subtracts instead of
 * replacing — no recension blanket-zeroes):
 *
 *   1. Either cell already 0: skip the pair.
 *   2. Both rashis occupied: skip.
 *   3. Exactly one occupied: if the vacant cell ≤ the occupied cell,
 *      the vacant cell becomes 0; if greater, it is reduced TO the
 *      occupied cell's value.
 *   4. Both vacant: unequal → BOTH become the minimum; equal → both 0.
 *
 * An earlier revision zeroed the vacant/lower cell in every non-skip case
 * (AV-2, 2026-08-14 audit — 7 of PVR Chart 7's 84 cells wrong, Mercury's
 * reduced row summing 7 against the published 12). Cancer (lord Moon) and
 * Leo (lord Sun) are excluded from the pairs — they have unique rulers.
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

    // Rule 1: a zero cell ends the pair's reduction.
    if (out[a]! === 0 || out[b]! === 0) continue;
    // Rule 2: both occupied — no reduction.
    if (aOcc && bOcc) continue;

    if (!aOcc && !bOcc) {
      // Rule 4: both vacant — unequal → both take the minimum; equal → both 0.
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

    // Rule 3: exactly one occupied.
    const occIdx = aOcc ? a : b;
    const vacIdx = aOcc ? b : a;
    out[vacIdx] = out[vacIdx]! <= out[occIdx]! ? 0 : out[occIdx]!;
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
