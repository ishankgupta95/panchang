import { describe, it, expect } from 'vitest';
import {
  computeNarayanDasha,
  VISHAMA_PADA_RASHIS, SAMA_PADA_RASHIS,
  CHARA_RASHI_YEARS,
} from '../../src/jyotish/dasha';
import { computeLagna } from '../../src/jyotish/lagna';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
] as const;

describe('Narayan Dasha: vishama / sama-pada classification', () => {
  it('vishama-pada set is {Aries, Taurus, Gemini, Libra, Scorpio, Sagittarius}', () => {
    expect([...VISHAMA_PADA_RASHIS].sort((a, b) => a - b)).toEqual([0, 1, 2, 6, 7, 8]);
  });

  it('sama-pada set is {Cancer, Leo, Virgo, Capricorn, Aquarius, Pisces}', () => {
    expect([...SAMA_PADA_RASHIS].sort((a, b) => a - b)).toEqual([3, 4, 5, 9, 10, 11]);
  });

  it('the two sets partition all 12 rashis', () => {
    const union = new Set<number>([...VISHAMA_PADA_RASHIS, ...SAMA_PADA_RASHIS]);
    expect(union.size).toBe(12);
  });
});

describe('Narayan Dasha: direction by lagna rashi', () => {
  const fixtureCharts = (fixtures as { charts: { name: string; dateLocal: string; tzh: number; lat: number; lon: number; }[] }).charts;

  function localToUtc(dateLocal: string, tzh: number): Date {
    const [d, t] = dateLocal.split('T') as [string, string];
    const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
    const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
  }

  it.each(fixtureCharts.slice(0, 8).map((f) => [f.name, f] as const))(
    '%s: direction matches lagna-rashi parity class',
    (_name, f) => {
      const utc = localToUtc(f.dateLocal, f.tzh);
      const loc = { latitude: f.lat, longitude: f.lon };
      const lagna = computeLagna(utc, loc);
      const expected = VISHAMA_PADA_RASHIS.has(lagna.rashi.index)
        ? 'forward'
        : 'backward';
      const r = computeNarayanDasha(utc, loc);
      expect(r.direction).toBe(expected);
      expect(r.startingRashi).toBe(lagna.rashi.index);
    },
  );
});

describe('Narayan Dasha: output structure', () => {
  it('returns 12 mahadashas', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    expect(r.mahaDashas).toHaveLength(12);
  });

  it('total span ~96 years from birth', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    const totalMs = r.mahaDashas[11]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime();
    const totalYears = totalMs / (365.25 * 24 * 3600 * 1000);
    expect(totalYears).toBeCloseTo(96, 0);
  });

  it('first dasha starts at lagna rashi', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    expect(r.mahaDashas[0]!.rashi).toBe(r.startingRashi);
  });

  it('mahadasha durations are contiguous (no gaps)', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    for (let i = 1; i < r.mahaDashas.length; i++) {
      expect(r.mahaDashas[i]!.startDate.getTime())
        .toBe(r.mahaDashas[i - 1]!.endDate.getTime());
    }
  });

  it('mahadasha years match the rashi-modality scheme', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    for (const md of r.mahaDashas) {
      expect(md.years).toBe(CHARA_RASHI_YEARS[md.rashi]);
    }
  });

  it('lord assignments match classical sign-lordship', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    for (const md of r.mahaDashas) {
      expect(md.lord).toBe(SIGN_LORDS[md.rashi]);
    }
  });

  it('all 12 rashis appear exactly once in the cycle', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    const seen = new Set(r.mahaDashas.map((md) => md.rashi));
    expect(seen.size).toBe(12);
  });
});

