// The tables are transcribed from Ernst Wilhelm's *Muhurta Yogas*, verified
// cell-for-cell against blog.cosmicinsights.net.

import { describe, it, expect } from 'vitest';
import { computeVaraTithiYogas, scoreMuhurta, vivahRule } from '../../src/index';
import type { VaraTithiYogaType } from '../../src/index';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const TZ = 330;

// Classical tithi groups, by number within the paksha.
const GROUPS: Record<string, number[]> = {
  nanda: [1, 6, 11], bhadra: [2, 7, 12], jaya: [3, 8, 13],
  rikta: [4, 9, 14], purna: [5, 10, 15],
};

const rowFor = (yoga: VaraTithiYogaType, vara: number): number[] =>
  Array.from({ length: 15 }, (_, i) => i + 1)
    .filter((n) => computeVaraTithiYogas(vara, n - 1).some((y) => y.type === yoga));

describe('computeVaraTithiYogas: table structure', () => {
  it('Siddha assigns whole tithi groups to Tue/Wed/Thu/Fri/Sat', () => {
    expect(rowFor('siddha', 2)).toEqual(GROUPS.jaya);
    expect(rowFor('siddha', 3)).toEqual(GROUPS.bhadra);
    expect(rowFor('siddha', 4)).toEqual(GROUPS.purna);
    expect(rowFor('siddha', 5)).toEqual(GROUPS.nanda);
    expect(rowFor('siddha', 6)).toEqual(GROUPS.rikta);
    expect(rowFor('siddha', 0)).toEqual([]);
    expect(rowFor('siddha', 1)).toEqual([]);
  });

  it('Amrita assigns a whole tithi group to every weekday', () => {
    const expected = [GROUPS.nanda, GROUPS.bhadra, GROUPS.nanda, GROUPS.jaya,
      GROUPS.rikta, GROUPS.bhadra, GROUPS.purna];
    for (let vara = 0; vara < 7; vara++) {
      expect(rowFor('amrita', vara)).toEqual(expected[vara]);
    }
  });

  // The malefic rows below run Sunday to Saturday.
  it.each([
    ['dagdha', [[12], [11], [5], [2, 3], [6], [8], [9]]],
    ['visha', [[4], [6], [7], [2], [8], [9], [7]]],
    ['hutasana', [[12], [6], [7], [8], [9], [10], [11]]],
    ['krakacha', [[12], [11], [10], [9], [8], [7], [6]]],
    ['samvartaka', [[7], [], [], [1], [], [], []]],
  ] as const)('%s matches the published row', (yoga, rows) => {
    for (let vara = 0; vara < 7; vara++) {
      expect(rowFor(yoga, vara)).toEqual(rows[vara]);
    }
  });

  it('Krakacha descends as the weekday ascends', () => {
    const heads = Array.from({ length: 7 }, (_, v) => rowFor('krakacha', v)[0]);
    expect(heads).toEqual([12, 11, 10, 9, 8, 7, 6]);
  });
});

describe('computeVaraTithiYogas: paksha symmetry', () => {
  it('every row applies identically in both pakshas', () => {
    for (let vara = 0; vara < 7; vara++) {
      for (let n = 1; n <= 15; n++) {
        const shukla = computeVaraTithiYogas(vara, n - 1);
        const krishna = computeVaraTithiYogas(vara, n + 14);
        expect(krishna).toEqual(shukla);
      }
    }
  });

  it('Purnima and Amavasya both count as the 15th tithi', () => {
    // Thursday + Purna group = Siddha.
    expect(computeVaraTithiYogas(4, 14).some((y) => y.type === 'siddha')).toBe(true);
    expect(computeVaraTithiYogas(4, 29).some((y) => y.type === 'siddha')).toBe(true);
  });
});

