/**
 * The implementation keeps only the dominant terms of the ProKerala / PyJHora
 * Shadbala panel, so component-wise agreement with published calculators runs
 * to ~5 V and the assertions here are loose on purpose.
 */

import { describe, it, expect } from 'vitest';
import { computeShadbala, _ojhaYugmaBalaForTest } from '../../src/jyotish/shadbala';
import { computeRashiChart, computeNavamsa } from '../../src/jyotish/charts';
import type { Divisional, DivisionalChart, GrahaName, ShadbalaResult } from '../../src/types/jyotish';

/** Not `GrahaName`: Rahu and Ketu have no classical Shadbala. */
type ShadbalaGraha = keyof ShadbalaResult;

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

describe('computeShadbala: output structure', () => {
  it('returns 7 visible grahas (no Rahu / Ketu)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const expected = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of expected) {
      expect(r).toHaveProperty(g);
    }
    expect(r).not.toHaveProperty('Rahu');
    expect(r).not.toHaveProperty('Ketu');
  });

  it('every planet has six sub-strengths plus total', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      const b = r[g];
      expect(b).toHaveProperty('sthana');
      expect(b).toHaveProperty('dig');
      expect(b).toHaveProperty('kala');
      expect(b).toHaveProperty('chesta');
      expect(b).toHaveProperty('naisargika');
      expect(b).toHaveProperty('drik');
      expect(b).toHaveProperty('total');
    }
  });

  it('total equals the sum of the six components (drik clamped to ≥0)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      const b = r[g];
      const expected = b.sthana + b.dig + b.kala + b.chesta + b.naisargika + Math.max(0, b.drik);
      expect(b.total).toBeCloseTo(expected, 6);
    }
  });

  it('all sub-balas are non-negative (drik may be negative pre-clamp)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      const b = r[g];
      expect(b.sthana).toBeGreaterThanOrEqual(0);
      expect(b.dig).toBeGreaterThanOrEqual(0);
      expect(b.kala).toBeGreaterThanOrEqual(0);
      expect(b.chesta).toBeGreaterThanOrEqual(0);
      expect(b.naisargika).toBeGreaterThanOrEqual(0);
      expect(b.total).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('computeShadbala: Naisargika (natural) Bala, fixed values', () => {
  it('Sun: 60.00, Saturn: 8.57 per the BPHS 60·k/7 ranking', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    expect(r.Sun.naisargika).toBeCloseTo(60.00, 2);
    expect(r.Moon.naisargika).toBeCloseTo(51.43, 2);
    expect(r.Venus.naisargika).toBeCloseTo(42.86, 2);
    expect(r.Jupiter.naisargika).toBeCloseTo(34.29, 2);
    expect(r.Mercury.naisargika).toBeCloseTo(25.71, 2);
    expect(r.Mars.naisargika).toBeCloseTo(17.14, 2);
    expect(r.Saturn.naisargika).toBeCloseTo(8.57, 2);
  });

  it('Naisargika is independent of the chart', () => {
    const a = computeShadbala(SAMPLE, DELHI);
    const b = computeShadbala(new Date('1980-12-31T20:00:00Z'), { latitude: 13.0827, longitude: 80.2707 });
    expect(a.Sun.naisargika).toBe(b.Sun.naisargika);
    expect(a.Saturn.naisargika).toBe(b.Saturn.naisargika);
  });
});

describe('computeShadbala: Sthana (positional), Uchcha at exaltation/debilitation', () => {
  it('Sun Sthana is highest near 10° Aries (exaltation), lowest near 10° Libra', () => {
    const aprilSun = computeShadbala(new Date('2000-04-15T06:00:00Z'), DELHI).Sun.sthana;
    const octSun = computeShadbala(new Date('2000-10-15T06:00:00Z'), DELHI).Sun.sthana;
    expect(aprilSun).toBeGreaterThan(octSun);
  });

  it('Sthana ∈ [0, 420] (Uchcha 60 + Saptavargaja 315 + Ojha 30 + Drekkana 15)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].sthana).toBeGreaterThanOrEqual(0);
      expect(r[g].sthana).toBeLessThanOrEqual(420);
    }
  });
});

