/**
 * Phase 18-3 — Drik Panchang cross-verification for planetary positions.
 *
 * Source: https://www.drikpanchang.com/planet/position/planetary-positions-sidereal.html
 * (Lahiri/Chitra Paksha ayanamsa, Delhi).
 *
 * Tolerances:
 *   - Sun/Moon/Mars/Mercury/Jupiter/Venus/Saturn: ±0.1° (observed drift is ≤0.02°)
 *   - Rahu/Ketu (mean node, as documented in src/jyotish/planets.ts): ±2°
 *     covering the worst-case perturbation excursions; typical mean-node-vs-true-node
 *     drift is ≤0.5° and observed Drik-delta is ≤0.02°, so headroom is large.
 *   - Rashi: exact match
 *   - Nakshatra: exact match
 *   - Retrograde flag: exact match
 */

import { describe, it, expect } from 'vitest';
import { computePlanetaryPositions } from '../../src/jyotish/planets';
import fixtures from '../fixtures/drikpanchang-planets.json';

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

const LON_TOL_FAST = 0.1;   // Sun–Saturn
const LON_TOL_NODE = 2.0;   // Rahu/Ketu (mean-node worst-case per Meeus Ch. 47)

/** Signed smallest-angle difference in degrees, handles 359↔0 wrap. */
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

describe('DrikPanchang cross-verification — planetary positions', () => {
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
