/** @tier 0  JPL Horizons DE441, plus a differential test against astronomy-engine */
import { describe, it, expect } from 'vitest';
import { MakeTime } from 'astronomy-engine';
import {
  deltaTSeconds, deltaTSecondsForYear, ttDaysSinceJ2000, terrestrialTimeJd, julianCenturiesTt,
} from '../../src/astronomy/deltaT';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'horizons-deltat.json');

function engineDeltaT(jdUt: number): number {
  const ut = jdUt - 2451545.0;
  return (MakeTime(ut).tt - ut) * 86400;
}

function dateForJdUt(jdUt: number): Date {
  return new Date((jdUt - 2440587.5) * 86_400_000);
}

describe('own ΔT vs Tier 0', () => {
  it('is no worse than the baseline against Horizons over 1900-2010', () => {
    let worstOwn = 0, worstEngine = 0, worstYear = 0;
    for (let i = 0; i < fixture.year.length; i++) {
      if (fixture.year[i]! > 2010) continue;
      const truth = fixture.deltaTSeconds[i]!;
      const own = Math.abs(deltaTSeconds(dateForJdUt(fixture.jd[i]!)) - truth);
      const eng = Math.abs(engineDeltaT(fixture.jd[i]!) - truth);
      if (own > worstOwn) { worstOwn = own; worstYear = fixture.year[i]!; }
      worstEngine = Math.max(worstEngine, eng);
    }
    expect(
      worstOwn,
      `own ΔT worst ${worstOwn.toFixed(3)} s at ${worstYear}; baseline ${worstEngine.toFixed(3)} s`,
    ).toBeLessThanOrEqual(1.0);
    expect(worstOwn).toBeLessThanOrEqual(worstEngine + 1e-4);
  });

  it('agrees with astronomy-engine to <0.05 s over 100,000 instants, −500 to +2500', () => {
    const START_JD = 1826000;
    const END_JD = 2921000;
    const N = 100_000;
    let worst = 0, worstJd = 0;
    for (let i = 0; i < N; i++) {
      const jd = START_JD + ((END_JD - START_JD) * i) / (N - 1);
      const year = 2000 + ((jd - 2451545.0) - 14) / 365.24217;
      const d = Math.abs(deltaTSecondsForYear(year) - engineDeltaT(jd));
      if (d > worst) { worst = d; worstJd = jd; }
    }
    const worstYear = Math.round(2000 + (worstJd - 2451545) / 365.25);
    expect(worst, `worst divergence ${worst.toFixed(4)} s near year ${worstYear}`)
      .toBeLessThan(0.05);
  });

  it('tracks the leap-second chain across the measured era', () => {
    const cases: [string, number][] = [
      ['1980-06-01T00:00:00Z', 32.184 + 19],
      ['1990-06-01T00:00:00Z', 32.184 + 25],
      ['2000-06-01T00:00:00Z', 32.184 + 32],
      ['2010-06-01T00:00:00Z', 32.184 + 34],
      ['2016-06-01T00:00:00Z', 32.184 + 36],
      ['2026-06-01T00:00:00Z', 32.184 + 37],
    ];
    for (const [iso, expected] of cases) {
      expect(deltaTSeconds(new Date(iso)), iso).toBeCloseTo(expected, 9);
    }
  });

  it('is continuous where measurement hands back to the model', () => {
    const handoff = Date.UTC(2027, 0, 1);
    const before = deltaTSeconds(new Date(handoff - 1000));
    const after = deltaTSeconds(new Date(handoff + 1000));
    expect(Math.abs(after - before)).toBeLessThan(0.01);
  });

  it('every polynomial branch is continuous at its boundary', () => {
    const BOUNDARIES = [-500, 500, 1600, 1700, 1800, 1860, 1900, 1920, 1941,
      1961, 1986, 2005, 2050, 2150];
    for (const y of BOUNDARIES) {
      const below = deltaTSecondsForYear(y - 1e-6);
      const above = deltaTSecondsForYear(y + 1e-6);
      expect(Math.abs(above - below), `ΔT jumps at the year-${y} segment boundary`)
        .toBeLessThan(1.0);
    }
  });

  it('reproduces the published anchor values', () => {
    expect(deltaTSecondsForYear(1900.0)).toBeCloseTo(-2.79, 1);
    expect(deltaTSecondsForYear(1950.0)).toBeCloseTo(29.07, 1);
    expect(deltaTSecondsForYear(2000.0)).toBeCloseTo(63.86, 1);
  });

  it('the TT helpers are consistent with ΔT', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    const utDays = (d.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
    expect((ttDaysSinceJ2000(d) - utDays) * 86400).toBeCloseTo(deltaTSeconds(d), 6);
    expect(julianCenturiesTt(d)).toBeCloseTo(ttDaysSinceJ2000(d) / 36525, 15);
    const viaJd = (terrestrialTimeJd(d) - (2451545 + utDays)) * 86400;
    expect(Math.abs(viaJd - deltaTSeconds(d))).toBeLessThan(1e-4);
  });
});
