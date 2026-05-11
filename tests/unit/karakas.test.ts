/**
 * Unit tests for `computeJaiminiKarakas` (Step 31-3).
 *
 * Strategy:
 *   1. Synthetic-chart unit cases pinning the descending-degree sort.
 *      `synthChart` is a local copy of the helper from `yogas.test.ts`
 *      so the karaka tests are self-contained. Each test sets explicit
 *      `degreeInRashi` per visible graha.
 *   2. Tie-break test — two grahas at exactly the same degree must
 *      preserve the canonical Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn
 *      order (stable sort).
 *   3. Monotonic-degree assertion: in the ranked karaka list,
 *      degree[Atmakaraka] ≥ degree[Amatyakaraka] ≥ … ≥ degree[Darakaraka].
 *   4. Pinned expected karaka mappings for 5 fixture charts already used
 *      by `yogas.test.ts` (Modi, Sachin, Tata, Dhirubhai, Mukesh) —
 *      regression detector for the combined effect of ephemeris +
 *      Lahiri ayanamsa + the karaka algorithm.
 */

import { describe, it, expect } from 'vitest';
import { computeJaiminiKarakas } from '../../src/jyotish/karakas';
import { computeRashiChart } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, GrahaName, HouseInfo, Jaimini8Karakas,
  JaiminiKarakas, Karaka8Name, KarakaName, LagnaInfo, PlanetPlacement,
} from '../../src/types/jyotish';
import fixtures from '../fixtures/astrosage-charts.json';

// ── Rashi names + synthetic-chart builder ─────────────

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
  /** Per-graha degree-in-rashi override. Defaults to 15° each. */
  degrees?: Partial<Record<GrahaName, number>>;
  /** Per-graha rashi placement (0..11). Defaults to 0. */
  rashis?: Partial<Record<GrahaName, number>>;
}

/**
 * Build a fully-typed BirthChart with whole-sign houses and explicit
 * `degreeInRashi` per planet. Karaka algorithm only reads
 * `chart.planets[i].degreeInRashi`, so the synthetic chart's house /
 * rashi assignments are intentionally simple.
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

/** Lookup a planet's degree-in-rashi by graha name. */
function degreeOf(chart: BirthChart, g: GrahaName): number {
  return chart.planets.find((p) => p.planet === g)!.degreeInRashi;
}

// ── Sort behavior — pinned mappings ───────────────────

describe('computeJaiminiKarakas — descending-degree sort', () => {
  it('strictly increasing input → reversed karaka assignment', () => {
    // Sun=1°, Moon=2°, Mars=3°, … Saturn=7°.
    // Highest = Saturn (Atmakaraka), lowest = Sun (Darakaraka).
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

  it('mixed degrees — picks correct planet per role', () => {
    // Highest: Jupiter @ 28°. Lowest: Mars @ 0.5°.
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

  it('Rahu and Ketu are excluded — never assigned to a karaka role', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 1, Moon: 2, Mars: 3, Mercury: 4,
        Jupiter: 5, Venus: 6, Saturn: 7,
        Rahu: 29, Ketu: 29, // would dominate if included — must be ignored
      },
    });
    const k = computeJaiminiKarakas(chart);
    const assigned = new Set(Object.values(k));
    expect(assigned.has('Rahu')).toBe(false);
    expect(assigned.has('Ketu')).toBe(false);
    expect(k.Atmakaraka).toBe('Saturn'); // not Rahu / Ketu
  });
});

// ── Tie-break (stable sort, canonical order) ──────────

describe('computeJaiminiKarakas — tie-break', () => {
  it('exact tie between Sun and Moon → Sun wins (earlier in canonical order)', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 20, Moon: 20, // identical
        Mars: 10, Mercury: 9, Jupiter: 8, Venus: 7, Saturn: 6,
      },
    });
    const k = computeJaiminiKarakas(chart);
    // Sun and Moon both at 20° → Sun is earlier in
    // [Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn], so Sun wins
    // Atmakaraka under the documented stable-sort tie-break.
    expect(k.Atmakaraka).toBe('Sun');
    expect(k.Amatyakaraka).toBe('Moon');
  });

  it('exact tie between Mars and Saturn → Mars wins', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 25, Mercury: 7,
        Jupiter: 8, Venus: 9, Saturn: 25, // tied with Mars
      },
    });
    const k = computeJaiminiKarakas(chart);
    expect(k.Atmakaraka).toBe('Mars');     // earlier than Saturn in canonical order
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

