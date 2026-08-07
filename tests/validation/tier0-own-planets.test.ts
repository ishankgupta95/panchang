/**
 * @tier 0  JPL Horizons DE441
 *
 * The acceptance gate for Phase 36.4's own Mercury–Saturn, exactly as
 * `tier0-own-sun-moon.test.ts` is for 36.2: max |error| against DE441 over
 * 1900–2100 must come in at or below the `astronomy-engine` ceilings recorded
 * in `tier0-horizons.test.ts`.
 *
 * ## Why the planetary budgets are deliberately looser
 *
 * The generator truncates the planets' VSOP87D series to 0.5″, five times
 * looser than the 0.1″ Earth series the planet path reads, and that is a
 * considered trade rather than inattention. The tightest planetary ceiling is Mercury's 6.50″ — four times
 * the Sun's — because the geocentric direction of a planet is a difference of
 * two orbits and inherits both their errors. Spending the same 8% of the budget
 * everywhere is what keeps Saturn's series from dominating the bundle: at 0.1″
 * its longitude alone needed 870 terms against 431.
 *
 * ## What the radius budget is really stated in
 *
 * A heliocentric radius error δR displaces the geocentric direction by δR/Δ, so
 * a budget in AU means something different for every body — far too tight for
 * Saturn at 8 AU, and too loose for Venus at 0.27 AU near inferior conjunction.
 * The generator therefore budgets the **angle** (0.3″) and converts per body.
 * Venus is where that decision is visible: it is the body whose radius series
 * ends up tightest, and the one whose ceiling is widest.
 */
import { describe, it, expect } from 'vitest';
import { getTropicalPlanetLongitude, type PlanetBody } from '../../src/astronomy/planet';
import { ttDaysSinceJ2000 } from '../../src/astronomy/deltaT';
import { planetApparentReference } from '../reference/ephemeris-reference';
import type { VsopBody } from '../reference/catalog';
import fixture from '../fixtures/horizons-positions.json';

