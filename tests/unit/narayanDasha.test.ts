/**
 * Unit tests for `computeNarayanDasha` (Step 33-2, Jaimini sign-dasha
 * with padi-based direction).
 *
 * Strategy:
 *   1. Per-rashi direction pin (12 lagnas → forward / backward).
 *   2. Forward sequence: 12-element zodiacal walk from lagna rashi.
 *   3. Backward sequence: 12-element anti-zodiacal walk from lagna.
 *   4. Years per rashi match Chara (movable 9 / fixed 8 / dual 7).
 *   5. Total span ~96 years; mahadashas contiguous.
 *   6. Lord assignment matches sign-lordship.
 *   7. Real-chart fixture sweep.
 */

import { describe, it, expect } from 'vitest';
import {
  computeNarayanDasha,
  VISHAMA_PADA_RASHIS, SAMA_PADA_RASHIS,
  CHARA_RASHI_YEARS,
} from '../../src/jyotish/dasha';
import { computeLagna } from '../../src/jyotish/lagna';
import fixtures from '../fixtures/astrosage-charts.json';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
] as const;

describe('Narayan Dasha — vishama / sama-pada classification', () => {
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

describe('Narayan Dasha — direction by lagna rashi', () => {
  // Synthesize a lagna at a given rashi by picking a birthDate/location
  // that yields it. Fall back: assert direction matches the lagna's
  // parity-class as computed by `computeLagna`. We sweep across the
  // existing fixtures (which span many lagnas) and one synthetic chart.
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

describe('Narayan Dasha — output structure', () => {
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

describe('Narayan Dasha — direction sequence pinning', () => {
  // We use the synthetic-chart approach: build a fake lagna at a chosen
  // rashi by picking a birthDate that yields it. Easier: just observe
  // the result and assert the cycle pattern matches the parity rule.

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

  // Force-coverage: test both directions by picking a couple of dates
  // whose lagnas land in opposite parity classes. The first SAMPLE
  // chart hits one; we sweep fixtures to find the other.
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
    // Find a backward-direction fixture
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

describe('Narayan Dasha — input validation', () => {
  it('throws on invalid latitude', () => {
    expect(() => computeNarayanDasha(SAMPLE, { latitude: 91, longitude: 77 })).toThrow();
  });
});

describe('Narayan Dasha — fixture sweep', () => {
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
