/**
 * @tier 2  this repository — the shipped path against its own frozen reference
 *
 * ## What this measures, and why it is Tier 2 rather than Tier 0
 *
 * PLAN.md §36.0 H, step 5: the optimized implementation is verified by
 * **differential testing against the frozen reference** over ~100k
 * pseudo-random instants, "not against fixtures, not against Tier 0, and not
 * against intuition". Neither side of this comparison carries independent
 * authority — the reference's *own* correctness is Tier 0's job, in
 * `tier0-own-sun-moon.test.ts`. What this file answers is narrower and
 * different: **does truncation cost what the generator says it costs?**
 *
 * That makes the two tests complementary in a way worth stating, because it is
 * the whole reason for writing the ephemeris twice:
 *
 * - Tier 0 can say "the answer is 1.28″ from DE441" but cannot say whether that
 *   came from the theory or from dropping 36,000 terms.
 * - This file separates them. The reference and the shipped path evaluate the
 *   *same coefficients from the same bytes*, so a parse difference is
 *   impossible by construction and the residual is truncation alone.
 *
 * The budgets in `notes/ephemeris-generate.src.ts` are therefore checked here
 * rather than asserted there. A generator that quietly kept too few terms fails
 * this test; it would only *dilute* the Tier 0 numbers.
 *
 * ## The sample size, and the deviation from §36.0 H's letter
 *
 * The untruncated lunar reference costs **5.5 ms per evaluation** — 37,872
 * terms, evaluated twice for light-time. 100,000 of them is nine minutes, which
 * is not a price an 8,000-test suite should pay on every run.
 *
 * So the requirement is met in two pieces, and the split is stated rather than
 * quietly taken:
 *
 * - **Every run** compares a few thousand instants against the full reference.
 *   That is what establishes the truncation bound.
 * - **`DIFFERENTIAL_FULL=1`** runs the full 100,000 for both bodies, about ten
 *   minutes. Its measured result is recorded in
 *   `docs/v5-validation-report.md` § Step 5 — that run is the claim, and the
 *   everyday sample is its regression detector: a truncation that drifted would
 *   move the small sample too.
 *
 * ## Why pseudo-random instants and not a grid
 *
 * Same reason the Horizons epochs are pseudo-random: a fixed cadence aliases
 * against the periods being measured. Sampling the Moon every 29.53 days
 * measures one lunar phase forever, and a truncated series' error is dominated
 * by exactly the periodic terms that were dropped — so a grid would report a
 * far smoother error than the series actually has.
 */
import { describe, it, expect } from 'vitest';
import { getTropicalSunLongitude, getSunPosition } from '../../src/astronomy/sun';
import { getTropicalMoonLongitude, getMoonPosition } from '../../src/astronomy/moon';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import {
  sunApparentReference, moonApparentReference, truncatedNutationDirectReference,
  nutationReference,
} from '../reference/ephemeris-reference';
import { nutation } from '../../src/astronomy/frame';

const FULL = process.env.DIFFERENTIAL_FULL === '1';

/** Sample sizes: the everyday run, and the §36.0 H run. */
const SUN_SAMPLE = FULL ? 100_000 : 4000;
const MOON_SAMPLE = FULL ? 100_000 : 1500;
const SELF_SAMPLE = 100_000;
const TIMEOUT_MS = FULL ? 30 * 60_000 : 120_000;

/**
 * 1900–2100 is the supported span (|t| ≤ 1 century). The generator truncated
 * over |t| ≤ 1.5, so sampling the narrower window here is deliberate: it is the
 * range the budgets are claimed *for*.
 */
const SPAN_DAYS = 36525;

/**
 * Numerical Recipes' `ranqd1`, seeded and written out here so the sample can be
 * reproduced rather than trusted.
 */
function* instants(seed: number, count: number): Generator<Date> {
  let s = seed >>> 0;
  const origin = Date.UTC(2000, 0, 1, 12);
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield new Date(origin + ((s / 4294967296) * 2 - 1) * SPAN_DAYS * 86_400_000);
  }
}

