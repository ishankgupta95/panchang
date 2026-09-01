
import { describe, it, expect } from 'vitest';
import { computePathuPorutham } from '../../src/jyotish/pathuPorutham';
import type { PoruthamName } from '../../src/jyotish/pathuPorutham';
import { vedhaOf, NAKSHATRA_RAJJU, MAHENDRA_AUSPICIOUS_DISTANCES }
  from '../../src/jyotish/pathuPoruthamTables';

const KOOT_NAMES: readonly PoruthamName[] = [
  'Dina', 'Gana', 'Mahendra', 'SthreeDeergha',
  'Yoni', 'Rashi', 'Rashyathipathi', 'Vasya', 'Rajju', 'Vedha',
];

function findKoot(result: ReturnType<typeof computePathuPorutham>, name: PoruthamName) {
  return result.poruthams.find((k) => k.name === name)!;
}

describe('computePathuPorutham: input validation', () => {
  it('rejects non-integer rashi', () => {
    expect(() =>
      computePathuPorutham({ rashi: 0.5, nakshatra: 0 }, { rashi: 0, nakshatra: 0 }),
    ).toThrow(RangeError);
  });
  it('rejects out-of-range rashi', () => {
    expect(() =>
      computePathuPorutham({ rashi: 12, nakshatra: 0 }, { rashi: 0, nakshatra: 0 }),
    ).toThrow(RangeError);
  });
  it('rejects out-of-range nakshatra', () => {
    expect(() =>
      computePathuPorutham({ rashi: 0, nakshatra: 27 }, { rashi: 0, nakshatra: 0 }),
    ).toThrow();
  });

  it('rejects out-of-range optional lagnaRashi', () => {
    expect(() =>
      computePathuPorutham(
        { rashi: 0, nakshatra: 0, lagnaRashi: 12 },
        { rashi: 0, nakshatra: 0 },
      ),
    ).toThrow(RangeError);
  });

  it('rejects out-of-range optional navamsaRashi', () => {
    expect(() =>
      computePathuPorutham(
        { rashi: 0, nakshatra: 0 },
        { rashi: 0, nakshatra: 0, navamsaRashi: -1 },
      ),
    ).toThrow(RangeError);
  });

  it('rejects out-of-range optional nakshatraPada', () => {
    expect(() =>
      computePathuPorutham(
        { rashi: 0, nakshatra: 0, nakshatraPada: 5 },
        { rashi: 0, nakshatra: 0 },
      ),
    ).toThrow(RangeError);
  });

  it('accepts optional fields in valid range without error', () => {
    expect(() =>
      computePathuPorutham(
        { rashi: 0, nakshatra: 0, lagnaRashi: 5, navamsaRashi: 7, nakshatraPada: 2 },
        { rashi: 6, nakshatra: 17, lagnaRashi: 11, navamsaRashi: 0, nakshatraPada: 4 },
      ),
    ).not.toThrow();
  });
});

