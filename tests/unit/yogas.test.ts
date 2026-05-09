/**
 * Unit tests for `computeYogas` and the named-yoga catalog.
 *
 * Strategy:
 *   1. Synthetic-chart unit tests per yoga (positive + negative + boundary)
 *      where planet rashi positions are controlled directly. Avoids
 *      coupling to ephemeris drift.
 *   2. Catalog-level invariants — fixed count (~25), unique names, all
 *      types covered, type-filter respected.
 *   3. Pinned expected yoga-name sets for ≥5 fixture charts from
 *      `astrosage-charts.json`. Adding a new yoga to the catalog must
 *      explicitly extend each pin so coverage stays traceable.
 *   4. `reasons[]` format is locked for one representative yoga so the
 *      human-readable output doesn't drift silently.
 */

import { describe, it, expect } from 'vitest';
import { computeYogas } from '../../src/jyotish/yogas';
import { YOGA_CATALOG } from '../../src/jyotish/yogasCatalog';
import { computeRashiChart, computeNavamsa } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, DivisionalChart, GrahaName, HouseInfo,
  LagnaInfo, PlanetPlacement, Yoga, YogaName,
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

interface SynthSpec {
  lagnaRashi: number;
  Sun?: number;
  Moon?: number;
  Mars?: number;
  Mercury?: number;
  Jupiter?: number;
  Venus?: number;
  Saturn?: number;
  Rahu?: number;
  Ketu?: number;
  /** Per-graha override for degree-in-rashi. Default 15°. */
  degrees?: Partial<Record<GrahaName, number>>;
}

/**
 * Build a fully-typed BirthChart with whole-sign houses anchored to
 * `lagnaRashi`. Each planet defaults to 15° within its rashi unless
 * overridden via `degrees`. Useful for hand-controlled yoga unit cases.
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
    const r = spec[g] ?? 0;
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

/** Names of all matched yogas, deduped + sorted for stable pins. */
function yogaNames(yogas: Yoga[]): YogaName[] {
  return Array.from(new Set(yogas.map((y) => y.name))).sort() as YogaName[];
}

/** Find one matched yoga by name, or undefined. */
function find(yogas: Yoga[], name: YogaName): Yoga | undefined {
  return yogas.find((y) => y.name === name);
}

// ── Catalog invariants ────────────────────────────────

