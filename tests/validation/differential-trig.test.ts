/**
 * @tier 2  this repository — the shipped trigonometry against the platform's
 *
 * PLAN.md §36.0 H for `src/astronomy/trig.ts`. Every other differential test in
 * this directory compares a fast implementation against a slow one that had to
 * be *written*; this one is the easy case, because the reference already exists
 * on every platform and can be sampled exhaustively.
 *
 * ## What is being claimed
 *
 * `Math.sin` is the reference **for accuracy only**, and deliberately not for
 * bit-identity. ECMA-262 does not require correct rounding of `Math.sin`, and
 * V8, JavaScriptCore and Hermes differ in the last few ULPs — which is why this
 * library computes its own: a tithi boundary found by root-finding on a sum of
 * several hundred sines otherwise lands a few microseconds apart on iOS and on
 * Android, and "the same input gives the same answer everywhere" is worth more
 * here than matching any one engine.
 *
 * So the assertion is a **bound**, and the bound has to be read against the
 * amplitudes it multiplies rather than in the abstract:
 *
 * | | value |
 * |---|---|
 * | ELP's largest longitude term | 22,639″ |
 * | sum of \|amplitude\| over the whole shipped lunar longitude series | ~35,000″ |
 * | measured worst |Δsin| | 6.0 × 10⁻¹² |
 * | worst-case arcseconds if *every* term erred by that, same sign | **2.1 × 10⁻⁷″** |
 * | the truncation budget above it | 0.4″ |
 * | the generator's own quantization budget | 0.005″ |
 *
 * ## The ranges
 *
 * Sampled where the series actually live, not uniformly over the doubles. ELP's
 * phases reach |x| ≈ 5 × 10³ over the supported span; VSOP's `B + C·τ` reaches
 * ≈ 10⁵ for the fastest planetary arguments. 10⁶ is sampled as headroom. The
 * reduction is exact for |q| < 2²⁴ ≈ 1.7 × 10⁷, so 10⁶ is well inside it — but
 * the claim is what is measured, not what the derivation permits.
 */
import { describe, it, expect } from 'vitest';
import { sin, cos } from '../../src/astronomy/trig';

/** Numerical Recipes' `ranqd1`, so the sample can be reproduced. */
function* uniform(seed: number, count: number, range: number): Generator<number> {
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield ((s / 4294967296) * 2 - 1) * range;
  }
}

const RANGES = [
  { name: 'π (the reduced interval itself)', range: Math.PI, samples: 2_000_000 },
  { name: '10² — VSOP low-order arguments', range: 100, samples: 2_000_000 },
  { name: '5 × 10³ — ELP phases over 1900–2100', range: 5000, samples: 2_000_000 },
  { name: '10⁵ — the fastest VSOP arguments', range: 100_000, samples: 2_000_000 },
  { name: '10⁶ — headroom', range: 1_000_000, samples: 2_000_000 },
] as const;

/**
 * The bound, from the measured maxima of 2026-08-07: **6.02 × 10⁻¹²** for sine
 * and 5.26 × 10⁻¹³ for cosine — and, tellingly, *the same at every range*, from
 * |x| ≤ π to |x| ≤ 10⁶. That flatness is the check that matters: it says the
 * error is the kernel's Taylor truncation and nothing else, and that the
 * Cody–Waite reduction contributes nothing measurable even at 10⁶, where a
 * split built on `Math.PI` would already be leaking 4 × 10⁻¹¹.
 *
 * 2 × 10⁻¹¹ is 3× the measured worst. It cannot usefully be tightened much
 * further: below ~10⁻¹⁵ this would be measuring the platform's error rather
 * than ours, `Math.sin` not being correctly rounded.
 */
const BOUND = 2e-11;

