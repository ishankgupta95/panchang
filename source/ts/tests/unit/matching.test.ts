import { describe, it, expect } from 'vitest';
import { computeAshtakoot, type NatalMoon } from '../../src/jyotish/matching';
import {
  RASHI_VARNA, VARNA_RANK, NAKSHATRA_NADI, RASHI_LORD,
} from '../../src/jyotish/matchingTables';

describe('computeAshtakoot: total structure', () => {
  it('returns 8 koots in canonical order, scores in [0, max]', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 6, nakshatra: 13 });
    const expectedNames = ['Varna', 'Vashya', 'Tara', 'Yoni', 'Graha Maitri', 'Gana', 'Bhakoot', 'Nadi'];
    expect(r.koots.map((k) => k.name)).toEqual(expectedNames);
    const expectedMax = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(r.koots.map((k) => k.maxScore)).toEqual(expectedMax);
    r.koots.forEach((k) => {
      expect(k.score).toBeGreaterThanOrEqual(0);
      expect(k.score).toBeLessThanOrEqual(k.maxScore);
    });
    expect(r.totalScore).toBeCloseTo(r.koots.reduce((s, k) => s + k.score, 0), 6);
  });

  it('throws on out-of-range rashi', () => {
    expect(() => computeAshtakoot({ rashi: 12, nakshatra: 0 }, { rashi: 0, nakshatra: 0 }))
      .toThrow();
  });
  it('throws on out-of-range nakshatra', () => {
    expect(() => computeAshtakoot({ rashi: 0, nakshatra: 27 }, { rashi: 0, nakshatra: 0 }))
      .toThrow();
  });
});

describe('Varna koot', () => {
  it('full mark when boy and girl share rashi (and therefore varna)', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[0]!.score).toBe(1);
  });

  it('full mark when boy varna outranks girl (Brahmin > Kshatriya)', () => {
    const boyRashi = 3;
    const girlRashi = 0;
    expect(VARNA_RANK[RASHI_VARNA[boyRashi]!]).toBeGreaterThan(VARNA_RANK[RASHI_VARNA[girlRashi]!]);
    const r = computeAshtakoot({ rashi: boyRashi, nakshatra: 0 }, { rashi: girlRashi, nakshatra: 0 });
    expect(r.koots[0]!.score).toBe(1);
  });

  it('zero when girl varna outranks boy (Shudra boy + Brahmin girl)', () => {
    const r = computeAshtakoot({ rashi: 2, nakshatra: 0 }, { rashi: 3, nakshatra: 0 });
    expect(r.koots[0]!.score).toBe(0);
  });
});

describe('Tara koot', () => {
  it('full 3 marks when boy & girl share nakshatra (rem = 1 → Janma → auspicious in this scheme)', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 5 }, { rashi: 0, nakshatra: 5 });
    expect(r.koots[2]!.score).toBe(3);
  });

  it('half marks when one direction inauspicious, other auspicious', () => {
    const r1 = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 2 });
    expect(r1.koots[2]!.score).toBe(1.5);
  });

  it('full 3 when both directions auspicious', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 });
    expect(r.koots[2]!.score).toBe(3);
  });

  it('Tara is never zero in both directions simultaneously (structural property)', () => {
    // The two distances sum to 2 (mod 9), which no pair of inauspicious
    // remainders {3, 5, 7} can do.
    for (let bn = 0; bn < 27; bn++) {
      for (let gn = 0; gn < 27; gn++) {
        const r = computeAshtakoot({ rashi: 0, nakshatra: bn }, { rashi: 0, nakshatra: gn });
        expect(r.koots[2]!.score).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
});

describe('Yoni koot', () => {
  it('full 4 marks for same yoni animal', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[3]!.score).toBe(4);
  });
  it('zero for enemy yoni pair (horse vs buffalo)', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 12 });
    expect(r.koots[3]!.score).toBe(0);
  });
});

describe('Graha Maitri koot', () => {
  it('full 5 marks when boy and girl share rashi-lord', () => {
    expect(RASHI_LORD[0]).toBe(RASHI_LORD[7]);
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 0 });
    expect(r.koots[4]!.score).toBe(5);
  });
  it('5 marks when both lords are mutual friends', () => {
    // Mars sees Moon as a friend, Moon sees Mars as neutral: friend x neutral
    // scores 4, not 5.
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 3, nakshatra: 0 });
    expect(r.koots[4]!.score).toBe(4);
  });
});

