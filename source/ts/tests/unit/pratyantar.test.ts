import { describe, it, expect } from 'vitest';
import {
  computeVimshottariDasha,
  computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar,
  computeVimshottariPratyantarIn,
  DASHA_ORDER,
  DASHA_YEARS,
} from '../../src/jyotish/dasha';
import type { AntarDasha, MahaDasha, PratyantarDasha } from '../../src/types/jyotish';
import { PanchangError } from '../../src/types/errors';

const MS_PER_YEAR = 365.25 * 86_400_000;

function expectTiles(parent: AntarDasha, kids: PratyantarDasha[]): void {
  expect(kids[0]!.startDate.getTime()).toBe(parent.startDate.getTime());
  expect(kids[kids.length - 1]!.endDate.getTime()).toBe(parent.endDate.getTime());
  for (let i = 1; i < kids.length; i++) {
    expect(kids[i]!.startDate.getTime()).toBe(kids[i - 1]!.endDate.getTime());
  }
}

/** The classical construction, restated: the full antardasha's nine pratyantars, those over by birth dropped. */
function fullSpanClipped(maha: MahaDasha, antar: AntarDasha): { lord: string; startMs: number; endMs: number }[] {
  const fullMs = (DASHA_YEARS[antar.lord] / 120) * DASHA_YEARS[maha.lord] * MS_PER_YEAR;
  const clip = antar.startDate.getTime();
  let cursor = antar.endDate.getTime() - fullMs;
  const out: { lord: string; startMs: number; endMs: number }[] = [];
  const idx = DASHA_ORDER.indexOf(antar.lord);
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(idx + i) % 9]!;
    const start = cursor;
    cursor += (DASHA_YEARS[lord] / 120) * fullMs;
    if (cursor > clip) out.push({ lord, startMs: Math.max(start, clip), endMs: cursor });
  }
  return out;
}

describe('computeVimshottariPratyantar', () => {
  const birthDate = new Date('1990-06-15T10:30:00Z');
  const dasha = computeVimshottariDashaFromBirth(birthDate);
  const sampleAntardasha = dasha.mahaDashas[1]!.antarDashas[2]!;

  it('returns 9 pratyantars in cycle order starting from antardasha lord', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    expect(ps).toHaveLength(9);
    const startIdx = DASHA_ORDER.indexOf(sampleAntardasha.lord);
    for (let i = 0; i < 9; i++) {
      expect(ps[i]!.lord).toBe(DASHA_ORDER[(startIdx + i) % 9]);
    }
  });

  it('pratyantars are contiguous and span the full antardasha', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    expect(ps[0]!.startDate.getTime()).toBe(sampleAntardasha.startDate.getTime());
    expect(ps[8]!.endDate.getTime()).toBe(sampleAntardasha.endDate.getTime());
    for (let i = 1; i < 9; i++) {
      expect(ps[i]!.startDate.getTime()).toBe(ps[i - 1]!.endDate.getTime());
    }
  });

  it('pratyantar duration is proportional to (lord_years / 120) × antardasha duration', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    const antardashaMs = sampleAntardasha.endDate.getTime() - sampleAntardasha.startDate.getTime();
    for (const p of ps) {
      const expected = (DASHA_YEARS[p.lord] / 120) * antardashaMs;
      const actual = p.endDate.getTime() - p.startDate.getTime();
      expect(actual / expected).toBeCloseTo(1, 9);
    }
  });

  it('pratyantar durations sum to antardasha duration', () => {
    const ps = computeVimshottariPratyantar(sampleAntardasha);
    const antardashaMs = sampleAntardasha.endDate.getTime() - sampleAntardasha.startDate.getTime();
    const totalMs = ps.reduce((s, p) => s + (p.endDate.getTime() - p.startDate.getTime()), 0);
    expect(totalMs / antardashaMs).toBeCloseTo(1, 9);
  });

  it('throws on invalid antardasha lord', () => {
    expect(() =>
      computeVimshottariPratyantar({
        // @ts-expect-error testing runtime guard
        lord: 'NotALord',
        startDate: new Date(),
        endDate: new Date(),
      }),
    ).toThrow();
  });
});

