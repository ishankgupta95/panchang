import { describe, it, expect } from 'vitest';
import {
  computeKpSubLord, computeKpCuspalSubLords, computeKpSignificators,
  _SUB_CUMULATIVE_WIDTHS_FOR_TEST as SUB_CUMS,
} from '../../src/jyotish/kpSubLord';
import { computeRashiChart } from '../../src/jyotish/charts';
import { computeLagna } from '../../src/jyotish/lagna';
import {
  DASHA_ORDER, DASHA_YEARS, NAKSHATRA_LORD,
} from '../../src/jyotish/dasha';
import { NAKSHATRA_SPAN } from '../../src/utils/constants';
import type { GrahaName } from '../../src/types/jyotish';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const ALL_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
];

describe('KP sub-divisions: width table invariants', () => {
  it('9 cumulative widths exposed', () => {
    expect(SUB_CUMS).toHaveLength(9);
  });

  it('cumulative widths are monotonically increasing', () => {
    for (let i = 1; i < 9; i++) {
      expect(SUB_CUMS[i]!).toBeGreaterThan(SUB_CUMS[i - 1]!);
    }
  });

  it('final cumulative width equals NAKSHATRA_SPAN (13°20\')', () => {
    expect(SUB_CUMS[8]!).toBeCloseTo(NAKSHATRA_SPAN, 8);
  });

  it('widths are proportional to Vimshottari dasha years (Ketu=7, Venus=20, Sun=6, …)', () => {
    let prev = 0;
    for (let i = 0; i < 9; i++) {
      const lord = DASHA_ORDER[i]!;
      const expectedWidth = (DASHA_YEARS[lord] / 120) * NAKSHATRA_SPAN;
      const actualWidth = SUB_CUMS[i]! - prev;
      expect(actualWidth).toBeCloseTo(expectedWidth, 8);
      prev = SUB_CUMS[i]!;
    }
  });
});

describe('computeKpSubLord: basic pinning', () => {
  it('longitude 0° (Aries / Ashwini start): sign-lord Mars, star-lord Ketu, sub-lord Ketu', () => {
    const r = computeKpSubLord(0);
    expect(r.rashi).toBe(0);
    expect(r.nakshatra).toBe(0);
    expect(r.signLord).toBe('Mars');
    expect(r.starLord).toBe('Ketu');
    expect(r.subLord).toBe('Ketu');
  });

  it('longitude 30° (Taurus start, Krittika mid): sign-lord Venus, star-lord Sun', () => {
    const r = computeKpSubLord(30);
    expect(r.rashi).toBe(1);
    expect(r.signLord).toBe('Venus');
    expect(r.starLord).toBe('Sun');
  });

  it('longitude 13°20\' (start of Bharani): sub-lord = Venus (Bharani\'s star-lord)', () => {
    const r = computeKpSubLord(NAKSHATRA_SPAN);  // exactly 13°20'
    expect(r.nakshatra).toBe(1);
    expect(r.starLord).toBe('Venus');
    expect(r.subLord).toBe('Venus');
  });

  it('Ketu sub at offset 0 within Ashwini (star-lord Ketu); transitions to Venus after Ketu\'s width', () => {
    const ketuWidth = (DASHA_YEARS.Ketu / 120) * NAKSHATRA_SPAN;
    expect(computeKpSubLord(0).subLord).toBe('Ketu');
    expect(computeKpSubLord(ketuWidth - 0.0001).subLord).toBe('Ketu');
    expect(computeKpSubLord(ketuWidth + 0.0001).subLord).toBe('Venus');
  });

  it('full sub-cycle inside Ashwini follows DASHA_ORDER', () => {
    let cum = 0;
    for (let i = 0; i < 9; i++) {
      const lord = DASHA_ORDER[i]!;
      const width = (DASHA_YEARS[lord] / 120) * NAKSHATRA_SPAN;
      const middle = cum + width / 2;
      expect(computeKpSubLord(middle).subLord).toBe(lord);
      cum += width;
    }
  });
});

describe('computeKpSubLord: sub-cycle wraps inside Bharani (star-lord Venus)', () => {
  const bharaniStart = NAKSHATRA_SPAN;
  const expectedOrder = ['Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter',
    'Saturn', 'Mercury', 'Ketu'];

  it.each(expectedOrder.map((lord, i) => [i, lord] as const))(
    'sub-division %i has lord %s',
    (i, lord) => {
      let cum = 0;
      for (let j = 0; j < i; j++) {
        const l = expectedOrder[j]!;
        cum += (DASHA_YEARS[l as keyof typeof DASHA_YEARS] / 120) * NAKSHATRA_SPAN;
      }
      const width = (DASHA_YEARS[lord as keyof typeof DASHA_YEARS] / 120) * NAKSHATRA_SPAN;
      const longitude = bharaniStart + cum + width / 2;
      expect(computeKpSubLord(longitude).subLord).toBe(lord);
    },
  );
});