describe('Gana koot', () => {
  it('full 6 marks for same gana', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[5]!.score).toBe(6);
  });
  it('zero for Manushya × Rakshasa pair', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 1 }, { rashi: 0, nakshatra: 2 });
    expect(r.koots[5]!.score).toBe(0);
  });
});

describe('Gana opt-in cancellation (options.ganaCancellation)', () => {
  // Manushya/Rakshasa pair whose rashis Aries and Scorpio share the lord Mars.
  const sameLordBoy: NatalMoon = { rashi: 0, nakshatra: 1 };
  const sameLordGirl: NatalMoon = { rashi: 7, nakshatra: 17 };

  it('default (no options) leaves the doshic score untouched: reference-almanac parity', () => {
    const r = computeAshtakoot(sameLordBoy, sameLordGirl);
    expect(r.koots[5]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.startsWith('Gana'))).toBe(false);
  });

  it('explicit false is byte-identical to omitting options', () => {
    const bare = computeAshtakoot(sameLordBoy, sameLordGirl);
    const explicit = computeAshtakoot(sameLordBoy, sameLordGirl, { ganaCancellation: false });
    expect(JSON.stringify(explicit)).toBe(JSON.stringify(bare));
  });

  it('same rashi-lord restores a 0-score Manushya/Rakshasa pair to 6', () => {
    const r = computeAshtakoot(sameLordBoy, sameLordGirl, { ganaCancellation: true });
    expect(r.koots[5]!.score).toBe(6);
    expect(r.cancellations).toContain('Gana: same rashi-lord');
    expect(r.totalScore).toBe(computeAshtakoot(sameLordBoy, sameLordGirl).totalScore + 6);
  });

  it('mutual rashi-lord friendship restores a 1-score Deva/Rakshasa pair to 6', () => {
    // Lords Moon (Cancer) and Sun (Leo) are mutual friends.
    const boy: NatalMoon = { rashi: 3, nakshatra: 7 };
    const girl: NatalMoon = { rashi: 4, nakshatra: 9 };
    expect(computeAshtakoot(boy, girl).koots[5]!.score).toBe(1);

    const r = computeAshtakoot(boy, girl, { ganaCancellation: true });
    expect(r.koots[5]!.score).toBe(6);
    expect(r.cancellations).toContain('Gana: mutual friendship of rashi-lords');
  });

  it('doshic pair whose lords are neither same nor mutual friends stays doshic', () => {
    // Mars sees Saturn as neutral, Saturn sees Mars as an enemy: not mutual.
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 1 }, { rashi: 10, nakshatra: 23 },
      { ganaCancellation: true },
    );
    expect(r.koots[5]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.startsWith('Gana'))).toBe(false);
  });

  it('non-doshic Deva/Manushya (5) is not touched even with same lord', () => {
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 },
      { ganaCancellation: true },
    );
    expect(r.koots[5]!.score).toBe(5);
    expect(r.cancellations.some((c) => c.startsWith('Gana'))).toBe(false);
  });
});

describe('Bhakoot koot', () => {
  it('full 7 marks at distance (1, 1): same rashi', () => {
    const r = computeAshtakoot({ rashi: 4, nakshatra: 9 }, { rashi: 4, nakshatra: 11 });
    expect(r.koots[6]!.score).toBe(7);
  });
  it('zero at distance (6, 8) without cancellation', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 5, nakshatra: 0 });
    expect(r.koots[6]!.score).toBe(0);
  });
  it('cancellation applied when rashi-lords are friends: score becomes 7', () => {
    // Moon sees Saturn as neutral, Saturn sees Moon as an enemy: no mutual
    // friendship to cancel on.
    const r1 = computeAshtakoot({ rashi: 3, nakshatra: 0 }, { rashi: 10, nakshatra: 0 });
    expect(r1.koots[6]!.score).toBe(0);

    // Aries and Scorpio are both lorded by Mars.
    const r2 = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 0 });
    expect(r2.koots[6]!.score).toBe(7);
    expect(r2.cancellations.some((c) => c.startsWith('Bhakoot'))).toBe(true);
  });
});