describe('computePathuPorutham: output shape', () => {
  it('returns 10 koots in canonical order', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 6, nakshatra: 17 },
    );
    expect(r.poruthams).toHaveLength(10);
    expect(r.poruthams.map((k) => k.name)).toEqual(KOOT_NAMES);
  });

  it('totalPasses equals count of passing koots (0..10)', () => {
    const r = computePathuPorutham(
      { rashi: 4, nakshatra: 9 },
      { rashi: 0, nakshatra: 1 },
    );
    expect(r.totalPasses).toBeGreaterThanOrEqual(0);
    expect(r.totalPasses).toBeLessThanOrEqual(10);
    const counted = r.poruthams.filter((k) => k.passes).length;
    expect(r.totalPasses).toBe(counted);
  });

  it('every koot has a description string', () => {
    const r = computePathuPorutham(
      { rashi: 4, nakshatra: 9 },
      { rashi: 0, nakshatra: 1 },
    );
    for (const k of r.poruthams) {
      expect(typeof k.description).toBe('string');
      expect(k.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Dina Porutham', () => {
  it('passes for girl→boy distance 2 (Sampat tara, auspicious)', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 1 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(true);
  });

  it('passes for girl→boy distance 9 (Param Mitra, auspicious)', () => {
    const r = computePathuPorutham({ rashi: 3, nakshatra: 8 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(true);
  });

  it('fails for girl→boy distance 3 (Vipat tara, inauspicious)', () => {
    const r = computePathuPorutham({ rashi: 1, nakshatra: 2 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(false);
  });

  it('fails for girl→boy distance 5 (Pratyari tara, inauspicious)', () => {
    const r = computePathuPorutham({ rashi: 1, nakshatra: 4 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(false);
  });

  it('fails for girl→boy distance 7 (Naidhana tara, inauspicious)', () => {
    const r = computePathuPorutham({ rashi: 2, nakshatra: 6 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(false);
  });

  it('fails for girl→boy distance 1 (Janma: Mixed, treated as fail)', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 0 });
    expect(findKoot(r, 'Dina').passes).toBe(false);
  });
});

describe('Gana Porutham', () => {
  it('Manushya-Rakshasa fails', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 1 }, { rashi: 0, nakshatra: 2 });
    expect(findKoot(r, 'Gana').passes).toBe(false);
  });
  it('Rakshasa-Manushya fails', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 2 }, { rashi: 0, nakshatra: 1 });
    expect(findKoot(r, 'Gana').passes).toBe(false);
  });
  it('Deva-Deva passes', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 0 }, { rashi: 1, nakshatra: 4 });
    expect(findKoot(r, 'Gana').passes).toBe(true);
  });
  it('Manushya-Manushya passes', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 1 }, { rashi: 1, nakshatra: 3 });
    expect(findKoot(r, 'Gana').passes).toBe(true);
  });
  it('Deva-Manushya passes (mild)', () => {
    const r = computePathuPorutham({ rashi: 0, nakshatra: 0 }, { rashi: 0, nakshatra: 1 });
    expect(findKoot(r, 'Gana').passes).toBe(true);
  });
});

describe('Mahendra Porutham', () => {
  it.each(MAHENDRA_AUSPICIOUS_DISTANCES.map((d) => [d] as const))(
    'girl→boy distance %i is auspicious',
    (d) => {
      const girlNak = 0;
      const boyNak = (girlNak + d - 1) % 27;
      const r = computePathuPorutham(
        { rashi: 0, nakshatra: boyNak },
        { rashi: 0, nakshatra: girlNak },
      );
      expect(findKoot(r, 'Mahendra').passes).toBe(true);
    },
  );

  it('girl→boy distance 5 (not in set) fails', () => {
    const r = computePathuPorutham(
      { rashi: 1, nakshatra: 4 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'Mahendra').passes).toBe(false);
  });
});

describe('Sthree Deergha', () => {
  it('passes when girl→boy distance > 13', () => {
    const r = computePathuPorutham(
      { rashi: 7, nakshatra: 16 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(true);
  });
  it('fails when girl→boy distance ≤ 13', () => {
    const r = computePathuPorutham(
      { rashi: 2, nakshatra: 6 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(false);
  });
  it('fails for girl→boy distance exactly 13', () => {
    const r = computePathuPorutham(
      { rashi: 5, nakshatra: 12 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(false);
  });
  it('passes for girl→boy distance 14', () => {
    const r = computePathuPorutham(
      { rashi: 4, nakshatra: 13 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(true);
  });

  it('fails for girl→boy distance 9 (defends against the >9 variant threshold)', () => {
    const r = computePathuPorutham(
      { rashi: 3, nakshatra: 8 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(false);
  });

  it('passes for girl→boy distance 15 (defends against the >15 variant threshold)', () => {
    const r = computePathuPorutham(
      { rashi: 6, nakshatra: 14 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(true);
  });

  it('passes for girl→boy distance 16 (well above threshold)', () => {
    const r = computePathuPorutham(
      { rashi: 6, nakshatra: 15 },
      { rashi: 0, nakshatra: 0 },
    );
    expect(findKoot(r, 'SthreeDeergha').passes).toBe(true);
  });
});

describe('Yoni Porutham (veto on enemy)', () => {
  it('same yoni passes (no veto)', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 10, nakshatra: 23 },
    );
    const k = findKoot(r, 'Yoni');
    expect(k.passes).toBe(true);
    expect(k.veto).toBeUndefined();
  });

  it('enemy yoni vetoes (horse vs buffalo)', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 5, nakshatra: 12 },
    );
    const k = findKoot(r, 'Yoni');
    expect(k.passes).toBe(false);
    expect(k.veto).toBe(true);
    expect(r.recommended).toBe(false);
  });
});

describe('Rashi Porutham', () => {
  it('passes for non-doshic distance', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 0, nakshatra: 1 },
    );
    expect(findKoot(r, 'Rashi').passes).toBe(true);
  });

  it('fails for 6/8 distance (Shashtashtaka)', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 5, nakshatra: 0 },
    );
    expect(findKoot(r, 'Rashi').passes).toBe(false);
  });

  it('fails for 2/12 distance', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 1, nakshatra: 0 },
    );
    expect(findKoot(r, 'Rashi').passes).toBe(false);
  });
});

