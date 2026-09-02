/**
 * @tier 0  JPL Horizons DE441
 *
 * Must call `astronomy-engine` directly, never through `src/astronomy/`: these
 * bounds are the dependency's error, the ceiling the own implementation is
 * judged against, and routed through `src/` they would track the code they
 * judge. Tighten them, never loosen them.
 */
import { describe, it, expect } from 'vitest';
import {
  MakeTime, Body, GeoVector, GeoMoon, Ecliptic, SunPosition,
} from 'astronomy-engine';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'horizons-positions.json');

const REPORT = process.env.TIER0_REPORT === '1';

function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** `MakeTime` has no inverse; ΔT moves under a second a year, so two steps converge and the third proves it. */
function utDateForTt(jdTt: number): Date {
  const ttDays = jdTt - 2451545.0;
  let ut = ttDays;
  for (let i = 0; i < 3; i++) ut += ttDays - MakeTime(ut).tt;
  return MakeTime(ut).date;
}

const PLANET_BODY: Record<string, Body> = {
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
};

function baselineLongitude(body: string, date: Date): number {
  const time = MakeTime(date);
  if (body === 'Sun') return SunPosition(time).elon;
  if (body === 'Moon') return Ecliptic(GeoMoon(time)).elon;
  const b = PLANET_BODY[body];
  if (b === undefined) throw new Error(`no baseline entry point for ${body}`);
  return Ecliptic(GeoVector(b, time, true)).elon;
}

/** Mean apparent geocentric motion, degrees per hour. */
const DEG_PER_HOUR: Record<string, number> = {
  Sun: 0.0410,
  Moon: 0.5490,
  Mercury: 0.0590,
  Venus: 0.0500,
  Mars: 0.0210,
  Jupiter: 0.0035,
  Saturn: 0.0014,
};

interface Curve {
  body: string;
  maxArcsec: number;
  meanArcsec: number;
  rmsArcsec: number;
  worstJdTt: number;
  worstYear: number;
  biasArcsec: number;
  maxSeconds: number;
}

function measure(body: string): Curve {
  const truth = (fixture.positions as Record<string, { elon: number }[]>)[body]!;
  let sumAbs = 0, sumSq = 0, sumSigned = 0, max = 0, worst = 0;
  for (let i = 0; i < fixture.jdTt.length; i++) {
    const jd = fixture.jdTt[i]!;
    const mine = baselineLongitude(body, utDateForTt(jd));
    const err = angularDelta(mine, truth[i]!.elon) * 3600;
    sumAbs += Math.abs(err);
    sumSq += err * err;
    sumSigned += err;
    if (Math.abs(err) > max) { max = Math.abs(err); worst = jd; }
  }
  const n = fixture.jdTt.length;
  return {
    body,
    maxArcsec: max,
    meanArcsec: sumAbs / n,
    rmsArcsec: Math.sqrt(sumSq / n),
    biasArcsec: sumSigned / n,
    worstJdTt: worst,
    worstYear: Math.round(2000 + (worst - 2451545.0) / 365.25),
    maxSeconds: (max / 3600) / DEG_PER_HOUR[body]! * 3600,
  };
}

/**
 * `astronomy-engine`'s error against DE441 over the 250 committed epochs: observed
 * maxima plus ~10%. Maxima, not means: the Moon's quoted 0.83″ is a mean, max 3.75″.
 */
const BASELINE_MAX_ARCSEC: Record<string, number> = {
  Sun: 1.8,
  Moon: 4.0,
  Mercury: 7.0,
  Venus: 21.0,
  Mars: 12.0,
  Jupiter: 10.5,
  Saturn: 12.0,
};

describe('Tier 0: apparent ecliptic longitude vs JPL Horizons (DE441)', () => {
  it('the fixture is the one this baseline was measured against', () => {
    expect(fixture.jdTt).toHaveLength(250);
    expect(fixture.timeScale).toBe('TT');
    expect(fixture.ephemeris).toBe('DE441');
    expect(fixture.jdTt[0]).toBeCloseTo(2415054.996917, 6);
    expect(fixture.jdTt[fixture.jdTt.length - 1]).toBeCloseTo(2487470.870887, 6);
  });

  const curves: Curve[] = [];

  for (const body of Object.keys(BASELINE_MAX_ARCSEC)) {
    it(`${body}: max |error| ≤ ${BASELINE_MAX_ARCSEC[body]}″ across 1900-2100`, () => {
      const c = measure(body);
      curves.push(c);
      expect(
        c.maxArcsec,
        `${body} worst error ${c.maxArcsec.toFixed(4)}″ at JD(TT) ${c.worstJdTt} (~${c.worstYear})`,
      ).toBeLessThanOrEqual(BASELINE_MAX_ARCSEC[body]!);
    });
  }

  it('prints the baseline error curve when TIER0_REPORT=1', () => {
    if (!REPORT) return;
    const rows = Object.keys(BASELINE_MAX_ARCSEC).map(measure);
    const pad = (s: string | number, n: number) => String(s).padStart(n);
    console.log('\nbody      max″    mean″     rms″    bias″   worst yr   max as time');
    for (const c of rows) {
      console.log(
        c.body.padEnd(9),
        pad(c.maxArcsec.toFixed(4), 7),
        pad(c.meanArcsec.toFixed(4), 8),
        pad(c.rmsArcsec.toFixed(4), 8),
        pad(c.biasArcsec.toFixed(4), 8),
        pad(c.worstYear, 10),
        pad((c.maxSeconds).toFixed(2) + ' s', 13),
      );
    }
    expect(rows).toHaveLength(7);
  });
});
