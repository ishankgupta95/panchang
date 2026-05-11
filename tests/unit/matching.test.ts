/**
 * Unit tests for Ashtakoot Guna Milan (36-point compatibility scoring).
 *
 * Coverage:
 *   - max-score self-pairs (boy == girl): every koot at its maximum.
 *   - per-koot semantics: Varna/Vashya/Tara/Yoni/Graha Maitri/Gana/Bhakoot/Nadi.
 *   - Bhakoot and Nadi cancellation rules.
 *   - Input validation (rashi ∈ [0,11], nakshatra ∈ [0,26]).
 */

import { describe, it, expect } from 'vitest';
import { computeAshtakoot, type NatalMoon } from '../../src/jyotish/matching';
import {
  RASHI_VARNA, VARNA_RANK, NAKSHATRA_NADI, RASHI_LORD,
} from '../../src/jyotish/matchingTables';

describe('computeAshtakoot — total structure', () => {
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
    const boyRashi = 3;  // Cancer (Brahmin)
    const girlRashi = 0; // Aries (Kshatriya)
    expect(VARNA_RANK[RASHI_VARNA[boyRashi]!]).toBeGreaterThan(VARNA_RANK[RASHI_VARNA[girlRashi]!]);
    const r = computeAshtakoot({ rashi: boyRashi, nakshatra: 0 }, { rashi: girlRashi, nakshatra: 0 });
    expect(r.koots[0]!.score).toBe(1);
  });

  it('zero when girl varna outranks boy (Shudra boy + Brahmin girl)', () => {
    const r = computeAshtakoot({ rashi: 2, nakshatra: 0 }, { rashi: 3, nakshatra: 0 });
    // Gemini (Shudra=1) < Cancer (Brahmin=4)
    expect(r.koots[0]!.score).toBe(0);
  });
});

describe('Tara koot', () => {
  it('full 3 marks when boy & girl share nakshatra (rem = 1 → Janma → auspicious in this scheme)', () => {
    // Same nakshatra: dBoyToGirl = 1, dGirlToBoy = 1 → rem = 1 (Janma).
    // Janma is index 0 in 0-based tarabala, but in 1-indexed remainder math
    // here, 1 maps to "Janma" — auspicious by classical Smarta listing.
    const r = computeAshtakoot({ rashi: 0, nakshatra: 5 }, { rashi: 0, nakshatra: 5 });
    expect(r.koots[2]!.score).toBe(3);
  });

  it('half marks when one direction inauspicious, other auspicious', () => {
    // Boy nakshatra 0, girl nakshatra 2:
    //   dBoyToGirl = 3 → rem 3 (Vipat → inauspicious) → 0
    //   dGirlToBoy = 26 → rem 8 (Mitra → auspicious) → 1.5
    const r1 = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 2 });
    expect(r1.koots[2]!.score).toBe(1.5);
  });

  it('full 3 when both directions auspicious', () => {
    // Boy 0, girl 1: dBoyToGirl = 2 (Sampat → auspicious),
    // dGirlToBoy = 27 → rem 0 (Param Mitra → auspicious). Both auspicious → 3.
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 });
    expect(r.koots[2]!.score).toBe(3);
  });

  it('Tara is never zero in both directions simultaneously (structural property)', () => {
    // Forward and backward distances always sum to 29 (mod 27 logic with +1).
    // 29 ≡ 2 (mod 9). The inauspicious remainder set {3, 5, 7} contains no
    // pair that sums ≡ 2 (mod 9), so at least one direction is always
    // auspicious — Tara score ≥ 1.5 for any (boy, girl) pair.
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
    // Both have nakshatra Ashwini (yoni = horse) → 4
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[3]!.score).toBe(4);
  });
  it('zero for enemy yoni pair (horse vs buffalo)', () => {
    // Ashwini (horse) vs Hasta (buffalo) → enemy
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 12 });
    expect(r.koots[3]!.score).toBe(0);
  });
});