describe('YOGA_CATALOG — structural invariants', () => {
  it('has 25 entries (PLAN catalog spec)', () => {
    expect(YOGA_CATALOG).toHaveLength(25);
  });

  it('every name is unique', () => {
    const names = YOGA_CATALOG.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('covers all 8 yoga types', () => {
    const types = new Set(YOGA_CATALOG.map((r) => r.type));
    expect(types).toEqual(new Set([
      'mahapurusha', 'lunar', 'solar', 'raja', 'dhana',
      'special', 'cancellation', 'negative',
    ]));
  });
});

// ── Mahapurusha (positive + negative + boundary) ──────

describe('Mahapurusha — Ruchaka (Mars own/exalted in kendra)', () => {
  it('positive — Mars in Aries (own) at lagna', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 0 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeDefined();
  });

  it('positive — Mars exalted in Capricorn, Cancer lagna (Mars in 7th = kendra)', () => {
    const chart = synthChart({ lagnaRashi: 3, Mars: 9 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeDefined();
  });

  it('negative — Mars in Taurus (neutral, not own/exalted)', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 1 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeUndefined();
  });

  it('negative — Mars in own (Scorpio) but in 2nd house (panaphara, not kendra)', () => {
    // Aries lagna → Scorpio = 8th house (apoklima). Try Libra lagna →
    // Scorpio = 2nd house, Mars not in kendra.
    const chart = synthChart({ lagnaRashi: 6, Mars: 7 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeUndefined();
  });
});

describe('Mahapurusha — Hamsa (Jupiter own/exalted in kendra)', () => {
  it('positive — Jupiter in Sagittarius at lagna', () => {
    const chart = synthChart({ lagnaRashi: 8, Jupiter: 8 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeDefined();
  });

  it('positive — Jupiter exalted in Cancer at 4th house (Aries lagna)', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 3 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeDefined();
  });

  it('negative — Jupiter in Aries (neutral / friend) at lagna', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 0 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeUndefined();
  });
});

describe('Mahapurusha — Bhadra / Malavya / Sasha smoke', () => {
  it('Bhadra — Mercury in Virgo at 6th house, Aries lagna (not kendra) → no match', () => {
    const chart = synthChart({ lagnaRashi: 0, Mercury: 5 });
    expect(find(computeYogas(chart), 'Bhadra')).toBeUndefined();
  });

  it('Bhadra — Mercury in Gemini at 4th house, Pisces lagna (kendra) → match', () => {
    const chart = synthChart({ lagnaRashi: 11, Mercury: 2 });
    expect(find(computeYogas(chart), 'Bhadra')).toBeDefined();
  });

  it('Malavya — Venus in Taurus at lagna → match', () => {
    const chart = synthChart({ lagnaRashi: 1, Venus: 1 });
    expect(find(computeYogas(chart), 'Malavya')).toBeDefined();
  });

  it('Sasha — Saturn exalted in Libra at 7th, Aries lagna → match', () => {
    const chart = synthChart({ lagnaRashi: 0, Saturn: 6 });
    expect(find(computeYogas(chart), 'Sasha')).toBeDefined();
  });
});

// ── Lunar yogas ───────────────────────────────────────

describe('Gajakesari (Jupiter in 1/4/7/10 from Moon)', () => {
  it('positive — offset 4 (Moon Aries, Jupiter Cancer)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 3 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });

  it('positive — offset 1 (conjunct in same rashi)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 5, Jupiter: 5 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });

  it('negative — offset 2 (Moon Aries, Jupiter Taurus)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 1 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeUndefined();
  });

  it('boundary — offset 10 (Moon Aries, Jupiter Capricorn)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 9 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });
});

describe('Sunapha / Anapha / Durudhura / Kemadruma', () => {
  it('Sunapha — Mars in Taurus, Moon in Aries', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1,
      // park other planets far from Moon to avoid contamination
      Sun: 6, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Sunapha')).toBeDefined();
  });

  it('Sunapha — empty 2nd from Moon → no match', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0,
      Sun: 6, Mars: 4, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 9,
    });
    expect(find(computeYogas(chart), 'Sunapha')).toBeUndefined();
  });

  it('Anapha — Mercury in Pisces, Moon in Aries (12th from Moon)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mercury: 11,
      Sun: 6, Mars: 4, Jupiter: 8, Venus: 7, Saturn: 5,
    });
    expect(find(computeYogas(chart), 'Anapha')).toBeDefined();
  });

  it('Durudhura — planets in BOTH 2nd and 12th from Moon', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1, Mercury: 11,
      Sun: 6, Jupiter: 8, Venus: 7, Saturn: 5,
    });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Sunapha')).toBeDefined();
    expect(find(yogas, 'Anapha')).toBeDefined();
    expect(find(yogas, 'Durudhura')).toBeDefined();
  });

  it('Kemadruma — Moon isolated (no planet in 2/12, none conjunct)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0,
      Sun: 3, Mars: 4, Mercury: 5, Jupiter: 6, Venus: 7, Saturn: 8,
    });
    expect(find(computeYogas(chart), 'Kemadruma')).toBeDefined();
  });

  it('Kemadruma — broken when Sunapha/Anapha/Durudhura is present', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1,
      Sun: 6, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Kemadruma')).toBeUndefined();
  });
});

// ── Solar yogas ───────────────────────────────────────

describe('Budha-Aditya / Veshi / Vasi / Ubhayachari', () => {
  it('Budha-Aditya — Sun + Mercury same rashi', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 5, Mercury: 5 });
    expect(find(computeYogas(chart), 'Budha-Aditya')).toBeDefined();
  });

  it('Budha-Aditya — Sun and Mercury in adjacent rashis → no match', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 5, Mercury: 6 });
    expect(find(computeYogas(chart), 'Budha-Aditya')).toBeUndefined();
  });

  it('Veshi — Mars in 2nd from Sun (Moon excluded)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Mars: 1, Moon: 6,
      Mercury: 7, Jupiter: 8, Venus: 9, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Veshi')).toBeDefined();
  });

  it('Vasi — Saturn in 12th from Sun', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Saturn: 11, Moon: 6,
      Mars: 7, Mercury: 8, Jupiter: 5, Venus: 4,
    });
    expect(find(computeYogas(chart), 'Vasi')).toBeDefined();
  });

  it('Ubhayachari — planets in BOTH 2nd and 12th from Sun', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Mars: 1, Saturn: 11,
      Moon: 6, Mercury: 5, Jupiter: 8, Venus: 7,
    });
    expect(find(computeYogas(chart), 'Ubhayachari')).toBeDefined();
  });
});

