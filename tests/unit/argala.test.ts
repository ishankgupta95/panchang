/**
 * Unit tests for `computeArgala` (Step 32-6).
 *
 * Strategy:
 *   1. **Synthetic-chart unit tests** for the 2/4/11 vs 3/10/12 split —
 *      a single planet placed in known houses contributes to specific
 *      bhavas in specific lists.
 *   2. **6-bhavas-per-planet structural invariant** — every planet
 *      contributes to exactly 3 Argala + 3 Virodhargala bhavas across
 *      the 12 returned entries. Asserted on multiple synthetic charts.
 *   3. **Output structural shape** — 12 entries in bhava order 1..12.
 *   4. **Empty when chart has no planets in trigger houses** —
 *      degenerate case (placement avoids all 6 trigger offsets) yields
 *      empty argala/virodhargala lists.
 *   5. **Fixture sweep** — for 5 R-tier charts assert the structural
 *      invariant holds across realistic placements.
 */

import { describe, it, expect } from 'vitest';
import { computeArgala } from '../../src/jyotish/argala';
import { computeRashiChart, indexPlanets } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo, LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import fixtures from '../fixtures/astrosage-charts.json';

const RASHI: readonly string[] = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

const ALL_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

interface SynthSpec {
  lagnaRashi: number;
  /** Per-graha rashi placement (0..11). Defaults to 0. */
  rashis: Partial<Record<GrahaName, number>>;
}

