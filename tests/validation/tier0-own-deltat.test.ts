/**
 * @tier 0  JPL Horizons DE441, plus a differential test against astronomy-engine
 *
 * ## Phase 36.2 — acceptance test for the first own-ephemeris module
 *
 * `src/astronomy/deltaT.ts` is the first piece of the port. §36.0 D says an own
 * implementation is accepted only if its error is **≤ the baseline across the
 * whole span**, and §36.0 H says the optimized path is then verified by
 * differential testing against a frozen reference over ~100k instants.
 *
 * Both are done here, with one adaptation stated openly: for ΔT the reference
 * *is* the shipped code — a degree-7 polynomial has no optimization worth the
 * risk, so there is no second implementation to diff against. The differential
 * test is therefore run against `astronomy-engine`'s **independent
 * transcription of the same Espenak–Meeus model**. That is a weaker check than
 * reference-vs-optimized (it cannot catch a shared misreading of the paper) but
 * a stronger one than nothing: it catches every transcription slip that is not
 * also present in a separately written implementation. The Tier 0 comparison
 * above it is what catches a shared misreading.
 */
import { describe, it, expect } from 'vitest';
import { MakeTime } from 'astronomy-engine';
import {
  deltaTSeconds, deltaTSecondsForYear, ttDaysSinceJ2000, terrestrialTimeJd, julianCenturiesTt,
} from '../../src/astronomy/deltaT';
import fixture from '../fixtures/horizons-deltat.json';

/** `astronomy-engine`'s effective ΔT at a UT Julian date, seconds. */
function engineDeltaT(jdUt: number): number {
  const ut = jdUt - 2451545.0;
  return (MakeTime(ut).tt - ut) * 86400;
}

function dateForJdUt(jdUt: number): Date {
  return new Date((jdUt - 2440587.5) * 86_400_000);
}

describe('36.2 — own ΔT vs Tier 0', () => {
  /**
   * The gate. The baseline — `astronomy-engine` against the Horizons-derived
   * fixture over 1900–2010 — is 0.831 s. The own implementation must not be
   * worse, so the bound is the same 1.0 s the baseline test uses. Measured:
   * see the assertion message on failure.
   *
   * Restricted to ≤2010 for the same reason the baseline test is: beyond that
   * Horizons reports TT − UTC with leap seconds frozen, which is a different
   * quantity from the TT − UT1 both implementations model. Asserting agreement
   * there would be asserting a falsehood.
   */
  it('is no worse than the baseline against Horizons over 1900–2010', () => {
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
    // The actual §36.0 D acceptance condition: at or below the baseline, not
    // merely inside an absolute bound. The margin is 0.1 ms — four orders of
    // magnitude below the model's own ~1 s agreement with observation, and
    // enough that the two implementations' differing year mappings (which
    // separate them by ~2 × 10⁻⁷ s here) do not register as a regression.
    expect(worstOwn).toBeLessThanOrEqual(worstEngine + 1e-4);
  });

  /**
   * §36.0 H differential test. 100,000 instants spread over −500 → +2500,
   * deliberately wider than the library's supported span so that every
   * polynomial branch — including the ones the fixture cannot reach — is
   * exercised against an independent transcription.
   *
   * The two differ only in how they map an instant to a decimal year, so the
   * expected residual is (year-mapping difference) × dΔT/dy. That is bounded by
   * a few hundredths of a year times ~1 s/yr in the steepest era.
   */
  it('agrees with astronomy-engine to <0.05 s over 100,000 instants, −500 to +2500', () => {
    const START_JD = 1826000; // ≈ −500
    const END_JD = 2921000;   // ≈ +2500
    const N = 100_000;
    let worst = 0, worstJd = 0;
    for (let i = 0; i < N; i++) {
      const jd = START_JD + ((END_JD - START_JD) * i) / (N - 1);
      const d = Math.abs(deltaTSeconds(dateForJdUt(jd)) - engineDeltaT(jd));
      if (d > worst) { worst = d; worstJd = jd; }
    }
    const worstYear = Math.round(2000 + (worstJd - 2451545) / 365.25);
    expect(worst, `worst divergence ${worst.toFixed(4)} s near year ${worstYear}`)
      .toBeLessThan(0.05);
  });

  it('every polynomial branch is continuous at its boundary', () => {
    // A discontinuity would be invisible to a sampled comparison and would put
    // a step in every derived time. Espenak's segments are not constrained to
    // meet exactly, but they agree to well under a second — a jump larger than
    // that is a transcription error, not a property of the model.
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
    // Widely quoted checkpoints from the Espenak–Meeus tables. Independent of
    // the fixture, so a regenerated fixture cannot silently move them.
    expect(deltaTSecondsForYear(1900.0)).toBeCloseTo(-2.79, 1);
    expect(deltaTSecondsForYear(1950.0)).toBeCloseTo(29.07, 1);
    expect(deltaTSecondsForYear(2000.0)).toBeCloseTo(63.86, 1);
  });

  it('the TT helpers are consistent with ΔT', () => {
    const d = new Date('2025-06-15T00:00:00Z');
    const utDays = (d.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000;
    // Round-trips to 10 ns on the primitive. Not bit-exact — recovering ΔT
    // means subtracting two numbers of order 10⁴ days whose difference is
    // order 10⁻³ — but three orders of magnitude tighter than going via an
    // absolute JD, which is the point.
    expect((ttDaysSinceJ2000(d) - utDays) * 86400).toBeCloseTo(deltaTSeconds(d), 7);
    expect(julianCenturiesTt(d)).toBeCloseTo(ttDaysSinceJ2000(d) / 36525, 15);
    // Lossy on the absolute JD, by design and by ~10 µs — asserted so the size
    // of the loss is pinned rather than discovered later.
    const viaJd = (terrestrialTimeJd(d) - (2451545 + utDays)) * 86400;
    expect(Math.abs(viaJd - deltaTSeconds(d))).toBeLessThan(1e-4);
  });
});
