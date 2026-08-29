import { describe, it, expect } from 'vitest';
import { computeYogas } from '../../src/jyotish/yogas';
import { YOGA_CATALOG } from '../../src/jyotish/yogasCatalog';
import { computeRashiChart, computeNavamsa, indexPlanets } from '../../src/jyotish/charts';
import type {
  BhavaChart, BirthChart, DivisionalChart, GrahaName, HouseInfo,
  LagnaInfo, PlanetPlacement, Yoga, YogaName,
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

  return { divisional: 'D1', lagna, bhava, planets, byPlanet: indexPlanets(planets) };
}

function yogaNames(yogas: Yoga[]): YogaName[] {
  return Array.from(new Set(yogas.map((y) => y.name))).sort() as YogaName[];
}

function find(yogas: Yoga[], name: YogaName): Yoga | undefined {
  return yogas.find((y) => y.name === name);
}

describe('YOGA_CATALOG: structural invariants', () => {
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

describe('Mahapurusha: Ruchaka (Mars own/exalted in kendra)', () => {
  it('positive: Mars in Aries (own) at lagna', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 0 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeDefined();
  });

  it('positive: Mars exalted in Capricorn, Cancer lagna (Mars in 7th = kendra)', () => {
    const chart = synthChart({ lagnaRashi: 3, Mars: 9 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeDefined();
  });

  it('negative: Mars in Taurus (neutral, not own/exalted)', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 1 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeUndefined();
  });

  it('negative: Mars in own (Scorpio) but in 2nd house (panaphara, not kendra)', () => {
    const chart = synthChart({ lagnaRashi: 6, Mars: 7 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Ruchaka')).toBeUndefined();
  });
});

describe('Mahapurusha: Hamsa (Jupiter own/exalted in kendra)', () => {
  it('positive: Jupiter in Sagittarius at lagna', () => {
    const chart = synthChart({ lagnaRashi: 8, Jupiter: 8 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeDefined();
  });

  it('positive: Jupiter exalted in Cancer at 4th house (Aries lagna)', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 3 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeDefined();
  });

  it('negative: Jupiter in Aries (neutral / friend) at lagna', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 0 });
    expect(find(computeYogas(chart), 'Hamsa')).toBeUndefined();
  });
});

describe('Mahapurusha bhanga (Phase 34c): Sun/Moon conjunction', () => {
  it('Ruchaka + Sun conjunct Mars → bhanga.applies = true (Sun only)', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 0, Sun: 0, Moon: 3 });
    const m = find(computeYogas(chart), 'Ruchaka')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toEqual(['Mars conjunct Sun in Mesha']);
  });

  it('Bhadra + Moon conjunct Mercury → bhanga.applies = true (Moon only)', () => {
    const chart = synthChart({ lagnaRashi: 11, Mercury: 2, Moon: 2, Sun: 0 });
    const m = find(computeYogas(chart), 'Bhadra')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toEqual(['Mercury conjunct Moon in Mithuna']);
  });

  it('Hamsa + neither Sun nor Moon conjunct → bhanga.applies = false', () => {
    const chart = synthChart({ lagnaRashi: 8, Jupiter: 8, Sun: 0, Moon: 3 });
    const m = find(computeYogas(chart), 'Hamsa')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(false);
    expect(m.bhanga!.reasons).toEqual([]);
  });

  it('Malavya + both Sun and Moon conjunct Venus → bhanga has both reasons', () => {
    const chart = synthChart({ lagnaRashi: 6, Venus: 6, Sun: 6, Moon: 6 });
    const m = find(computeYogas(chart), 'Malavya')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toEqual([
      'Venus conjunct Sun in Tula',
      'Venus conjunct Moon in Tula',
    ]);
  });

  it('Sasha + Sun conjunct → bhanga reason format pin', () => {
    const chart = synthChart({ lagnaRashi: 0, Saturn: 6, Sun: 6, Moon: 0 });
    const m = find(computeYogas(chart), 'Sasha')!;
    expect(m.bhanga!.reasons).toEqual(['Saturn conjunct Sun in Tula']);
  });

  it('Mahapurusha yoga absent → no Yoga emitted; bhanga field not surfaced', () => {
    const chart = synthChart({ lagnaRashi: 0, Mars: 1, Sun: 1 });
    expect(find(computeYogas(chart), 'Ruchaka')).toBeUndefined();
  });
});