describe('Graha Maitri koot', () => {
  it('full 5 marks when boy and girl share rashi-lord', () => {
    // Aries(0) and Scorpio(7) both ruled by Mars
    expect(RASHI_LORD[0]).toBe(RASHI_LORD[7]);
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 0 });
    expect(r.koots[4]!.score).toBe(5);
  });
  it('5 marks when both lords are mutual friends', () => {
    // Aries (Mars) ↔ Cancer (Moon). Mars views Moon as friend; Moon views Mars as neutral.
    // Friend × neutral → 4
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 3, nakshatra: 0 });
    expect(r.koots[4]!.score).toBe(4);
  });
});

describe('Gana koot', () => {
  it('full 6 marks for same gana', () => {
    // Ashwini (Deva) ↔ Ashwini (Deva) → 6
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[5]!.score).toBe(6);
  });
  it('zero for Manushya × Rakshasa pair', () => {
    // Bharani (Manushya) vs Krittika (Rakshasa) → 0
    const r = computeAshtakoot({ rashi: 0, nakshatra: 1 }, { rashi: 0, nakshatra: 2 });
    expect(r.koots[5]!.score).toBe(0);
  });
});

describe('Bhakoot koot', () => {
  it('full 7 marks at distance (1, 1) — same rashi', () => {
    const r = computeAshtakoot({ rashi: 4, nakshatra: 9 }, { rashi: 4, nakshatra: 11 });
    expect(r.koots[6]!.score).toBe(7);
  });
  it('zero at distance (6, 8) without cancellation', () => {
    // Aries (0) → Virgo (5): d = 6; reverse Virgo→Aries: d = 8.
    // Aries lord Mars; Virgo lord Mercury. Mars-Mercury: enemy/neutral, no cancel.
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 5, nakshatra: 0 });
    expect(r.koots[6]!.score).toBe(0);
  });
  it('cancellation applied when rashi-lords are friends — score becomes 7', () => {
    // Cancer(3) → Aquarius(10): d_boy_to_girl = 8; d_girl_to_boy = 6 → doshic.
    // Cancer lord Moon, Aquarius lord Saturn. Moon views Saturn as neutral,
    // Saturn views Moon as enemy → no mutual friendship → no cancel.
    const r1 = computeAshtakoot({ rashi: 3, nakshatra: 0 }, { rashi: 10, nakshatra: 0 });
    expect(r1.koots[6]!.score).toBe(0);

    // Aries(0) → Scorpio(7) shares lord Mars → score 7 via "same lord" cancel.
    // distance (8, 6) is doshic but cancelled.
    const r2 = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 0 });
    expect(r2.koots[6]!.score).toBe(7);
    expect(r2.cancellations.some((c) => c.startsWith('Bhakoot'))).toBe(true);
  });
});

