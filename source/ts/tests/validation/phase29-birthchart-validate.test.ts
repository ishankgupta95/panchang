/**
 * @tier 1  AstroSage R-tier celebrity charts
 *
 * Every `expected` value is from AstroSage's published chart, never from this
 * library. AstroSage publishes D9 only as an image, so the D9 assertions here
 * are internal consistency only.
 */
import { describe, it, expect } from 'vitest';
import {
  computeRashiChart, computeNavamsa, computeLagna, computeBhava,
} from '../../src/index';
import type { GrahaName } from '../../src/types/jyotish';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const RASHI = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
               'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'] as const;

type ExpPlacement = { rashi: string; degree: number; nakshatra?: string };
type Fixture = {
  name: string;
  _source: string;
  dateLocal: string;
  tzh: number;
  lat: number;
  lon: number;
  lagna: ExpPlacement;
  sun: ExpPlacement;
  moon: ExpPlacement;
  mars: ExpPlacement;
  mercury: ExpPlacement;
  jupiter: ExpPlacement;
  venus: ExpPlacement;
  saturn: ExpPlacement;
  rahu: ExpPlacement;
  ketu: ExpPlacement;
};

const CHARTS: Fixture[] = (fixtures as { charts: Fixture[] }).charts;

const LAGNA_DEGREE_TOL = 1.0;
const PLANET_DEGREE_TOL = 0.5;

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

function rashiIndex(name: string): number {
  const i = (RASHI as readonly string[]).indexOf(name);
  if (i < 0) throw new Error(`Unknown rashi name: ${name}`);
  return i;
}

const PLANET_KEYS: Array<[Exclude<keyof Fixture, 'name' | '_source' | 'dateLocal' | 'tzh' | 'lat' | 'lon' | 'lagna'>, GrahaName]> = [
  ['sun', 'Sun'], ['moon', 'Moon'], ['mars', 'Mars'], ['mercury', 'Mercury'],
  ['jupiter', 'Jupiter'], ['venus', 'Venus'], ['saturn', 'Saturn'],
  ['rahu', 'Rahu'], ['ketu', 'Ketu'],
];

describe('Phase 29 birth-chart cross-validation against AstroSage R-tier (21 charts)', () => {
  for (const f of CHARTS) {
    describe(`${f.name}`, () => {
      const date = localToUtc(f.dateLocal, f.tzh);
      const loc = { latitude: f.lat, longitude: f.lon };

      it('lagna rashi exact match', () => {
        const lagna = computeLagna(date, loc);
        expect(lagna.rashi.index).toBe(rashiIndex(f.lagna.rashi));
      });

      it(`lagna degree within ±${LAGNA_DEGREE_TOL}° of AstroSage`, () => {
        const lagna = computeLagna(date, loc);
        expect(Math.abs(lagna.degreeInRashi - f.lagna.degree))
          .toBeLessThanOrEqual(LAGNA_DEGREE_TOL);
      });

      const chart = computeRashiChart(date, loc);

      for (const [key, name] of PLANET_KEYS) {
        const exp = f[key];
        const lib = chart.planets.find((p) => p.planet === name)!;

        it(`${name} rashi exact (${exp.rashi})`, () => {
          expect(lib.rashi.index).toBe(rashiIndex(exp.rashi));
        });

        it(`${name} degree within ±${PLANET_DEGREE_TOL}° of AstroSage`, () => {
          expect(Math.abs(lib.degreeInRashi - exp.degree))
            .toBeLessThanOrEqual(PLANET_DEGREE_TOL);
        });
      }

      for (const system of ['whole-sign', 'equal', 'placidus-kp'] as const) {
        it(`bhava ${system} produces 12 monotonic cusps`, () => {
          const bhava = computeBhava(date, loc, { houseSystem: system });
          expect(bhava.houses).toHaveLength(12);
          expect(bhava.system).toBe(system);
          for (let i = 1; i < 12; i++) {
            let delta = bhava.houses[i]!.cuspLongitude - bhava.houses[i - 1]!.cuspLongitude;
            if (delta < 0) delta += 360;
            expect(delta).toBeGreaterThan(0);
            expect(delta).toBeLessThan(360);
          }
        });
      }

      it('D9 lagna rashi consistent with natal lagna', () => {
        const d1 = computeRashiChart(date, loc);
        const d9 = computeNavamsa(date, loc);
        expect(d9.divisional).toBe('D9');
        expect(d9.planets).toHaveLength(9);
        for (let i = 0; i < 9; i++) {
          expect(d1.planets[i]!.planet).toBe(d9.planets[i]!.planet);
          expect(d1.planets[i]!.isRetrograde).toBe(d9.planets[i]!.isRetrograde);
        }
      });
    });
  }
});

describe('Phase 29 birth-chart cross-validation: aggregate', () => {
  it('coverage: 21 R-tier charts loaded', () => {
    expect(CHARTS.length).toBe(21);
    for (const f of CHARTS) {
      expect(f._source).toContain('Reference (R)');
    }
  });

  it('every fixture passes lagna-degree ±1° tolerance', () => {
    let maxDelta = 0;
    let maxName = '';
    for (const f of CHARTS) {
      const date = localToUtc(f.dateLocal, f.tzh);
      const lagna = computeLagna(date, { latitude: f.lat, longitude: f.lon });
      expect(lagna.rashi.index).toBe(rashiIndex(f.lagna.rashi));
      const delta = Math.abs(lagna.degreeInRashi - f.lagna.degree);
      if (delta > maxDelta) { maxDelta = delta; maxName = f.name; }
    }
    expect(maxDelta, `worst-case lagna degree drift was ${maxDelta.toFixed(3)}° at ${maxName}`)
      .toBeLessThanOrEqual(LAGNA_DEGREE_TOL);
  });

  it('every planet × every fixture passes rashi exact + ±0.5° degree tolerance', () => {
    let maxDelta = 0;
    let maxName = '';
    for (const f of CHARTS) {
      const date = localToUtc(f.dateLocal, f.tzh);
      const chart = computeRashiChart(date, { latitude: f.lat, longitude: f.lon });
      for (const [key, name] of PLANET_KEYS) {
        const exp = f[key];
        const lib = chart.planets.find((p) => p.planet === name)!;
        expect(lib.rashi.index, `${f.name} / ${name} rashi`).toBe(rashiIndex(exp.rashi));
        const delta = Math.abs(lib.degreeInRashi - exp.degree);
        if (delta > maxDelta) { maxDelta = delta; maxName = `${f.name}/${name}`; }
        expect(delta, `${f.name} / ${name} degree drift ${delta.toFixed(3)}°`)
          .toBeLessThanOrEqual(PLANET_DEGREE_TOL);
      }
    }
    expect(maxDelta, `worst-case planet degree drift was ${maxDelta.toFixed(3)}° at ${maxName}`)
      .toBeLessThanOrEqual(PLANET_DEGREE_TOL);
  });
});