describe('computeVaraTithiYogas: documented ambiguities', () => {
  // Wilhelm asterisks exactly these cells as forming both polarities.
  it.each([
    [3, 2, 'Wednesday + 2nd'],
    [3, 3, 'Wednesday + 3rd'],
    [6, 9, 'Saturday + 9th'],
    [4, 9, 'Thursday + 9th'],
    [5, 7, 'Friday + 7th'],
  ])('%s/%s (%s) reports both polarities', (vara, n) => {
    const ys = computeVaraTithiYogas(vara, n - 1);
    expect(ys.some((y) => y.polarity === 'auspicious')).toBe(true);
    expect(ys.some((y) => y.polarity === 'inauspicious')).toBe(true);
  });

  it('returns auspicious matches before inauspicious ones', () => {
    const ys = computeVaraTithiYogas(6, 8);
    expect(ys.map((y) => y.polarity)).toEqual(['auspicious', 'inauspicious']);
    expect(ys.map((y) => y.type)).toEqual(['siddha', 'dagdha']);
  });

  it('returns an empty array when no yoga forms', () => {
    expect(computeVaraTithiYogas(0, 4)).toEqual([]);
  });
});

describe('computeVaraTithiYogas: validation', () => {
  it.each([-1, 7, 1.5, NaN])('rejects vara index %s', (v) => {
    expect(() => computeVaraTithiYogas(v as number, 0)).toThrow();
  });
  it.each([-1, 30, 2.5, NaN])('rejects tithi index %s', (t) => {
    expect(() => computeVaraTithiYogas(0, t as number)).toThrow();
  });
});

describe('muhurta engine: Vara x Tithi integration', () => {
  // 2026-01-17: a Saturday on Krishna Chaturdashi (28), a Rikta tithi, so
  // Siddha forms and partly redeems it.
  const riktaSaturday = new Date(Date.UTC(2026, 0, 17));

  it('nets an auspicious yoga against an inauspicious tithi', () => {
    const rule = { occasion: 't', inauspiciousTithis: [13, 28] };
    const r = scoreMuhurta(riktaSaturday, DELHI, rule, { timezone: TZ });
    expect(r.factors).toContainEqual({ code: 'inauspicious_tithi', axis: 'tithi', index: 28, delta: -15 });
    expect(r.factors).toContainEqual({ code: 'vara_tithi_siddha', axis: 'varaTithiYoga', delta: 10 });
    expect(r.score).toBe(45);
  });

  it('is on by default and can be switched off', () => {
    const rule = { occasion: 't', inauspiciousTithis: [13, 28] };
    const on = scoreMuhurta(riktaSaturday, DELHI, rule, { timezone: TZ });
    const off = scoreMuhurta(
      riktaSaturday, DELHI, { ...rule, varaTithiYogas: false }, { timezone: TZ },
    );
    expect(on.factors.some((f) => f.axis === 'varaTithiYoga')).toBe(true);
    expect(off.factors.some((f) => f.axis === 'varaTithiYoga')).toBe(false);
    expect(off.score).toBe(35);
  });

  it('stock rules pick the layer up', () => {
    const days = [];
    for (let i = 0; i < 40; i++) {
      const d = new Date(Date.UTC(2026, 2, 1 + i));
      days.push(scoreMuhurta(d, DELHI, vivahRule, { timezone: TZ }));
    }
    const withYoga = days.filter((d) => d.factors.some((f) => f.axis === 'varaTithiYoga'));
    expect(withYoga.length).toBeGreaterThan(0);
  });

  it('a hard exclusion still short-circuits before any yoga is scored', () => {
    const rule = { occasion: 't', excludeBhadra: true };
    for (let i = 1; i <= 20; i++) {
      const r = scoreMuhurta(new Date(Date.UTC(2026, 3, i)), DELHI, rule, { timezone: TZ });
      if (r.factors[0]?.code === 'bhadra') {
        expect(r.factors).toHaveLength(1);
        expect(r.score).toBe(0);
        return;
      }
    }
    throw new Error('no Bhadra day found in April 2026: fixture assumption broken');
  });
});
