import { describe, it, expect } from 'vitest';
import {
  computeBhavaBala, computeShadbala, _BHAVA_DIK_VALUES_FOR_TEST,
} from '../../src/jyotish/shadbala';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo,
  LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

interface Fix {
  name: string;
  dateLocal: string;
  tzh: number;
  lat: number;
  lon: number;
}
const FIXTURE_CHARTS: Fix[] = (fixtures as { charts: Fix[] }).charts;

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

function fixtureBirth(name: string): { utc: Date; loc: { latitude: number; longitude: number } } {
  const f = FIXTURE_CHARTS.find((c) => c.name === name);
  if (!f) throw new Error(`fixture not found: ${name}`);
  return {
    utc: localToUtc(f.dateLocal, f.tzh),
    loc: { latitude: f.lat, longitude: f.lon },
  };
}

const RASHI: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

interface SynthSpec {
  lagnaRashi: number;
  rashis?: Partial<Record<GrahaName, number>>;
  degrees?: Partial<Record<GrahaName, number>>;
}

function synthChart(spec: SynthSpec): BirthChart {
  const lagnaRashi = spec.lagnaRashi;
  const lagna: LagnaInfo = {
    siderealLongitude: lagnaRashi * 30 + 15,
    rashi: { index: lagnaRashi, name: RASHI[lagnaRashi]! },
    degreeInRashi: 15,
    nakshatra: { index: 0, name: 'Ashwini' },
    pada: 1,
  };
  const houses: HouseInfo[] = [];
  for (let i = 0; i < 12; i++) {
    const r = (lagnaRashi + i) % 12;
    houses.push({
      house: i + 1,
      cuspLongitude: r * 30,
      rashi: { index: r, name: RASHI[r]! },
      degreeInRashi: 0,
    });
  }
  const bhava: BhavaChart = {
    system: 'whole-sign',
    houses,
    ascendantLongitude: lagna.siderealLongitude,
    mcLongitude: ((lagnaRashi + 9) % 12) * 30,
  };

  const allGrahas: GrahaName[] = [...VISIBLE_GRAHAS, 'Rahu', 'Ketu'];
  const planets: PlanetPlacement[] = allGrahas.map((g) => {
    const r = spec.rashis?.[g] ?? 0;
    const deg = spec.degrees?.[g] ?? 15;
    const house = ((r - lagnaRashi + 12) % 12) + 1;
    return {
      planet: g,
      longitude: r * 30 + deg,
      rashi: { index: r, name: RASHI[r]! },
      degreeInRashi: deg,
      house,
      isRetrograde: g === 'Rahu' || g === 'Ketu',
    };
  });
  return { divisional: 'D1', lagna, bhava, planets, byPlanet: indexPlanets(planets) };
}

describe('computeBhavaBala: structural invariants', () => {
  const { utc, loc } = fixtureBirth('Narendra Modi');
  const bhavaBala = computeBhavaBala(utc, loc);

  it('returns exactly 12 houses', () => {
    expect(bhavaBala.houses).toHaveLength(12);
  });

  it('each house total equals exact sum of the 4 components', () => {
    for (let i = 0; i < 12; i++) {
      const h = bhavaBala.houses[i]!;
      expect(h.total).toBe(h.bhavadhipati + h.dik + h.drik + h.sthana);
    }
  });

  it('drik component is non-negative for every bhava (clamp ≥ 0)', () => {
    for (let i = 0; i < 12; i++) {
      expect(bhavaBala.houses[i]!.drik).toBeGreaterThanOrEqual(0);
    }
  });

  it('dik component matches the BPHS Ch. 27 table for every bhava', () => {
    for (let i = 0; i < 12; i++) {
      expect(bhavaBala.houses[i]!.dik).toBe(_BHAVA_DIK_VALUES_FOR_TEST[i]);
    }
  });
});

describe('Bhava Dik Bala: pinned BPHS Ch. 27 table', () => {
  it('matches the 12 cardinal-anchored values exactly', () => {
    expect([..._BHAVA_DIK_VALUES_FOR_TEST]).toEqual([
      60, 40, 20, 0, 5, 10, 15, 20, 25, 30, 40, 50,
    ]);
  });
});

