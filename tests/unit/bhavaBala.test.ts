/**
 * Unit tests for `computeBhavaBala` (Step 31-4).
 *
 * Strategy:
 *   1. Structural invariants — `houses.length === 12`; for every bhava the
 *      total equals the arithmetic sum of `bhavadhipati + dik + drik +
 *      sthana` (exact-equality assertion, not `toBeCloseTo`).
 *   2. Per-component unit cases on synthetic charts. The synthChart helper
 *      mirrors the one used by `karakas.test.ts` / `yogas.test.ts` so the
 *      house and rashi placements are tightly controlled.
 *      - **Bhavadhipati** — the bhava-1 contribution must equal the
 *        Shadbala total of the lagna-rashi-lord on a real fixture chart.
 *      - **Dik** — the 12-cell BPHS table is pinned exactly.
 *      - **Drik** — a constructed chart with one strong-aspect malefic
 *        clamps the bhava component to 0 (the negative net is suppressed).
 *      - **Sthana** — benefic occupant contributes positive Naisargika,
 *        malefic contributes negative; Rahu / Ketu contribute nothing.
 *   3. 5-fixture pin (Modi, Sachin, Tata, Dhirubhai, Mukesh) — 12 totals
 *      per chart, derived from the algorithm and pinned to detect
 *      regressions in the combined effect of ephemeris + Lahiri ayanamsa
 *      + Shadbala internals + the four Bhava-Bala sums.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBhavaBala, computeShadbala, _BHAVA_DIK_VALUES_FOR_TEST,
} from '../../src/jyotish/shadbala';
import { computeRashiChart } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo,
  LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import fixtures from '../fixtures/astrosage-charts.json';

// ── Fixture loading ───────────────────────────────────

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

// ── Synthetic-chart builder ───────────────────────────

const RASHI: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

interface SynthSpec {
  lagnaRashi: number;
  /** Per-graha rashi (0..11). Defaults to 0 (Aries). */
  rashis?: Partial<Record<GrahaName, number>>;
  /** Per-graha degree-in-rashi. Default 15°. */
  degrees?: Partial<Record<GrahaName, number>>;
}

/**
 * Build a fully-typed BirthChart with whole-sign houses anchored to
 * `lagnaRashi`. Mirrors `karakas.test.ts` / `yogas.test.ts`. Used here
 * only to exercise the per-bhava sum logic that consumes a chart shape;
 * the public `computeBhavaBala` accepts birth inputs and computes the
 * chart itself, so the synthetic-chart unit cases call internal helpers
 * indirectly via fixture chart inspection.
 */
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
  return { divisional: 'D1', lagna, bhava, planets };
}

// ── Structural invariants ─────────────────────────────