describe('computeKpCuspalSubLords', () => {
  const SAMPLE = new Date('1995-08-15T05:30:00Z');
  const DELHI = { latitude: 28.6139, longitude: 77.2090 };

  it('returns 12 cusps in order', () => {
    const r = computeKpCuspalSubLords(SAMPLE, DELHI);
    expect(r.cusps).toHaveLength(12);
  });

  it('cusp 1 (ascendant) longitude matches lagna under Placidus-KP (KP ayanamsa)', () => {
    const r = computeKpCuspalSubLords(SAMPLE, DELHI);
    const lagna = computeLagna(SAMPLE, DELHI, 'krishnamurti');
    expect(r.cusps[0]!.longitude).toBeCloseTo(lagna.siderealLongitude, 4);
  });

  it('every cusp has valid star/sub lords from the 9 KP planets', () => {
    const r = computeKpCuspalSubLords(SAMPLE, DELHI);
    for (const c of r.cusps) {
      expect(DASHA_ORDER).toContain(c.starLord);
      expect(DASHA_ORDER).toContain(c.subLord);
      expect(c.signLord).not.toBe('Rahu');
      expect(c.signLord).not.toBe('Ketu');
    }
  });

  it('forces Placidus-KP regardless of caller-supplied houseSystem', () => {
    const r1 = computeKpCuspalSubLords(SAMPLE, DELHI, { houseSystem: 'whole-sign' });
    const r2 = computeKpCuspalSubLords(SAMPLE, DELHI, { houseSystem: 'placidus-kp' });
    const wholeSignFirstCusp = Math.floor(r2.cusps[0]!.longitude / 30) * 30;
    expect(r1.cusps[0]!.longitude).not.toBeCloseTo(wholeSignFirstCusp, 4);
    for (let i = 0; i < 12; i++) {
      expect(r1.cusps[i]!.longitude).toBeCloseTo(r2.cusps[i]!.longitude, 6);
    }
  });
});

describe('computeKpSignificators', () => {
  const SAMPLE = new Date('1995-08-15T05:30:00Z');
  const DELHI = { latitude: 28.6139, longitude: 77.2090 };

  it('byPlanet has all 9 grahas', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const g of ALL_GRAHAS) {
      expect(sig.byPlanet[g]).toBeDefined();
      expect(Array.isArray(sig.byPlanet[g])).toBe(true);
    }
  });

  it('byHouse covers houses 1..12', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (let h = 1; h <= 12; h++) {
      expect(sig.byHouse[h]).toBeDefined();
      expect(Array.isArray(sig.byHouse[h])).toBe(true);
    }
  });

  it('byPlanet ↔ byHouse round-trip is consistent', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const g of ALL_GRAHAS) {
      for (const h of sig.byPlanet[g]!) {
        expect(sig.byHouse[h]!).toContain(g);
      }
    }
    for (let h = 1; h <= 12; h++) {
      for (const g of sig.byHouse[h]!) {
        expect(sig.byPlanet[g]!).toContain(h);
      }
    }
  });

  it('every planet signifies at least 1 house (rule 1, own house)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const g of ALL_GRAHAS) {
      expect(sig.byPlanet[g]!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('most visible grahas signify ≥3 houses (KP rule of thumb)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    const passing = ALL_GRAHAS.filter((g) => sig.byPlanet[g]!.length >= 3).length;
    expect(passing).toBeGreaterThanOrEqual(5);
  });

  it('Rahu/Ketu signify houses (rule 3 vacuous but rules 1,2,4 still apply)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    expect(sig.byPlanet.Rahu!.length).toBeGreaterThan(0);
    expect(sig.byPlanet.Ketu!.length).toBeGreaterThan(0);
  });

  it('houses are sorted ascending in byPlanet', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const g of ALL_GRAHAS) {
      const houses = sig.byPlanet[g]!;
      for (let i = 1; i < houses.length; i++) {
        expect(houses[i]!).toBeGreaterThan(houses[i - 1]!);
      }
    }
  });

  it('a planet always signifies its own house (rule 1)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const p of chart.planets) {
      expect(sig.byPlanet[p.planet]!).toContain(p.house);
    }
  });

  it('a planet always signifies its star-lord\'s house (rule 2)', () => {
    const chart = computeRashiChart(SAMPLE, DELHI);
    const sig = computeKpSignificators(chart);
    for (const p of chart.planets) {
      const starLord = NAKSHATRA_LORD[Math.floor(p.longitude / NAKSHATRA_SPAN)]!;
      const starLordPlanet = chart.planets.find((x) => x.planet === starLord);
      if (starLordPlanet) {
        expect(sig.byPlanet[p.planet]!).toContain(starLordPlanet.house);
      }
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
const SWEEP_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
  'Dhirubhai Ambani', 'Mukesh Ambani'] as const;

describe('Fixture sweep: KP cuspal sub-lord structural invariants', () => {
  it.each(SWEEP_NAMES)('%s: 12 cusps with valid star/sub/sign lords', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const r = computeKpCuspalSubLords(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    expect(r.cusps).toHaveLength(12);
    for (const c of r.cusps) {
      expect(DASHA_ORDER).toContain(c.starLord);
      expect(DASHA_ORDER).toContain(c.subLord);
    }
  });

  it.each(SWEEP_NAMES)('%s: every planet signifies its own house (rule 1 invariant)', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const chart = computeRashiChart(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const sig = computeKpSignificators(chart);
    for (const p of chart.planets) {
      expect(sig.byPlanet[p.planet]!).toContain(p.house);
    }
  });

  it.each(SWEEP_NAMES)('%s: most planets signify ≥3 houses (KP rule of thumb)', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const chart = computeRashiChart(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const sig = computeKpSignificators(chart);
    const passing = ALL_GRAHAS.filter((g) => sig.byPlanet[g]!.length >= 3).length;
    expect(passing).toBeGreaterThanOrEqual(5);
  });
});