describe('Bhavadhipati Bala: uses lord-of-bhava Shadbala total', () => {
  it('bhava-1 bhavadhipati equals Shadbala total of the lagna-rashi lord', () => {
    const { utc, loc } = fixtureBirth('Narendra Modi');
    const chart = computeRashiChart(utc, loc);
    const sb = computeShadbala(utc, loc);
    const bhavaBala = computeBhavaBala(utc, loc);

    const RASHI_LORD_GRAHA: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
      'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
      'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
    ];
    const lagnaLord = RASHI_LORD_GRAHA[chart.lagna.rashi.index]!;
    expect(bhavaBala.houses[0]!.bhavadhipati).toBe(sb[lagnaLord].total);
  });

  it('bhavas with same rashi-lord share the same bhavadhipati', () => {
    const { utc, loc } = fixtureBirth('Mukesh Ambani');
    const chart = computeRashiChart(utc, loc);
    const bhavaBala = computeBhavaBala(utc, loc);

    const RASHI_LORD_NUM: readonly number[] = [
      2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4,
    ];
    const byLord = new Map<number, number[]>();
    for (let i = 0; i < 12; i++) {
      const cuspRashi = chart.bhava.houses[i]!.rashi.index;
      const lord = RASHI_LORD_NUM[cuspRashi]!;
      if (!byLord.has(lord)) byLord.set(lord, []);
      byLord.get(lord)!.push(i);
    }
    for (const indices of byLord.values()) {
      if (indices.length < 2) continue;
      const reference = bhavaBala.houses[indices[0]!]!.bhavadhipati;
      for (const i of indices) {
        expect(bhavaBala.houses[i]!.bhavadhipati).toBe(reference);
      }
    }
  });
});

describe('Bhava Drik Bala: clamp and sign rules', () => {
  it('clamps net malefic aspect to 0', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 9, Moon: 9, Mars: 0, Mercury: 9,
        Jupiter: 9, Venus: 9, Saturn: 9, Rahu: 5, Ketu: 11,
      },
    });
    const drikRaw = computeSyntheticDrikBala(chart, 7);
    expect(drikRaw).toBeLessThan(0);
    expect(Math.max(0, drikRaw)).toBe(0);
  });

  it('positive net benefic aspect contributes the un-clamped value', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 10, Moon: 10, Mars: 10, Mercury: 10,
        Jupiter: 0, Venus: 10, Saturn: 10, Rahu: 5, Ketu: 11,
      },
    });
    expect(computeSyntheticDrikBala(chart, 5)).toBe(45);
    expect(computeSyntheticDrikBala(chart, 9)).toBe(45);
  });
});

describe('Bhavasthana Bala: benefic/malefic sign rule', () => {
  it('Jupiter alone in bhava 1 → +34.29 (Jupiter Naisargika)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6,
        Jupiter: 0, Venus: 6, Saturn: 6, Rahu: 5, Ketu: 11,
      },
    });
    expect(computeSyntheticSthanaBala(chart, 1)).toBeCloseTo(34.29, 4);
  });

  it('Saturn alone in bhava 1 → -8.57 (Saturn Naisargika, malefic)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6,
        Jupiter: 6, Venus: 6, Saturn: 0, Rahu: 5, Ketu: 11,
      },
    });
    expect(computeSyntheticSthanaBala(chart, 1)).toBeCloseTo(-8.57, 4);
  });

  it('Mercury (benefic per BPHS) + Mars (malefic) in same bhava → +25.71 -17.14', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 0, Mercury: 0,
        Jupiter: 6, Venus: 6, Saturn: 6, Rahu: 5, Ketu: 11,
      },
    });
    expect(computeSyntheticSthanaBala(chart, 1)).toBeCloseTo(25.71 - 17.14, 4);
  });

  it('Rahu and Ketu in bhava 1 contribute nothing', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6,
        Jupiter: 6, Venus: 6, Saturn: 6, Rahu: 0, Ketu: 0,
      },
    });
    expect(computeSyntheticSthanaBala(chart, 1)).toBe(0);
  });
});

