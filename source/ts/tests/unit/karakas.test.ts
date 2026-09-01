import { describe, it, expect } from 'vitest';
import { computeJaiminiKarakas } from '../../src/jyotish/karakas';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo, Jaimini8Karakas,
  JaiminiKarakas, Karaka8Name, KarakaName, LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const RASHI: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

const KARAKA_ORDER: readonly KarakaName[] = [
  'Atmakaraka', 'Amatyakaraka', 'Bhratrukaraka', 'Matrukaraka',
  'Putrakaraka', 'Gnatikaraka', 'Darakaraka',
];

interface SynthSpec {
  lagnaRashi: number;
  degrees?: Partial<Record<GrahaName, number>>;
  rashis?: Partial<Record<GrahaName, number>>;
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

function degreeOf(chart: BirthChart, g: GrahaName): number {
  return chart.planets.find((p) => p.planet === g)!.degreeInRashi;
}

describe('computeJaiminiKarakas: descending-degree sort', () => {
  it('strictly increasing input → reversed karaka assignment', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 1, Moon: 2, Mars: 3, Mercury: 4,
        Jupiter: 5, Venus: 6, Saturn: 7,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k).toEqual({
      Atmakaraka: 'Saturn',
      Amatyakaraka: 'Venus',
      Bhratrukaraka: 'Jupiter',
      Matrukaraka: 'Mercury',
      Putrakaraka: 'Mars',
      Gnatikaraka: 'Moon',
      Darakaraka: 'Sun',
    });
  });

  it('strictly decreasing input → in-order karaka assignment', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 29, Moon: 25, Mars: 20, Mercury: 15,
        Jupiter: 10, Venus: 5, Saturn: 1,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k.Atmakaraka).toBe('Sun');
    expect(k.Amatyakaraka).toBe('Moon');
    expect(k.Bhratrukaraka).toBe('Mars');
    expect(k.Matrukaraka).toBe('Mercury');
    expect(k.Putrakaraka).toBe('Jupiter');
    expect(k.Gnatikaraka).toBe('Venus');
    expect(k.Darakaraka).toBe('Saturn');
  });

  it('mixed degrees: picks correct planet per role', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 12, Moon: 19, Mars: 0.5, Mercury: 22,
        Jupiter: 28, Venus: 14, Saturn: 6,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k.Atmakaraka).toBe('Jupiter');
    expect(k.Amatyakaraka).toBe('Mercury');
    expect(k.Bhratrukaraka).toBe('Moon');
    expect(k.Matrukaraka).toBe('Venus');
    expect(k.Putrakaraka).toBe('Sun');
    expect(k.Gnatikaraka).toBe('Saturn');
    expect(k.Darakaraka).toBe('Mars');
  });

  it('Rahu and Ketu are excluded: never assigned to a karaka role', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 1, Moon: 2, Mars: 3, Mercury: 4,
        Jupiter: 5, Venus: 6, Saturn: 7,
        Rahu: 29, Ketu: 29,
      },
    });
    const k = computeJaiminiKarakas(chart);
    const assigned = new Set(Object.values(k));
    expect(assigned.has('Rahu')).toBe(false);
    expect(assigned.has('Ketu')).toBe(false);
    expect(k.Atmakaraka).toBe('Saturn');
  });
});

describe('computeJaiminiKarakas: tie-break', () => {
  it('exact tie between Sun and Moon → Sun wins (earlier in canonical order)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 20, Moon: 20,
        Mars: 10, Mercury: 9, Jupiter: 8, Venus: 7, Saturn: 6,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k.Atmakaraka).toBe('Sun');
    expect(k.Amatyakaraka).toBe('Moon');
  });

  it('exact tie between Mars and Saturn → Mars wins', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 25, Mercury: 7,
        Jupiter: 8, Venus: 9, Saturn: 25,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k.Atmakaraka).toBe('Mars');
    expect(k.Amatyakaraka).toBe('Saturn');
  });

  it('all 7 grahas at the same degree → canonical order preserved', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 15, Moon: 15, Mars: 15, Mercury: 15,
        Jupiter: 15, Venus: 15, Saturn: 15,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k).toEqual({
      Atmakaraka: 'Sun',
      Amatyakaraka: 'Moon',
      Bhratrukaraka: 'Mars',
      Matrukaraka: 'Mercury',
      Putrakaraka: 'Jupiter',
      Gnatikaraka: 'Venus',
      Darakaraka: 'Saturn',
    });
  });
});