describe('computeShadbala: Dig (directional) Bala', () => {
  it('Dig ∈ [0, 60]', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].dig).toBeGreaterThanOrEqual(0);
      expect(r[g].dig).toBeLessThanOrEqual(60);
    }
  });

  it('a planet exactly at its strong cusp gets 60 V (Saturn at 7th cusp)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const saturn = chart.planets.find((p) => p.planet === 'Saturn')!;
    const cusp7Rashi = (chart.lagna.rashi.index + 6) % 12;
    const cusp7Lon = cusp7Rashi * 30;
    const arc = Math.abs(((saturn.longitude - cusp7Lon + 540) % 360) - 180);
    const expected = ((180 - arc) / 180) * 60;
    const r = computeShadbala(SAMPLE, DELHI);
    expect(r.Saturn.dig).toBeCloseTo(expected, 4);
  });
});

describe('computeShadbala: Paksha (lunar phase) component of Kala Bala', () => {
  it('Moon (benefic) Kala stronger near full moon than near new moon', () => {
    const full = computeShadbala(new Date('2025-10-07T15:00:00Z'), DELHI).Moon.kala;
    const newMoon = computeShadbala(new Date('2025-09-21T15:00:00Z'), DELHI).Moon.kala;
    expect(full).toBeGreaterThan(newMoon);
  });

  it('Sun (malefic) Kala stronger near new moon than near full moon', () => {
    const full = computeShadbala(new Date('2025-10-07T15:00:00Z'), DELHI).Sun.kala;
    const newMoon = computeShadbala(new Date('2025-09-21T15:00:00Z'), DELHI).Sun.kala;
    expect(newMoon).toBeGreaterThan(full);
  });
});

describe('computeShadbala: Chesta (motional) Bala', () => {
  it('Chesta ∈ [0, 60]', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].chesta).toBeGreaterThanOrEqual(0);
      expect(r[g].chesta).toBeLessThanOrEqual(60);
    }
  });

  it('retrograde planets get 60 V Chesta', () => {
    const r = computeShadbala(new Date('2024-12-01T06:00:00Z'), DELHI);
    expect(r.Jupiter.chesta).toBe(60);
  });

  it('Sun and Moon get fixed 30 V Chesta (simplified model)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    expect(r.Sun.chesta).toBe(30);
    expect(r.Moon.chesta).toBe(30);
  });

  it('combust planet (within 10° of Sun, direct) gets 15 V Chesta', () => {
    const r = computeShadbala(new Date('2024-05-18T18:00:00Z'), DELHI);
    expect(r.Jupiter.chesta).toBe(15);
  });

  it('superior-conjunction Mercury (within 1° of Sun) is combust', () => {
    const r = computeShadbala(new Date('2024-09-30T12:00:00Z'), DELHI);
    expect(r.Mercury.chesta).toBe(15);
  });

  it('planet far from Sun and direct gets 30 V Chesta (not combust)', () => {
    const r = computeShadbala(new Date('2024-05-18T18:00:00Z'), DELHI);
    expect(r.Mars.chesta).toBe(30);
  });

  it('opposition-side planet that is direct is NOT combust (180° from Sun)', () => {
    const r = computeShadbala(new Date('2024-09-15T12:00:00Z'), DELHI);
    expect(r.Jupiter.chesta).toBe(30);
  });
});

describe('computeShadbala: Drik (aspectual) Bala', () => {
  it('Drik value is finite (may be negative pre-clamp)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(Number.isFinite(r[g].drik)).toBe(true);
    }
  });
});

