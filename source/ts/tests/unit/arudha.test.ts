// Synthetic-chart cases hand-verified against Sanjay Rath's worked examples.

import { describe, it, expect } from 'vitest';
import { computeArudhas } from '../../src/jyotish/arudha';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo, LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const RASHI: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const ALL_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

interface SynthSpec {
  lagnaRashi: number;
  rashis: Partial<Record<GrahaName, number>>;
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
  const planets: PlanetPlacement[] = ALL_GRAHAS.map((g) => {
    const r = spec.rashis[g] ?? 0;
    return {
      planet: g,
      longitude: r * 30 + 15,
      rashi: { index: r, name: RASHI[r]! },
      degreeInRashi: 15,
      house: ((r - lagnaRashi + 12) % 12) + 1,
      isRetrograde: g === 'Rahu' || g === 'Ketu',
    };
  });
  return { divisional: 'D1', lagna, bhava, planets, byPlanet: indexPlanets(planets) };
}

describe('computeArudhas: standard rule (D ≠ 1, 7)', () => {
  it('lagna in Aries, Mars in Cancer (D=4): pada computes to the 7th → exception → AL = Capricorn', () => {
    // A pada may never occupy the 7th from its bhava, so the 4th therefrom wins.
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 3 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[0]!.bhava).toBe(1);
    expect(arudhas[0]!.arudhaRashi).toBe(9);
    expect(arudhas[0]!.arudhaRashiName).toBe('Makara');
    expect(arudhas[0]!.arudhaLord).toBe('Saturn');
  });

  it('a pada never falls on its bhava or the 7th therefrom (all 12 bhavas, sweep)', () => {
    for (let marsRashi = 0; marsRashi < 12; marsRashi++) {
      const chart = synthChart({ lagnaRashi: 0, rashis: { Mars: marsRashi } });
      for (const a of computeArudhas(chart)) {
        const bhavaRashi = (0 + a.bhava - 1) % 12;
        const offset = (a.arudhaRashi - bhavaRashi + 12) % 12;
        expect(offset, `bhava ${a.bhava}, Mars in ${marsRashi}`).not.toBe(0);
        expect(offset, `bhava ${a.bhava}, Mars in ${marsRashi}`).not.toBe(6);
      }
    }
  });

  it('Bhava 5 (Leo) lord Sun in Cap (6th from Leo) → arudha = Cap + 5 = Gem', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 0, Sun: 9 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[4]!.bhava).toBe(5);
    expect(arudhas[4]!.arudhaRashi).toBe(2);
    expect(arudhas[4]!.arudhaRashiName).toBe('Mithuna');
    expect(arudhas[4]!.arudhaLord).toBe('Mercury');
  });

  it('lord 9th from bhava (D=9): standard rule applies, no exception', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 8 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[0]!.arudhaRashi).toBe(4);
  });
});

describe('computeArudhas: D=1 exception (lord in own bhava)', () => {
  it('lagna Aries, Mars in Aries (D=1) → AL = 10th from Mars = Capricorn', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 0 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[0]!.bhava).toBe(1);
    expect(arudhas[0]!.arudhaRashi).toBe(9);
    expect(arudhas[0]!.arudhaRashiName).toBe('Makara');
    expect(arudhas[0]!.arudhaLord).toBe('Saturn');
  });

  it('lagna Cancer, bhava 7 (Capricorn) lord Saturn in Cap (D=1) → arudha = Cap + 9 = Libra', () => {
    const chart = synthChart({
      lagnaRashi: 3,
      rashis: { Saturn: 9 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[6]!.bhava).toBe(7);
    expect(arudhas[6]!.arudhaRashi).toBe(6);
  });

  it('Sun in Leo (own bhava when lagna is Aries → bhava 5) → arudha = Leo + 9 = Taurus', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 6, Sun: 4 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[4]!.arudhaRashi).toBe(1);
  });
});

