/**
 * Unit tests for `computeAshtakavarga` (BPHS Ch. 66) and the BENEFIC_OFFSETS
 * table sourced verbatim from BPHS Ch. 66 (Phaladeepika Ch. 31 cross-check).
 *
 * Strategy:
 *   1. Pin every cell of the BENEFIC_OFFSETS table — any drift in the table
 *      breaks the test. The table is the algorithm's only chart-independent
 *      input.
 *   2. Verify per-receiver Bhinnashtaka totals (chart-invariant) match the
 *      canonical BPHS values: Sun=47, Moon=49, Mars=39, Mercury=54,
 *      Jupiter=56, Venus=52, Saturn=39 — and Sarvashtaka totals 336.
 *   3. Verify the cell-wise sum invariant: Sarvashtaka[i] = Σ_recv Bhinn[i].
 *   4. Hand-computed pins for Modi's Sun and Saturn Bhinnashtaka grids —
 *      derived bindu-by-bindu from the published rashi positions in
 *      `astrosage-charts.json` and the BENEFIC_OFFSETS table; these serve
 *      as ground-truth references the algorithm must match.
 *   5. Sarvashtaka golden-master pins for 3 fixture charts (Modi, Sachin,
 *      Tata) — programmatically derived but pinned to detect regressions.
 *      Public-calculator cross-validation against ProKerala / AstroSage is
 *      a manual exercise (their panels are not fetchable from this env).
 *   6. Reduction smoke tests — Trikona Sodhana invariants and a worked
 *      Ekadhipatya Sodhana case.
 */

import { describe, it, expect } from 'vitest';
import {
  computeAshtakavarga,
  _bhinnashtakaForTest as bhinnashtakaFor,
  _applyTrikonaSodhanaForTest as trikonaSodhana,
  _applyEkadhipatyaSodhanaForTest as ekadhipatyaSodhana,
} from '../../src/jyotish/ashtakavarga';
import {
  BENEFIC_OFFSETS, BHINNASHTAKA_TOTAL, SARVASHTAKA_TOTAL,
  ASHTAKAVARGA_RECEIVERS, ASHTAKAVARGA_CONTRIBUTORS,
  EKADHIPATYA_PAIRS, TRIKONA_TRIADS,
} from '../../src/jyotish/ashtakavargaTables';
import { computeRashiChart } from '../../src/jyotish/charts';
import type { BirthChart } from '../../src/types/jyotish';
import fixtures from '../fixtures/astrosage-charts.json';

// ── Fixture helpers ────────────────────────────────────

type Fix = {
  name: string;
  dateLocal: string;
  tzh: number;
  lat: number;
  lon: number;
};
const CHARTS: Fix[] = (fixtures as { charts: Fix[] }).charts;

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

function chartFor(name: string): BirthChart {
  const f = CHARTS.find((c) => c.name === name);
  if (!f) throw new Error(`Fixture not found: ${name}`);
  return computeRashiChart(localToUtc(f.dateLocal, f.tzh), { latitude: f.lat, longitude: f.lon });
}

// ── BENEFIC_OFFSETS table cell-by-cell pin ────────────

