/**
 * @tier 0  JPL Horizons DE441
 *
 * ## TIER 0 — JPL Horizons (DE441). The only tier that can adjudicate an
 * ephemeris change.
 *
 * PLAN.md §36.0 A–D. `tests/fixtures/horizons-positions.json` does not
 * originate from this library and does not move when this library moves, so a
 * disagreement with it is evidence about *us*. Everything else in
 * `tests/validation/` is Tier 1 (DrikPanchang — rule-level, quantized to the
 * minute) or Tier 2 (our own pins — a regression detector with no independent
 * authority).
 *
 * ### What this file is for
 *
 * Two jobs, and they are different:
 *
 * 1. **Record the baseline.** §36.0 C: measure the *current* implementation's
 *    error against Tier 0 before writing any replacement, so "at least as good
 *    as today" is a number rather than an opinion. Run with
 *    `TIER0_REPORT=1 npx vitest run tests/validation/tier0-horizons.test.ts`
 *    to print the full per-body curve.
 * 2. **Gate the replacement.** §36.0 D: the own-ephemeris modules of 36.2/36.4
 *    must come in at or below these bounds *across the whole span* — not on
 *    average, not just near 2025. The bounds below are therefore a ceiling that
 *    may only ever be tightened. Loosening one is a finding to be written up,
 *    never a re-pin.
 *
 * ### This file measures `astronomy-engine`, and must keep doing so
 *
 * It calls `astronomy-engine` directly rather than through `src/astronomy/`.
 * That was not always true: until Phase 36.4 it read `getTropicalSunLongitude`
 * and `getTropicalMoonLongitude`, which was fine while those were thin wrappers
 * and became quietly wrong the moment 36.2 replaced them — the "baseline" would
 * have started tracking the very implementation it exists to judge, and it
 * would have *passed*, because the replacement is better.
 *
 * The baseline is a historical constant. It records what the dependency's error
 * was, so that "at least as good as today" keeps meaning what it meant on
 * 2026-08-06. `tier0-own-sun-moon.test.ts` and `tier0-own-planets.test.ts`
 * measure the replacement.
 *
 * ### Why the comparison is done in TT
 *
 * The fixture is tagged TT, and each epoch is converted to the UT instant the
 * library's public API takes using the library's *own* ΔT. That makes ΔT cancel
 * exactly, leaving the position theory alone. It is the right split: a ΔT error
 * shifts every body uniformly and would otherwise hide inside these numbers.
 * ΔT is tested separately, in `tier0-deltat.test.ts` (§36.0 G).
 */
import { describe, it, expect } from 'vitest';
import {
  MakeTime, Body, GeoVector, GeoMoon, Ecliptic, SunPosition,
} from 'astronomy-engine';
import fixture from '../fixtures/horizons-positions.json';

const REPORT = process.env.TIER0_REPORT === '1';

/** Signed smallest angle a − b, degrees, in (−180, 180]. */
function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * The UT instant whose Terrestrial Time is `jdTt`, per astronomy-engine's own
 * ΔT model.
 *
 * `MakeTime(ut: number)` builds an `AstroTime` from UT days since J2000 and
 * derives `.tt` from it; there is no public inverse, so this iterates. ΔT
 * changes by well under a second per year, so the fixed point is reached in two
 * steps and the third is only there to prove it.
 */
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

/**
 * Mean apparent geocentric motion, degrees per hour. Used only to express a
 * longitude error as the *time* error it implies, which is the unit every
 * downstream panchang quantity is actually measured in.
 */
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
  /** Mean signed error — separates a systematic offset from scatter. */
  biasArcsec: number;
  /** `maxArcsec` expressed as the time error it implies at the body's mean rate. */
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
 * Baseline: `astronomy-engine`'s own error against DE441 over 1900–2100,
 * measured 2026-08-06 across the 250 committed epochs. Bounds are the observed
 * maxima with ~10% headroom — tight enough that a real regression trips them,
 * loose enough to survive floating-point drift across platforms.
 *
 * | body | max″ | mean″ | rms″ | bias″ | worst yr | max as time |
 * |---|---|---|---|---|---|---|
 * | Sun | 1.613 | 0.519 | 0.639 | −0.148 | 1942 | 39 s |
 * | Moon | 3.747 | 0.884 | 1.132 | +0.296 | 1906 | 6.8 s |
 * | Mercury | 6.504 | 1.671 | 2.075 | −0.084 | 1981 | 110 s |
 * | Venus | 19.586 | 1.783 | 3.069 | −0.401 | 2027 | 392 s |
 * | Mars | 11.103 | 1.507 | 2.288 | +0.325 | 1989 | 529 s |
 * | Jupiter | 9.662 | 2.856 | 3.489 | +0.331 | 2009 | 2761 s |
 * | Saturn | 11.147 | 3.109 | 4.066 | −0.391 | 2002 | 7962 s |
 *
 * PLAN.md §36.0 D illustrated the Moon baseline as 0.83″. That matches the
 * *mean* (0.88″); the **max is 3.75″**, 4.5× larger. Judging an own
 * implementation on the mean would have accepted something materially worse at
 * the edges of the span, which is exactly why §36.0 D says max, mean *and*
 * worst epoch.
 *
 * **These are a ceiling for §36.2 and §36.4.** An own implementation is
 * accepted only if it comes in at or below them across the whole span.
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

describe('Tier 0 — apparent ecliptic longitude vs JPL Horizons (DE441)', () => {
  it('the fixture is the one this baseline was measured against', () => {
    // Guards against silently re-measuring on a regenerated fixture: a changed
    // epoch list would make every bound below meaningless.
    expect(fixture.jdTt).toHaveLength(250);
    expect(fixture.timeScale).toBe('TT');
    expect(fixture.ephemeris).toBe('DE441');
    expect(fixture.jdTt[0]).toBeCloseTo(2415054.996917, 6);
    expect(fixture.jdTt[fixture.jdTt.length - 1]).toBeCloseTo(2487470.870887, 6);
  });

  const curves: Curve[] = [];

  for (const body of Object.keys(BASELINE_MAX_ARCSEC)) {
    it(`${body}: max |error| ≤ ${BASELINE_MAX_ARCSEC[body]}″ across 1900–2100`, () => {
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