// ── Raja yogas ────────────────────────────────────────

describe('Raja Yoga (kendra-lord conjunct/aspecting trikona-lord)', () => {
  it('Aries lagna — Mars (kendra-lord 1) and Sun (trikona-lord 5) conjunct', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mars: 5, Sun: 5,
      Moon: 6, Mercury: 7, Jupiter: 8, Venus: 9, Saturn: 4,
    });
    const m = find(computeYogas(chart), 'Raja Yoga');
    expect(m).toBeDefined();
  });

  it('Pisces lagna — kendra/trikona lords mutually isolated → no Raja Yoga', () => {
    // Pisces lagna: kendra-lords = {Jupiter (h1, h10), Mercury (h4, h7)};
    // trikona-lords = {Jupiter (h1), Moon (h5), Mars (h9)}. Distinct
    // (k, t) pairs after dedup: (Jupiter, Moon), (Jupiter, Mars),
    // (Mercury, Jupiter), (Mercury, Moon), (Mercury, Mars). For Raja
    // Yoga to fire, at least one pair must share a rashi or be in
    // mutual aspect.
    //
    // Placement chosen so every pair fails both conditions:
    //   Jupiter @ Pisces (h1) — aspects h5, h7, h9 (special 5/9 + universal)
    //   Mars    @ Aries  (h2) — aspects h5, h8, h9 (special 4/8 + universal)
    //   Mercury @ Taurus (h3) — aspects h9 only (universal)
    //   Moon    @ Leo    (h6) — aspects h12 only (universal)
    // None of {Moon@h6, Mars@h2, Mercury@h3} sits at h5/h7/h9 → Jupiter
    // doesn't aspect them. None of {Jupiter@h1, Moon@h6, Mercury@h3}
    // sits at h5/h8/h9 → Mars doesn't aspect them. Mercury and Moon's
    // sole 7th aspects (h9 / h12) hit empty houses for the partner set.
    // Sun/Venus/Saturn parked outside the rule (not k or t lords for
    // Pisces lagna).
    const chart = synthChart({
      lagnaRashi: 11,
      Jupiter: 11, // h1
      Mars: 0,     // h2
      Mercury: 1,  // h3
      Moon: 4,     // h6
      Sun: 6,      // h8 — parked
      Venus: 7,    // h9 — parked (not a relevant lord)
      Saturn: 8,   // h10 — parked
    });
    expect(find(computeYogas(chart), 'Raja Yoga')).toBeUndefined();
  });
});

describe('Dharma-Karmadhipati (9th + 10th lord conjunct)', () => {
  it('Aries lagna — Jupiter (9th) + Saturn (10th) conjunct', () => {
    const chart = synthChart({
      lagnaRashi: 0, Jupiter: 9, Saturn: 9,
      Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Venus: 4,
    });
    expect(find(computeYogas(chart), 'Dharma-Karmadhipati')).toBeDefined();
  });

  it('negative — 9th and 10th lords in different rashis without mutual aspect', () => {
    const chart = synthChart({
      lagnaRashi: 0, Jupiter: 0, Saturn: 1,
      Sun: 5, Moon: 6, Mars: 7, Mercury: 8, Venus: 9,
    });
    expect(find(computeYogas(chart), 'Dharma-Karmadhipati')).toBeUndefined();
  });
});

describe('Vipareeta Raja Yoga', () => {
  it('Aries lagna — 6th/8th/12th lords (Mercury, Mars, Jupiter) all in Scorpio (8th)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mercury: 7, Mars: 7, Jupiter: 7,
      Sun: 0, Moon: 1, Venus: 2, Saturn: 3,
    });
    expect(find(computeYogas(chart), 'Vipareeta Raja Yoga')).toBeDefined();
  });

  it('negative — lords scattered across rashis', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mercury: 5, Mars: 7, Jupiter: 11,
    });
    expect(find(computeYogas(chart), 'Vipareeta Raja Yoga')).toBeUndefined();
  });
});