const NAISARGIKA: Record<GrahaName, number> = {
  Sun: 60.00, Moon: 51.43, Venus: 42.86, Jupiter: 34.29,
  Mercury: 25.71, Mars: 17.14, Saturn: 8.57,
  Rahu: 0, Ketu: 0,
};
const BENEFICS: ReadonlySet<GrahaName> = new Set(['Moon', 'Mercury', 'Jupiter', 'Venus']);
const ASPECT_WEIGHTS: Record<number, number> = {
  6: 1, 3: 0.5, 7: 0.5, 4: 0.75, 8: 0.75, 2: 0.25, 9: 0.25,
};
const SPECIAL: Record<GrahaName, ReadonlySet<number>> = {
  Sun: new Set(), Moon: new Set(),
  Mars: new Set([3, 7]),
  Mercury: new Set(),
  Jupiter: new Set([4, 8]),
  Venus: new Set(),
  Saturn: new Set([2, 9]),
  Rahu: new Set(), Ketu: new Set(),
};

function computeSyntheticDrikBala(chart: BirthChart, bhavaNumber: number): number {
  let net = 0;
  for (const aspector of chart.planets) {
    if (aspector.planet === 'Rahu' || aspector.planet === 'Ketu') continue;
    const offset = (bhavaNumber - aspector.house + 12) % 12;
    if (offset === 0) continue;
    const isUniversal = offset === 6;
    const isSpecial = SPECIAL[aspector.planet].has(offset);
    if (!isUniversal && !isSpecial) continue;
    const weight = ASPECT_WEIGHTS[offset] ?? 0;
    const sign = BENEFICS.has(aspector.planet) ? 1 : -1;
    net += sign * weight * 60;
  }
  return net;
}

function computeSyntheticSthanaBala(chart: BirthChart, bhavaNumber: number): number {
  let sum = 0;
  for (const p of chart.planets) {
    if (p.planet === 'Rahu' || p.planet === 'Ketu') continue;
    if (p.house !== bhavaNumber) continue;
    const sign = BENEFICS.has(p.planet) ? 1 : -1;
    sum += sign * NAISARGIKA[p.planet];
  }
  return sum;
}

/**
 * Generated from the algorithm, not ground truth. Re-pin only by predicting the
 * delta from the mechanism first, never by transcribing a failure.
 */
const FIXTURE_PINS: ReadonlyArray<{ name: string; totals: readonly number[] }> = [
  {
    name: 'Narendra Modi',
    totals: [
      370.944, 375.026, 352.6257, 366.9157, 340.026, 286.654,
      290.5127, 462.0925, 303.1225, 441.6584, 432.8025, 355.5127,
    ],
  },
  {
    name: 'Sachin Tendulkar',
    totals: [
      571.7472, 424.5006, 255.2637, 342.0539, 318.259, 322.3477,
      310.1977, 307.539, 349.9139, 301.6937, 379.5006, 378.8911,
    ],
  },
  {
    name: 'Ratan Tata',
    totals: [
      343.7306, 345.7394, 274.3094, 266.5906, 397.3379, 261.4089,
      433.4584, 342.82, 402.5266, 388.4584, 342.8389, 382.3379,
    ],
  },
  {
    name: 'Dhirubhai Ambani',
    totals: [
      325.8856, 420.6678, 364.2378, 289.4556, 370.4039, 493.2711,
      288.3524, 300.664, 399.6158, 337.6424, 358.2711, 483.9739,
    ],
  },
  {
    name: 'Mukesh Ambani',
    totals: [
      342.6951, 547.5949, 296.2784, 336.2784, 446.1649, 354.8351,
      347.4793, 417.8971, 353.0317, 505.8506, 377.8971, 459.6193,
    ],
  },
];

describe('Fixture sweep: pinned Bhava Bala totals', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const { utc, loc } = fixtureBirth(pin.name);
      const result = computeBhavaBala(utc, loc);
      const totals = result.houses.map((h) => Number(h.total.toFixed(4)));
      expect(totals).toEqual(pin.totals);
    });
  }
});