describe('computeJaiminiKarakas: monotonic-degree invariant', () => {
  function assertMonotonic(chart: BirthChart, k: JaiminiKarakas): void {
    const degrees = KARAKA_ORDER.map((role) => degreeOf(chart, k[role]));
    for (let i = 0; i < degrees.length - 1; i++) {
      expect(degrees[i]).toBeGreaterThanOrEqual(degrees[i + 1]!);
    }
  }

  it('enumerates the 6 inequalities for a synthetic chart', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 12, Moon: 19, Mars: 0.5, Mercury: 22,
        Jupiter: 28, Venus: 14, Saturn: 6,
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(degreeOf(chart, k.Atmakaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Amatyakaraka));
    expect(degreeOf(chart, k.Amatyakaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Bhratrukaraka));
    expect(degreeOf(chart, k.Bhratrukaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Matrukaraka));
    expect(degreeOf(chart, k.Matrukaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Putrakaraka));
    expect(degreeOf(chart, k.Putrakaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Gnatikaraka));
    expect(degreeOf(chart, k.Gnatikaraka))
      .toBeGreaterThanOrEqual(degreeOf(chart, k.Darakaraka));
  });

  it('holds across every fixture chart (sweep)', () => {
    for (const f of FIXTURE_CHARTS) {
      const chart = fixtureChart(f.name);
      const k = computeJaiminiKarakas(chart);
      assertMonotonic(chart, k);
    }
  });
});

describe('computeJaiminiKarakas: output shape', () => {
  it('returns exactly 7 unique grahas, one per role', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 1, Moon: 2, Mars: 3, Mercury: 4,
        Jupiter: 5, Venus: 6, Saturn: 7,
      },
    });
    const k = computeJaiminiKarakas(chart);
    const keys = Object.keys(k).sort();
    expect(keys).toEqual([...KARAKA_ORDER].sort());
    const grahas = Object.values(k);
    expect(new Set(grahas).size).toBe(7);
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
  const utc = localToUtc(f.dateLocal, f.tzh);
  const loc = { latitude: f.lat, longitude: f.lon };
  return computeRashiChart(utc, loc);
}

const FIXTURE_PINS: ReadonlyArray<{ name: string; expected: JaiminiKarakas }> = [
  {
    name: 'Narendra Modi',
    expected: {
      Atmakaraka: 'Saturn',
      Amatyakaraka: 'Venus',
      Bhratrukaraka: 'Moon',
      Matrukaraka: 'Jupiter',
      Putrakaraka: 'Mars',
      Gnatikaraka: 'Mercury',
      Darakaraka: 'Sun',
    },
  },
  {
    name: 'Sachin Tendulkar',
    expected: {
      Atmakaraka: 'Mars',
      Amatyakaraka: 'Moon',
      Bhratrukaraka: 'Saturn',
      Matrukaraka: 'Mercury',
      Putrakaraka: 'Jupiter',
      Gnatikaraka: 'Venus',
      Darakaraka: 'Sun',
    },
  },
  {
    name: 'Ratan Tata',
    expected: {
      Atmakaraka: 'Moon',
      Amatyakaraka: 'Mercury',
      Bhratrukaraka: 'Sun',
      Matrukaraka: 'Mars',
      Putrakaraka: 'Jupiter',
      Gnatikaraka: 'Saturn',
      Darakaraka: 'Venus',
    },
  },
  {
    name: 'Dhirubhai Ambani',
    expected: {
      Atmakaraka: 'Mars',
      Amatyakaraka: 'Mercury',
      Bhratrukaraka: 'Moon',
      Matrukaraka: 'Venus',
      Putrakaraka: 'Sun',
      Gnatikaraka: 'Saturn',
      Darakaraka: 'Jupiter',
    },
  },
  {
    name: 'Mukesh Ambani',
    expected: {
      Atmakaraka: 'Jupiter',
      Amatyakaraka: 'Mars',
      Bhratrukaraka: 'Mercury',
      Matrukaraka: 'Saturn',
      Putrakaraka: 'Moon',
      Gnatikaraka: 'Venus',
      Darakaraka: 'Sun',
    },
  },
];

describe('Fixture sweep: pinned karaka mappings', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const chart = fixtureChart(pin.name);
      const k = computeJaiminiKarakas(chart);
      expect(k).toEqual(pin.expected);
    });
  }
});

const KARAKA_8_ORDER: readonly Karaka8Name[] = [
  'Atmakaraka', 'Amatyakaraka', 'Bhratrukaraka', 'Matrukaraka',
  'Pitrukaraka', 'Putrakaraka', 'Gnatikaraka', 'Darakaraka',
];

function effective8(chart: BirthChart, g: GrahaName): number {
  const p = chart.planets.find((x) => x.planet === g)!;
  return g === 'Rahu' ? 30 - p.degreeInRashi : p.degreeInRashi;
}

