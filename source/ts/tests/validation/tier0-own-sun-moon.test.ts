/**
 * @tier 0  JPL Horizons DE441, and IMCCE's own VSOP87 substitution results
 * Accepted only if max |error| stays at or below the `astronomy-engine` baseline over the same 250 epochs: Sun 1.613″, Moon 3.747″.
 */
import { describe, it, expect } from 'vitest';
import { getTropicalSunLongitude } from '../../src/astronomy/sun';
import { getTropicalMoonLongitude } from '../../src/astronomy/moon';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import {
  sunApparentReference, moonApparentReference, vsopReference,
} from '../reference/ephemeris-reference';
import { readVsop87Check, type VsopBody } from '../reference/catalog';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'horizons-positions.json');

const REPORT = process.env.TIER0_REPORT === '1';

function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function utDateForTt(jdTt: number): Date {
  const ttDays = jdTt - 2451545.0;
  let ms = ttDays * 86_400_000 + Date.UTC(2000, 0, 1, 12);
  for (let i = 0; i < 3; i++) {
    ms += (ttDays - ttDaysSinceJ2000(new Date(ms))) * 86_400_000;
  }
  return new Date(ms);
}

interface Curve { max: number; mean: number; bias: number; worstYear: number }

function measure(body: 'Sun' | 'Moon', longitudeAt: (jdTt: number) => number): Curve {
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

/**
 * Observed maxima plus ~15% headroom: shipped measures 0.3233″ and 1.2610″, and
 * these may only move down. The Moon's residual is pure bias, an ELP2000-82B to
 * ICRS frame offset; Chapront et al.'s (2002) rotation for it is not applied,
 * since a constant justified only by the Tier 0 residual is circular.
 */
const OWN_MAX_ARCSEC = { Sun: 0.5, Moon: 1.6 } as const;

describe('Tier 0: own Sun and Moon vs JPL Horizons (DE441)', () => {
  it('the VSOP87D parser reproduces IMCCE\'s own substitution results', () => {
    const bodyFile: Record<string, VsopBody> = {
      MERCURY: 'mer', VENUS: 'ven', EARTH: 'ear', MARS: 'mar', JUPITER: 'jup', SATURN: 'sat',
    };
    let checked = 0;
    let worst = 0;
    for (const row of readVsop87Check()) {
      const body = bodyFile[row.body];
      if (!body) continue;
      const [L, B, R] = vsopReference(body, row.jd);
      const dl = Math.abs(((L - row.l) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      worst = Math.max(worst, dl, Math.abs(B - row.b), Math.abs(R - row.r));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(60);
    expect(worst, `worst |Δ| vs vsop87.chk was ${worst.toExponential(3)}`).toBeLessThan(1e-9);
  });

  const curves: Record<string, Curve> = {};

  for (const [label, sun, moon] of [
    ['reference (untruncated)', (jd: number) => sunApparentReference(jd).lonDeg,
      (jd: number) => moonApparentReference(jd).lonDeg],
    ['shipped (truncated)', (jd: number) => getTropicalSunLongitude(utDateForTt(jd)),
      (jd: number) => getTropicalMoonLongitude(utDateForTt(jd))],
  ] as const) {
    it(`Sun, ${label}: max |error| ≤ ${OWN_MAX_ARCSEC.Sun}″ across 1900-2100`, () => {
      const c = measure('Sun', sun);
      curves[`Sun ${label}`] = c;
      expect(
        c.max,
        `Sun ${label}: max ${c.max.toFixed(4)}″ (worst ~${c.worstYear}), mean ${c.mean.toFixed(4)}″, bias ${c.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC.Sun);
    });

    it(`Moon, ${label}: max |error| ≤ ${OWN_MAX_ARCSEC.Moon}″ across 1900-2100`, () => {
      const c = measure('Moon', moon);
      curves[`Moon ${label}`] = c;
      expect(
        c.max,
        `Moon ${label}: max ${c.max.toFixed(4)}″ (worst ~${c.worstYear}), mean ${c.mean.toFixed(4)}″, bias ${c.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC.Moon);
    }, 30_000);
  }

  it('comes in strictly better than the astronomy-engine baseline', () => {
    expect(measure('Sun', (jd) => getTropicalSunLongitude(utDateForTt(jd))).max).toBeLessThan(1.613);
    expect(measure('Moon', (jd) => getTropicalMoonLongitude(utDateForTt(jd))).max).toBeLessThan(3.747);
  });

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
    expect(Object.keys(curves).length).toBeGreaterThan(0);
  });
});