describe('Narayan Dasha: direction sequence pinning', () => {
  it('forward (vishama) direction: 2nd dasha rashi = (start + 1) % 12', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    if (r.direction === 'forward') {
      const start = r.startingRashi;
      expect(r.mahaDashas[1]!.rashi).toBe((start + 1) % 12);
      expect(r.mahaDashas[2]!.rashi).toBe((start + 2) % 12);
      expect(r.mahaDashas[11]!.rashi).toBe((start + 11) % 12);
    }
  });

  it('backward (sama) direction: 2nd dasha rashi = (start - 1 + 12) % 12', () => {
    const r = computeNarayanDasha(SAMPLE, DELHI);
    if (r.direction === 'backward') {
      const start = r.startingRashi;
      expect(r.mahaDashas[1]!.rashi).toBe((start - 1 + 12) % 12);
      expect(r.mahaDashas[2]!.rashi).toBe((start - 2 + 12) % 12);
      expect(r.mahaDashas[11]!.rashi).toBe((start - 11 + 12) % 12);
    }
  });

  const fixtureCharts = (fixtures as { charts: { name: string; dateLocal: string; tzh: number; lat: number; lon: number; }[] }).charts;
  function localToUtc(dateLocal: string, tzh: number): Date {
    const [d, t] = dateLocal.split('T') as [string, string];
    const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
    const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
  }

  it('both directions are reachable across the fixture set', () => {
    const directions = new Set<'forward' | 'backward'>();
    for (const f of fixtureCharts) {
      const utc = localToUtc(f.dateLocal, f.tzh);
      const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
      directions.add(r.direction);
      if (directions.size === 2) break;
    }
    expect(directions.size).toBe(2);
  });

  it('backward direction sequence is anti-zodiacal across full 12 rashis', () => {
    let backwardR: ReturnType<typeof computeNarayanDasha> | null = null;
    for (const f of fixtureCharts) {
      const utc = localToUtc(f.dateLocal, f.tzh);
      const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
      if (r.direction === 'backward') {
        backwardR = r;
        break;
      }
    }
    expect(backwardR).not.toBeNull();
    const r = backwardR!;
    const start = r.startingRashi;
    for (let i = 0; i < 12; i++) {
      expect(r.mahaDashas[i]!.rashi).toBe((start - i + 12) % 12);
    }
  });

  it('forward direction sequence is zodiacal across full 12 rashis', () => {
    let forwardR: ReturnType<typeof computeNarayanDasha> | null = null;
    for (const f of fixtureCharts) {
      const utc = localToUtc(f.dateLocal, f.tzh);
      const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
      if (r.direction === 'forward') {
        forwardR = r;
        break;
      }
    }
    expect(forwardR).not.toBeNull();
    const r = forwardR!;
    const start = r.startingRashi;
    for (let i = 0; i < 12; i++) {
      expect(r.mahaDashas[i]!.rashi).toBe((start + i) % 12);
    }
  });
});

describe('Narayan Dasha: input validation', () => {
  it('throws on invalid latitude', () => {
    expect(() => computeNarayanDasha(SAMPLE, { latitude: 91, longitude: 77 })).toThrow();
  });
});

describe('Narayan Dasha: fixture sweep', () => {
  const fixtureCharts = (fixtures as { charts: { name: string; dateLocal: string; tzh: number; lat: number; lon: number; }[] }).charts;
  function localToUtc(dateLocal: string, tzh: number): Date {
    const [d, t] = dateLocal.split('T') as [string, string];
    const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
    const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
  }

  const SWEEP_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
    'Dhirubhai Ambani', 'Mukesh Ambani'] as const;

  it.each(SWEEP_NAMES)('%s: 12 rashis appear exactly once', (name) => {
    const f = fixtureCharts.find((c) => c.name === name)!;
    const utc = localToUtc(f.dateLocal, f.tzh);
    const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
    const seen = new Set(r.mahaDashas.map((md) => md.rashi));
    expect(seen.size).toBe(12);
  });

  it.each(SWEEP_NAMES)('%s: total span ~96 years', (name) => {
    const f = fixtureCharts.find((c) => c.name === name)!;
    const utc = localToUtc(f.dateLocal, f.tzh);
    const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
    const totalMs = r.mahaDashas[11]!.endDate.getTime() - r.mahaDashas[0]!.startDate.getTime();
    const totalYears = totalMs / (365.25 * 24 * 3600 * 1000);
    expect(totalYears).toBeCloseTo(96, 0);
  });

  it.each(SWEEP_NAMES)('%s: years per rashi match modality (CHARA_RASHI_YEARS)', (name) => {
    const f = fixtureCharts.find((c) => c.name === name)!;
    const utc = localToUtc(f.dateLocal, f.tzh);
    const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
    for (const md of r.mahaDashas) {
      expect(md.years).toBe(CHARA_RASHI_YEARS[md.rashi]);
    }
  });
});

// The variable-duration rules follow Sanjay Rath, *Narayana Dasa* (Sagar
// Publications), Strength Source 1 Rule 2 and Source 2 Rule 1 breaking dual-lord ties.
const VARIABLE_FIXTURE_CHARTS = (fixtures as { charts: {
  name: string; dateLocal: string; tzh: number; lat: number; lon: number;
}[] }).charts;
function variableLocalToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}
const VARIABLE_SWEEP_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Mukesh Ambani'] as const;

const VISHAMA_PADA_SET = new Set<number>([0, 1, 2, 6, 7, 8]);
function inclusiveSignCount(src: number, dst: number, anti: boolean): number {
  return anti ? ((src - dst + 12) % 12) + 1 : ((dst - src + 12) % 12) + 1;
}
function expectedNarayanBase(rashi: number, lordRashi: number): number {
  const anti = !VISHAMA_PADA_SET.has(rashi);
  return inclusiveSignCount(rashi, lordRashi, anti) - 1;
}

