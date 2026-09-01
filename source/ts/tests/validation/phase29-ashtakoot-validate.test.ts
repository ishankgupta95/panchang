/**
 * @tier 1  ProKerala / reference-almanac Guna Milan panels, plus BPHS table invariants
 *
 * Per-pair published totals are unobtainable: the match tools are form-only
 * with no GET URL and the public APIs are keyed. So the tables are pinned
 * against Brihat Parashara Hora Shastra Ch.7, Brihat Samhita Ch.102 and the
 * almanac's doc pages; pair natal moons come from AstroSage's R-tier corpus.
 */

import { describe, it, expect } from 'vitest';
import { computeAshtakoot } from '../../src/jyotish/matching';
import {
  RASHI_VARNA, VARNA_RANK, NAKSHATRA_GANA, NAKSHATRA_NADI,
  YONI_SCORE, BHAKOOT_DOSHIC_DISTANCES, INAUSPICIOUS_TARA_REMAINDERS,
} from '../../src/jyotish/matchingTables';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'ashtakoot-pairs.json');

describe('Ashtakoot tables: Varna (BPHS Ch.7)', () => {
  it('rashi-to-varna mapping has 3 of each varna across 12 rashis', () => {
    const counts: Record<string, number> = { brahmin: 0, kshatriya: 0, vaishya: 0, shudra: 0 };
    for (const v of RASHI_VARNA) counts[v] = (counts[v] ?? 0) + 1;
    expect(counts).toEqual({ brahmin: 3, kshatriya: 3, vaishya: 3, shudra: 3 });
  });

  it('varna ranks are Brahmin>Kshatriya>Vaishya>Shudra', () => {
    expect(VARNA_RANK.brahmin).toBeGreaterThan(VARNA_RANK.kshatriya);
    expect(VARNA_RANK.kshatriya).toBeGreaterThan(VARNA_RANK.vaishya);
    expect(VARNA_RANK.vaishya).toBeGreaterThan(VARNA_RANK.shudra);
  });
});

describe('Ashtakoot tables: Yoni (Brihat Samhita Ch.102 + reference almanac)', () => {
  const ENEMY_PAIRS: Array<[string, string]> = [
    ['horse', 'buffalo'], ['elephant', 'lion'], ['sheep', 'monkey'],
    ['snake', 'mongoose'], ['dog', 'deer'], ['cat', 'rat'], ['cow', 'tiger'],
  ];
  const yIdx: Record<string, number> = {
    horse: 0, elephant: 1, sheep: 2, snake: 3, dog: 4, cat: 5, rat: 6, cow: 7,
    buffalo: 8, tiger: 9, deer: 10, monkey: 11, mongoose: 12, lion: 13,
  };
  for (const [a, b] of ENEMY_PAIRS) {
    it(`enemy yoni pair ${a}-${b} scores 0 (mutual)`, () => {
      expect(YONI_SCORE[yIdx[a]!]![yIdx[b]!]).toBe(0);
      expect(YONI_SCORE[yIdx[b]!]![yIdx[a]!]).toBe(0);
    });
  }
  it('same-yoni scores 4 (diagonal)', () => {
    for (let i = 0; i < 14; i++) expect(YONI_SCORE[i]![i]).toBe(4);
  });
  it('symmetric yoni table (mutual scores)', () => {
    for (let i = 0; i < 14; i++) {
      for (let j = 0; j < 14; j++) {
        expect(YONI_SCORE[i]![j]).toBe(YONI_SCORE[j]![i]);
      }
    }
  });
});

describe('Ashtakoot tables: Gana (BPHS Ch.7)', () => {
  it('27 nakshatras split 9/9/9 across Deva/Manushya/Rakshasa (canonical)', () => {
    const counts: Record<string, number> = { deva: 0, manushya: 0, rakshasa: 0 };
    for (const g of NAKSHATRA_GANA) counts[g] = (counts[g] ?? 0) + 1;
    expect(counts).toEqual({ deva: 9, manushya: 9, rakshasa: 9 });
  });
});

describe('Ashtakoot tables: Nadi (BPHS Ch.7)', () => {
  it('27 nakshatras split 9/9/9 across Adi/Madhya/Antya', () => {
    const counts: Record<string, number> = { adi: 0, madhya: 0, antya: 0 };
    for (const n of NAKSHATRA_NADI) counts[n] = (counts[n] ?? 0) + 1;
    expect(counts).toEqual({ adi: 9, madhya: 9, antya: 9 });
  });
});

describe('Ashtakoot tables: Bhakoot doshic distances (BPHS Ch.7)', () => {
  it('contains exactly the 6 doshic distance pairs (2/12, 5/9, 6/8) and reverses', () => {
    const set = new Set(BHAKOOT_DOSHIC_DISTANCES.map(([a, b]) => `${a}-${b}`));
    expect(set).toEqual(new Set(['2-12', '12-2', '5-9', '9-5', '6-8', '8-6']));
  });
});

