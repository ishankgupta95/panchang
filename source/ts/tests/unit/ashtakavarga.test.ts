/**
 * The BENEFIC_OFFSETS table is transcribed verbatim from BPHS Ch. 66, with
 * Phaladeepika Ch. 31 as the cross-check.
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
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

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

describe('BENEFIC_OFFSETS: BPHS Ch. 66 table pin', () => {
  it('Sun receiver, 8 contributor lists', () => {
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

describe('computeAshtakavarga: structural invariants', () => {
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

describe('Bhinnashtaka: hand-validated pins (Modi)', () => {
  const chart = chartFor('Narendra Modi');
  const av = computeAshtakavarga(chart);

  it('Sun Bhinnashtaka, hand-computed cell-by-cell', () => {
    expect(av.bhinnashtaka.Sun).toEqual([4, 4, 5, 5, 5, 5, 3, 3, 3, 4, 5, 2]);
  });

  it('Saturn Bhinnashtaka, hand-computed cell-by-cell', () => {
    expect(av.bhinnashtaka.Saturn).toEqual([5, 1, 5, 4, 3, 4, 3, 1, 3, 6, 2, 2]);
  });
});

describe('Sarvashtaka: golden-master pins', () => {
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

describe('bhinnashtakaFor (internal)', () => {
  it('all 8 contributors at rashi 0 → bindus deposit at (offset - 1) for each list', () => {
    const all0 = {
      Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0,
      Venus: 0, Saturn: 0, Lagna: 0,
    } as const;
    const grid = bhinnashtakaFor('Sun', all0);

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

describe('Trikona Sodhana (BPHS Ch. 67)', () => {
  it('subtracts the minimum from each elemental triad when no zero present', () => {
    const grid = [3, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0];
    const out = trikonaSodhana(grid);
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(2);
    expect(out[8]).toBe(4);
  });

  it('a zero cell in the triad means NO reduction (PVR Rule 1 / Maitreya subtract-min)', () => {
    const grid = [0, 0, 0, 0, 5, 0, 0, 0, 7, 0, 0, 0];
    const out = trikonaSodhana(grid);
    expect(out[0]).toBe(0);
    expect(out[4]).toBe(5);
    expect(out[8]).toBe(7);
  });

  it('reduces all four triads independently', () => {
    const grid = [3, 4, 2, 0, 5, 4, 3, 5, 7, 4, 5, 7];
    const out = trikonaSodhana(grid);
    expect(out).toEqual([0, 0, 0, 0, 2, 0, 1, 5, 4, 0, 3, 7]);
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

describe('Ekadhipatya Sodhana (BPHS Ch. 67)', () => {
  it('does not touch Cancer (3) or Leo (4), the single-lord rashis', () => {
    const ekadhipatyaTouches = new Set<number>();
    for (const [a, b] of EKADHIPATYA_PAIRS) {
      ekadhipatyaTouches.add(a);
      ekadhipatyaTouches.add(b);
    }
    expect(ekadhipatyaTouches.has(3)).toBe(false);
    expect(ekadhipatyaTouches.has(4)).toBe(false);
    for (let i = 0; i < 12; i++) {
      if (i === 3 || i === 4) continue;
      expect(ekadhipatyaTouches.has(i)).toBe(true);
    }
  });

  it('both rashis occupied → no change', () => {
    const grid = [5, 3, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0];
    const occupied = new Set<number>([0, 7]);
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(5);
    expect(out[7]).toBe(4);
  });

  it('one occupied, vacant ≤ occupied → vacant cell is zeroed', () => {
    const grid = [5, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0];
    const occupied = new Set<number>([0]);
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(5);
    expect(out[7]).toBe(0);
  });

  it('one occupied, vacant > occupied → vacant reduced TO the occupied value (PVR rule 3)', () => {
    const grid = [5, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0];
    const occupied = new Set<number>([0]);
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(5);
    expect(out[7]).toBe(5);
  });

  it('either cell already 0 → the pair is skipped (PVR rule 1)', () => {
    const grid = [0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0];
    const occupied = new Set<number>([0]);
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[7]).toBe(7);
  });

  it('both vacant, unequal → BOTH become the minimum (PVR rule 4)', () => {
    const grid = [3, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0];
    const occupied = new Set<number>();
    const out = ekadhipatyaSodhana(grid, occupied);
    expect(out[0]).toBe(3);
    expect(out[7]).toBe(3);
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

describe('computeAshtakavarga with reductions, real chart', () => {
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

describe('Trikona triads and Ekadhipatya pairs: coverage', () => {
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

describe('Sodhana vs PVR Narasimha Rao Chart 7 (PyJHora reference)', () => {
  const BAV: Record<string, number[]> = {
    Sun:     [4, 2, 3, 4, 6, 5, 5, 3, 2, 6, 6, 2],
    Moon:    [6, 3, 5, 3, 5, 5, 6, 3, 3, 4, 4, 2],
    Mars:    [3, 2, 3, 4, 2, 5, 4, 3, 3, 4, 3, 3],
    Mercury: [4, 6, 4, 3, 4, 7, 4, 5, 6, 3, 5, 3],
    Jupiter: [4, 4, 3, 5, 6, 5, 6, 4, 6, 4, 3, 6],
    Venus:   [3, 5, 5, 4, 6, 2, 3, 6, 5, 2, 7, 4],
    Saturn:  [3, 2, 2, 3, 5, 6, 3, 4, 1, 3, 6, 1],
  };
  const OCCUPIED = new Set([0, 6, 8, 9, 10]);
  const EXPECTED: Record<string, number[]> = {
    Sun:     [2, 0, 0, 2, 4, 3, 2, 0, 0, 4, 3, 0],
    Moon:    [3, 0, 1, 1, 2, 1, 2, 0, 0, 1, 0, 0],
    Mars:    [1, 0, 0, 1, 0, 3, 1, 0, 1, 2, 0, 0],
    Mercury: [0, 3, 0, 0, 0, 4, 0, 2, 2, 0, 1, 0],
    Jupiter: [0, 0, 0, 1, 2, 1, 3, 0, 2, 0, 0, 0],
    Venus:   [0, 3, 2, 0, 3, 0, 0, 2, 2, 0, 4, 0],
    Saturn:  [2, 0, 0, 2, 4, 4, 1, 2, 0, 1, 4, 0],
  };

  for (const planet of Object.keys(BAV)) {
    it(`${planet}: Trikona + Ekadhipatya reduce to the reference row`, () => {
      const reduced = ekadhipatyaSodhana(trikonaSodhana(BAV[planet]!), OCCUPIED);
      expect(reduced).toEqual(EXPECTED[planet]);
    });
  }

  it('Mercury reduced row sums to 12 (audit repro; pre-fix gave 7)', () => {
    const reduced = ekadhipatyaSodhana(trikonaSodhana(BAV.Mercury!), OCCUPIED);
    expect(reduced.reduce((a, b) => a + b, 0)).toBe(12);
    expect(reduced[1]).toBe(3);
  });
});