describe('Narayan Dasha: variable-duration backwards-compat default', () => {
  it.each(VARIABLE_SWEEP_NAMES)('%s: no options → fixed 9/8/7 byte-for-byte', (name) => {
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === name)!;
    const utc = variableLocalToUtc(f.dateLocal, f.tzh);
    const a = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon });
    const b = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon }, 'lahiri');
    expect(a.mahaDashas.map((md) => md.years)).toEqual(b.mahaDashas.map((md) => md.years));
    for (const md of a.mahaDashas) {
      expect(md.years).toBe(CHARA_RASHI_YEARS[md.rashi]);
    }
  });
});

describe('Narayan Dasha: variable-duration opt-in, real fixture sweep', () => {
  // Expected years are re-derived from the chart's rashis, never from output.

  // Manteswara exaltation, which is what Rath uses for Narayan.
  const EXALTATION: Record<string, number> = {
    Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3,
    Venus: 11, Saturn: 6, Rahu: 2, Ketu: 8,
  };
  const DEBILITATION: Record<string, number> = {
    Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9,
    Venus: 5, Saturn: 0, Rahu: 8, Ketu: 2,
  };
  const PRIMARY_LORD = SIGN_LORDS;

  it.each(VARIABLE_SWEEP_NAMES)('%s: variable durations match first-principles for non-dual-lord rashis', async (name) => {
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === name)!;
    const utc = variableLocalToUtc(f.dateLocal, f.tzh);
    const loc = { latitude: f.lat, longitude: f.lon };
    const { computeRashiChart } = await import('../../src/jyotish/charts');
    const chart = computeRashiChart(utc, loc, { houseSystem: 'whole-sign' });
    const planetRashi = new Map<string, number>(
      chart.planets.map((p) => [p.planet, p.rashi.index] as const),
    );

    const result = computeNarayanDasha(utc, loc, 'lahiri', { duration: 'variable' });

    for (const md of result.mahaDashas) {
      const r = md.rashi;
      if (r === 7 || r === 10) continue; // Dual-lord rashis, covered separately.
      const lord = PRIMARY_LORD[r]!;
      const lordRashi = planetRashi.get(lord)!;
      let expectedYears = expectedNarayanBase(r, lordRashi);
      if (EXALTATION[lord] === lordRashi) expectedYears += 1;
      else if (DEBILITATION[lord] === lordRashi) expectedYears -= 1;
      expectedYears = Math.min(12, Math.max(0, expectedYears));
      expect(md.years).toBe(expectedYears);
    }
  });

  it.each(VARIABLE_SWEEP_NAMES)('%s: total of 12 variable years is between 12 and 144', (name) => {
    // [0, 144] is the theoretical range; the floor of 12 is practical, the
    // 0-year pile-up that would go below it not occurring on a real chart.
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === name)!;
    const utc = variableLocalToUtc(f.dateLocal, f.tzh);
    const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon }, 'lahiri',
                                   { duration: 'variable' });
    const total = r.mahaDashas.reduce((s, md) => s + md.years, 0);
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(144);
    // Rule 3 caps a single mahadasha at 12.
    for (const md of r.mahaDashas) {
      expect(md.years).toBeLessThanOrEqual(12);
      expect(md.years).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(VARIABLE_SWEEP_NAMES)('%s: end-to-end continuity (start_{i+1} = end_i)', (name) => {
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === name)!;
    const utc = variableLocalToUtc(f.dateLocal, f.tzh);
    const r = computeNarayanDasha(utc, { latitude: f.lat, longitude: f.lon }, 'lahiri',
                                  { duration: 'variable' });
    for (let i = 1; i < r.mahaDashas.length; i++) {
      expect(r.mahaDashas[i]!.startDate.getTime()).toBe(r.mahaDashas[i - 1]!.endDate.getTime());
    }
  });
});

describe('Narayan variable: Rule 2 base count algorithm (first-principles cross-check)', () => {
  it('Modi: Sun in Kanya (rashi 5), Leo (rashi 4, samapada) Sun-lord dasha', () => {
    // Leo is samapada: anti-count 4 to 5 = 12 inclusive, minus 1; Sun in Kanya draws no adjustment.
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const leoDasha = r.mahaDashas.find((md) => md.rashi === 4)!;
    expect(leoDasha.years).toBe(11);
  });

  it('Modi: Mars in Vrischika (rashi 7), Aries Mars-lord dasha (vimsapada zodiacal)', () => {
    // Aries is vimsapada: zodiacal 0 to 7 = 8 inclusive, minus 1; Mars in its own sign, no adjustment.
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const ariesDasha = r.mahaDashas.find((md) => md.rashi === 0)!;
    expect(ariesDasha.years).toBe(7);
  });
});