describe('Lakshmi Yoga (9th lord + Venus, both own/exalted)', () => {
  it('Aries lagna — Jupiter in Sagittarius (own) + Venus in Taurus (own)', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 8, Venus: 1 });
    expect(find(computeYogas(chart), 'Lakshmi Yoga')).toBeDefined();
  });

  it('negative — Jupiter exalted, Venus debilitated', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 3, Venus: 5 });
    expect(find(computeYogas(chart), 'Lakshmi Yoga')).toBeUndefined();
  });
});

// ── Dhana yogas ───────────────────────────────────────

describe('Dhana Yoga (2-11) and Dhana Yoga (5-9)', () => {
  it('Dhana 2-11 — Aries lagna, Venus (2nd lord) + Saturn (11th lord) conjunct', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 4, Saturn: 4 });
    expect(find(computeYogas(chart), 'Dhana Yoga (2-11)')).toBeDefined();
  });

  it('Dhana 5-9 — Aries lagna, Sun (5th lord) + Jupiter (9th lord) conjunct', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 7, Jupiter: 7 });
    expect(find(computeYogas(chart), 'Dhana Yoga (5-9)')).toBeDefined();
  });

  it('negative — 2nd and 11th lords in different rashis', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 0, Saturn: 7 });
    expect(find(computeYogas(chart), 'Dhana Yoga (2-11)')).toBeUndefined();
  });
});

describe('Vasumati Yoga', () => {
  it('positive — natural benefics in houses 3, 6, 11, 12 from Aries lagna', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      Mercury: 2, // Gemini → 3rd
      Moon: 5,    // Virgo → 6th
      Venus: 10,  // Aquarius → 11th
      Jupiter: 11,// Pisces → 12th
      Sun: 4, Mars: 6, Saturn: 7,
    });
    expect(find(computeYogas(chart), 'Vasumati Yoga')).toBeDefined();
  });

  it('negative — only 3 of 4 required houses filled', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      Mercury: 2, Moon: 5, Venus: 10,
      Jupiter: 0, // Pisces empty
    });
    expect(find(computeYogas(chart), 'Vasumati Yoga')).toBeUndefined();
  });
});

// ── Special yogas ─────────────────────────────────────

describe('Yogakaraka (lagna-conditional)', () => {
  it('Cancer lagna → Mars is Yogakaraka', () => {
    const chart = synthChart({ lagnaRashi: 3 });
    expect(find(computeYogas(chart), 'Yogakaraka')).toBeDefined();
  });

  it('Taurus lagna → Saturn is Yogakaraka', () => {
    const chart = synthChart({ lagnaRashi: 1 });
    expect(find(computeYogas(chart), 'Yogakaraka')).toBeDefined();
  });

  it('Capricorn lagna → Venus is Yogakaraka', () => {
    const chart = synthChart({ lagnaRashi: 9 });
    expect(find(computeYogas(chart), 'Yogakaraka')).toBeDefined();
  });

  it('Aries lagna → no Yogakaraka', () => {
    const chart = synthChart({ lagnaRashi: 0 });
    expect(find(computeYogas(chart), 'Yogakaraka')).toBeUndefined();
  });

  it('Pisces lagna → no Yogakaraka', () => {
    const chart = synthChart({ lagnaRashi: 11 });
    expect(find(computeYogas(chart), 'Yogakaraka')).toBeUndefined();
  });
});

describe('Vargottama (D9 required)', () => {
  it('without navamsa option → silently skipped', () => {
    const chart = synthChart({ lagnaRashi: 0 });
    expect(find(computeYogas(chart), 'Vargottama')).toBeUndefined();
  });

  it('with real chart + computeNavamsa → may fire', () => {
    // Use a fixture so Vargottama input is meaningful.
    const f = (fixtures as { charts: { name: string; dateLocal: string; tzh: number; lat: number; lon: number }[] })
      .charts.find((c) => c.name === 'Narendra Modi')!;
    const utc = localToUtc(f.dateLocal, f.tzh);
    const loc = { latitude: f.lat, longitude: f.lon };
    const d1 = computeRashiChart(utc, loc);
    const d9 = computeNavamsa(utc, loc);
    const yogas = computeYogas(d1, { navamsa: d9 });
    // Either Vargottama fires or it doesn't — but the call must succeed
    // and yogas must be a well-formed array.
    expect(Array.isArray(yogas)).toBe(true);
  });
});