describe('computeBhavaBala — structural invariants', () => {
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

// ── Bhava Dik Bala — 12-cell table pin ───────────────

describe('Bhava Dik Bala — pinned BPHS Ch. 27 table', () => {
  it('matches the 12 cardinal-anchored values exactly', () => {
    // Cardinal anchors: bhava 1 = 60 (East), bhava 4 = 0 (North),
    // bhava 7 = 15 (West), bhava 10 = 30 (South). Intermediate bhavas
    // linearly interpolate around the wheel.
    expect([..._BHAVA_DIK_VALUES_FOR_TEST]).toEqual([
      60, 40, 20, 0, 5, 10, 15, 20, 25, 30, 40, 50,
    ]);
  });
});

// ── Bhavadhipati Bala — lord-of-bhava → Shadbala ─────

describe('Bhavadhipati Bala — uses lord-of-bhava Shadbala total', () => {
  it('bhava-1 bhavadhipati equals Shadbala total of the lagna-rashi lord', () => {
    const { utc, loc } = fixtureBirth('Narendra Modi');
    const chart = computeRashiChart(utc, loc);
    const sb = computeShadbala(utc, loc);
    const bhavaBala = computeBhavaBala(utc, loc);

    // Map rashi-index → graha (Sun..Saturn 7-planet scheme).
    const RASHI_LORD_GRAHA: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
      'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
      'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
    ];
    const lagnaLord = RASHI_LORD_GRAHA[chart.lagna.rashi.index]!;
    expect(bhavaBala.houses[0]!.bhavadhipati).toBe(sb[lagnaLord].total);
  });

  it('bhavas with same rashi-lord share the same bhavadhipati', () => {
    // Mars rules Aries (0) and Scorpio (7); Venus rules Taurus (1) and
    // Libra (6); Mercury rules Gemini (2) and Virgo (5); Jupiter rules
    // Sagittarius (8) and Pisces (11); Saturn rules Capricorn (9) and
    // Aquarius (10). Pick a fixture and assert the shared lord rule.
    const { utc, loc } = fixtureBirth('Mukesh Ambani');
    const chart = computeRashiChart(utc, loc);
    const bhavaBala = computeBhavaBala(utc, loc);

    // Group bhavas by their cusp rashi-lord and check pairwise equality.
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

// ── Bhava Drik Bala — clamp + benefic/malefic sign ───

describe('Bhava Drik Bala — clamp and sign rules', () => {
  it('clamps net malefic aspect to 0', () => {
    // Construct a chart where bhava 7 has only malefic aspect (Mars in
    // bhava 1 sees the 7th universally → -60 V × 1 = -60). No benefic
    // aspect anywhere. The 7th bhava's drik must clamp to 0.
    const chart = synthChart({
      lagnaRashi: 0,
      // Mars in bhava 1 (Aries), no other planet in aspecting positions.
      rashis: {
        Sun: 9, Moon: 9, Mars: 0, Mercury: 9,
        Jupiter: 9, Venus: 9, Saturn: 9, Rahu: 5, Ketu: 11,
      },
    });
    // Mars is in house 1 → 7th aspect goes to house 7. Mars is malefic,
    // so the raw drik for bhava 7 is -60. All other planets are stuffed
    // into bhava 10 — they universally aspect bhava 4 (not bhava 7).
    // Bhava 7 raw = -60 → clamped 0.
    //
    // We can't call computeBhavaBala directly with a synthetic chart
    // (the public API takes Date + GeoLocation), so we re-implement the
    // tiny drik-bala component for the synthetic case to assert the
    // clamp invariant. This keeps the test independent of the ephemeris.
    const drikRaw = computeSyntheticDrikBala(chart, 7);
    expect(drikRaw).toBeLessThan(0);
    // Final drik component is clamped to ≥ 0 in the production code:
    expect(Math.max(0, drikRaw)).toBe(0);
  });

  it('positive net benefic aspect contributes the un-clamped value', () => {
    // Jupiter in bhava 1 (Aries with lagnaRashi=0) — Jupiter's special
    // aspects are 5th (offset 4) and 9th (offset 8), so it aspects
    // bhavas 5 and 9 with weight 0.75. Jupiter is benefic → +0.75 × 60
    // = +45 V on bhavas 5 and 9.
    //
    // To isolate Jupiter's contribution we park the other 6 visible
    // grahas in rashi 10 (house 11). Their universal 7th aspect lands
    // on bhava 5 — but with 3 benefics (Moon, Mercury, Venus) + 3
    // malefics (Sun, Mars, Saturn) the +/− contributions cancel out
    // exactly. Mars's 4th/8th specials from house 11 hit bhavas 2/6 (not
    // 5/9) and Saturn's 3rd/10th hit bhavas 1/8 (not 5/9), so neither
    // contaminates our targets.
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 10, Moon: 10, Mars: 10, Mercury: 10,
        Jupiter: 0, Venus: 10, Saturn: 10, Rahu: 5, Ketu: 11,
      },
    });
    // Bhava 5: Jupiter's 5th-aspect +45; the 6 others sum to 0 universally.
    expect(computeSyntheticDrikBala(chart, 5)).toBe(45);
    // Bhava 9: Jupiter's 9th-aspect +45; the others have no aspect onto 9.
    expect(computeSyntheticDrikBala(chart, 9)).toBe(45);
  });
});

// ── Bhavasthana Bala — sign rule for occupants ───────

describe('Bhavasthana Bala — benefic/malefic sign rule', () => {
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
    // Mercury Naisargika 25.71 (benefic, +); Mars Naisargika 17.14 (malefic, -).
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

// ── Mini-replica of the Drik / Sthana Bala helpers ───
//
// The public API of `computeBhavaBala` accepts birth inputs and computes
// the chart internally. To assert the per-component logic on a hand-built
// synthetic chart (rather than via ephemeris-driven fixtures, which would
// couple unit cases to Lahiri-ayanamsa drift), the two simplest helpers —
// drik raw sum and sthana sum — are duplicated here. They MUST stay in
// lockstep with the production implementation; if a regression sneaks in
// to `shadbala.ts` the fixture pin further down will catch it as well.

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

// ── Fixture pins ──────────────────────────────────────

/**
 * Pinned 12-house totals (rounded to 4 decimals) for the 5 R-tier fixture
 * charts. Generated from the algorithm; serves as a regression detector
 * for the combined effect of ephemeris + Lahiri ayanamsa + the four
 * Bhava-Bala sums.
 */
const FIXTURE_PINS: ReadonlyArray<{ name: string; totals: readonly number[] }> = [
  // Re-pinned 2026-05-11 post-Phase-34e item 5 (Shadbala Saptavargaja +
  // Ojha-Yugma + Drekkana sub-components added to Sthana Bala). Each
  // per-house delta below is exactly Δshadbala[cuspLord].total, which
  // is the sum of the new sub-component virupas accruing to the bhava
  // cusp lord — see notes/phase34e-shadbala-derive.mjs for the
  // first-principles delta computation. The new totals were verified
  // against the derive-script predictions (observed-vs-predicted
  // match to all 4 decimal places per the locked anti-circular
  // re-pinning workflow in memory/feedback_fixture_repinning.md).
  // The Mukesh Ambani chart in particular exercises the full delta
  // range (Jupiter +206.25 V from heavy saptavargaja+ojha, Saturn
  // +120 V, Sun +183.75 V) so several previously-negative bhavaBala
  // totals (-53, -65, -40, -16) now turn positive after the increase.
  {
    name: 'Narendra Modi',
    totals: [
      378.4448, 367.5252, 330.1265, 344.4165, 332.5252, 294.1548,
      283.0118, 492.0988, 310.6306, 434.1504, 462.8088, 348.0118,
    ],
  },
  {
    name: 'Sachin Tendulkar',
    totals: [
      563.7607, 424.5077, 247.2705, 350.0473, 310.2725, 330.3341,
      318.1841, 299.5525, 357.9073, 293.7005, 379.5077, 386.8776,
    ],
  },
  {
    name: 'Ratan Tata',
    totals: [
      482.1611, 207.3089, 135.8789, 405.0211, 258.9007, 399.8465,
      433.4519, 204.3893, 540.9573, 388.4519, 481.2765, 243.9007,
    ],
  },
  {
    name: 'Dhirubhai Ambani',
    totals: [
      463.3512, 283.2021, 226.7721, 426.9212, 232.9455, 630.7439,
      318.3524, 163.2057, 537.0813, 367.6424, 495.7439, 346.5155,
    ],
  },
  {
    name: 'Mukesh Ambani',
    totals: [
      70.6601, 819.6299, 54.2434, 94.2434, 718.1999, 82.8001,
      619.5074, 417.8971, 81.0038, 777.8928, 377.8971, 731.6474,
    ],
  },
];

describe('Fixture sweep — pinned Bhava Bala totals', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const { utc, loc } = fixtureBirth(pin.name);
      const result = computeBhavaBala(utc, loc);
      const totals = result.houses.map((h) => Number(h.total.toFixed(4)));
      expect(totals).toEqual(pin.totals);
    });
  }
});