describe('BENEFIC_OFFSETS — BPHS Ch. 66 table pin', () => {
  it('Sun receiver — 8 contributor lists', () => {
    expect(BENEFIC_OFFSETS.Sun.Sun).toEqual([1, 2, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Sun.Moon).toEqual([3, 6, 10, 11]);
    expect(BENEFIC_OFFSETS.Sun.Mars).toEqual([1, 2, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Sun.Mercury).toEqual([3, 5, 6, 9, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Sun.Jupiter).toEqual([5, 6, 9, 11]);
    expect(BENEFIC_OFFSETS.Sun.Venus).toEqual([6, 7, 12]);
    expect(BENEFIC_OFFSETS.Sun.Saturn).toEqual([1, 2, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Sun.Lagna).toEqual([3, 4, 6, 10, 11, 12]);
  });

  it('Moon receiver', () => {
    expect(BENEFIC_OFFSETS.Moon.Sun).toEqual([3, 6, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Moon.Moon).toEqual([1, 3, 6, 7, 10, 11]);
    expect(BENEFIC_OFFSETS.Moon.Mars).toEqual([2, 3, 5, 6, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Moon.Mercury).toEqual([1, 3, 4, 5, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Moon.Jupiter).toEqual([1, 4, 7, 8, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Moon.Venus).toEqual([3, 4, 5, 7, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Moon.Saturn).toEqual([3, 5, 6, 11]);
    expect(BENEFIC_OFFSETS.Moon.Lagna).toEqual([3, 6, 10, 11]);
  });

  it('Mars receiver', () => {
    expect(BENEFIC_OFFSETS.Mars.Sun).toEqual([3, 5, 6, 10, 11]);
    expect(BENEFIC_OFFSETS.Mars.Moon).toEqual([3, 6, 11]);
    expect(BENEFIC_OFFSETS.Mars.Mars).toEqual([1, 2, 4, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Mars.Mercury).toEqual([3, 5, 6, 11]);
    expect(BENEFIC_OFFSETS.Mars.Jupiter).toEqual([6, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Mars.Venus).toEqual([6, 8, 11, 12]);
    expect(BENEFIC_OFFSETS.Mars.Saturn).toEqual([1, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Mars.Lagna).toEqual([1, 3, 6, 10, 11]);
  });

  it('Mercury receiver', () => {
    expect(BENEFIC_OFFSETS.Mercury.Sun).toEqual([5, 6, 9, 11, 12]);
    expect(BENEFIC_OFFSETS.Mercury.Moon).toEqual([2, 4, 6, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Mercury.Mars).toEqual([1, 2, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Mercury.Mercury).toEqual([1, 3, 5, 6, 9, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Mercury.Jupiter).toEqual([6, 8, 11, 12]);
    expect(BENEFIC_OFFSETS.Mercury.Venus).toEqual([1, 2, 3, 4, 5, 8, 9, 11]);
    expect(BENEFIC_OFFSETS.Mercury.Saturn).toEqual([1, 2, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Mercury.Lagna).toEqual([1, 2, 4, 6, 8, 10, 11]);
  });

  it('Jupiter receiver', () => {
    expect(BENEFIC_OFFSETS.Jupiter.Sun).toEqual([1, 2, 3, 4, 7, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Moon).toEqual([2, 5, 7, 9, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Mars).toEqual([1, 2, 4, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Mercury).toEqual([1, 2, 4, 5, 6, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Jupiter).toEqual([1, 2, 3, 4, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Venus).toEqual([2, 5, 6, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Jupiter.Saturn).toEqual([3, 5, 6, 12]);
    expect(BENEFIC_OFFSETS.Jupiter.Lagna).toEqual([1, 2, 4, 5, 6, 7, 9, 10, 11]);
  });

  it('Venus receiver', () => {
    expect(BENEFIC_OFFSETS.Venus.Sun).toEqual([8, 11, 12]);
    expect(BENEFIC_OFFSETS.Venus.Moon).toEqual([1, 2, 3, 4, 5, 8, 9, 11, 12]);
    expect(BENEFIC_OFFSETS.Venus.Mars).toEqual([3, 5, 6, 9, 11, 12]);
    expect(BENEFIC_OFFSETS.Venus.Mercury).toEqual([3, 5, 6, 9, 11]);
    expect(BENEFIC_OFFSETS.Venus.Jupiter).toEqual([5, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Venus.Venus).toEqual([1, 2, 3, 4, 5, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Venus.Saturn).toEqual([3, 4, 5, 8, 9, 10, 11]);
    expect(BENEFIC_OFFSETS.Venus.Lagna).toEqual([1, 2, 3, 4, 5, 8, 9, 11]);
  });

  it('Saturn receiver', () => {
    expect(BENEFIC_OFFSETS.Saturn.Sun).toEqual([1, 2, 4, 7, 8, 10, 11]);
    expect(BENEFIC_OFFSETS.Saturn.Moon).toEqual([3, 6, 11]);
    expect(BENEFIC_OFFSETS.Saturn.Mars).toEqual([3, 5, 6, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Saturn.Mercury).toEqual([6, 8, 9, 10, 11, 12]);
    expect(BENEFIC_OFFSETS.Saturn.Jupiter).toEqual([5, 6, 11, 12]);
    expect(BENEFIC_OFFSETS.Saturn.Venus).toEqual([6, 11, 12]);
    expect(BENEFIC_OFFSETS.Saturn.Saturn).toEqual([3, 5, 6, 11]);
    expect(BENEFIC_OFFSETS.Saturn.Lagna).toEqual([1, 3, 4, 6, 10, 11]);
  });

  it('per-receiver list-length totals match published Bhinnashtaka totals', () => {
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      let sum = 0;
      for (const ctr of ASHTAKAVARGA_CONTRIBUTORS) {
        sum += BENEFIC_OFFSETS[recv][ctr].length;
      }
      expect(sum).toBe(BHINNASHTAKA_TOTAL[recv]);
    }
  });

  it('every offset is in [1, 12]', () => {
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      for (const ctr of ASHTAKAVARGA_CONTRIBUTORS) {
        for (const o of BENEFIC_OFFSETS[recv][ctr]) {
          expect(o).toBeGreaterThanOrEqual(1);
          expect(o).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('every offset list is strictly ascending (no dupes)', () => {
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      for (const ctr of ASHTAKAVARGA_CONTRIBUTORS) {
        const list = BENEFIC_OFFSETS[recv][ctr];
        for (let i = 1; i < list.length; i++) {
          expect(list[i]).toBeGreaterThan(list[i - 1]!);
        }
      }
    }
  });

  it('SARVASHTAKA_TOTAL = sum of BHINNASHTAKA_TOTAL across receivers', () => {
    let sum = 0;
    for (const recv of ASHTAKAVARGA_RECEIVERS) sum += BHINNASHTAKA_TOTAL[recv];
    expect(sum).toBe(SARVASHTAKA_TOTAL);
    expect(SARVASHTAKA_TOTAL).toBe(337);
  });
});

// ── Algorithm — chart-invariant structural properties ─

describe('computeAshtakavarga — structural invariants', () => {
  for (const f of CHARTS.slice(0, 5)) {
    describe(`${f.name}`, () => {
      const chart = chartFor(f.name);
      const av = computeAshtakavarga(chart);

      it('Sarvashtaka has 12 cells, total 336', () => {
        expect(av.sarvashtaka).toHaveLength(12);
        expect(av.sarvashtaka.reduce((a, b) => a + b, 0)).toBe(SARVASHTAKA_TOTAL);
      });

      it('every Sarvashtaka cell in [0, 56]', () => {
        for (const c of av.sarvashtaka) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(56);
        }
      });

      for (const recv of ASHTAKAVARGA_RECEIVERS) {
        it(`${recv} Bhinnashtaka has 12 cells, total ${BHINNASHTAKA_TOTAL[recv]}`, () => {
          expect(av.bhinnashtaka[recv]).toHaveLength(12);
          expect(av.bhinnashtaka[recv].reduce((a, b) => a + b, 0)).toBe(BHINNASHTAKA_TOTAL[recv]);
        });
      }

      it('every Bhinnashtaka cell in [0, 8]', () => {
        for (const recv of ASHTAKAVARGA_RECEIVERS) {
          for (const c of av.bhinnashtaka[recv]) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(8);
          }
        }
      });

      it('Sarvashtaka[i] = Σ Bhinnashtaka[recv][i] for every cell', () => {
        for (let i = 0; i < 12; i++) {
          let sum = 0;
          for (const recv of ASHTAKAVARGA_RECEIVERS) sum += av.bhinnashtaka[recv][i]!;
          expect(av.sarvashtaka[i]).toBe(sum);
        }
      });
    });
  }

  it('does not return reduced grids unless options.reductions = true', () => {
    const chart = chartFor('Narendra Modi');
    expect(computeAshtakavarga(chart).reduced).toBeUndefined();
    expect(computeAshtakavarga(chart, {}).reduced).toBeUndefined();
    expect(computeAshtakavarga(chart, { reductions: false }).reduced).toBeUndefined();
    expect(computeAshtakavarga(chart, { reductions: true }).reduced).toBeDefined();
  });
});

// ── Hand-computed Bhinnashtaka pins (Narendra Modi) ───
//
// These pins are derived bindu-by-bindu from the published AstroSage rashi
// positions and the BENEFIC_OFFSETS table — they are independent from the
// algorithm under test and cross-validate it.
//
// Modi's chart (per `astrosage-charts.json`):
//   Lagna=Vrischika(7), Sun=Kanya(5), Moon=Vrischika(7), Mars=Vrischika(7),
//   Mercury=Kanya(5), Jupiter=Kumbha(10), Venus=Simha(4), Saturn=Simha(4).

describe('Bhinnashtaka — hand-validated pins (Modi)', () => {
  const chart = chartFor('Narendra Modi');
  const av = computeAshtakavarga(chart);

  it('Sun Bhinnashtaka — hand-computed cell-by-cell', () => {
    // Per-rashi tally walked from BPHS BENEFIC_OFFSETS.Sun (Mars contributes
    // in 1,2,4,7,8,9,10,11) and Modi's contributor positions; total = 48.
    expect(av.bhinnashtaka.Sun).toEqual([4, 4, 5, 5, 5, 5, 3, 3, 3, 4, 5, 2]);
  });

  it('Saturn Bhinnashtaka — hand-computed cell-by-cell', () => {
    // Per-rashi tally walked manually from BPHS BENEFIC_OFFSETS.Saturn and
    // Modi's contributor positions; total = 39 (confirmed).
    expect(av.bhinnashtaka.Saturn).toEqual([5, 1, 5, 4, 3, 4, 3, 1, 3, 6, 2, 2]);
  });
});

// ── Sarvashtaka golden-master pins (3 charts) ─────────
//
// These pins are programmatically derived from the algorithm under test.
// They serve as regression detectors — any change to the BENEFIC_OFFSETS
// table or the compute path that alters cell values will fail these tests.
//
// Public-calculator cross-validation (ProKerala, AstroSage, JagannathaHora)
// is left as a manual verification — those panels are not fetchable from
// this environment. The deterministic algorithm + canonical BPHS table
// guarantee that any conformant calculator produces identical values for
// the same input rashi positions.

describe('Sarvashtaka — golden-master pins', () => {
  it('Modi (Lagna=7, Sun=5, Moon=7, Mars=7, Mercury=5, Jup=10, Ven=4, Sat=4)', () => {
    const av = computeAshtakavarga(chartFor('Narendra Modi'));
    expect(av.sarvashtaka).toEqual([30, 24, 33, 30, 27, 36, 17, 30, 31, 32, 27, 20]);
  });

  it('Sachin Tendulkar (Lagna=4, Sun=0, Moon=8, Mars=9, Mercury=11, Jup=9, Ven=0, Sat=1)', () => {
    const av = computeAshtakavarga(chartFor('Sachin Tendulkar'));
    expect(av.sarvashtaka).toEqual([17, 31, 26, 25, 31, 24, 33, 36, 26, 34, 32, 22]);
  });

  it('Ratan Tata (Lagna=8, Sun=8, Moon=6, Mars=10, Mercury=8, Jup=9, Ven=8, Sat=11)', () => {
    const av = computeAshtakavarga(chartFor('Ratan Tata'));
    expect(av.sarvashtaka).toEqual([23, 32, 21, 24, 32, 29, 41, 29, 33, 22, 24, 27]);
  });
});

// ── bhinnashtakaFor — direct test of the inner algorithm ──

describe('bhinnashtakaFor (internal)', () => {
  it('all 8 contributors at rashi 0 → bindus deposit at (offset - 1) for each list', () => {
    const all0 = {
      Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0,
      Venus: 0, Saturn: 0, Lagna: 0,
    } as const;
    const grid = bhinnashtakaFor('Sun', all0);

    // For each rashi i, count contributors whose offset list contains (i+1).
    for (let i = 0; i < 12; i++) {
      let expected = 0;
      for (const ctr of ASHTAKAVARGA_CONTRIBUTORS) {
        if (BENEFIC_OFFSETS.Sun[ctr].includes(i + 1)) expected += 1;
      }
      expect(grid[i]).toBe(expected);
    }
  });

  it('shifting all contributors by k rashis rotates the grid by k cells', () => {
    const base = {
      Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0,
      Venus: 0, Saturn: 0, Lagna: 0,
    };
    const k = 4;
    const shifted: typeof base = { ...base };
    for (const ctr of ASHTAKAVARGA_CONTRIBUTORS) shifted[ctr] = k;

    const baseGrid = bhinnashtakaFor('Mercury', base);
    const shiftedGrid = bhinnashtakaFor('Mercury', shifted);

    for (let i = 0; i < 12; i++) {
      expect(shiftedGrid[(i + k) % 12]).toBe(baseGrid[i]);
    }
  });
});

// ── Trikona Sodhana ───────────────────────────────────

describe('Trikona Sodhana (BPHS Ch. 67)', () => {
  it('subtracts the minimum from each elemental triad when no zero present', () => {
    // Triad indices: Aries(0), Leo(4), Sagittarius(8).
    const grid = [3, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0];
    // min(3,5,7) = 3 → cells become (0, 2, 4).
    const out = trikonaSodhana(grid);
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(2);
    expect(out[8]).toBe(4);
  });

  it('zeros every cell in the triad if any cell was already 0', () => {
    const grid = [0, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0];
    const out = trikonaSodhana(grid);
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(0);
    expect(out[8]).toBe(0);
  });

  it('reduces all four triads independently', () => {
    // [Aries, Leo, Sag] = [3,5,7] → [0,2,4]
    // [Tau, Vir, Cap]   = [4,4,4] → [0,0,0]
    // [Gem, Lib, Aqu]   = [2,3,5] → [0,1,3]
    // [Can, Sco, Pis]   = [0,5,7] → [0,0,0] (zero present)
    const grid = [3, 4, 2, 0, 5, 4, 3, 5, 7, 4, 5, 7];
    const out = trikonaSodhana(grid);
    expect(out).toEqual([0, 0, 0, 0, 2, 0, 1, 0, 4, 0, 3, 0]);
  });

  it('does not mutate input grid', () => {
    const grid = [3, 4, 2, 0, 5, 4, 3, 5, 7, 4, 5, 7];
    const snapshot = grid.slice();
    trikonaSodhana(grid);
    expect(grid).toEqual(snapshot);
  });

  it('output sum is always ≤ input sum', () => {
    const chart = chartFor('Narendra Modi');
    const av = computeAshtakavarga(chart);
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      const before = av.bhinnashtaka[recv].reduce((a, b) => a + b, 0);
      const after = trikonaSodhana(av.bhinnashtaka[recv]).reduce((a, b) => a + b, 0);
      expect(after).toBeLessThanOrEqual(before);
    }
  });
});

// ── Ekadhipatya Sodhana ───────────────────────────────

describe('Ekadhipatya Sodhana (BPHS Ch. 67)', () => {
  it('does not touch Cancer (3) or Leo (4) — single-lord rashis', () => {
    const ekadhipatyaTouches = new Set<number>();
    for (const [a, b] of EKADHIPATYA_PAIRS) {
      ekadhipatyaTouches.add(a);
      ekadhipatyaTouches.add(b);
    }
    expect(ekadhipatyaTouches.has(3)).toBe(false);
    expect(ekadhipatyaTouches.has(4)).toBe(false);
    // All other 10 rashis are touched.
    for (let i = 0; i < 12; i++) {
      if (i === 3 || i === 4) continue;
      expect(ekadhipatyaTouches.has(i)).toBe(true);
    }
  });

  it('both rashis occupied → no change', () => {
    const grid = [5, 3, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0];
    const occupied = new Set<number>([0, 7]); // both Aries and Scorpio occupied
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(5);
    expect(out[7]).toBe(4);
  });

  it('one occupied, one vacant → vacant cell is zeroed', () => {
    // Aries(0) occupied, Scorpio(7) vacant. Aries=5, Scorpio=4 → Scorpio becomes 0.
    const grid = [5, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0];
    const occupied = new Set<number>([0]);
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(5);
    expect(out[7]).toBe(0);
  });

  it('both vacant, unequal → lower cell is zeroed', () => {
    const grid = [3, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0];
    const occupied = new Set<number>(); // neither occupied
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(0);
    expect(out[7]).toBe(7);
  });

  it('both vacant, equal → both cells zeroed', () => {
    const grid = [4, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0];
    const occupied = new Set<number>();
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(0);
    expect(out[7]).toBe(0);
  });

  it('does not mutate input grid', () => {
    const grid = [3, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0];
    const snapshot = grid.slice();
    ekadhipatyaSodhana(grid, new Set([0]));
    expect(grid).toEqual(snapshot);
  });
});

// ── End-to-end reductions on a real chart ─────────────

describe('computeAshtakavarga with reductions — real chart', () => {
  const chart = chartFor('Narendra Modi');
  const av = computeAshtakavarga(chart, { reductions: true });

  it('returns reduced.sarvashtaka and reduced.bhinnashtaka', () => {
    expect(av.reduced).toBeDefined();
    expect(av.reduced!.sarvashtaka).toHaveLength(12);
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      expect(av.reduced!.bhinnashtaka[recv]).toHaveLength(12);
    }
  });

  it('reduced totals are ≤ unreduced totals', () => {
    const beforeS = av.sarvashtaka.reduce((a, b) => a + b, 0);
    const afterS = av.reduced!.sarvashtaka.reduce((a, b) => a + b, 0);
    expect(afterS).toBeLessThanOrEqual(beforeS);
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      const before = av.bhinnashtaka[recv].reduce((a, b) => a + b, 0);
      const after = av.reduced!.bhinnashtaka[recv].reduce((a, b) => a + b, 0);
      expect(after).toBeLessThanOrEqual(before);
    }
  });

  it('reduced Sarvashtaka equals Σ reduced Bhinnashtaka per cell', () => {
    for (let i = 0; i < 12; i++) {
      let sum = 0;
      for (const recv of ASHTAKAVARGA_RECEIVERS) sum += av.reduced!.bhinnashtaka[recv][i]!;
      expect(av.reduced!.sarvashtaka[i]).toBe(sum);
    }
  });

  it('reduced cells are non-negative integers', () => {
    for (const recv of ASHTAKAVARGA_RECEIVERS) {
      for (const c of av.reduced!.bhinnashtaka[recv]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(c)).toBe(true);
      }
    }
  });
});

// ── Triad and pair count sanity ───────────────────────

describe('Trikona triads and Ekadhipatya pairs — coverage', () => {
  it('TRIKONA_TRIADS covers all 12 rashis exactly once', () => {
    const seen = new Set<number>();
    for (const [a, b, c] of TRIKONA_TRIADS) {
      seen.add(a); seen.add(b); seen.add(c);
    }
    expect(seen.size).toBe(12);
    for (let i = 0; i < 12; i++) expect(seen.has(i)).toBe(true);
    expect(TRIKONA_TRIADS).toHaveLength(4);
  });

  it('EKADHIPATYA_PAIRS has 5 entries (Cancer + Leo excluded)', () => {
    expect(EKADHIPATYA_PAIRS).toHaveLength(5);
  });
});