describe('Mahapurusha: Bhadra / Malavya / Sasha smoke', () => {
  it('Bhadra: Mercury in Virgo at 6th house, Aries lagna (not kendra) → no match', () => {
    const chart = synthChart({ lagnaRashi: 0, Mercury: 5 });
    expect(find(computeYogas(chart), 'Bhadra')).toBeUndefined();
  });

  it('Bhadra: Mercury in Gemini at 4th house, Pisces lagna (kendra) → match', () => {
    const chart = synthChart({ lagnaRashi: 11, Mercury: 2 });
    expect(find(computeYogas(chart), 'Bhadra')).toBeDefined();
  });

  it('Malavya: Venus in Taurus at lagna → match', () => {
    const chart = synthChart({ lagnaRashi: 1, Venus: 1 });
    expect(find(computeYogas(chart), 'Malavya')).toBeDefined();
  });

  it('Sasha: Saturn exalted in Libra at 7th, Aries lagna → match', () => {
    const chart = synthChart({ lagnaRashi: 0, Saturn: 6 });
    expect(find(computeYogas(chart), 'Sasha')).toBeDefined();
  });
});

describe('Gajakesari (Jupiter in 1/4/7/10 from Moon)', () => {
  it('positive: offset 4 (Moon Aries, Jupiter Cancer)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 3 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });

  it('positive: offset 1 (conjunct in same rashi)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 5, Jupiter: 5 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });

  it('negative: offset 2 (Moon Aries, Jupiter Taurus)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 1 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeUndefined();
  });

  it('boundary: offset 10 (Moon Aries, Jupiter Capricorn)', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 9 });
    expect(find(computeYogas(chart), 'Gajakesari')).toBeDefined();
  });
});

describe('Gajakesari bhanga (Phase 34c): combust / debilitated Jupiter', () => {
  it('Jupiter combust → bhanga applies with combust reason', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 0, Jupiter: 0, Sun: 0 });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toContain('Jupiter combust (within 10° of Sun)');
  });

  it('Jupiter debilitated (Capricorn) → bhanga applies with debilitated reason', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 9, Jupiter: 9, Sun: 0 });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toEqual(['Jupiter debilitated in Makara']);
  });

  it('Jupiter combust AND debilitated (Sun in Capricorn) → both reasons fire', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 9, Jupiter: 9, Sun: 9 });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toEqual([
      'Jupiter combust (within 10° of Sun)',
      'Jupiter debilitated in Makara',
    ]);
  });

  it('Jupiter exalted (Cancer), not combust → bhanga.applies = false', () => {
    const chart = synthChart({ lagnaRashi: 0, Moon: 3, Jupiter: 3, Sun: 0 });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga).toBeDefined();
    expect(m.bhanga!.applies).toBe(false);
    expect(m.bhanga!.reasons).toEqual([]);
  });

  it('Combustion boundary: Jupiter 10° from Sun (boundary inclusive)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Jupiter: 0, Sun: 0,
      degrees: { Sun: 0, Jupiter: 10 },
    });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga!.applies).toBe(true);
    expect(m.bhanga!.reasons).toContain('Jupiter combust (within 10° of Sun)');
  });

  it('Combustion boundary: Jupiter 11° from Sun (just outside)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Jupiter: 0, Sun: 0,
      degrees: { Sun: 0, Jupiter: 11 },
    });
    const m = find(computeYogas(chart), 'Gajakesari')!;
    expect(m.bhanga!.applies).toBe(false);
  });
});