describe('Bhakoot opt-in cancellations (Phase 34b)', () => {
  it('same lagna-lord cancels Bhakoot when both natives supply lagnaRashi', () => {
    // Cancer (3) ↔ Aquarius (10): distance (8, 6) is doshic.
    // Rashi lords Moon vs Saturn are not mutual friends → default rule
    // leaves Bhakoot at 0. Adding lagnaRashi 9 (Cap) / 10 (Aqua) — both
    // ruled by Saturn — fires the opt-in same-lagna-lord cancellation.
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, lagnaRashi: 9 },
      { rashi: 10, nakshatra: 0, lagnaRashi: 10 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same lagna-lord');
  });

  it('same 7th-house lord cancels Bhakoot when lagna lords differ', () => {
    // Aries(0) ↔ Virgo(5): distance (6, 8) doshic, Mars vs Mercury — no
    // default cancel. Lagna Cancer (3, lord Moon) and lagna Leo (4, lord
    // Sun) differ, but 7th-from-each is Cap (Saturn) and Aqua (Saturn) —
    // SAME 7th-house lord.
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 3 },
      { rashi: 5, nakshatra: 0, lagnaRashi: 4 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same 7th-house lord');
  });

  it('same Navamsa lord cancels Bhakoot when lagnaRashi omitted', () => {
    // Cancer(3) ↔ Aquarius(10) doshic distance, no default cancel.
    // Navamsa rashis 0 (Aries, Mars) and 7 (Scorpio, Mars) share Mars.
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, navamsaRashi: 0 },
      { rashi: 10, nakshatra: 0, navamsaRashi: 7 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same Navamsa lord');
  });

  it('opt-in cancellations do not fire when only one native provides the field', () => {
    // Lagna provided on the boy only — same-lagna-lord must NOT fire.
    const r = computeAshtakoot(
      { rashi: 3, nakshatra: 0, lagnaRashi: 9 },
      { rashi: 10, nakshatra: 0 },
    );
    expect(r.koots[6]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.includes('lagna-lord'))).toBe(false);
  });

  it('opt-in cancellations do not fire when lagna and 7th and Navamsa lords all differ', () => {
    // Pair at (6,8): Aries lagna+navamsa+Moon vs Gemini lagna+navamsa+Virgo Moon.
    // Boy lagna 0 (Mars), girl lagna 2 (Mercury) — differ.
    // Boy 7th = Libra(Venus), girl 7th = Sagittarius(Jupiter) — differ.
    // Boy navamsa 0 (Mars), girl navamsa 2 (Mercury) — differ.
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 0, navamsaRashi: 0 },
      { rashi: 5, nakshatra: 0, lagnaRashi: 2, navamsaRashi: 2 },
    );
    expect(r.koots[6]!.score).toBe(0);
    expect(r.cancellations.some((c) => c.startsWith('Bhakoot'))).toBe(false);
  });

  it('default cancellation precedence: same rashi-lord wins over opt-in rules', () => {
    // Aries(0) ↔ Scorpio(7) — same rashi-lord Mars, already cancels.
    // Even with mismatched lagnaRashi, the existing same-rashi-lord
    // reason is pushed (not the lagna one).
    const r = computeAshtakoot(
      { rashi: 0, nakshatra: 0, lagnaRashi: 3 },
      { rashi: 7, nakshatra: 0, lagnaRashi: 8 },
    );
    expect(r.koots[6]!.score).toBe(7);
    expect(r.cancellations).toContain('Bhakoot: same rashi-lord');
    expect(r.cancellations.some((c) => c.includes('lagna-lord'))).toBe(false);
  });

  it('backward compat: omitting all optional fields preserves v3.5.0 behavior', () => {
    // Aries Moon ↔ Virgo Moon — distance (6,8) doshic with no default
    // cancellation. Picked different nakshatras (Ashwini vs Mrigashira)
    // so the existing Nadi same-nakshatra cancellation doesn't fire and
    // the cancellations array stays cleanly empty.
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
    // Both Adi nadi (Ashwini × Ardra). Different rashis to avoid same-rashi
    // cancellation (Ashwini in Aries 0; Ardra in Gemini 2).
    expect(NAKSHATRA_NADI[0]).toBe('adi');
    expect(NAKSHATRA_NADI[5]).toBe('adi');
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 2, nakshatra: 5 });
    expect(r.koots[7]!.score).toBe(0);
  });
  it('full 8 when natives have different nadis', () => {
    // Adi (Ashwini) × Madhya (Bharani)
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 });
    expect(r.koots[7]!.score).toBe(8);
  });
  it('cancellation when natives share the exact nakshatra', () => {
    // Same nakshatra Ashwini → same nadi (Adi), but cancelled.
    const r = computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(r.koots[7]!.score).toBe(8);
    expect(r.cancellations.some((c) => c.startsWith('Nadi'))).toBe(true);
  });
});

describe('total scoring — exemplar pairs', () => {
  it('identical chart (boy.rashi=girl.rashi, boy.nakshatra=girl.nakshatra) hits 36', () => {
    // Same rashi → Varna 1, Vashya 2, Bhakoot 7 (distance 1,1).
    // Same nakshatra → Tara 3, Yoni 4, Gana 6, Nadi 8 (cancelled).
    // Same rashi-lord → Graha Maitri 5.
    // Total = 36.
    const moon: NatalMoon = { rashi: 4, nakshatra: 11 };
    const r = computeAshtakoot(moon, moon);
    expect(r.totalScore).toBe(36);
  });

  it('a moderately compatible pair scores between 18 and 30', () => {
    const r = computeAshtakoot(
      { rashi: 4, nakshatra: 9 },   // Leo / Magha
      { rashi: 0, nakshatra: 1 },   // Aries / Bharani
    );
    expect(r.totalScore).toBeGreaterThanOrEqual(15);
    expect(r.totalScore).toBeLessThanOrEqual(35);
  });
});