describe('Rashyathipathi Porutham', () => {
  it('passes when same rashi-lord', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 7, nakshatra: 0 },
    );
    expect(findKoot(r, 'Rashyathipathi').passes).toBe(true);
  });

  it('fails when lords are mutual enemies', () => {
    const r = computePathuPorutham(
      { rashi: 4, nakshatra: 0 },
      { rashi: 6, nakshatra: 0 },
    );
    expect(findKoot(r, 'Rashyathipathi').passes).toBe(false);
  });
});

describe('Vasya Porutham', () => {
  it('passes when both same vashya group (quadruped)', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 1, nakshatra: 0 },
    );
    expect(findKoot(r, 'Vasya').passes).toBe(true);
  });

  it('fails for incompatible vashya (wild + insect)', () => {
    const r = computePathuPorutham(
      { rashi: 4, nakshatra: 0 },
      { rashi: 7, nakshatra: 0 },
    );
    expect(findKoot(r, 'Vasya').passes).toBe(false);
  });
});

describe('Rajju Porutham (veto on same group)', () => {
  it('canonical group spot-checks', () => {
    expect(NAKSHATRA_RAJJU[0]).toBe('Pada');
    expect(NAKSHATRA_RAJJU[8]).toBe('Pada');
    expect(NAKSHATRA_RAJJU[4]).toBe('Sira');
    expect(NAKSHATRA_RAJJU[13]).toBe('Sira');
    expect(NAKSHATRA_RAJJU[22]).toBe('Sira');
    expect(NAKSHATRA_RAJJU[5]).toBe('Kantha');
    expect(NAKSHATRA_RAJJU[3]).toBe('Kantha');
  });

  it('same rajju vetoes', () => {
    const r = computePathuPorutham(
      { rashi: 1, nakshatra: 4 },
      { rashi: 6, nakshatra: 13 },
    );
    const k = findKoot(r, 'Rajju');
    expect(k.passes).toBe(false);
    expect(k.veto).toBe(true);
    expect(r.recommended).toBe(false);
  });

  it('different rajju passes', () => {
    const r = computePathuPorutham(
      { rashi: 1, nakshatra: 4 },
      { rashi: 2, nakshatra: 5 },
    );
    const k = findKoot(r, 'Rajju');
    expect(k.passes).toBe(true);
    expect(k.veto).toBeUndefined();
  });
});

describe('Vedha Porutham (veto on pair)', () => {
  it('vedha pair vetoes', () => {
    expect(vedhaOf(0)).toBe(17);
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 7, nakshatra: 17 },
    );
    const k = findKoot(r, 'Vedha');
    expect(k.passes).toBe(false);
    expect(k.veto).toBe(true);
    expect(r.recommended).toBe(false);
  });

  it('non-pair passes', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 0, nakshatra: 1 },
    );
    const k = findKoot(r, 'Vedha');
    expect(k.passes).toBe(true);
    expect(k.veto).toBeUndefined();
  });

  it('Chitra (13) is the one unpaired nakshatra in the canonical table', () => {
    expect(vedhaOf(13)).toBe(null);
  });

  it('canonical non-symmetric pairs (the mirror-symmetric table got these wrong)', () => {
    expect(vedhaOf(4)).toBe(22);
    expect(vedhaOf(5)).toBe(21);
    expect(vedhaOf(8)).toBe(18);
    expect(vedhaOf(9)).toBe(26);
    expect(vedhaOf(12)).toBe(23);
  });
});

