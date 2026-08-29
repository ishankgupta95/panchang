/**
 * @tier 1  reference-almanac sidereal planetary positions, Lahiri/Chitra Paksha, Delhi
 */

import { describe, it, expect } from 'vitest';
import { computePlanetaryPositions } from '../../src/jyotish/planets';
import { readTestData } from '../testdata';

const fixtures = readTestData('almanac', 'almanac-planets.json');

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanus', 'Makara', 'Kumbha', 'Meena',
] as const;

const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra',
  'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha',
  'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

const LON_TOL_FAST = 0.1;
const LON_TOL_NODE = 2.0;   // mean-node worst case, Meeus Ch. 47

function angDelta(a: number, b: number): number {
  let d = a - b;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

type PlanetExpected = {
  siderealLongitude: number;
  rashi: string;
  nakshatra: string;
  retrograde: boolean;
};

type Fixture = {
  _source?: string;
  date: string;
  instantUTC: string;
  city: string;
  location: { latitude: number; longitude: number };
  ayanamsa: 'lahiri';
  expected: Record<string, PlanetExpected>;
};

const PLANETS = ['sun','moon','mars','mercury','jupiter','venus','saturn','rahu','ketu'] as const;

describe('Reference-almanac cross-verification: planetary positions', () => {
  for (const f of fixtures as Fixture[]) {
    describe(`${f.date} @ ${f.instantUTC} / ${f.city}`, () => {
      const pp = computePlanetaryPositions(
        new Date(f.instantUTC),
        f.ayanamsa,
        (i) => NAKSHATRA_NAMES[i]!,
        (i) => RASHI_NAMES[i]!,
      );

      for (const planet of PLANETS) {
        const e = f.expected[planet]!;
        const g = pp[planet];
        const tol = (planet === 'rahu' || planet === 'ketu') ? LON_TOL_NODE : LON_TOL_FAST;

        it(`${planet}: sidereal longitude within ±${tol}° of ${e.siderealLongitude}`, () => {
          const delta = Math.abs(angDelta(g.siderealLongitude, e.siderealLongitude));
          expect(delta).toBeLessThanOrEqual(tol);
        });

        it(`${planet}: rashi === "${e.rashi}"`, () => {
          expect(g.rashi.name).toBe(e.rashi);
        });

        it(`${planet}: nakshatra === "${e.nakshatra}"`, () => {
          expect(g.nakshatra.name).toBe(e.nakshatra);
        });

        it(`${planet}: retrograde === ${e.retrograde}`, () => {
          expect(g.isRetrograde).toBe(e.retrograde);
        });
      }
    });
  }
});