describe('computeVimshottariPratyantar on the birth antardasha', () => {
  it('still tiles the clipped span exactly (the last pratyantar used to end up to 8 ms early)', () => {
    const dasha = computeVimshottariDashaFromBirth(new Date('1990-06-15T10:30:00Z'));
    const birthAntar = dasha.mahaDashas[0]!.antarDashas[0]!;
    expectTiles(birthAntar, computeVimshottariPratyantar(birthAntar));
  });

  it('keeps its one-argument signature, so point-free map still works', () => {
    const dasha = computeVimshottariDashaFromBirth(new Date('1990-06-15T10:30:00Z'));
    const lists = dasha.mahaDashas[1]!.antarDashas.map(computeVimshottariPratyantar);
    expect(lists).toHaveLength(9);
    for (const list of lists) expect(list).toHaveLength(9);
  });
});

describe('computeVimshottariPratyantarIn', () => {
  const birth = new Date('1995-08-15T05:30:00Z');
  const moonSid = 355.19020663914483;
  const dasha = computeVimshottariDasha(birth, moonSid, birth);
  const maha0 = dasha.mahaDashas[0]!;
  const birthAntar = maha0.antarDashas[0]!;

  it('splits the full birth antardasha and starts with the pratyantar running at birth', () => {
    expect(maha0.lord).toBe('Mercury');
    expect(birthAntar.lord).toBe('Rahu');
    const ps = computeVimshottariPratyantarIn(maha0, birthAntar);
    expect(ps.map((p) => p.lord)).toEqual(['Mercury', 'Ketu', 'Venus', 'Sun', 'Moon', 'Mars']);
    expect(ps.map((p) => p.startDate.toISOString().slice(0, 10))).toEqual([
      '1995-08-15', '1995-09-25', '1995-11-18', '1996-04-21', '1996-06-07', '1996-08-23',
    ]);
    expectTiles(birthAntar, ps);
  });

  it('matches the full-span construction restated from the rule, to the millisecond', () => {
    for (const lon of [0.5, 6.6666, 100, 200.123, 355.19020663914483]) {
      const r = computeVimshottariDasha(birth, lon, birth);
      const m = r.mahaDashas[0]!;
      const a = m.antarDashas[0]!;
      const want = fullSpanClipped(m, a);
      const got = computeVimshottariPratyantarIn(m, a);
      expect(got.map((p) => p.lord)).toEqual(want.map((w) => w.lord));
      got.forEach((p, i) => {
        expect(Math.abs(p.startDate.getTime() - want[i]!.startMs)).toBeLessThanOrEqual(1);
        expect(Math.abs(p.endDate.getTime() - want[i]!.endMs)).toBeLessThanOrEqual(1);
      });
    }
  });

  it('reports Ketu, not Jupiter, at the 1990-06-15T10:30Z birth', () => {
    const r = computeVimshottariDashaFromBirth(new Date('1990-06-15T10:30:00Z'));
    const m = r.mahaDashas[0]!;
    expect(computeVimshottariPratyantar(m.antarDashas[0]!)[0]!.lord).toBe('Jupiter');
    expect(computeVimshottariPratyantarIn(m, m.antarDashas[0]!)[0]!.lord).toBe('Ketu');
  });

  it('equals computeVimshottariPratyantar on every antardasha that was not clipped', () => {
    for (const [mi, m] of dasha.mahaDashas.entries()) {
      for (const [ai, a] of m.antarDashas.entries()) {
        if (mi === 0 && ai === 0) continue;
        expect(computeVimshottariPratyantarIn(m, a)).toEqual(computeVimshottariPratyantar(a));
      }
    }
  });

  it('throws INVALID_INPUT for an invalid lord', () => {
    const badAntar = { ...birthAntar, lord: 'NotALord' } as unknown as AntarDasha;
    const badMaha = { ...maha0, lord: 'NotALord' } as unknown as MahaDasha;
    for (const call of [
      () => computeVimshottariPratyantarIn(maha0, badAntar),
      () => computeVimshottariPratyantarIn(badMaha, birthAntar),
    ]) {
      expect(call).toThrow(PanchangError);
      try { call(); } catch (e) { expect((e as PanchangError).code).toBe('INVALID_INPUT'); }
    }
  });
});