// ── Monotonic invariant ───────────────────────────────

describe('computeJaiminiKarakas — monotonic-degree invariant', () => {
  /**
   * For every chart, the assigned grahas' degrees must be
   * non-increasing across the canonical Atmakaraka..Darakaraka
   * positions.
   */
  function assertMonotonic(chart: BirthChart, k: JaiminiKarakas): void {
    const degrees = KARAKA_ORDER.map((role) => degreeOf(chart, k[role]));
    // Atmakaraka ≥ Amatyakaraka ≥ Bhratrukaraka ≥ Matrukaraka ≥
    // Putrakaraka ≥ Gnatikaraka ≥ Darakaraka.
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

// ── Output structural shape ───────────────────────────

describe('computeJaiminiKarakas — output shape', () => {
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

// ── Fixture pins (5 charts) ───────────────────────────

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

/**
 * Pinned expected karaka mappings for 5 R-tier fixture charts.
 * Derived programmatically from `computeJaiminiKarakas` after the
 * algorithm was finalized — these values serve as regression detectors
 * for the combined effect of ephemeris + Lahiri ayanamsa + the karaka
 * sort.
 */
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

describe('Fixture sweep — pinned karaka mappings', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const chart = fixtureChart(pin.name);
      const k = computeJaiminiKarakas(chart);
      expect(k).toEqual(pin.expected);
    });
  }
});

// ── Phase 34e — 8-Karaka Jaimini variant ──────────────

const KARAKA_8_ORDER: readonly Karaka8Name[] = [
  'Atmakaraka', 'Amatyakaraka', 'Bhratrukaraka', 'Matrukaraka',
  'Pitrukaraka', 'Putrakaraka', 'Gnatikaraka', 'Darakaraka',
];

/**
 * Effective degree for the 8-Karaka variant: Rahu reversed
 * (30 − degreeInRashi), every other graha unchanged.
 */
function effective8(chart: BirthChart, g: GrahaName): number {
  const p = chart.planets.find((x) => x.planet === g)!;
  return g === 'Rahu' ? 30 - p.degreeInRashi : p.degreeInRashi;
}

describe('computeJaiminiKarakas (8-jaimini) — Rahu reversal rule', () => {
  it('Rahu at degreeInRashi = 29° → reversed = 1° → Darakaraka (lowest)', () => {
    // Visible grahas all > 1°. Rahu reversed at 1° must take the
    // lowest rank.
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 7, Mercury: 8,
        Jupiter: 9, Venus: 10, Saturn: 11,
        Rahu: 29, // reversed = 1°
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Darakaraka).toBe('Rahu');
    // Highest visible degree is Saturn @ 11°, so Atmakaraka = Saturn.
    expect(k.Atmakaraka).toBe('Saturn');
  });

  it('Rahu at degreeInRashi = 1° → reversed = 29° → Atmakaraka (highest)', () => {
    // Visible grahas all < 29°. Rahu reversed at 29° must take the
    // highest rank.
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 5, Moon: 6, Mars: 7, Mercury: 8,
        Jupiter: 9, Venus: 10, Saturn: 11,
        Rahu: 1, // reversed = 29°
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Rahu');
    // Lowest visible degree is Sun @ 5°, and the 7 visible grahas
    // shift down one slot, so Darakaraka = Sun.
    expect(k.Darakaraka).toBe('Sun');
  });

  it('Ketu is excluded from the 8-Jaimini variant', () => {
    // Set Ketu's degreeInRashi to 0° (would be Darakaraka if included)
    // and confirm Ketu doesn't appear in any assigned role.
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

describe('computeJaiminiKarakas (8-jaimini) — Pitrukaraka insertion', () => {
  it('Rahu lands at exactly position 4 → Pitrukaraka = Rahu, 7-K names unchanged for AK..MK and PK..DK', () => {
    // Visible grahas at 7°, 8°, 9°, 10°, 3°, 2°, 1°
    // → sorted: 10°, 9°, 8°, 7°, 3°, 2°, 1° (positions 0-6 of 7-K)
    // Insert Rahu reversed at 5° (degreeInRashi=25°) → slots at position 4
    // (between 7° and 3°). So Rahu = Pitrukaraka.
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Mercury: 10, Jupiter: 9, Venus: 8, Saturn: 7,
        Sun: 3, Moon: 2, Mars: 1,
        Rahu: 25, // reversed = 5°
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Mercury');     // pos 0: 10°
    expect(k.Amatyakaraka).toBe('Jupiter');   // pos 1: 9°
    expect(k.Bhratrukaraka).toBe('Venus');    // pos 2: 8°
    expect(k.Matrukaraka).toBe('Saturn');     // pos 3: 7°
    expect(k.Pitrukaraka).toBe('Rahu');       // pos 4: 5° (reversed)
    expect(k.Putrakaraka).toBe('Sun');        // pos 5: 3°
    expect(k.Gnatikaraka).toBe('Moon');       // pos 6: 2°
    expect(k.Darakaraka).toBe('Mars');        // pos 7: 1°
  });
});

describe('computeJaiminiKarakas (8-jaimini) — tie-break (Rahu loses)', () => {
  it('Rahu reversed degree exactly equals a visible graha → visible graha wins', () => {
    // Sun at 15° and Rahu at degreeInRashi=15° (reversed=15°) — exact tie.
    // Canonical 8-graha order: Sun > Moon > … > Saturn > Rahu.
    // Sun must win (higher role).
    const chart = synthChart({
      lagnaRashi: 0,
      degrees: {
        Sun: 15, Moon: 1, Mars: 2, Mercury: 3,
        Jupiter: 4, Venus: 5, Saturn: 6,
        Rahu: 15, // reversed = 15° — tied with Sun
      },
    });
    const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
    expect(k.Atmakaraka).toBe('Sun');
    expect(k.Amatyakaraka).toBe('Rahu');
  });

  it('all 8 grahas at effective 15° → canonical order preserved (Rahu last)', () => {
    // Every visible graha at 15°. Rahu at degreeInRashi=15° → reversed = 15°.
    // All 8 effective degrees equal → canonical Parashara order:
    // Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu.
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

describe('computeJaiminiKarakas (8-jaimini) — output shape', () => {
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

describe('computeJaiminiKarakas — backwards-compat with 7-Parashara default', () => {
  it('calling with no options returns identical result as { variant: "7-parashara" }', () => {
    for (const pin of FIXTURE_PINS) {
      const chart = fixtureChart(pin.name);
      const kDefault: JaiminiKarakas = computeJaiminiKarakas(chart);
      const k7: JaiminiKarakas = computeJaiminiKarakas(chart, { variant: '7-parashara' });
      expect(kDefault).toEqual(k7);
      // Belt-and-braces: also matches the pinned 7-K expected.
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

describe('computeJaiminiKarakas (8-jaimini) — monotonic-degree invariant', () => {
  /**
   * For every chart, the assigned grahas' effective degrees must be
   * non-increasing across positions 0..7 (Atmakaraka..Darakaraka).
   */
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

/**
 * Pinned expected 8-karaka mappings for 9 R-tier fixture charts. The
 * predictions are derived by hand from the raw `degreeInRashi` values
 * (extracted from `computeRashiChart`) — Rahu's effective degree
 * `30 − degreeInRashi` slotted into the sorted-by-descending-degree
 * 7-graha list, with the Parashara stable-sort tie-break extended one
 * slot (Rahu loses every tie). Full derivation in
 * `notes/phase34e-jaimini-research.md` §7.
 */
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

describe('Fixture sweep — pinned 8-Jaimini karaka mappings (9 R-tier charts)', () => {
  for (const pin of FIXTURE_PINS_8) {
    it(`${pin.name}`, () => {
      const chart = fixtureChart(pin.name);
      const k = computeJaiminiKarakas(chart, { variant: '8-jaimini' });
      expect(k).toEqual(pin.expected);
    });
  }
});