/**
 * Build a synthetic whole-sign chart. House numbers 1..12 follow
 * `(rashi - lagnaRashi + 12) % 12 + 1`.
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

// ── 1. Synthetic unit tests ───────────────────────────

describe('computeArgala — single-planet trigger houses', () => {
  it('Sun in 2nd: forms Argala on 1st bhava only (no other planets in 2/4/11 from any bhava)', () => {
    // Lagna Aries (rashi 0). Sun in Taurus (rashi 1, house 2). All other
    // planets in Aries (house 1) — they then form Argala on bhavas where
    // they're in 2nd/4th/11th from. Since they're in house 1, they form
    // Argala on bhavas 12 (2nd from 12 is 1), 10 (4th from 10 is 1),
    // 3 (11th from 3 is 1). Skip the multi-planet case here — just
    // verify Sun's 2nd-house placement.
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 1,    // house 2 from Aries
        Moon: 6,   // house 7 from Aries — 12th from 8, etc., we ignore
        Mars: 6,
        Mercury: 6,
        Jupiter: 6,
        Venus: 6,
        Saturn: 6,
        Rahu: 6,
        Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    // Sun in house 2 forms Argala on bhava 1 (it's the 2nd FROM bhava 1).
    expect(argala[0]!.argala.find((p) => p.planet === 'Sun')).toBeDefined();
  });

  it('Saturn in 4th from lagna: forms Argala on 1st bhava (4th rule)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6, Jupiter: 6, Venus: 6,
        Saturn: 3,  // house 4
        Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    expect(argala[0]!.argala.find((p) => p.planet === 'Saturn')).toBeDefined();
  });

  it('Jupiter in 11th from lagna: forms Argala on 1st bhava (11th rule)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6,
        Jupiter: 10,  // house 11
        Venus: 6, Saturn: 6, Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    expect(argala[0]!.argala.find((p) => p.planet === 'Jupiter')).toBeDefined();
  });

  it('Mars in 3rd from lagna: forms Virodhargala on 1st bhava', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6,
        Mars: 2,  // house 3 from Aries
        Mercury: 6, Jupiter: 6, Venus: 6, Saturn: 6, Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    expect(argala[0]!.virodhargala.find((p) => p.planet === 'Mars')).toBeDefined();
    // And NOT in Argala for bhava 1.
    expect(argala[0]!.argala.find((p) => p.planet === 'Mars')).toBeUndefined();
  });

  it('Venus in 10th from lagna: forms Virodhargala on 1st bhava', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6, Jupiter: 6,
        Venus: 9,  // house 10
        Saturn: 6, Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    expect(argala[0]!.virodhargala.find((p) => p.planet === 'Venus')).toBeDefined();
  });

  it('Mercury in 12th from lagna: forms Virodhargala on 1st bhava', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6,
        Mercury: 11,  // house 12
        Jupiter: 6, Venus: 6, Saturn: 6, Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    expect(argala[0]!.virodhargala.find((p) => p.planet === 'Mercury')).toBeDefined();
  });
});

// ── 2. 6-bhavas-per-planet invariant ──────────────────

describe('computeArgala — 6-bhavas-per-planet invariant', () => {
  it('every planet contributes to exactly 3 Argala + 3 Virodhargala bhavas (synthetic chart)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4,
        Venus: 5, Saturn: 6, Rahu: 7, Ketu: 8,
      },
    });
    const argala = computeArgala(chart);
    for (const planet of ALL_GRAHAS) {
      let argalaCount = 0;
      let virodhCount = 0;
      for (const ab of argala) {
        if (ab.argala.find((p) => p.planet === planet)) argalaCount++;
        if (ab.virodhargala.find((p) => p.planet === planet)) virodhCount++;
      }
      expect(argalaCount).toBe(3);
      expect(virodhCount).toBe(3);
    }
  });

  it('invariant holds for various lagna placements', () => {
    for (const lag of [0, 3, 5, 7, 10]) {
      const chart = synthChart({
        lagnaRashi: lag,
        rashis: {
          Sun: (lag + 1) % 12, Moon: (lag + 2) % 12, Mars: (lag + 3) % 12,
          Mercury: (lag + 4) % 12, Jupiter: (lag + 5) % 12,
          Venus: (lag + 6) % 12, Saturn: (lag + 7) % 12,
          Rahu: (lag + 8) % 12, Ketu: (lag + 11) % 12,
        },
      });
      const argala = computeArgala(chart);
      for (const planet of ALL_GRAHAS) {
        let aCnt = 0;
        let vCnt = 0;
        for (const ab of argala) {
          if (ab.argala.find((p) => p.planet === planet)) aCnt++;
          if (ab.virodhargala.find((p) => p.planet === planet)) vCnt++;
        }
        expect(aCnt).toBe(3);
        expect(vCnt).toBe(3);
      }
    }
  });

  it('all planets in the same house: each contributes to the same 6 bhavas', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 0, Ketu: 0,
      },
    });
    const argala = computeArgala(chart);
    // All 9 planets in house 1. They form Argala on bhavas where house 1
    // is the 2nd (bhava 12), 4th (bhava 10), or 11th (bhava 3).
    // So bhavas 3, 10, 12 each have 9 Argala planets.
    expect(argala[2]!.argala.length).toBe(9);   // bhava 3
    expect(argala[9]!.argala.length).toBe(9);   // bhava 10
    expect(argala[11]!.argala.length).toBe(9);  // bhava 12
    // Virodhargala bhavas: bhava is where house 1 is the 3rd (bhava 11),
    // 10th (bhava 4), or 12th (bhava 2). So bhavas 2, 4, 11 each have 9.
    expect(argala[1]!.virodhargala.length).toBe(9);   // bhava 2
    expect(argala[3]!.virodhargala.length).toBe(9);   // bhava 4
    expect(argala[10]!.virodhargala.length).toBe(9);  // bhava 11
  });
});

// ── 3. Output structural shape ────────────────────────

describe('computeArgala — output structural shape', () => {
  it('returns 12 entries in bhava order 1..12', () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Sun: 0 } });
    const argala = computeArgala(chart);
    expect(argala).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(argala[i]!.bhava).toBe(i + 1);
    }
  });

  it('argala and virodhargala are disjoint per bhava (no planet appears in both lists)', () => {
    const chart = synthChart({
      lagnaRashi: 5,
      rashis: {
        Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Jupiter: 4,
        Venus: 5, Saturn: 6, Rahu: 7, Ketu: 11,
      },
    });
    const argala = computeArgala(chart);
    for (const ab of argala) {
      const aNames = new Set(ab.argala.map((p) => p.planet));
      const vNames = new Set(ab.virodhargala.map((p) => p.planet));
      for (const a of aNames) {
        expect(vNames.has(a)).toBe(false);
      }
    }
  });
});

// ── 4. Empty-list edge case ───────────────────────────

describe('computeArgala — same-house and 7th-house planets', () => {
  it('all planets in the lagna itself: bhava 1 has empty argala/virodhargala (since all are 0-offset)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 0, Ketu: 0,
      },
    });
    const argala = computeArgala(chart);
    // All planets in house 1 contribute to bhavas 3/10/12 (Argala) and
    // 2/4/11 (Virodhargala). Bhava 1 itself sees no planet in 2/4/11
    // OR 3/10/12 because all are at offset 0.
    expect(argala[0]!.argala).toHaveLength(0);
    expect(argala[0]!.virodhargala).toHaveLength(0);
  });

  it('all planets in 7th from lagna: bhava 1 has empty argala/virodhargala', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 6, Moon: 6, Mars: 6, Mercury: 6, Jupiter: 6, Venus: 6,
        Saturn: 6, Rahu: 6, Ketu: 6,
      },
    });
    const argala = computeArgala(chart);
    // 7th from bhava 1 isn't in {2, 4, 11} or {3, 10, 12}, so bhava 1
    // has empty lists. Bhava 7 itself has empty lists too (planets are
    // in 7's own house, offset 0).
    expect(argala[0]!.argala).toHaveLength(0);
    expect(argala[0]!.virodhargala).toHaveLength(0);
    expect(argala[6]!.argala).toHaveLength(0);
    expect(argala[6]!.virodhargala).toHaveLength(0);
  });
});

// ── 5. Fixture sweep ──────────────────────────────────

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

const FIXTURE_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
  'Dhirubhai Ambani', 'Mukesh Ambani'] as const;

describe('Fixture sweep — Argala invariants on R-tier charts', () => {
  it.each(FIXTURE_NAMES)('%s: every planet contributes to exactly 6 bhavas (3 + 3)', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const chart = computeRashiChart(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const argala = computeArgala(chart);
    for (const planet of ALL_GRAHAS) {
      let aCnt = 0;
      let vCnt = 0;
      for (const ab of argala) {
        if (ab.argala.find((p) => p.planet === planet)) aCnt++;
        if (ab.virodhargala.find((p) => p.planet === planet)) vCnt++;
      }
      expect(aCnt).toBe(3);
      expect(vCnt).toBe(3);
    }
  });

  it.each(FIXTURE_NAMES)('%s: 12 entries in bhava order 1..12', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const chart = computeRashiChart(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const argala = computeArgala(chart);
    expect(argala).toHaveLength(12);
    for (let i = 0; i < 12; i++) {
      expect(argala[i]!.bhava).toBe(i + 1);
    }
  });
});

// ── 6. Trikonargala (5/9) opt-in (Phase 34e item 3) ────
//
// Multi-source consensus: planets in the 5th from bhava are Trikonargala
// sources; 9th from bhava are Trikona virodhakas. Ketu reverses the role
// (5th-from = virodhaka; 9th-from = source) per sutramritam +
// anandamoyee + Sanjay Rath. Drik publishes nothing on Argala. Hand-
// derived predictions in notes/phase34e-trikonargala-derive.mjs.

describe('computeArgala — trikona option (Phase 34e item 3)', () => {
  it('default (no options) does NOT populate trikona on any bhava', () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Sun: 4, Moon: 8 } });
    const argala = computeArgala(chart);
    for (const ab of argala) {
      expect(ab.trikona).toBeUndefined();
    }
  });

  it('explicit { includeTrikonargala: true } populates trikona on every bhava', () => {
    const chart = synthChart({ lagnaRashi: 0, rashis: { Sun: 4, Moon: 8 } });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    expect(argala).toHaveLength(12);
    for (const ab of argala) {
      expect(ab.trikona).toBeDefined();
      expect(Array.isArray(ab.trikona!.sources)).toBe(true);
      expect(Array.isArray(ab.trikona!.virodhakas)).toBe(true);
    }
  });
});

describe('computeArgala — trikona 5/9 placement rule (synthetic)', () => {
  it('Sun in 5th from lagna: forms Trikonargala source on bhava 1', () => {
    // Lagna Aries (rashi 0). Sun in Leo (rashi 4, house 5). Other planets
    // in Aries (house 1) → for bhava 1, only Sun is in offset 4.
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Sun: 4,
        Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 0, Ketu: 0,
      },
    });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    const bhava1Sources = argala[0]!.trikona!.sources.map((p) => p.planet);
    expect(bhava1Sources).toContain('Sun');
  });

  it('Mars in 9th from lagna: forms Trikona virodhaka on bhava 1', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Mars: 8,            // house 9 from Aries
        Sun: 0, Moon: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 0, Ketu: 0,
      },
    });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    const bhava1Virodhakas = argala[0]!.trikona!.virodhakas.map((p) => p.planet);
    expect(bhava1Virodhakas).toContain('Mars');
  });
});

describe('computeArgala — Ketu reversal in Trikonargala', () => {
  it('Ketu in 5th from lagna: lands in trikona.virodhakas (NOT sources) for bhava 1', () => {
    // Ketu in Leo (rashi 4, house 5 from Aries lagna).
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Ketu: 4,
        Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 10,    // Rahu opposite Ketu (rashi 10, house 11)
      },
    });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    expect(argala[0]!.trikona!.sources.map((p) => p.planet)).not.toContain('Ketu');
    expect(argala[0]!.trikona!.virodhakas.map((p) => p.planet)).toContain('Ketu');
  });

  it('Ketu in 9th from lagna: lands in trikona.sources (NOT virodhakas) for bhava 1', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Ketu: 8,            // house 9 from Aries
        Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Rahu: 2, // Rahu opposite Ketu (rashi 2, house 3)
      },
    });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    expect(argala[0]!.trikona!.virodhakas.map((p) => p.planet)).not.toContain('Ketu');
    expect(argala[0]!.trikona!.sources.map((p) => p.planet)).toContain('Ketu');
  });

  it('Rahu does NOT reverse — Rahu in 5th remains a Trikonargala source', () => {
    // Sanity: only Ketu is reversed; Rahu (the other node) follows the
    // standard rule. Three classical sources attest the Ketu-specific
    // reversal; none attest a parallel Rahu reversal in the trine context.
    const chart = synthChart({
      lagnaRashi: 0,
      rashis: {
        Rahu: 4,            // house 5 from Aries
        Sun: 0, Moon: 0, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0,
        Saturn: 0, Ketu: 10,
      },
    });
    const argala = computeArgala(chart, { includeTrikonargala: true });
    expect(argala[0]!.trikona!.sources.map((p) => p.planet)).toContain('Rahu');
    expect(argala[0]!.trikona!.virodhakas.map((p) => p.planet)).not.toContain('Rahu');
  });
});

describe('Trikonargala — 2-list-per-planet structural invariant', () => {
  // Each planet (including Ketu) sits in exactly ONE house, so it satisfies
  // offset=4 from exactly one bhava and offset=8 from exactly one bhava.
  // Therefore each planet contributes to exactly 2 trikona lists across
  // all 12 bhavas — total (sources count + virodhakas count) = 2.
  it.each(FIXTURE_NAMES)('%s: each graha contributes to exactly 2 trikona lists', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const chart = computeRashiChart(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const argala = computeArgala(chart, { includeTrikonargala: true });
    for (const planet of ALL_GRAHAS) {
      let count = 0;
      for (const ab of argala) {
        if (ab.trikona!.sources.find((p) => p.planet === planet)) count++;
        if (ab.trikona!.virodhakas.find((p) => p.planet === planet)) count++;
      }
      expect(count).toBe(2);
    }
  });
});

describe('Trikonargala — fixture pin sweep (hand-derived)', () => {
  // Hand-derived in notes/phase34e-trikonargala-derive.mjs. The library
  // implementation is verified against these pins; pins are NOT
  // regenerated from implementation output.
  type Pin = { name: string; bhava: number; sources: GrahaName[]; virodhakas: GrahaName[] };
  const PINS: Pin[] = [
    // Narendra Modi (Vrischika lagna). Ketu in house 11 → 5th-from-7 →
    // Ketu reversal → bhava 7 virodhakas: [Ketu]; bhava 3 sources: [Ketu].
    { name: 'Narendra Modi', bhava:  1, sources: ['Rahu'],            virodhakas: [] },
    { name: 'Narendra Modi', bhava:  3, sources: ['Ketu'],            virodhakas: ['Sun', 'Mercury'] },
    { name: 'Narendra Modi', bhava:  5, sources: [],                  virodhakas: ['Moon', 'Mars'] },
    { name: 'Narendra Modi', bhava:  7, sources: ['Sun', 'Mercury'],  virodhakas: ['Ketu'] },
    { name: 'Narendra Modi', bhava:  9, sources: ['Moon', 'Mars'],    virodhakas: ['Rahu'] },
    { name: 'Narendra Modi', bhava: 12, sources: ['Jupiter'],         virodhakas: [] },
    // Sachin Tendulkar (Simha lagna). Ketu in house 11 → bhava-7 virodhaka.
    { name: 'Sachin Tendulkar', bhava: 1, sources: ['Moon', 'Rahu'],  virodhakas: ['Sun', 'Venus'] },
    { name: 'Sachin Tendulkar', bhava: 3, sources: ['Ketu'],          virodhakas: [] },
    { name: 'Sachin Tendulkar', bhava: 7, sources: [],                virodhakas: ['Ketu'] },
    // Ratan Tata (Dhanus lagna). Ketu in house 6 → 5th-from-2 → bhava-2 virodhaka; 9th-from-10 → bhava-10 source.
    { name: 'Ratan Tata',    bhava:  2, sources: [],                              virodhakas: ['Ketu'] },
    { name: 'Ratan Tata',    bhava:  5, sources: [],                              virodhakas: ['Sun', 'Mercury', 'Venus'] },
    { name: 'Ratan Tata',    bhava:  9, sources: ['Sun', 'Mercury', 'Venus'],     virodhakas: [] },
    { name: 'Ratan Tata',    bhava: 10, sources: ['Jupiter', 'Ketu'],             virodhakas: [] },
  ];

  for (const pin of PINS) {
    it(`${pin.name} bhava ${pin.bhava}: sources=${JSON.stringify(pin.sources)} virodhakas=${JSON.stringify(pin.virodhakas)}`, () => {
      const f = FIXTURE_CHARTS.find((c) => c.name === pin.name)!;
      const chart = computeRashiChart(
        localToUtc(f.dateLocal, f.tzh),
        { latitude: f.lat, longitude: f.lon },
      );
      const argala = computeArgala(chart, { includeTrikonargala: true });
      const entry = argala[pin.bhava - 1]!;
      const sources = entry.trikona!.sources.map((p) => p.planet).sort();
      const virodhakas = entry.trikona!.virodhakas.map((p) => p.planet).sort();
      expect(sources).toEqual([...pin.sources].sort());
      expect(virodhakas).toEqual([...pin.virodhakas].sort());
    });
  }
});