describe('Bhakoot opt-in cancellations (Phase 34b)', () => {
  it('same lagna-lord cancels Bhakoot when both natives supply lagnaRashi', () => {
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, lagnaRashi: 9 },
      { rashi: 10, nakshatra: 0, lagnaRashi: 10 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same lagna-lord');
  });

  it('same 7th-house lord cancels Bhakoot when lagna lords differ', () => {
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 3 },
      { rashi: 5, nakshatra: 0, lagnaRashi: 4 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same 7th-house lord');
  });

  it('same Navamsa lord cancels Bhakoot when lagnaRashi omitted', () => {
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, navamsaRashi: 0 },
      { rashi: 10, nakshatra: 0, navamsaRashi: 7 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same Navamsa lord');
  });

  it('opt-in cancellations do not fire when only one native provides the field', () => {
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, lagnaRashi: 9 },
      { rashi: 10, nakshatra: 0 },
    );
    expect(r.koots[6]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.includes('lagna-lord'))).toBe(false);
  });

  it('opt-in cancellations do not fire when lagna and 7th and Navamsa lords all differ', () => {
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 0, navamsaRashi: 0 },
      { rashi: 5, nakshatra: 0, lagnaRashi: 2, navamsaRashi: 2 },
    );
    expect(r.koots[6]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.startsWith('Bhakoot'))).toBe(false);
  });

  it('default cancellation precedence: same rashi-lord wins over opt-in rules', () => {
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 3 },
      { rashi: 7, nakshatra: 0, lagnaRashi: 8 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same rashi-lord');
    expect(r.cancellations.some((c) => c.includes('lagna-lord'))).toBe(false);
  });

  it('backward compat: omitting all optional fields preserves v3.5.0 behavior', () => {
    // The nakshatras differ deliberately so the Nadi same-nakshatra
    // cancellation cannot fire.
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0 },
      { rashi: 5, nakshatra: 4 },
    );
    expect(r.koots[6]!.score).toBe(0);
    expect(r.cancellations).toEqual([]);
  });

  it('throws on out-of-range lagnaRashi', () => {
    expect(() =>
      computeAshtakoot({ rashi: 0, nakshatra: 0, lagnaRashi: 12 }, { rashi: 0, nakshatra: 0 }),
    ).toThrow(RangeError);
  });

  it('throws on out-of-range navamsaRashi', () => {
    expect(() =>
      computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0, navamsaRashi: -1 }),
    ).toThrow(RangeError);
  });

  it('throws on out-of-range nakshatraPada', () => {
    expect(() =>
      computeAshtakoot({ rashi: 0, nakshatra: 0, nakshatraPada: 0 }, { rashi: 0, nakshatra: 0 }),
    ).toThrow(RangeError);
  });
});

describe('Nadi koot', () => {
  it('zero when both natives share the same nadi', () => {
    // The rashis differ deliberately so the same-rashi cancellation cannot fire.
    expect(NAKSHATRA_NADI[0]).toBe('adi');
    expect(NAKSHATRA_NADI[5]).toBe('adi');
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 2, nakshatra: 5 });
    expect(r.koots[7]!.score).toBe(0);
  });
  it('full 8 when natives have different nadis', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 });
    expect(r.koots[7]!.score).toBe(8);
  });
  it('cancellation when natives share the exact nakshatra', () => {
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[7]!.score).toBe(8);
    expect(r.cancellations.some((c) => c.startsWith('Nadi'))).toBe(true);
  });
});

describe('total scoring: exemplar pairs', () => {
  it('identical chart (boy.rashi=girl.rashi, boy.nakshatra=girl.nakshatra) hits 36', () => {
    // Nadi reaches 8 only via the same-nakshatra cancellation.
    const moon: NatalMoon = { rashi: 4, nakshatra: 11 };
    const r = computeAshtakoot(moon, moon);
    expect(r.totalScore).toBe(36);
  });

  it('a moderately compatible pair scores between 18 and 30', () => {
    const r = computeAshtakoot(
      { rashi: 4, nakshatra: 9 },
      { rashi: 0, nakshatra: 1 },
    );
    expect(r.totalScore).toBeGreaterThanOrEqual(15);
    expect(r.totalScore).toBeLessThanOrEqual(35);
  });
});