describe('Aggregate recommendation flag', () => {
  it('strong veto fail flips recommended to false even with high passing count', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 7, nakshatra: 17 },
    );
    expect(r.recommended).toBe(false);
    expect(r.poruthams.some((k) => k.veto === true)).toBe(true);
  });

  it('low passing count (<5) fails recommendation even without veto', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 0, nakshatra: 4 },
    );
    if (!r.poruthams.some((k) => k.veto === true)) {
      const expected = r.totalPasses >= 5;
      expect(r.recommended).toBe(expected);
    }
  });

  it('high passing count + no veto → recommended', () => {
    const r = computePathuPorutham(
      { rashi: 0, nakshatra: 0 },
      { rashi: 8, nakshatra: 20 },
    );
    if (r.totalPasses >= 5 && !r.poruthams.some((k) => k.veto === true)) {
      expect(r.recommended).toBe(true);
    }
  });
});

describe('20-pair smoke sweep', () => {
  const pairs: { boy: { rashi: number; nakshatra: number }; girl: { rashi: number; nakshatra: number } }[] = [
    { boy: { rashi: 0, nakshatra: 0 }, girl: { rashi: 1, nakshatra: 3 } },
    { boy: { rashi: 0, nakshatra: 1 }, girl: { rashi: 2, nakshatra: 6 } },
    { boy: { rashi: 1, nakshatra: 2 }, girl: { rashi: 3, nakshatra: 9 } },
    { boy: { rashi: 1, nakshatra: 3 }, girl: { rashi: 4, nakshatra: 12 } },
    { boy: { rashi: 2, nakshatra: 4 }, girl: { rashi: 5, nakshatra: 15 } },
    { boy: { rashi: 2, nakshatra: 5 }, girl: { rashi: 6, nakshatra: 18 } },
    { boy: { rashi: 3, nakshatra: 6 }, girl: { rashi: 7, nakshatra: 21 } },
    { boy: { rashi: 3, nakshatra: 7 }, girl: { rashi: 8, nakshatra: 24 } },
    { boy: { rashi: 4, nakshatra: 8 }, girl: { rashi: 9, nakshatra: 0 } },
    { boy: { rashi: 4, nakshatra: 9 }, girl: { rashi: 10, nakshatra: 3 } },
    { boy: { rashi: 5, nakshatra: 10 }, girl: { rashi: 11, nakshatra: 6 } },
    { boy: { rashi: 5, nakshatra: 11 }, girl: { rashi: 0, nakshatra: 9 } },
    { boy: { rashi: 6, nakshatra: 12 }, girl: { rashi: 1, nakshatra: 12 } },
    { boy: { rashi: 6, nakshatra: 13 }, girl: { rashi: 2, nakshatra: 15 } },
    { boy: { rashi: 7, nakshatra: 14 }, girl: { rashi: 3, nakshatra: 18 } },
    { boy: { rashi: 7, nakshatra: 15 }, girl: { rashi: 4, nakshatra: 21 } },
    { boy: { rashi: 8, nakshatra: 16 }, girl: { rashi: 5, nakshatra: 24 } },
    { boy: { rashi: 9, nakshatra: 19 }, girl: { rashi: 6, nakshatra: 0 } },
    { boy: { rashi: 10, nakshatra: 22 }, girl: { rashi: 7, nakshatra: 5 } },
    { boy: { rashi: 11, nakshatra: 25 }, girl: { rashi: 0, nakshatra: 10 } },
  ];

  it.each(pairs)('returns shape-valid result for pair %#', ({ boy, girl }) => {
    const r = computePathuPorutham(boy, girl);
    expect(r.poruthams).toHaveLength(10);
    expect(r.totalPasses).toBeGreaterThanOrEqual(0);
    expect(r.totalPasses).toBeLessThanOrEqual(10);
    expect(typeof r.recommended).toBe('boolean');

    const veto = r.poruthams.some((k) => k.veto === true);
    if (veto) expect(r.recommended).toBe(false);
    else expect(r.recommended).toBe(r.totalPasses >= 5);
  });
});