// ── Cancellation: Neecha Bhanga ───────────────────────

describe('Neecha Bhanga (cancellation)', () => {
  it('Rule A — debilitated Sun in Libra, Venus (dispositor) in kendra', () => {
    // Aries lagna. Sun in Libra (7th house = kendra). Venus in Capricorn
    // (10th house from Aries = kendra). Sun debilitated → Venus
    // (dispositor of Libra) is in kendra → Neecha Bhanga.
    const chart = synthChart({ lagnaRashi: 0, Sun: 6, Venus: 9 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Neecha Bhanga')).toBeDefined();
  });

  it('negative — Sun debilitated, Venus in 3rd house (not kendra) and no exalted helper', () => {
    // Aries lagna; Sun in Libra; Venus in Gemini (3rd house, not kendra).
    // No exalted graha; lord of Sun's exaltation rashi (Aries=Mars) not
    // in kendra either → no cancellation.
    const chart = synthChart({
      lagnaRashi: 0, Sun: 6, Venus: 2,
      Mars: 1, Jupiter: 0, Saturn: 0, Mercury: 0, Moon: 5,
    });
    expect(find(computeYogas(chart), 'Neecha Bhanga')).toBeUndefined();
  });
});

// ── Negative: Daridra ─────────────────────────────────

describe('Daridra Yoga', () => {
  it('Aries lagna — Saturn (11th lord) in 12th house', () => {
    const chart = synthChart({ lagnaRashi: 0, Saturn: 11 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeDefined();
  });

  it('Aries lagna — Venus (2nd lord) in 8th house (Scorpio)', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 7 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeDefined();
  });

  it('negative — 2nd lord and 11th lord in benign houses', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 1, Saturn: 9 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeUndefined();
  });
});

// ── reasons[] format pin ──────────────────────────────

describe('reasons[] human-readable format', () => {
  it('Gajakesari reason locks the "Jupiter in Nth from Moon" string', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 3 });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.reasons).toEqual(['Jupiter in 4th from Moon (kendra)']);
  });

  it('Yogakaraka reason includes lagna name and planet position', () => {
    const chart = synthChart({ lagnaRashi: 3, Mars: 5 });
    const m = find(computeYogas(chart), 'Yogakaraka')!;
    expect(m.reasons).toHaveLength(1);
    expect(m.reasons[0]).toContain('Mars is Yogakaraka');
    expect(m.reasons[0]).toContain('Karka lagna');
  });

  it('Mahapurusha reason includes dignity and rashi name', () => {
    const chart = synthChart({ lagnaRashi: 8, Jupiter: 8 });
    const m = find(computeYogas(chart), 'Hamsa')!;
    expect(m.reasons[0]).toMatch(/Jupiter (own|moolatrikona) in Dhanu/);
    expect(m.reasons[0]).toContain('kendra');
  });
});

// ── Type-filter option ────────────────────────────────

describe('options.types — filter by yoga type', () => {
  it('restricts output to mahapurusha only', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mars: 0, Jupiter: 3, Sun: 5, Mercury: 5,
    });
    const filtered = computeYogas(chart, { types: ['mahapurusha'] });
    for (const y of filtered) {
      expect(y.type).toBe('mahapurusha');
    }
  });

  it('empty types[] → no filter', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 0 });
    const all = computeYogas(chart);
    const empty = computeYogas(chart, { types: [] });
    expect(empty.map((y) => y.name)).toEqual(all.map((y) => y.name));
  });

  it('multi-type filter respects every requested type', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mars: 0, Sun: 5, Mercury: 5, Moon: 0, Jupiter: 3,
    });
    const filt = computeYogas(chart, { types: ['mahapurusha', 'lunar'] });
    for (const y of filt) {
      expect(['mahapurusha', 'lunar']).toContain(y.type);
    }
  });
});