describe('computeJaiminiKarakas (8-jaimini): Rahu reversal rule', () => {
  it('Rahu at degreeInRashi = 29° → reversed = 1° → Darakaraka (lowest)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 7, Mercury: 8,
        Jupiter: 9, Venus: 10, Saturn: 11,
        Rahu: 29,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Darakaraka).toBe('Rahu');
    expect(k.Atmakaraka).toBe('Saturn');
  });

  it('Rahu at degreeInRashi = 1° → reversed = 29° → Atmakaraka (highest)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 7, Mercury: 8,
        Jupiter: 9, Venus: 10, Saturn: 11,
        Rahu: 1,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Rahu');
    expect(k.Darakaraka).toBe('Sun');
  });

  it('Ketu is excluded from the 8-Jaimini variant', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 7, Mercury: 8,
        Jupiter: 9, Venus: 10, Saturn: 11,
        Rahu: 15, Ketu: 0,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    const assigned = new Set(Object.values(k));
    expect(assigned.has('Ketu')).toBe(false);
    expect(assigned.has('Rahu')).toBe(true);
  });
});

describe('computeJaiminiKarakas (8-jaimini): Pitrukaraka insertion', () => {
  it('Rahu lands at exactly position 4 → Pitrukaraka = Rahu, 7-K names unchanged for AK..MK and PK..DK', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Mercury: 10, Jupiter: 9, Venus: 8, Saturn: 7,
        Sun: 3, Moon: 2, Mars: 1,
        Rahu: 25,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Mercury');
    expect(k.Amatyakaraka).toBe('Jupiter');
    expect(k.Bhratrukaraka).toBe('Venus');
    expect(k.Matrukaraka).toBe('Saturn');
    expect(k.Pitrukaraka).toBe('Rahu');
    expect(k.Putrakaraka).toBe('Sun');
    expect(k.Gnatikaraka).toBe('Moon');
    expect(k.Darakaraka).toBe('Mars');
  });
});

describe('computeJaiminiKarakas (8-jaimini): tie-break (Rahu loses)', () => {
  it('Rahu reversed degree exactly equals a visible graha → visible graha wins', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 15, Moon: 1, Mars: 2, Mercury: 3,
        Jupiter: 4, Venus: 5, Saturn: 6,
        Rahu: 15,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Sun');
    expect(k.Amatyakaraka).toBe('Rahu');
  });

  it('all 8 grahas at effective 15° → canonical order preserved (Rahu last)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 15, Moon: 15, Mars: 15, Mercury: 15,
        Jupiter: 15, Venus: 15, Saturn: 15,
        Rahu: 15,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k).toEqual({
      Atmakaraka: 'Sun',
      Amatyakaraka: 'Moon',
      Bhratrukaraka: 'Mars',
      Matrukaraka: 'Mercury',
      Pitrukaraka: 'Jupiter',
      Putrakaraka: 'Venus',
      Gnatikaraka: 'Saturn',
      Darakaraka: 'Rahu',
    });
  });
});

describe('computeJaiminiKarakas (8-jaimini): output shape', () => {
  it('returns exactly 8 unique grahas, one per role, including Pitrukaraka', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 1, Moon: 2, Mars: 3, Mercury: 4,
        Jupiter: 5, Venus: 6, Saturn: 7,
        Rahu: 15,
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    const keys = Object.keys(k).sort();
    expect(keys).toEqual([...KARAKA_8_ORDER].sort());
    const grahas = Object.values(k);
    expect(new Set(grahas).size).toBe(8);
    expect(grahas).toContain('Rahu');
  });
});

describe('computeJaiminiKarakas: backwards-compat with 7-Parashara default', () => {
  it('calling with no options returns identical result as { variant: "7-parashara" }', () => {
    for (const pin of FIXTURE_PINS) {
      const chart = fixtureChart(pin.name);
      const kDefault: JaiminiKarakas = computeJaiminiKarakas(chart);
      const k7: JaiminiKarakas = computeJaiminiKarakas(chart, { variant: '7-parashara' });
      expect(kDefault).toEqual(k7);
      expect(kDefault).toEqual(pin.expected);
    }
  });

  it('the 7-Parashara return type has exactly 7 keys (no Pitrukaraka)', () => {
    const chart = fixtureChart('Narendra Modi');
    const k = computeJaiminiKarakas(chart);
    expect(Object.keys(k)).toHaveLength(7);
    expect((k as Record<string, unknown>).Pitrukaraka).toBeUndefined();
  });
});