describe('Sunapha / Anapha / Durudhura / Kemadruma', () => {
  it('Sunapha: Mars in Taurus, Moon in Aries', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1,
      Sun: 6, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Sunapha')).toBeDefined();
  });

  it('Sunapha: empty 2nd from Moon → no match', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0,
      Sun: 6, Mars: 4, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 9,
    });
    expect(find(computeYogas(chart), 'Sunapha')).toBeUndefined();
  });

  it('Anapha: Mercury in Pisces, Moon in Aries (12th from Moon)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mercury: 11,
      Sun: 6, Mars: 4, Jupiter: 8, Venus: 7, Saturn: 5,
    });
    expect(find(computeYogas(chart), 'Anapha')).toBeDefined();
  });

  it('Durudhura: planets in BOTH 2nd and 12th from Moon', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1, Mercury: 11,
      Sun: 6, Jupiter: 8, Venus: 7, Saturn: 5,
    });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Sunapha')).toBeDefined();
    expect(find(yogas, 'Anapha')).toBeDefined();
    expect(find(yogas, 'Durudhura')).toBeDefined();
  });

  it('Kemadruma: Moon isolated (no planet in 2/12, none conjunct)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0,
      Sun: 3, Mars: 4, Mercury: 5, Jupiter: 6, Venus: 7, Saturn: 8,
    });
    expect(find(computeYogas(chart), 'Kemadruma')).toBeDefined();
  });

  it('Kemadruma: broken when Sunapha/Anapha/Durudhura is present', () => {
    const chart = synthChart({
      lagnaRashi: 0, Moon: 0, Mars: 1,
      Sun: 6, Mercury: 5, Jupiter: 8, Venus: 7, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Kemadruma')).toBeUndefined();
  });
});

describe('Budha-Aditya / Veshi / Vasi / Ubhayachari', () => {
  it('Budha-Aditya: Sun + Mercury same rashi', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 5, Mercury: 5 });
    expect(find(computeYogas(chart), 'Budha-Aditya')).toBeDefined();
  });

  it('Budha-Aditya: Sun and Mercury in adjacent rashis → no match', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 5, Mercury: 6 });
    expect(find(computeYogas(chart), 'Budha-Aditya')).toBeUndefined();
  });

  it('Veshi: Mars in 2nd from Sun (Moon excluded)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Mars: 1, Moon: 6,
      Mercury: 7, Jupiter: 8, Venus: 9, Saturn: 4,
    });
    expect(find(computeYogas(chart), 'Veshi')).toBeDefined();
  });

  it('Vasi: Saturn in 12th from Sun', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Saturn: 11, Moon: 6,
      Mars: 7, Mercury: 8, Jupiter: 5, Venus: 4,
    });
    expect(find(computeYogas(chart), 'Vasi')).toBeDefined();
  });

  it('Ubhayachari: planets in BOTH 2nd and 12th from Sun', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 0, Mars: 1, Saturn: 11,
      Moon: 6, Mercury: 5, Jupiter: 8, Venus: 7,
    });
    expect(find(computeYogas(chart), 'Ubhayachari')).toBeDefined();
  });
});

describe('Raja Yoga (kendra-lord conjunct/aspecting trikona-lord)', () => {
  it('Aries lagna: Mars (kendra-lord 1) and Sun (trikona-lord 5) conjunct', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mars: 5, Sun: 5,
      Moon: 6, Mercury: 7, Jupiter: 8, Venus: 9, Saturn: 4,
    });
    const m = find(computeYogas(chart), 'Raja Yoga');
    expect(m).toBeDefined();
  });

  it('Pisces lagna: kendra/trikona lords mutually isolated → no Raja Yoga', () => {
    // No pair of these lords shares a rashi or forms a mutual aspect, and Sun,
    // Venus and Saturn lord neither a kendra nor a trikona for Pisces.
    const chart = synthChart({
      lagnaRashi: 11,
      Jupiter: 11,
      Mars: 0,
      Mercury: 1,
      Moon: 4,
      Sun: 6,
      Venus: 7,
      Saturn: 8,
    });
    expect(find(computeYogas(chart), 'Raja Yoga')).toBeUndefined();
  });
});

describe('Dharma-Karmadhipati (9th + 10th lord conjunct)', () => {
  it('Aries lagna: Jupiter (9th) + Saturn (10th) conjunct', () => {
    const chart = synthChart({
      lagnaRashi: 0, Jupiter: 9, Saturn: 9,
      Sun: 0, Moon: 1, Mars: 2, Mercury: 3, Venus: 4,
    });
    expect(find(computeYogas(chart), 'Dharma-Karmadhipati')).toBeDefined();
  });

  it('negative: 9th and 10th lords in different rashis without mutual aspect', () => {
    const chart = synthChart({
      lagnaRashi: 0, Jupiter: 0, Saturn: 1,
      Sun: 5, Moon: 6, Mars: 7, Mercury: 8, Venus: 9,
    });
    expect(find(computeYogas(chart), 'Dharma-Karmadhipati')).toBeUndefined();
  });
});