describe('Ashtakoot tables: Tara inauspicious remainders', () => {
  it('inauspicious remainders are exactly {3, 5, 7} (Vipat / Pratyari / Vadha)', () => {
    expect([...INAUSPICIOUS_TARA_REMAINDERS].sort()).toEqual([3, 5, 7]);
  });
});

describe('Ashtakoot: independent Yoni cross-check (NeeleshRoy/ashtakoot)', () => {
  it('Yoni: nak 17×26 (Anuradha/deer × U.Bhadrapada/cow) = 2', () => {
    const r = computeAshtakoot(
      { rashi: 7, nakshatra: 16 },   // Anuradha
      { rashi: 11, nakshatra: 25 },  // U. Bhadrapada
    );
    expect(r.koots.find((k) => k.name === 'Yoni')!.score).toBe(2);
  });
});

type PairFixture = {
  label: string;
  boy:  { rashi: number; nakshatra: number; _source: string };
  girl: { rashi: number; nakshatra: number; _source: string };
};

const PAIRS: PairFixture[] = (fixtures as { pairs: PairFixture[] }).pairs;

describe('Ashtakoot: 31 celebrity pair sweep (R-tier natal moons)', () => {
  it(`coverage: ${PAIRS.length} pairs loaded`, () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(30);
  });

  for (const p of PAIRS) {
    describe(`${p.label}`, () => {
      const r = computeAshtakoot(p.boy, p.girl);

      it('produces 8 koots in canonical order with correct max scores', () => {
        const expectedNames = ['Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi'];
        expect(r.koots.map((k) => k.name)).toEqual(expectedNames);
        expect(r.koots.map((k) => k.maxScore)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      });

      it('every per-koot score is within [0, max]', () => {
        for (const k of r.koots) {
          expect(k.score).toBeGreaterThanOrEqual(0);
          expect(k.score).toBeLessThanOrEqual(k.maxScore);
        }
      });

      it('total equals sum of per-koot scores and is in [0, 36]', () => {
        const sum = r.koots.reduce((s, k) => s + k.score, 0);
        expect(r.totalScore).toBeCloseTo(sum, 6);
        expect(r.totalScore).toBeGreaterThanOrEqual(0);
        expect(r.totalScore).toBeLessThanOrEqual(36);
      });
    });
  }
});

describe('Ashtakoot: hand-derived totals (structurally clear cases)', () => {
  it('Modi × Modi (identical chart): perfect 36', () => {
    const r = computeAshtakoot({ rashi: 7, nakshatra: 16 }, { rashi: 7, nakshatra: 16 });
    expect(r.totalScore).toBe(36);
  });

  it('Same-rashi different-nakshatra (Modi × Trump-Vrischika): Bhakoot full marks via distance (1,1)', () => {
    const r = computeAshtakoot({ rashi: 7, nakshatra: 16 }, { rashi: 7, nakshatra: 17 });
    expect(r.koots.find((k) => k.name === 'Bhakoot')!.score).toBe(7);
  });

  it('Same nakshatra (Obama × Priyanka, both Rohini): Nadi cancelled to 8', () => {
    const r = computeAshtakoot({ rashi: 1, nakshatra: 3 }, { rashi: 1, nakshatra: 3 });
    expect(r.koots.find((k) => k.name === 'Nadi')!.score).toBe(8);
    expect(r.cancellations.some((c) => c.startsWith('Nadi'))).toBe(true);
  });

  it('Bill Clinton × Kejriwal (both Mesha/Bharani): Nadi cancelled, Bhakoot full', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 1 }, { rashi: 0, nakshatra: 1 });
    expect(r.koots.find((k) => k.name === 'Bhakoot')!.score).toBe(7);
    expect(r.koots.find((k) => k.name === 'Nadi')!.score).toBe(8);
    expect(r.totalScore).toBe(36);
  });
});

describe('Ashtakoot: aggregate', () => {
  it('every fixture produces a deterministic, repeatable result', () => {
    for (const p of PAIRS) {
      const r1 = computeAshtakoot(p.boy, p.girl);
      const r2 = computeAshtakoot(p.boy, p.girl);
      expect(r1.totalScore).toBe(r2.totalScore);
      for (let i = 0; i < 8; i++) {
        expect(r1.koots[i]!.score).toBe(r2.koots[i]!.score);
      }
    }
  });

  it('total scores spread across 0..36 (no degenerate clustering)', () => {
    const totals = PAIRS.map((p) => computeAshtakoot(p.boy, p.girl).totalScore);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    expect(max - min).toBeGreaterThan(10);
  });
});