describe('§36.0 H — own sin/cos vs the platform’s', () => {
  for (const { name, range, samples } of RANGES) {
    it(`|x| ≤ ${name}`, () => {
      let worstSin = 0;
      let worstCos = 0;
      let worstAt = 0;
      for (const x of uniform(0x5eed + range, samples, range)) {
        const ds = Math.abs(sin(x) - Math.sin(x));
        const dc = Math.abs(cos(x) - Math.cos(x));
        if (ds > worstSin) { worstSin = ds; worstAt = x; }
        if (dc > worstCos) worstCos = dc;
      }
      expect(worstSin, `worst |Δsin| ${worstSin.toExponential(3)} at x=${worstAt}`)
        .toBeLessThan(BOUND);
      expect(worstCos, `worst |Δcos| ${worstCos.toExponential(3)}`).toBeLessThan(BOUND);
    }, 120_000);
  }

  it('the identities a series evaluation actually depends on', () => {
    // Not decoration. A reduction that lands in the wrong quadrant passes an
    // amplitude test at small |x| and fails here, because these hold across the
    // ±π/2 boundaries where the sign flips.
    let worstPythagoras = 0;
    let worstShift = 0;
    let worstOdd = 0;
    for (const x of uniform(99, 500_000, 5000)) {
      worstPythagoras = Math.max(worstPythagoras, Math.abs(sin(x) ** 2 + cos(x) ** 2 - 1));
      // cos(x) = sin(x + π/2) — the relation `evaluateVsop` relies on when its
      // cosine series is read beside ELP's sine series in the same frame.
      worstShift = Math.max(worstShift, Math.abs(cos(x) - sin(x + Math.PI / 2)));
      worstOdd = Math.max(worstOdd, Math.abs(sin(-x) + sin(x)), Math.abs(cos(-x) - cos(x)));
    }
    // Two kernels, each truncating at ~6 × 10⁻¹², so their squares' sum carries
    // about twice that. Not a free parameter: 1e-10 is 8× the derivation.
    expect(worstPythagoras, `sin² + cos² − 1 = ${worstPythagoras.toExponential(3)}`).toBeLessThan(1e-10);
    // Looser than BOUND because `x + π/2` rounds before the reduction sees it:
    // at |x| = 5000 that rounding is already ~5 × 10⁻¹³ of argument.
    expect(worstShift, `cos(x) − sin(x + π/2) = ${worstShift.toExponential(3)}`).toBeLessThan(1e-9);
    // Parity is exact — the reduction is odd in x and the kernels have the
    // right symmetry — so this one is not a tolerance.
    expect(worstOdd, `parity violated by ${worstOdd.toExponential(3)}`).toBe(0);
  }, 60_000);

  /**
   * The arguments a series evaluation never produces, and what happens anyway.
   *
   * None of these can reach `trig.ts` from `elp.ts` or `vsop87.ts`: a phase is
   * a polynomial in `t` with |t| ≤ 1.5 and finite coefficients. They are pinned
   * because the module's whole justification is that it may skip the
   * argument-reduction machinery `Math.sin` carries — Payne–Hanek for arguments
   * up to 10³⁰⁸, and the special cases around them — and "we don't need that
   * range" is a claim about the *range*, not a licence to return something
   * different in kind from `Math.sin` when handed one of these.
   *
   * The behaviour below is what the Cody–Waite reduction produces on its own,
   * not something branched for: `Infinity − Infinity` is `NaN`, `±0` survives
   * the odd kernel with its sign, and a subnormal is far inside the linear
   * regime where `sin x = x`. It agrees with the platform on every one. What
   * this test forbids is that changing silently.
   */
  it('agrees with the platform on the arguments a series can never produce', () => {
    const SPECIAL = [
      Number.NaN, Infinity, -Infinity,
      0,
      Number.MIN_VALUE, -Number.MIN_VALUE, 5e-324, 2.2250738585072014e-308,
    ];
    for (const x of SPECIAL) {
      for (const [name, ours, theirs] of [
        ['sin', sin(x), Math.sin(x)],
        ['cos', cos(x), Math.cos(x)],
      ] as const) {
        if (Number.isNaN(theirs)) {
          expect(ours, `${name}(${String(x)}) should be NaN like the platform's`).toBeNaN();
        } else {
          // `Object.is`, not `toBe`: it separates +0 from −0, so a subnormal
          // collapsing to the wrong signed zero would be caught here rather than
          // compare equal.
          expect(
            Object.is(ours, theirs),
            `${name}(${String(x)}) = ${String(ours)}, platform gives ${String(theirs)}`,
          ).toBe(true);
        }
      }
    }
  });

  /**
   * The one place `trig.ts` and the platform disagree, pinned as a deviation
   * rather than folded into the test above by loosening its comparison.
   *
   * `Math.sin(-0)` is `-0`; ours is `+0`. The cause is the first step of the
   * Cody–Waite reduction: `q = Math.round(-0 / π)` is `-0`, and IEEE-754
   * round-to-nearest makes `(-0) − (-0)` equal `+0`, so the sign is gone before
   * the kernel is reached. Recovering it needs an explicit branch in `reduce`,
   * which runs several thousand times per panchang and is the single hottest
   * function in the library.
   *
   * Not fixed, and the reasoning is worth being explicit about rather than
   * leaving to a future reader's inference:
   *
   *  - `-0 === 0`, so the difference is invisible to every arithmetic operation
   *    except `1/x` and `Object.is`. Nothing in this library divides by a sine.
   *  - `-0` cannot reach `sin` from a series anyway. A phase is
   *    `p₀ + t(p₁ + t(…))` with a nonzero constant term; the arguments that
   *    reach the kernel are ELP and VSOP phases, never a signed zero.
   *  - The module already does not claim bit-identity with `Math.sin` — it
   *    claims a 6 × 10⁻¹² bound and identical results across engines, and it
   *    delivers `+0` identically on all of them.
   *
   * If `reduce` is ever rewritten, this is the assertion that says the change
   * was noticed.
   */
  it('differs from the platform in exactly one place: the sign of zero', () => {
    expect(Object.is(Math.sin(-0), -0), 'the platform still returns -0').toBe(true);
    expect(Object.is(sin(-0), 0), 'ours returns +0, by way of the reduction').toBe(true);
    // Equal as *numbers*, which is the property everything downstream relies on.
    // Written with `===` rather than `toBe`, because vitest's `toBe` is
    // `Object.is` and would separate the two zeroes this line exists to join.
    expect(sin(-0) === Math.sin(-0), '-0 and +0 still compare equal').toBe(true);
    // `cos` is even, so there is nothing to lose and it agrees exactly.
    expect(Object.is(cos(-0), Math.cos(-0))).toBe(true);
  });

  /**
   * The stated range, and what happens past it.
   *
   * `trig.ts` claims |x| below ~10⁵ and explains why: the reduction's three
   * exact subtractions hold while |q| < 2²⁴, and no ELP or VSOP phase comes near
   * that. Past it the result is not merely less accurate — at `Number.MAX_VALUE`
   * it is `Infinity`, because `Math.round(x / π)` is itself ~5.7 × 10³⁰⁷ and
   * `q * PI_1` overflows.
   *
   * Pinned so the documented range is a tested claim rather than a comment, and
   * so that anyone tempted to reuse `trig.ts` as a general-purpose `Math.sin`
   * finds out here instead of in a series they have already shipped.
   */
  it('holds to its stated range, and gives up outside it', () => {
    // Inside: the everyday accuracy claim still holds at the edge.
    for (const x of [1e5, -1e5, 99999.5, 12345.6789]) {
      expect(Math.abs(sin(x) - Math.sin(x)), `sin(${x})`).toBeLessThan(1e-9);
      expect(Math.abs(cos(x) - Math.cos(x)), `cos(${x})`).toBeLessThan(1e-9);
    }
    // Outside: not a bounded error, a different answer entirely.
    expect(Number.isFinite(Math.sin(Number.MAX_VALUE))).toBe(true);
    expect(Number.isFinite(sin(Number.MAX_VALUE)), 'the reduction overflows').toBe(false);
  });
});
