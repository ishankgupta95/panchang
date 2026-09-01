
import { describe, it, expect } from 'vitest';
import { computeAspects } from '../../src/jyotish/aspects';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type { BirthChart, GrahaName, PlanetPlacement } from '../../src/types/jyotish';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

function makeChart(houseByPlanet: Partial<Record<GrahaName, number>>): BirthChart {
  const order: GrahaName[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const stub = (planet: GrahaName, house: number): PlanetPlacement => ({
    planet,
    longitude: (house - 1) * 30,
    rashi: { index: house - 1, name: String(house - 1) },
    degreeInRashi: 0,
    house,
    isRetrograde: false,
  });
  const lagnaRashi = 0;
  const planets = order.map((p) => stub(p, houseByPlanet[p] ?? 1));
  return {
    divisional: 'D1',
    lagna: {
      siderealLongitude: 0,
      rashi: { index: 0, name: '0' },
      degreeInRashi: 0,
      nakshatra: { index: 0, name: 'x' },
      pada: 1,
    },
    bhava: {
      system: 'whole-sign',
      ascendantLongitude: 0,
      mcLongitude: 270,
      houses: Array.from({ length: 12 }, (_, i) => ({
        house: i + 1,
        cuspLongitude: i * 30,
        rashi: { index: i, name: String(i) },
        degreeInRashi: 0,
      })),
    },
    planets,
    byPlanet: indexPlanets(planets),
  };
  void lagnaRashi;
}

describe('computeAspects: universal 7th aspect', () => {
  it('every graha aspects the 7th house from itself', () => {
    const chart = makeChart({
      Sun: 1, Moon: 2, Mars: 3, Mercury: 4, Jupiter: 5,
      Venus: 6, Saturn: 7, Rahu: 8, Ketu: 9,
    });
    const a = computeAspects(chart);
    expect(a.Sun).toContain(7);
    expect(a.Moon).toContain(8);
    expect(a.Mars).toContain(9);
    expect(a.Mercury).toContain(10);
    expect(a.Jupiter).toContain(11);
    expect(a.Venus).toContain(12);
    expect(a.Saturn).toContain(1);
    expect(a.Rahu).toContain(2);
    expect(a.Ketu).toContain(3);
  });

  it('7th aspect wraps modulo 12', () => {
    const chart = makeChart({ Sun: 7 });
    expect(computeAspects(chart).Sun).toContain(1);
    const chart2 = makeChart({ Sun: 12 });
    expect(computeAspects(chart2).Sun).toContain(6);
  });
});

describe('computeAspects: Mars special aspects (4 + 8)', () => {
  it('Mars in house 1 aspects 4, 7, 8', () => {
    const a = computeAspects(makeChart({ Mars: 1 }));
    expect(a.Mars).toEqual([4, 7, 8]);
  });

  it('Mars in house 5 aspects 8, 11, 12', () => {
    const a = computeAspects(makeChart({ Mars: 5 }));
    expect(a.Mars).toEqual([8, 11, 12]);
  });

  it('Mars in house 12 aspects 3, 6, 7', () => {
    const a = computeAspects(makeChart({ Mars: 12 }));
    expect(a.Mars).toEqual([3, 6, 7]);
  });

  it('Mars aspects sorted ascending', () => {
    const a = computeAspects(makeChart({ Mars: 9 }));
    for (let i = 1; i < a.Mars.length; i++) {
      expect(a.Mars[i]!).toBeGreaterThan(a.Mars[i - 1]!);
    }
  });
});

describe('computeAspects: Jupiter special aspects (5 + 9)', () => {
  it('Jupiter in house 1 aspects 5, 7, 9', () => {
    const a = computeAspects(makeChart({ Jupiter: 1 }));
    expect(a.Jupiter).toEqual([5, 7, 9]);
  });

  it('Jupiter in house 6 aspects 10, 12, 2', () => {
    const a = computeAspects(makeChart({ Jupiter: 6 }));
    expect(a.Jupiter).toEqual([2, 10, 12]);
  });

  it('Jupiter in house 11 aspects 3, 5, 7', () => {
    const a = computeAspects(makeChart({ Jupiter: 11 }));
    expect(a.Jupiter).toEqual([3, 5, 7]);
  });
});

describe('computeAspects: Saturn special aspects (3 + 10)', () => {
  it('Saturn in house 1 aspects 3, 7, 10', () => {
    const a = computeAspects(makeChart({ Saturn: 1 }));
    expect(a.Saturn).toEqual([3, 7, 10]);
  });

  it('Saturn in house 4 aspects 6, 10, 1', () => {
    const a = computeAspects(makeChart({ Saturn: 4 }));
    expect(a.Saturn).toEqual([1, 6, 10]);
  });

  it('Saturn in house 10 aspects 12, 4, 7', () => {
    const a = computeAspects(makeChart({ Saturn: 10 }));
    expect(a.Saturn).toEqual([4, 7, 12]);
  });
});

describe('computeAspects: non-malefic grahas only have 7th aspect', () => {
  it('Sun in house 3 aspects only 9', () => {
    const a = computeAspects(makeChart({ Sun: 3 }));
    expect(a.Sun).toEqual([9]);
  });

  it('Moon in house 5 aspects only 11', () => {
    const a = computeAspects(makeChart({ Moon: 5 }));
    expect(a.Moon).toEqual([11]);
  });

  it('Mercury in house 8 aspects only 2', () => {
    const a = computeAspects(makeChart({ Mercury: 8 }));
    expect(a.Mercury).toEqual([2]);
  });

  it('Venus in house 12 aspects only 6', () => {
    const a = computeAspects(makeChart({ Venus: 12 }));
    expect(a.Venus).toEqual([6]);
  });
});

describe('computeAspects: Rahu / Ketu node aspects', () => {
  it('default (7-only): Rahu in house 4 aspects only 10', () => {
    const a = computeAspects(makeChart({ Rahu: 4 }));
    expect(a.Rahu).toEqual([10]);
  });

  it('default (7-only): Ketu in house 9 aspects only 3', () => {
    const a = computeAspects(makeChart({ Ketu: 9 }));
    expect(a.Ketu).toEqual([3]);
  });

  it('5-and-9 mode: Rahu in house 1 aspects 5, 7, 9', () => {
    const a = computeAspects(makeChart({ Rahu: 1 }), { nodeAspects: '5-and-9' });
    expect(a.Rahu).toEqual([5, 7, 9]);
  });

  it('5-and-9 mode: Ketu in house 1 aspects 5, 7, 9', () => {
    const a = computeAspects(makeChart({ Ketu: 1 }), { nodeAspects: '5-and-9' });
    expect(a.Ketu).toEqual([5, 7, 9]);
  });

  it('5-and-9 mode does not affect Sun/Moon/Mercury/Venus', () => {
    const chart = makeChart({ Sun: 1, Moon: 1, Mercury: 1, Venus: 1 });
    const def = computeAspects(chart);
    const ext = computeAspects(chart, { nodeAspects: '5-and-9' });
    expect(def.Sun).toEqual(ext.Sun);
    expect(def.Moon).toEqual(ext.Moon);
    expect(def.Mercury).toEqual(ext.Mercury);
    expect(def.Venus).toEqual(ext.Venus);
  });
});

describe('computeAspects: output structure', () => {
  it('every graha key is present', () => {
    const chart = makeChart({});
    const a = computeAspects(chart);
    const keys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    for (const k of keys) expect(a).toHaveProperty(k);
  });

  it('aspect houses are always in [1, 12] and unique', () => {
    for (let h = 1; h <= 12; h++) {
      const a = computeAspects(makeChart({ Mars: h }));
      const houses = a.Mars;
      expect(new Set(houses).size).toBe(houses.length);
      for (const x of houses) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(12);
      }
    }
  });

  it('Mars / Jupiter / Saturn each have exactly 3 aspect houses', () => {
    const a = computeAspects(makeChart({ Mars: 1, Jupiter: 1, Saturn: 1 }));
    expect(a.Mars).toHaveLength(3);
    expect(a.Jupiter).toHaveLength(3);
    expect(a.Saturn).toHaveLength(3);
  });

  it('Sun / Moon / Mercury / Venus / Rahu / Ketu each have exactly 1 aspect (7-only)', () => {
    const chart = makeChart({});
    const a = computeAspects(chart);
    expect(a.Sun).toHaveLength(1);
    expect(a.Moon).toHaveLength(1);
    expect(a.Mercury).toHaveLength(1);
    expect(a.Venus).toHaveLength(1);
    expect(a.Rahu).toHaveLength(1);
    expect(a.Ketu).toHaveLength(1);
  });
});

describe('computeAspects: integration with computeRashiChart', () => {
  it('returns valid aspects for a real natal chart', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const a = computeAspects(chart);
    expect(a.Mars).toHaveLength(3);
    expect(a.Jupiter).toHaveLength(3);
    expect(a.Saturn).toHaveLength(3);
    for (const houses of Object.values(a)) {
      for (const h of houses) {
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(12);
      }
    }
  });

  it('Rahu and Ketu aspect axially-opposite houses (their 7ths are 6 apart, ie axial)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const a = computeAspects(chart);
    const rahu = chart.planets.find((p) => p.planet === 'Rahu')!;
    const ketu = chart.planets.find((p) => p.planet === 'Ketu')!;
    expect(a.Rahu).toEqual([ketu.house]);
    expect(a.Ketu).toEqual([rahu.house]);
  });
});