/** JD(TT) for a UT date — the argument the reference takes. */
const jdTtOf = (d: Date): number => 2451545.0 + ttDaysSinceJ2000(d);

/** Smallest signed angle a − b, arcseconds. */
function deltaArcsec(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d * 3600;
}

/**
 * Reports the measured worst error, always.
 *
 * The bounds below are set from these numbers, and the numbers are what every
 * write-up quotes — so reading them out of an assertion message means
 * deliberately breaking a passing test to see a figure that is not in dispute.
 * Mirrors the `TIER0_REPORT=1` reporters in the `tier0-own-*` files, except that
 * this one needs no flag: the run that produces the interesting value already
 * costs ten minutes and is opted into with `DIFFERENTIAL_FULL=1`.
 */
function report(label: string, worst: number, at: number, sample: number): void {
  console.log(
    `  ${label.padEnd(18)} worst ${worst.toFixed(5)}″ over ${sample.toLocaleString('en-US')} instants`
    + `, at JD(TT) ${at.toFixed(2)}`,
  );
}

describe('§36.0 H — shipped series vs the frozen untruncated reference', () => {
  it(`Sun longitude over ${SUN_SAMPLE} instants`, () => {
    let worst = 0;
    let worstAt = 0;
    for (const date of instants(11, SUN_SAMPLE)) {
      const jd = jdTtOf(date);
      const d = Math.abs(deltaArcsec(getTropicalSunLongitude(date), sunApparentReference(jd).lonDeg));
      if (d > worst) { worst = d; worstAt = jd; }
    }
    // 0.4″ generator budget for Earth's L, plus room for the truncated
    // nutation (0.005″) and the coarse radius used for light-time. Was 0.15
    // against a 0.1″ budget; both moved together when the budget was raised on
    // 2026-08-07, which is the point of checking the budget here rather than
    // asserting it in the generator.
    //
    // Measured **0.34877″ over the full 100,000** (JD(TT) 2485881.94). It was
    // 0.45312″ before `PROBE_COUNT` in the generator went from 600 to 100,000:
    // the budget is 0.4″ either way, but it is now met over the same sample
    // size that checks it, rather than over one 170× smaller. See the note
    // below the Moon's bound.
    report('Sun longitude', worst, worstAt, SUN_SAMPLE);
    expect(worst, `worst ${worst.toFixed(5)}″ at JD(TT) ${worstAt}`).toBeLessThan(0.5);
  }, TIMEOUT_MS);

  it(`Moon longitude over ${MOON_SAMPLE} instants`, () => {
    let worst = 0;
    let worstAt = 0;
    for (const date of instants(22, MOON_SAMPLE)) {
      const jd = jdTtOf(date);
      const d = Math.abs(deltaArcsec(getTropicalMoonLongitude(date), moonApparentReference(jd).lonDeg));
      if (d > worst) { worst = d; worstAt = jd; }
    }
    /**
     * 0.4″ generator budget for the longitude series; the coarse latitude and
     * distance the longitude-only path uses add ~0.005″ on top.
     *
     * Measured **0.35166″ over the full 100,000** (JD(TT) 2418386.48).
     *
     * ## What this test found, and what was done about it
     *
     * It used to read **0.45073″** here against a 0.398″ budget, and 0.35004″
     * over the everyday 1,500 — a gap that was the whole point of running at
     * this sample size. The generator sized each series by searching on the
     * *measured* error over `PROBE_COUNT = 600` epochs, so the budget it
     * advertised was a 600-sample maximum, and a 100,000-sample maximum of the
     * same quantity is legitimately larger: the tail the small sample never
     * draws. 13–25% larger, across the series.
     *
     * `PROBE_COUNT` is now **100,000** — deliberately the same sample size as
     * this test, so the generator cannot advertise a budget that the test
     * verifying it then exceeds. Raising it further would not help and the
     * generator says why: the residual's supremum over the span is attained on
     * a set of measure zero, so random sampling approaches it as an
     * extreme-value problem and never arrives. What it buys is that the two
     * numbers now mean the same thing.
     *
     * The series grew 9–34% and the accuracy improved on every body; the Tier 0
     * claim, which is the one that matters and is made against DE441, went from
     * 1.345″ to **1.261″** against a 3.747″ ceiling.
     */
    report('Moon longitude', worst, worstAt, MOON_SAMPLE);
    expect(worst, `worst ${worst.toFixed(5)}″ at JD(TT) ${worstAt}`).toBeLessThan(0.5);
  }, TIMEOUT_MS);

  it('Moon latitude and distance, full series', () => {
    let worstLat = 0;
    let worstDist = 0;
    for (const date of instants(33, Math.min(MOON_SAMPLE, 1500))) {
      const truth = moonApparentReference(jdTtOf(date));
      const mine = getMoonPosition(date);
      worstLat = Math.max(worstLat, Math.abs(mine.latitude - truth.latDeg) * 3600);
      worstDist = Math.max(worstDist, Math.abs(mine.distance - truth.distance));
    }
    expect(worstLat, `worst latitude ${worstLat.toFixed(5)}″`).toBeLessThan(0.3);
    expect(worstDist, `worst distance ${worstDist.toFixed(5)} km`).toBeLessThan(0.3);
  }, TIMEOUT_MS);

  it('Sun latitude and distance', () => {
    let worstLat = 0;
    let worstDist = 0;
    for (const date of instants(44, Math.min(SUN_SAMPLE, 3000))) {
      const truth = sunApparentReference(jdTtOf(date));
      const mine = getSunPosition(date);
      worstLat = Math.max(worstLat, Math.abs(mine.latitude - truth.latDeg) * 3600);
      worstDist = Math.max(worstDist, Math.abs(mine.distance - truth.distance));
    }
    // 0.4″ budget for Earth's B, same change as the longitude above. The Sun's
    // latitude never exceeds 1.2″ in the first place, so this is a bound on a
    // quantity that is itself almost zero; it feeds declination, where 0.35″ is
    // 0.023 s of sunrise. Measured 0.35119″.
    expect(worstLat, `worst latitude ${worstLat.toFixed(5)}″`).toBeLessThan(0.45);
    expect(worstDist, `worst distance ${worstDist.toExponential(3)} AU`).toBeLessThan(3e-6);
  }, TIMEOUT_MS);

  /**
   * §36.0 H for the one optimization that is pure arithmetic rather than
   * truncation. `sumNutation` folds each term's integer multipliers together by
   * angle addition instead of calling `Math.sin` and `Math.cos` per term — 28
   * transcendentals instead of 156. Nothing about the *answer* is supposed to
   * change, so unlike every other bound in this file the threshold here is set
   * by floating-point rounding rather than by a budget: 10⁻⁹″ is six orders
   * below the 0.005″ the truncation itself costs, and about six orders *above*
   * the ~10⁻¹⁵″ the recurrence actually accumulates.
   *
   * Deliberately at the full 100,000 even on an everyday run. The reference is
   * cheap here (78 terms, not 37,872), so there is no reason to sample — and
   * this is the one place where a rare argument combination, rather than a
   * smooth truncation residual, is what could go wrong.
   */
  it(`nutation by angle addition vs direct summation, ${SELF_SAMPLE} instants`, () => {
    let worstPsi = 0;
    let worstEps = 0;
    let worstAt = 0;
    for (const date of instants(77, SELF_SAMPLE)) {
      const t = ttDaysSinceJ2000(date) / 36525;
      const mine = nutation(t);
      const truth = truncatedNutationDirectReference(t);
      const dPsi = Math.abs(mine.dpsi - truth.dpsi);
      const dEps = Math.abs(mine.deps - truth.deps);
      if (dPsi > worstPsi) { worstPsi = dPsi; worstAt = t; }
      if (dEps > worstEps) worstEps = dEps;
    }
    expect(worstPsi, `worst |Δψ| ${worstPsi.toExponential(3)}″ at t=${worstAt}`).toBeLessThan(1e-9);
    expect(worstEps, `worst |Δε| ${worstEps.toExponential(3)}″`).toBeLessThan(1e-9);
  }, TIMEOUT_MS);

  /**
   * The truncation budget itself — the one number the series header quotes that
   * nothing else here measures.
   *
   * The angle-addition test above compares the truncated series against *itself*
   * summed directly, so it says nothing about what dropping 2,336 of 2,414 terms
   * costs. This compares the shipped 78 terms against `nutationReference`, which
   * evaluates the untruncated IERS tables, and is what makes the header's
   * figures checked rather than asserted.
   *
   * The bound is span-dependent, which is why the span is stated: the residual
   * is a beat of long-period terms, and widening the window catches more of the
   * envelope. Measured worst case is 0.00578″ / 0.00325″ over 1900–2100 and
   * 0.00607″ / 0.00382″ over 1800–2200 — so the 0.0065″ / 0.0045″ asserted here
   * has roughly 7% headroom over the wider span and is not a tight fit that a
   * harmless coefficient reshuffle would trip.
   */
  it('truncated nutation vs the untruncated IERS series, 1800–2200', () => {
    let worstPsi = 0;
    let worstEps = 0;
    let worstAt = 0;
    const STEPS = 20_000;
    for (let i = 0; i <= STEPS; i++) {
      const t = -2 + (4 * i) / STEPS;          // Julian centuries TT from J2000
      const mine = nutation(t);
      const truth = nutationReference(t);
      const dPsi = Math.abs(mine.dpsi - truth.dpsi);
      const dEps = Math.abs(mine.deps - truth.deps);
      if (dPsi > worstPsi) { worstPsi = dPsi; worstAt = t; }
      if (dEps > worstEps) worstEps = dEps;
    }
    expect(worstPsi, `worst |Δψ| ${worstPsi.toFixed(6)}″ at t=${worstAt}`).toBeLessThan(0.0065);
    expect(worstEps, `worst |Δε| ${worstEps.toFixed(6)}″`).toBeLessThan(0.0045);
  }, TIMEOUT_MS);

  it(`the shipped path stays well-formed over ${SELF_SAMPLE} instants`, () => {
    // Everything checkable without the expensive reference, at the full sample
    // size §36.0 H asks for: no NaN anywhere in the span, longitudes inside
    // [0, 360), distances inside the physical range. Assertions are accumulated
    // rather than made per instant — 400,000 `expect` calls cost more than the
    // ephemeris they are checking.
    let bad = 0;
    let firstBad = '';
    for (const date of instants(55, SELF_SAMPLE)) {
      const moonLon = getTropicalMoonLongitude(date);
      const sunLon = getTropicalSunLongitude(date);
      const ok = Number.isFinite(moonLon) && Number.isFinite(sunLon)
        && moonLon >= 0 && moonLon < 360 && sunLon >= 0 && sunLon < 360;
      if (!ok) { bad++; if (!firstBad) firstBad = `${date.toISOString()} moon=${moonLon} sun=${sunLon}`; }
    }
    expect(bad, `first malformed result at ${firstBad}`).toBe(0);

    // The two lunar paths differ only in whether the latitude and distance
    // series are the coarse or the full ones, so their gap measures directly
    // what the coarse series cost — the claim `moon.ts` makes in prose.
    let worstPathGap = 0;
    let outOfRange = 0;
    for (const date of instants(66, 20_000)) {
      const full = getMoonPosition(date);
      worstPathGap = Math.max(worstPathGap, Math.abs(deltaArcsec(getTropicalMoonLongitude(date), full.longitude)));
      if (full.distance < 356_000 || full.distance > 407_000) outOfRange++;
    }
    expect(outOfRange).toBe(0);
    expect(
      worstPathGap,
      `coarse-vs-full lunar longitude gap ${worstPathGap.toFixed(5)}″ — moon.ts claims ~0.005″`,
    ).toBeLessThan(0.02);
  }, TIMEOUT_MS);
});
