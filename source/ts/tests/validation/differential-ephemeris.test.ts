/**
 * @tier 2  this repository: the shipped path against its own frozen reference
 * Both sides evaluate the same coefficients from the same bytes, so the
 * residual is truncation alone. `DIFFERENTIAL_FULL=1` runs the full 100,000.
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

const SUN_SAMPLE = FULL ? 100_000 : 4000;
const MOON_SAMPLE = FULL ? 100_000 : 1500;
const SELF_SAMPLE = 100_000;
const TIMEOUT_MS = FULL ? 30 * 60_000 : 120_000;

/** 1900-2100, the range the budgets are claimed for. */
const SPAN_DAYS = 36525;

/** Numerical Recipes' `ranqd1`. */
function* instants(seed: number, count: number): Generator<Date> {
  let s = seed >>> 0;
  const origin = Date.UTC(2000, 0, 1, 12);
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield new Date(origin + ((s / 4294967296) * 2 - 1) * SPAN_DAYS * 86_400_000);
  }
}

const jdTtOf = (d: Date): number => 2451545.0 + ttDaysSinceJ2000(d);

function deltaArcsec(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d * 3600;
}

function report(label: string, worst: number, at: number, sample: number): void {
  console.log(
    `  ${label.padEnd(18)} worst ${worst.toFixed(5)}″ over ${sample.toLocaleString('en-US')} instants`
    + `, at JD(TT) ${at.toFixed(2)}`,
  );
}

describe('differential: shipped series vs the frozen untruncated reference', () => {
  it(`Sun longitude over ${SUN_SAMPLE} instants`, () => {
    let worst = 0;
    let worstAt = 0;
    for (const date of instants(11, SUN_SAMPLE)) {
      const jd = jdTtOf(date);
      const d = Math.abs(deltaArcsec(getTropicalSunLongitude(date), sunApparentReference(jd).lonDeg));
      if (d > worst) { worst = d; worstAt = jd; }
    }
    // 0.4″ budget for Earth's L, plus nutation and light-time; measured 0.34877″ over the full 100,000.
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
    // 0.4″ longitude budget plus ~0.005″ of coarse latitude and distance; measured 0.35166″ over the full 100,000.
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
    // 0.4″ budget for Earth's B; measured 0.35119″, which is 0.023 s of sunrise through declination.
    expect(worstLat, `worst latitude ${worstLat.toFixed(5)}″`).toBeLessThan(0.45);
    expect(worstDist, `worst distance ${worstDist.toExponential(3)} AU`).toBeLessThan(3e-6);
  }, TIMEOUT_MS);

  /** 10⁻⁹″ is rounding headroom: six orders below the 0.005″ truncation, six above the ~10⁻¹⁵″ recurrence. */
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

  /** Measured 0.00607″ / 0.00382″ over this span, so the asserted bounds keep about 7% headroom. */
  it('truncated nutation vs the untruncated IERS series, 1800-2200', () => {
    let worstPsi = 0;
    let worstEps = 0;
    let worstAt = 0;
    const STEPS = 20_000;
    for (let i = 0; i <= STEPS; i++) {
      const t = -2 + (4 * i) / STEPS;
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
      `coarse-vs-full lunar longitude gap ${worstPathGap.toFixed(5)}″, moon.ts claims ~0.005″`,
    ).toBeLessThan(0.02);
  }, TIMEOUT_MS);
});