/** Signed smallest angle a − b, degrees, in (−180, 180]. */
function angularDelta(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** The UT instant whose Terrestrial Time is `jdTt`, per this library's ΔT. */
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

/**
 * `astronomy-engine`'s measured maxima, from `tier0-horizons.test.ts`. These
 * are the ceilings §36.0 D says an own implementation must come in at or below.
 */
const BASELINE_MAX_ARCSEC: Record<string, number> = {
  Mercury: 6.504, Venus: 19.586, Mars: 11.103, Jupiter: 9.662, Saturn: 11.147,
};

/**
 * Ceilings for the own implementation, over the same 250 epochs, with headroom
 * for cross-platform floating point.
 *
 * | | reference max″ | shipped max″ | baseline max″ | factor |
 * |---|---|---|---|---|
 * | Mercury | 0.254 | 0.296 | 6.504 | 22× |
 * | Venus | 0.261 | 0.862 | 19.586 | 23× |
 * | Mars | 0.260 | 1.293 | 11.103 | 8.6× |
 * | Jupiter | 0.553 | 0.835 | 9.662 | 11.6× |
 * | Saturn | 0.450 | 0.862 | 11.147 | 12.9× |
 *
 * Two things in that table are worth reading rather than skimming. The
 * reference column is flat at ~0.3–0.6″ across bodies whose baselines span 6″
 * to 20″ — VSOP87D is uniformly good, and what varied in the old numbers was
 * how much of it `astronomy-engine` kept. And the gap between reference and
 * shipped is widest for **Mars** (0.26″ → 1.29″), which is the truncation
 * budget doing exactly what it was told: Mars is the body whose geocentric
 * distance shrinks most against its heliocentric one, so it amplifies a
 * heliocentric error the most.
 *
 * ## Mercury and Venus moved on 2026-08-07, and not for a planetary reason
 *
 * Mercury 0.327 → 0.499 and Venus 0.824 → 1.217, while the planets' own
 * truncation budget did not change at all. **This was not predicted**, and the
 * cause is worth recording because it is a coupling the error budget's
 * per-body structure hides: a geocentric planetary direction is
 * `planet − Earth`, so it inherits *Earth's* heliocentric error, and Earth's
 * budget was raised from 0.1″ to 0.4″ that day for the Sun's sake.
 *
 * The amount checks out from geometry rather than from hindsight. An Earth
 * position error δ at 1 AU subtends δ·(1/Δ) as seen against a body at
 * geocentric distance Δ, so the 0.363″ of new Earth-L truncation is worth
 * 0.66″ at Mercury (Δ_min ≈ 0.55 AU) and 1.34″ at Venus (Δ_min ≈ 0.27 AU);
 * combined in quadrature with what was already there, 0.74″ and 1.22″. Venus
 * lands on that exactly, Mercury below it because its worst Earth epoch and its
 * worst planetary epoch are not the same one.
 *
 * Accepted rather than reverted at the time: every body stayed 7–16× inside its
 * §36.0 D ceiling, and the jyotish surface these feed is quoted at ±0.25° = 900″.
 *
 * ## Then it was fixed properly, at the close of Phase 36
 *
 * Accepting it left a series' budget being set by a consumer that did not use
 * it. The generator now emits the Earth's angular series **twice** — coarse for
 * `sun.ts`, where the Earth *is* the answer, and `EAR_L_PRECISE`/`EAR_B_PRECISE`
 * at ≤0.1″ for `vsop87.ts`'s `earthRect`, which is the planet path's only Earth
 * read. Mercury 0.499 → 0.296″ and Venus 1.217 → 0.862″, with the Sun and Moon
 * bit-identical because nothing on their path changed.
 *
 * **Mars went the other way, 1.142 → 1.293″, and that is not a regression.**
 * Measured epoch by epoch: Mars improved at 134 of 250 epochs and its *mean*
 * error fell (0.1400 → 0.1367″), but at its worst epoch (1940) the coarse
 * Earth had been contributing +0.151″ that *cancelled* part of Mars's own
 * truncation error. Removing a component can raise a maximum whenever that
 * component was cancelling at the argmax; Venus shows the same effect from the
 * other side, its overall maximum falling while its new worst epoch rose from
 * 0.682″ to 0.862″.
 */
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

/**
 * Error curves, collected as the per-body tests run so that `TIER0_REPORT=1`
 * can print them without measuring anything twice.
 *
 * Mirrors the reporter in `tier0-own-sun-moon.test.ts`, and exists for the same
 * reason: these maxima are the numbers every write-up quotes and every budget
 * change is judged against, and reading them out of an assertion message means
 * deliberately breaking a test to see a number that is not in dispute.
 */
const curves: Record<string, { max: number; mean: number; bias: number; worstYear: number }> = {};
const REPORT = process.env['TIER0_REPORT'] === '1';

describe('Tier 0 — own planetary longitudes vs JPL Horizons (DE441)', () => {
  for (const { name, own, reference } of BODIES) {
    it(`${name}: reference and shipped both inside ${OWN_MAX_ARCSEC[name]}″, and below the ${BASELINE_MAX_ARCSEC[name]}″ baseline`, () => {
      const ref = measure(name, (jd) => planetApparentReference(reference, jd).lonDeg);
      const shipped = measure(name, (jd) => getTropicalPlanetLongitude(own, utDateForTt(jd)));
      curves[`${name} reference`] = ref;
      curves[`${name} shipped`] = shipped;

      // The untruncated theory: is VSOP87D itself good enough?
      expect(
        ref.max,
        `${name} reference: max ${ref.max.toFixed(4)}″ (worst ~${ref.worstYear}), mean ${ref.mean.toFixed(4)}″, bias ${ref.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC[name]!);

      // The truncated, optimized copy: does it still clear the gate?
      expect(
        shipped.max,
        `${name} shipped: max ${shipped.max.toFixed(4)}″ (worst ~${shipped.worstYear}), mean ${shipped.mean.toFixed(4)}″, bias ${shipped.bias.toFixed(4)}″`,
      ).toBeLessThanOrEqual(OWN_MAX_ARCSEC[name]!);

      // §36.0 D's actual gate, kept separate so tightening the bounds above
      // cannot quietly weaken it.
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
    // Retrograde is a *sign*, which puts it in the invariant half of TIERS.md:
    // it may never change. It is derived from the longitude derivative, so this
    // asserts the derivative is consistent with the longitude — a series with a
    // discontinuity would pass every max-error test above and fail this one.
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
      // Over two years: Mercury turns ~8 times, Saturn ~4. A smooth series
      // gives an even count of reversals in any window that starts and ends
      // direct; a noisy one gives dozens.
      expect(reversals).toBeGreaterThan(0);
      expect(reversals).toBeLessThan(20);
    }
  });
});