describe('Vipareeta Raja Yoga', () => {
  it('Aries lagna: 6th/8th/12th lords (Mercury, Mars, Jupiter) all in Scorpio (8th)', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mercury: 7, Mars: 7, Jupiter: 7,
      Sun: 0, Moon: 1, Venus: 2, Saturn: 3,
    });
    expect(find(computeYogas(chart), 'Vipareeta Raja Yoga')).toBeDefined();
  });

  it('negative: lords scattered across rashis', () => {
    const chart = synthChart({
      lagnaRashi: 0, Mercury: 5, Mars: 7, Jupiter: 11,
    });
    expect(find(computeYogas(chart), 'Vipareeta Raja Yoga')).toBeUndefined();
  });
});

describe('Lakshmi Yoga (9th lord + Venus, both own/exalted)', () => {
  it('Aries lagna: Jupiter in Sagittarius (own) + Venus in Taurus (own)', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 8, Venus: 1 });
    expect(find(computeYogas(chart), 'Lakshmi Yoga')).toBeDefined();
  });

  it('negative: Jupiter exalted, Venus debilitated', () => {
    const chart = synthChart({ lagnaRashi: 0, Jupiter: 3, Venus: 5 });
    expect(find(computeYogas(chart), 'Lakshmi Yoga')).toBeUndefined();
  });
});

describe('Dhana Yoga (2-11) and Dhana Yoga (5-9)', () => {
  it('Dhana 2-11: Aries lagna, Venus (2nd lord) + Saturn (11th lord) conjunct', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 4, Saturn: 4 });
    expect(find(computeYogas(chart), 'Dhana Yoga (2-11)')).toBeDefined();
  });

  it('Dhana 5-9: Aries lagna, Sun (5th lord) + Jupiter (9th lord) conjunct', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 7, Jupiter: 7 });
    expect(find(computeYogas(chart), 'Dhana Yoga (5-9)')).toBeDefined();
  });

  it('negative: 2nd and 11th lords in different rashis', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 0, Saturn: 7 });
    expect(find(computeYogas(chart), 'Dhana Yoga (2-11)')).toBeUndefined();
  });
});

describe('Vasumati Yoga', () => {
  // The upachayas are 3, 6, 10 and 11 (Raman §21); the 12th is a vyaya house.
  it('positive: all natural benefics in upachayas (3, 6, 10, 11) from Aries lagna', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      Mercury: 2,
      Moon: 5,
      Jupiter: 9,
      Venus: 10,
      Sun: 4, Mars: 6, Saturn: 7,
    });
    expect(find(computeYogas(chart), 'Vasumati Yoga')).toBeDefined();
  });

  it('positive: two benefics sharing an upachaya still qualifies', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      Mercury: 2,
      Moon: 2,
      Jupiter: 5,
      Venus: 10,
      Sun: 4, Mars: 6, Saturn: 7,
    });
    expect(find(computeYogas(chart), 'Vasumati Yoga')).toBeDefined();
  });

  it('negative: a benefic in the 12th (not an upachaya) breaks the yoga', () => {
    const chart = synthChart({
      lagnaRashi: 0,
      Mercury: 2,
      Moon: 5,
      Venus: 10,
      Jupiter: 11,
      Sun: 4, Mars: 6, Saturn: 7,
    });
    expect(find(computeYogas(chart), 'Vasumati Yoga')).toBeUndefined();
  });
});

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
    const f = (fixtures as { charts: { name: string; dateLocal: string; tzh: number; lat: number; lon: number }[] })
      .charts.find((c) => c.name === 'Narendra Modi')!;
    const utc = localToUtc(f.dateLocal, f.tzh);
    const loc = { latitude: f.lat, longitude: f.lon };
    const d1 = computeRashiChart(utc, loc);
    const d9 = computeNavamsa(utc, loc);
    const yogas = computeYogas(d1, { navamsa: d9 });
    expect(Array.isArray(yogas)).toBe(true);
  });
});

describe('Neecha Bhanga (cancellation)', () => {
  it('Rule A: debilitated Sun in Libra, Venus (dispositor) in kendra', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 6, Venus: 9 });
    const yogas = computeYogas(chart);
    expect(find(yogas, 'Neecha Bhanga')).toBeDefined();
  });

  it('negative: Sun debilitated, no rule fires from Lagna OR Moon, no exalted helper', () => {
    const chart = synthChart({
      lagnaRashi: 0, Sun: 6, Venus: 2, Mars: 1,
      Jupiter: 0, Saturn: 8, Mercury: 0, Moon: 0,
    });
    expect(find(computeYogas(chart), 'Neecha Bhanga')).toBeUndefined();
  });
});