describe('computeJaiminiKarakas (8-jaimini): monotonic-degree invariant', () => {
  function assertMonotonic8(chart: BirthChart, k: Jaimini8Karakas): void {
    const degrees = KARAKA_8_ORDER.map((role) => effective8(chart, k[role]));
    for (let i = 0; i < degrees.length - 1; i++) {
      expect(degrees[i]).toBeGreaterThanOrEqual(degrees[i + 1]!);
    }
  }

  it('holds across every R-tier fixture chart (sweep)', () => {
    for (const f of FIXTURE_CHARTS) {
      const chart = fixtureChart(f.name);
      const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
      assertMonotonic8(chart, k);
    }
  });
});

const FIXTURE_PINS_8: ReadonlyArray<{ name: string; expected: Jaimini8Karakas }> = [
  {
    name: 'Narendra Modi',
    expected: {
      Atmakaraka: 'Saturn',
      Amatyakaraka: 'Rahu',
      Bhratrukaraka: 'Venus',
      Matrukaraka: 'Moon',
      Pitrukaraka: 'Jupiter',
      Putrakaraka: 'Mars',
      Gnatikaraka: 'Mercury',
      Darakaraka: 'Sun',
    },
  },
  {
    name: 'Sachin Tendulkar',
    expected: {
      Atmakaraka: 'Mars',
      Amatyakaraka: 'Moon',
      Bhratrukaraka: 'Saturn',
      Matrukaraka: 'Mercury',
      Pitrukaraka: 'Jupiter',
      Putrakaraka: 'Venus',
      Gnatikaraka: 'Rahu',
      Darakaraka: 'Sun',
    },
  },
  {
    name: 'Ratan Tata',
    expected: {
      Atmakaraka: 'Moon',
      Amatyakaraka: 'Rahu',
      Bhratrukaraka: 'Mercury',
      Matrukaraka: 'Sun',
      Pitrukaraka: 'Mars',
      Putrakaraka: 'Jupiter',
      Gnatikaraka: 'Saturn',
      Darakaraka: 'Venus',
    },
  },
  {
    name: 'Dhirubhai Ambani',
    expected: {
      Atmakaraka: 'Mars',
      Amatyakaraka: 'Mercury',
      Bhratrukaraka: 'Moon',
      Matrukaraka: 'Venus',
      Pitrukaraka: 'Sun',
      Putrakaraka: 'Rahu',
      Gnatikaraka: 'Saturn',
      Darakaraka: 'Jupiter',
    },
  },
  {
    name: 'Mukesh Ambani',
    expected: {
      Atmakaraka: 'Jupiter',
      Amatyakaraka: 'Mars',
      Bhratrukaraka: 'Mercury',
      Matrukaraka: 'Saturn',
      Pitrukaraka: 'Moon',
      Putrakaraka: 'Venus',
      Gnatikaraka: 'Sun',
      Darakaraka: 'Rahu',
    },
  },
  {
    name: 'Mark Zuckerberg',
    expected: {
      Atmakaraka: 'Sun',
      Amatyakaraka: 'Mars',
      Bhratrukaraka: 'Venus',
      Matrukaraka: 'Jupiter',
      Pitrukaraka: 'Saturn',
      Putrakaraka: 'Moon',
      Gnatikaraka: 'Rahu',
      Darakaraka: 'Mercury',
    },
  },
  {
    name: 'Barack Obama',
    expected: {
      Atmakaraka: 'Mars',
      Amatyakaraka: 'Rahu',
      Bhratrukaraka: 'Sun',
      Matrukaraka: 'Moon',
      Pitrukaraka: 'Mercury',
      Putrakaraka: 'Venus',
      Gnatikaraka: 'Jupiter',
      Darakaraka: 'Saturn',
    },
  },
  {
    name: 'Bill Gates',
    expected: {
      Atmakaraka: 'Saturn',
      Amatyakaraka: 'Venus',
      Bhratrukaraka: 'Mercury',
      Matrukaraka: 'Mars',
      Pitrukaraka: 'Moon',
      Putrakaraka: 'Sun',
      Gnatikaraka: 'Jupiter',
      Darakaraka: 'Rahu',
    },
  },
  {
    name: 'Donald Trump',
    expected: {
      Atmakaraka: 'Sun',
      Amatyakaraka: 'Moon',
      Bhratrukaraka: 'Jupiter',
      Matrukaraka: 'Mercury',
      Pitrukaraka: 'Mars',
      Putrakaraka: 'Venus',
      Gnatikaraka: 'Rahu',
      Darakaraka: 'Saturn',
    },
  },
];

describe('Fixture sweep: pinned 8-Jaimini karaka mappings (9 R-tier charts)', () => {
  for (const pin of FIXTURE_PINS_8) {
    it(`${pin.name}`, () => {
      const chart = fixtureChart(pin.name);
      const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
      expect(k).toEqual(pin.expected);
    });
  }
});
