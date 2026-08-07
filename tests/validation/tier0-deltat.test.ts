/**
 * @tier 0  JPL Horizons DE441, ΔT isolated
 *
 * ## TIER 0 — ΔT, isolated (PLAN.md §36.0 G)
 *
 * "A Delta-T error shifts everything *uniformly* — test it on its own so it
 * cannot hide inside a longitude comparison." That is precisely what happens if
 * you do not: a ΔT that is 130 s wrong moves every body in proportion to its
 * mean motion, which is indistinguishable by eye from ordinary theory error,
 * and it moves every *published time* by the full 130 s.
 *
 * §36.2 has to reimplement ΔT. This file is what it will be judged against.
 *
 * Ground truth is `tests/fixtures/horizons-deltat.json`, derived from Horizons
 * by the method in `notes/horizons-deltat.mjs`.
 *
 * ### The two regimes, and why they are tested differently
 *
 * Horizons and this library do not answer the same question in both halves of
 * the span, and pretending otherwise would produce a test that passes for the
 * wrong reason:
 *
 * - **Through ~2010** both track TT − UT1 (Horizons uses observed UT1 before
 *   1972 and observed leap seconds after, which by construction stay within
 *   0.9 s of UT1). They are comparable, and they agree.
 * - **From ~2020 on** Horizons *freezes*: its own header says "the last known
 *   leap-second is used as a constant over future intervals", and the fixture
 *   shows exactly that — 69.184 s = 32.184 + 37 leap seconds, flat from 2020 to
 *   2100. The library instead extrapolates Espenak–Meeus TT − UT1, reaching
 *   202.7 s by 2100. Neither is wrong; they are answers to different questions,
 *   and asserting agreement there would be asserting a falsehood.
 */
import { describe, it, expect } from 'vitest';
import { MakeTime } from 'astronomy-engine';
import fixture from '../fixtures/horizons-deltat.json';

/** The library's effective ΔT at a UT Julian date, in seconds. */
function libraryDeltaT(jdUt: number): number {
  const ut = jdUt - 2451545.0;
  return (MakeTime(ut).tt - ut) * 86400;
}

/** TAI − UTC as of the last leap second (2017-01-01), plus TT − TAI. */
const TT_MINUS_UTC_FROZEN = 32.184 + 37;

describe('Tier 0 — ΔT (TT − UT), isolated', () => {
  it('the fixture is the one these bounds were measured against', () => {
    expect(fixture.deltaTSeconds).toHaveLength(21);
    expect(fixture.year[0]).toBe(1900);
    expect(fixture.year[20]).toBe(2100);
  });

  /**
   * Baseline: worst |library − Horizons| over 1900–2010 is **0.831 s**, at
   * 1910. Every decade is inside 0.9 s, which is not a coincidence — that is
   * the width of the UT1/UTC band that leap seconds maintain, so it is the
   * floor for any comparison between a UT1 model and a UTC-tagged source.
   *
   * A replacement ΔT is accepted only at or below this. It is not a re-pinnable
   * number: exceeding it means the new model disagrees with observed Earth
   * rotation, and every published time moves with it.
   */
  it('agrees with Horizons to ≤1.0 s over 1900–2010', () => {
    let worst = 0, worstYear = 0;
    for (let i = 0; i < fixture.year.length; i++) {
      if (fixture.year[i]! > 2010) continue;
      const diff = Math.abs(libraryDeltaT(fixture.jd[i]!) - fixture.deltaTSeconds[i]!);
      if (diff > worst) { worst = diff; worstYear = fixture.year[i]!; }
    }
    expect(worst, `worst ΔT disagreement ${worst.toFixed(3)} s at ${worstYear}`)
      .toBeLessThanOrEqual(1.0);
  });

  it("Horizons' post-2020 values are the frozen-leap-second branch, not a ΔT model", () => {
    // Establishes that the divergence below is Horizons declining to
    // extrapolate, rather than the two models disagreeing about physics.
    for (let i = 0; i < fixture.year.length; i++) {
      if (fixture.year[i]! < 2020) continue;
      expect(fixture.deltaTSeconds[i]!, `Horizons ΔT at ${fixture.year[i]}`)
        .toBeCloseTo(TT_MINUS_UTC_FROZEN, 2);
    }
  });

  /**
   * ## The consequence, stated rather than left implicit
   *
   * The library's public API takes a JS `Date`, which is **UTC**. It then adds
   * an Espenak–Meeus ΔT, which models **TT − UT1**. Those agree only for as
   * long as leap seconds keep UTC within 0.9 s of UT1.
   *
   * CGPM Resolution 4 (2022) resolved to stop inserting leap seconds by 2035.
   * If that holds, UTC stops tracking UT1 and this library's far-future times
   * carry the accumulated difference — because a ΔT error of δ seconds moves a
   * reported tithi or nakshatra end time by the full δ. (Rise/set is far less
   * affected: there the error scales by the body's motion against the 15°/hr
   * sky rotation, so 133 s of ΔT is ~0.4 s of sunrise and ~5 s of moonrise.)
   *
   * This test pins the size of that exposure so it is a known quantity rather
   * than a surprise, and so §36.2's own ΔT reproduces it deliberately.
   */
  it('pins the post-2035 UTC-vs-UT1 exposure', () => {
    const at = (year: number) =>
      libraryDeltaT(fixture.jd[fixture.year.indexOf(year)]!) - TT_MINUS_UTC_FROZEN;
    expect(at(2050)).toBeCloseTo(23.8, 0);
    expect(at(2100)).toBeCloseTo(133.5, 0);
  });

  it('is monotonic increasing across the modern span', () => {
    // A closure check that needs no fixture: the Earth's rotation has been
    // slowing throughout the era covered here, so ΔT rises. A model that dips
    // is broken in a way an accuracy bound might not catch.
    for (let i = 0; i < fixture.jd.length - 1; i++) {
      if (fixture.year[i]! < 1960) continue; // pre-1960 ΔT genuinely has flat spells
      expect(libraryDeltaT(fixture.jd[i + 1]!)).toBeGreaterThan(libraryDeltaT(fixture.jd[i]!));
    }
  });
});