describe('Neecha Bhanga: Moon-kendra extension (Phase 34c)', () => {
  it('Rule A from Moon: dispositor kendra from Moon only (not from Lagna)', () => {
    const chart = synthChart({
      lagnaRashi: 11, Sun: 6, Moon: 0, Venus: 0, Mars: 1,
      Mercury: 0, Jupiter: 0, Saturn: 0,
    });
    const m = find(computeYogas(chart), 'Neecha Bhanga')!;
    expect(m).toBeDefined();
    expect(m.reasons.some((r) =>
      r.includes('dispositor Venus in kendra from Moon'),
    )).toBe(true);
    expect(m.reasons.some((r) =>
      r.includes('dispositor Venus in kendra from Lagna'),
    )).toBe(false);
  });

  it('Rule B from Moon: exaltation-lord kendra from Moon only (not from Lagna)', () => {
    const chart = synthChart({
      lagnaRashi: 11, Sun: 6, Moon: 0, Mars: 3, Venus: 1,
      Mercury: 0, Jupiter: 0, Saturn: 0,
    });
    const m = find(computeYogas(chart), 'Neecha Bhanga')!;
    expect(m).toBeDefined();
    expect(m.reasons.some((r) =>
      r.includes('lord of exaltation rashi Mars in kendra from Moon'),
    )).toBe(true);
  });

  it('Rule D: dispositor aspects the debilitated planet (no kendra firing)', () => {
    const chart = synthChart({
      lagnaRashi: 11, Sun: 6, Moon: 11, Venus: 0, Mars: 1,
      Mercury: 7, Jupiter: 4, Saturn: 8,
    });
    const m = find(computeYogas(chart), 'Neecha Bhanga')!;
    expect(m).toBeDefined();
    expect(m.reasons.some((r) =>
      r.includes('dispositor Venus aspects Sun'),
    )).toBe(true);
  });

  it('Pre-34c reason format pin: Rule A from Lagna uses "from Lagna" label', () => {
    const chart = synthChart({ lagnaRashi: 0, Sun: 6, Venus: 9, Moon: 0 });
    const m = find(computeYogas(chart), 'Neecha Bhanga')!;
    expect(m.reasons[0]).toContain('dispositor Venus in kendra from Lagna');
  });
});

describe('Daridra Yoga', () => {
  it('Aries lagna: Saturn (11th lord) in 12th house', () => {
    const chart = synthChart({ lagnaRashi: 0, Saturn: 11 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeDefined();
  });

  it('Aries lagna: Venus (2nd lord) in 8th house (Scorpio)', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 7 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeDefined();
  });

  it('negative: 2nd lord and 11th lord in benign houses', () => {
    const chart = synthChart({ lagnaRashi: 0, Venus: 1, Saturn: 9 });
    expect(find(computeYogas(chart), 'Daridra Yoga')).toBeUndefined();
  });
});

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

describe('options.types: filter by yoga type', () => {
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

// Derived from `computeYogas` itself once the catalog was finalized, so these
// are regression detectors, not independent truth. Adding a yoga to the catalog
// must extend each pin.
const FIXTURE_PINS: ReadonlyArray<{ name: string; expected: readonly YogaName[] }> = [
  {
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
    // No Raja Yoga: the kendra/trikona lord pair here is connected by a one-way
    // special aspect only, which is not a classical sambandha.
    expected: [
      'Anapha',
      'Daridra Yoga',
      'Durudhura',
      'Gajakesari',
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

describe('Fixture sweep: pinned yoga sets per chart', () => {
  for (const pin of FIXTURE_PINS) {
    it(`${pin.name}`, () => {
      const { d1, d9 } = fixtureChart(pin.name);
      const yogas = computeYogas(d1, { navamsa: d9 });
      expect(yogaNames(yogas)).toEqual([...pin.expected].sort());
    });
  }
});

describe('computeYogas: overall sanity on every fixture', () => {
  for (const f of FIXTURE_CHARTS.slice(0, 10)) {
    it(`${f.name}: output is a valid Yoga[] (no exception)`, () => {
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