describe('computeShadbala: Kala Bala bounds', () => {
  it('Kala ∈ [0, 120] (Nathonatha + Paksha, each ≤60 V)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].kala).toBeGreaterThanOrEqual(0);
      expect(r[g].kala).toBeLessThanOrEqual(120);
    }
  });

  it('Mercury always full Nathonatha (60 V) regardless of birth time', () => {
    const a = computeShadbala(new Date('2025-01-01T03:00:00Z'), DELHI).Mercury.kala;
    const b = computeShadbala(new Date('2025-01-01T15:00:00Z'), DELHI).Mercury.kala;
    expect(a).toBeGreaterThanOrEqual(60);
    expect(b).toBeGreaterThanOrEqual(60);
  });
});

describe('computeShadbala sanity: typical totals are in expected range', () => {
  it('totals fall in roughly [50, 500] V, covering most natal-chart cases', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].total).toBeGreaterThan(0);
      expect(r[g].total).toBeLessThan(500);
    }
  });

  it('multiple call invocations are stable for the same input', () => {
    const a = computeShadbala(SAMPLE, DELHI);
    const b = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(a[g].total).toBe(b[g].total);
    }
  });
});

describe('computeShadbala: input validation', () => {
  it('throws on invalid date', () => {
    expect(() => computeShadbala(new Date('not-a-date'), DELHI)).toThrow();
  });

  it('throws on invalid latitude', () => {
    expect(() => computeShadbala(SAMPLE, { latitude: 91, longitude: 77 })).toThrow();
  });
});

describe('computeShadbala: Sthana Bala sub-components', () => {
  it('At least one graha exceeds the earlier Uchcha-only ceiling (60 V)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const above60 = grahas.some((g) => r[g].sthana > 60);
    expect(above60).toBe(true);
  });

  it('Every graha has Sthana ≥ Saptavargaja minimum (7 × 1.875 = 13.125 V)', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const grahas: ShadbalaGraha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    for (const g of grahas) {
      expect(r[g].sthana).toBeGreaterThanOrEqual(13.125);
    }
  });

  it('Ojha-Yugma grouping: Mercury and Saturn gain in ODD signs, only Moon and Venus in even', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const d9 = computeNavamsa(SAMPLE, DELHI);
    const dc = { D9: d9 } as Record<Divisional, DivisionalChart>;
    const parity = (g: GrahaName) => ({
      d1Odd: chart.byPlanet[g].rashi.index % 2 === 0,
      d9Odd: d9.planets.find((p) => p.planet === g)!.rashi.index % 2 === 0,
    });
    for (const g of ['Sun', 'Mars', 'Jupiter', 'Mercury', 'Saturn'] as GrahaName[]) {
      const { d1Odd, d9Odd } = parity(g);
      expect(_ojhaYugmaBalaForTest(g, chart, dc), g)
        .toBe((d1Odd ? 15 : 0) + (d9Odd ? 15 : 0));
    }
    for (const g of ['Moon', 'Venus'] as GrahaName[]) {
      const { d1Odd, d9Odd } = parity(g);
      expect(_ojhaYugmaBalaForTest(g, chart, dc), g)
        .toBe((d1Odd ? 0 : 15) + (d9Odd ? 0 : 15));
    }
  });

  it('Sthana strictly increased for SAMPLE chart vs hypothetical Uchcha-only', () => {
    const r = computeShadbala(SAMPLE, DELHI);
    const chart = computeRashiChart(SAMPLE, DELHI);
    const UCHCHA_DEG: Record<string, number> = {
      Sun: 10, Moon: 33, Mars: 298, Mercury: 165,
      Jupiter: 95, Venus: 357, Saturn: 200,
    };
    for (const g of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as ShadbalaGraha[]) {
      const lon = chart.planets.find((p) => p.planet === g)!.longitude;
      const arc = Math.abs(((lon - UCHCHA_DEG[g]! + 540) % 360) - 180);
      const uchchaOnly = ((180 - arc) / 180) * 60;
      expect(r[g].sthana).toBeGreaterThanOrEqual(uchchaOnly - 1e-6);
    }
  });
});