// ── Fixture-pin sweep (5 charts) ──────────────────────

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

function fixtureChart(name: string): { d1: BirthChart; d9: DivisionalChart } {
  const f = FIXTURE_CHARTS.find((c) => c.name === name);
  if (!f) throw new Error(`fixture not found: ${name}`);
  const utc = localToUtc(f.dateLocal, f.tzh);
  const loc = { latitude: f.lat, longitude: f.lon };
  return { d1: computeRashiChart(utc, loc), d9: computeNavamsa(utc, loc) };
}

/**
 * Pinned expected name sets per fixture chart. Adding a new yoga to
 * the catalog MUST extend each pin (or add a deliberate `// not detected`
 * comment) so coverage stays explicit.
 *
 * Values were derived programmatically from `computeYogas` after the
 * catalog was finalized; they serve as regression detectors for the
 * combined effect of catalog + dignity + aspects.
 */
const FIXTURE_PINS: ReadonlyArray<{ name: string; expected: readonly YogaName[] }> = [
  {
    // Vrischika lagna; Mars in Vrischika (own → Ruchaka, kendra-1).
    // Sun + Mercury conjunct in Kanya (Budha-Aditya); Jupiter in Kumbha
    // = 4th from Moon (Gajakesari); Sun in Kanya = 11th from Vrischika
    // (Vasi from Sun); Mercury debilitated in Kanya? No — Mercury in
    // own. Sun debilitated? No — Sun not in Tula. The Neecha Bhanga
    // entry comes from Saturn's setup; verified by inspection.
    name: 'Narendra Modi',
    expected: [
      'Budha-Aditya',
      'Gajakesari',
      'Neecha Bhanga',
      'Raja Yoga',
      'Ruchaka',
      'Vargottama',
      'Vasi',
    ],
  },
  {
    // Simha lagna → Mars is Yogakaraka. Daridra + Dhana (5-9) co-exist
    // because the rules are independent (different houses).
    name: 'Sachin Tendulkar',
    expected: [
      'Daridra Yoga',
      'Dhana Yoga (5-9)',
      'Neecha Bhanga',
      'Raja Yoga',
      'Sunapha',
      'Ubhayachari',
      'Vasi',
      'Veshi',
      'Yogakaraka',
    ],
  },
  {
    // Dhanu lagna; Moon in Tula (isolated from visible grahas) →
    // Kemadruma. Jupiter aspects Moon's house from Makara.
    name: 'Ratan Tata',
    expected: [
      'Budha-Aditya',
      'Dharma-Karmadhipati',
      'Gajakesari',
      'Kemadruma',
      'Neecha Bhanga',
      'Raja Yoga',
      'Veshi',
    ],
  },
  {
    name: 'Dhirubhai Ambani',
    expected: [
      'Anapha',
      'Daridra Yoga',
      'Durudhura',
      'Gajakesari',
      'Raja Yoga',
      'Sunapha',
      'Ubhayachari',
      'Vargottama',
      'Vasi',
      'Veshi',
    ],
  },
  {
    name: 'Mukesh Ambani',
    expected: [
      'Anapha',
      'Budha-Aditya',
      'Raja Yoga',
      'Veshi',
    ],
  },
];

describe('Fixture sweep — pinned yoga sets per chart', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const { d1, d9 } = fixtureChart(pin.name);
      const yogas = computeYogas(d1, { navamsa: d9 });
      expect(yogaNames(yogas)).toEqual([...pin.expected].sort());
    });
  }
});

describe('computeYogas — overall sanity on every fixture', () => {
  for (const f of FIXTURE_CHARTS.slice(0, 10)) {
    it(`${f.name} — output is a valid Yoga[] (no exception)`, () => {
      const { d1, d9 } = fixtureChart(f.name);
      const yogas = computeYogas(d1, { navamsa: d9 });
      for (const y of yogas) {
        expect(y.name).toBeDefined();
        expect(y.type).toBeDefined();
        expect(Array.isArray(y.reasons)).toBe(true);
        expect(y.reasons.length).toBeGreaterThan(0);
      }
    });
  }
});