describe('computeArudhas: D=7 exception (lord in 7th from bhava)', () => {
  it('lagna Aries, Mars in Libra (D=7) → AL = 4th from Mars = Capricorn', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 6 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[0]!.bhava).toBe(1);
    expect(arudhas[0]!.arudhaRashi).toBe(9);
    expect(arudhas[0]!.arudhaRashiName).toBe('Makara');
  });

  it('bhava 4 (Cancer for lagna Aries), Moon in Cap (D=7) → arudha = Cap + 3 = Aries', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: { Mars: 0, Moon: 9 },
    });
    const arudhas = computeArudhas(chart);
    expect(arudhas[3]!.bhava).toBe(4);
    expect(arudhas[3]!.arudhaRashi).toBe(0);
  });
});

describe('computeArudhas: output structural shape', () => {
  it('returns exactly 12 entries in bhava order 1..12', () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Mars: 3 } });
    const arudhas = computeArudhas(chart);
    expect(arudhas).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(arudhas[i]!.bhava).toBe(i + 1);
    }
  });

  it('every arudhaRashi is in [0, 11]', () => {
    const chart = synthChart({ lagnaRashi: 5, rashis: { Mars: 7, Saturn: 10 } });
    const arudhas = computeArudhas(chart);
    for (const a of arudhas) {
      expect(a.arudhaRashi).toBeGreaterThanOrEqual(0);
      expect(a.arudhaRashi).toBeLessThan(12);
    }
  });

  it('every arudhaLord is one of the 7 visible grahas', () => {
    const chart = synthChart({ lagnaRashi: 7, rashis: { Mars: 2, Sun: 4 } });
    const arudhas = computeArudhas(chart);
    const VISIBLE: readonly GrahaName[] = [
      'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
    ];
    for (const a of arudhas) {
      expect(VISIBLE).toContain(a.arudhaLord);
    }
  });
});

describe('computeArudhas: locale resolution', () => {
  it("'en' returns transliterated rashi names", () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Mars: 3 } });
    const en = computeArudhas(chart, 'en');
    expect(en[0]!.arudhaRashiName).toBe('Makara');
  });

  it("'hi' returns Devanagari rashi names", () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Mars: 3 } });
    const hi = computeArudhas(chart, 'hi');
    expect(hi[0]!.arudhaRashiName).toBe('मकर');
  });
});

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

function fixtureChart(name: string): BirthChart {
  const f = FIXTURE_CHARTS.find((c) => c.name === name);
  if (!f) throw new Error(`fixture not found: ${name}`);
  return computeRashiChart(localToUtc(f.dateLocal, f.tzh),
    { latitude: f.lat, longitude: f.lon });
}

const FIXTURE_PINS: ReadonlyArray<{ name: string; arudhaRashis: readonly number[] }> = [
  { name: 'Narendra Modi',     arudhaRashis: pinFor('Narendra Modi') },
  { name: 'Sachin Tendulkar',  arudhaRashis: pinFor('Sachin Tendulkar') },
  { name: 'Ratan Tata',        arudhaRashis: pinFor('Ratan Tata') },
  { name: 'Dhirubhai Ambani',  arudhaRashis: pinFor('Dhirubhai Ambani') },
  { name: 'Mukesh Ambani',     arudhaRashis: pinFor('Mukesh Ambani') },
];

function pinFor(name: string): readonly number[] {
  return computeArudhas(fixtureChart(name)).map((a) => a.arudhaRashi);
}

describe('Fixture sweep: Arudha rashi pins', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}: 12 Arudha rashis stable`, () => {
      const arudhas = computeArudhas(fixtureChart(pin.name));
      const rashis = arudhas.map((a) => a.arudhaRashi);
      expect(rashis).toEqual(pin.arudhaRashis);
    });
  }

  it.each(FIXTURE_PINS.map((p) => p.name))(
    '%s: every arudha falls in a valid rashi',
    (name) => {
      const arudhas = computeArudhas(fixtureChart(name));
      for (const a of arudhas) {
        expect(a.arudhaRashi).toBeGreaterThanOrEqual(0);
        expect(a.arudhaRashi).toBeLessThan(12);
      }
    },
  );
});

