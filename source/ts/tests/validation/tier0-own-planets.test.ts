/**
 * @tier 0  JPL Horizons DE441
 *
 * The VSOP87D planet series are truncated to 0.5″, looser than the Earth
 * series' 0.1″, and the radius budget is an angle (0.3″) per body since a
 * radius error δR displaces the direction by δR/Δ.
 */
import { describe, it, expect } from 'vitest';
import { getTropicalPlanetLongitude, type PlanetBody } from '../../src/astronomy/planet';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { planetApparentReference } from '../reference/ephemeris-reference';
import type { VsopBody } from '../reference/catalog';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'horizons-positions.json');

function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Inverts this library's own ΔT, so a ΔT error also lands in the comparison. */
function utDateForTt(jdTt: number): Date {
  const ttDays = jdTt - 2451545.0;
  let ms = ttDays * 86_400_000 + Date.UTC(2000, 0, 1, 12);
  for (let i = 0; i < 3; i++) {
    ms += (ttDays - ttDaysSinceJ2000(new Date(ms))) * 86_400_000;
  }
  return new Date(ms);
}

interface Curve { max: number; mean: number; bias: number; worstYear: number }

function measure(body: string, longitudeAt: (jdTt: number) => number): Curve {
  const truth = (fixture.positions as Record<string, { elon: number }[]>)[body]!;
  let sumAbs = 0, sumSigned = 0, max = 0, worst = 0;
  for (let i = 0; i < fixture.jdTt.length; i++) {
    const jd = fixture.jdTt[i]!;
    const err = angularDelta(longitudeAt(jd), truth[i]!.elon) * 3600;
    sumAbs += Math.abs(err);
    sumSigned += err;
    if (Math.abs(err) > max) { max = Math.abs(err); worst = jd; }
  }
  const n = fixture.jdTt.length;
  return {
    max, mean: sumAbs / n, bias: sumSigned / n,
    worstYear: Math.round(2000 + (worst - 2451545.0) / 365.25),
  };
}

/** `astronomy-engine`'s measured maxima, from `tier0-horizons.test.ts`. */
const BASELINE_MAX_ARCSEC: Record<string, number> = {
  Mercury: 6.504, Venus: 19.586, Mars: 11.103, Jupiter: 9.662, Saturn: 11.147,
};

// Measured shipped maxima, plus headroom for cross-platform floating point:
// Mercury 0.296″, Venus 0.862″, Mars 1.293″, Jupiter 0.835″, Saturn 0.862″.
const OWN_MAX_ARCSEC: Record<string, number> = {
  Mercury: 0.7, Venus: 1.5, Mars: 2.0, Jupiter: 1.2, Saturn: 1.2,
};

const BODIES: { name: string; own: PlanetBody; reference: VsopBody }[] = [
  { name: 'Mercury', own: 'mercury', reference: 'mer' },
  { name: 'Venus', own: 'venus', reference: 'ven' },
  { name: 'Mars', own: 'mars', reference: 'mar' },
  { name: 'Jupiter', own: 'jupiter', reference: 'jup' },
  { name: 'Saturn', own: 'saturn', reference: 'sat' },
];

const curves: Record<string, { max: number; mean: number; bias: number; worstYear: number }> = {};
const REPORT = process.env['TIER0_REPORT'] === '1';

describe('Tier 0: own planetary longitudes vs JPL Horizons (DE441)', () => {
  for (const { name, own, reference } of BODIES) {
    it(`${name}: reference and shipped both inside ${OWN_MAX_ARCSEC[name]}″, and below the ${BASELINE_MAX_ARCSEC[name]}″ baseline`, () => {
      const ref = measure(name, (jd) => planetApparentReference(reference, jd).lonDeg);
      const shipped = measure(name, (jd) => getTropicalPlanetLongitude(own, utDateForTt(jd)));
      curves[`${name} reference`] = ref;
      curves[`${name} shipped`] = shipped;

      expect(
        ref.max,
        `${name} reference: max ${ref.max.toFixed(4)}″ (worst ~${ref.worstYear}), mean ${ref.mean.toFixed(4)}″, bias ${ref.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC[name]!);

      expect(
        shipped.max,
        `${name} shipped: max ${shipped.max.toFixed(4)}″ (worst ~${shipped.worstYear}), mean ${shipped.mean.toFixed(4)}″, bias ${shipped.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC[name]!);

      // Kept separate so loosening the bounds above cannot weaken the gate.
      expect(shipped.max).toBeLessThan(BASELINE_MAX_ARCSEC[name]!);
    });
  }

  it('prints the error curves when TIER0_REPORT=1', () => {
    if (!REPORT) return;
    console.log('\nseries                          max″     mean″     bias″   worst yr');
    for (const [name, c] of Object.entries(curves)) {
      console.log(
        name.padEnd(30),
        c.max.toFixed(4).padStart(8),
        c.mean.toFixed(4).padStart(9),
        c.bias.toFixed(4).padStart(9),
        String(c.worstYear).padStart(10),
      );
    }
    expect(Object.keys(curves).length).toBe(BODIES.length * 2);
  });

  it('retrograde motion is detected at the same instants the longitude implies', () => {
    // Retrograde comes off the derivative: a discontinuous series fails only here.
    for (const { own } of BODIES) {
      let reversals = 0;
      let previous = getTropicalPlanetLongitude(own, new Date(Date.UTC(2025, 0, 1)));
      let previousDirection = 0;
      for (let d = 1; d < 730; d++) {
        const now = getTropicalPlanetLongitude(own, new Date(Date.UTC(2025, 0, 1) + d * 86_400_000));
        let delta = now - previous;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        const direction = Math.sign(delta);
        if (previousDirection !== 0 && direction !== 0 && direction !== previousDirection) reversals++;
        previousDirection = direction;
        previous = now;
      }
      // Over two years Mercury turns ~8 times, Saturn ~4; a noisy series dozens.
      expect(reversals).toBeGreaterThan(0);
      expect(reversals).toBeLessThan(20);
    }
  });
});