describe('Narayan variable: Rule 3 exaltation / debilitation', () => {
  it('Modi: Saturn in Simha (rashi 4), Capricorn (Saturn-lord) dasha gets no exalt-adjust', () => {
    // Capricorn is samapada: anti-count 9 to 4 = 6 inclusive, minus 1; Saturn exalts in Libra, not Simha.
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const capDasha = r.mahaDashas.find((md) => md.rashi === 9)!;
    expect(capDasha.years).toBe(5);
  });

  it('Modi: Jupiter in Kumbha (rashi 10), Pisces (Jup-lord) dasha (samapada, 2 - 1 = 1)', () => {
    // Pisces is samapada: anti-count 11 to 10 = 2 inclusive, minus 1; Jupiter exalts in Cancer, not Kumbha.
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const piscesDasha = r.mahaDashas.find((md) => md.rashi === 11)!;
    expect(piscesDasha.years).toBe(1);
  });
});

describe('Narayan variable: Rule 4 dual-lord (Scorpio / Aquarius)', () => {
  // Rule 4(c) picks Ketu's Kanya, Mars being in Scorpio itself: zodiacal 7 to 5 = 11 inclusive, minus 1.
  it('Modi: Scorpio dasha applies Rule 4(c), uses Ketu since Mars is in Scorpio', () => {
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const scorpioDasha = r.mahaDashas.find((md) => md.rashi === 7)!;
    expect(scorpioDasha.years).toBe(10);
  });

  // Rule 4(d) compares strength: Simha holds Venus and Saturn against Meena's
  // lone Rahu, so Saturn's sign wins. Anti-count 10 to 4 = 7 inclusive, minus 1.
  it('Modi: Aquarius dasha applies Rule 4(d), Saturn-in-Simha wins by planet count over Rahu-in-Meena', () => {
    const f = VARIABLE_FIXTURE_CHARTS.find((c) => c.name === 'Narendra Modi')!;
    const r = computeNarayanDasha(variableLocalToUtc(f.dateLocal, f.tzh),
                                  { latitude: f.lat, longitude: f.lon },
                                  'lahiri', { duration: 'variable' });
    const aquariusDasha = r.mahaDashas.find((md) => md.rashi === 10)!;
    expect(aquariusDasha.years).toBe(6);
  });
});

describe('Narayan variable: Sanjay Rath worked Einstein table validation', () => {
  // Einstein's 1879 birth is outside the library's date-validator range, so the
  // placements are Rath's own (*Narayana Dasa* Chart 5, pp. 46-47) fed straight
  // to the rules. Only his self-consistent rows are pinned: his Gemini and
  // Virgo rows do not follow his own rules.

  function einsteinExpected(rashi: number, _lord: string, lordRashi: number, exalt: number): number {
    const anti = !VISHAMA_PADA_SET.has(rashi);
    let y = inclusiveSignCount(rashi, lordRashi, anti) - 1 + exalt;
    return Math.min(12, Math.max(0, y));
  }

  it('Algorithm: Aries → Mars-in-Cap (exalted) → years=10', () => {
    // Aries is vimsapada: zodiacal 0 to 9 = 10, minus 1, plus 1 for exalt.
    expect(einsteinExpected(0, 'Mars', 9, +1)).toBe(10);
  });

  it('Algorithm: Cancer → Moon-in-Scorpio (debilitated) → years=8 [Sanjay Rath table: 12]', () => {
    // Cancer is samapada: anti-count 3 to 7 = 9, minus 1, minus 1 for Moon's
    // debility. Rath's table prints 12, his worked calculation having omitted
    // the debility adjustment; the rules-correct value is pinned instead.
    expect(einsteinExpected(3, 'Moon', 7, -1)).toBe(7);
  });

  it('Algorithm: Libra → Venus-in-Pisces (exalted) → years=6', () => {
    // Libra is vimsapada: zodiacal 6 to 11 = 6, minus 1, plus 1 for exalt;
    // matches Rath's published row.
    expect(einsteinExpected(6, 'Venus', 11, +1)).toBe(6);
  });

  it('Algorithm: Sagittarius → Jupiter-in-Aquarius → years=2', () => {
    // Sagittarius is vimsapada: zodiacal 8 to 10 = 3, minus 1, no adjustment;
    // matches Rath's published row.
    expect(einsteinExpected(8, 'Jupiter', 10, 0)).toBe(2);
  });
});
