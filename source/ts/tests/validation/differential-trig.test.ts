/**
 * @tier 2  this repository: the shipped trigonometry against the platform's.
 *
 * `Math.sin` is the reference for accuracy only, deliberately not for
 * bit-identity: ECMA-262 does not require it to be correctly rounded, and
 * engines differ in the last few ULPs, which is why the library ships its own.
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
  { name: '10²: VSOP low-order arguments', range: 100, samples: 2_000_000 },
  { name: '5 × 10³: ELP phases over 1900-2100', range: 5000, samples: 2_000_000 },
  { name: '10⁵: the fastest VSOP arguments', range: 100_000, samples: 2_000_000 },
  { name: '10⁶: headroom', range: 1_000_000, samples: 2_000_000 },
] as const;

/**
 * 3x the measured worst (6.02e-12 for sine, 5.26e-13 for cosine, flat across
 * every range here). It cannot usefully go below ~1e-15, where this would be
 * measuring the platform's own rounding instead.
 */
const BOUND = 2e-11;

describe('differential: own sin/cos vs the platform’s', () => {
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
    let worstPythagoras = 0;
    let worstShift = 0;
    let worstOdd = 0;
    for (const x of uniform(99, 500_000, 5000)) {
      worstPythagoras = Math.max(worstPythagoras, Math.abs(sin(x) ** 2 + cos(x) ** 2 - 1));
      worstShift = Math.max(worstShift, Math.abs(cos(x) - sin(x + Math.PI / 2)));
      worstOdd = Math.max(worstOdd, Math.abs(sin(-x) + sin(x)), Math.abs(cos(-x) - cos(x)));
    }
    // 8x the derivation: two kernels truncating at ~6e-12, squared and summed.
    expect(worstPythagoras, `sin² + cos² − 1 = ${worstPythagoras.toExponential(3)}`).toBeLessThan(1e-10);
    // Looser than BOUND because `x + π/2` rounds before the reduction sees it:
    // at |x| = 5000 that is already ~5e-13 of argument.
    expect(worstShift, `cos(x) − sin(x + π/2) = ${worstShift.toExponential(3)}`).toBeLessThan(1e-9);
    // Parity is exact: the reduction is odd in x, so this is not a tolerance.
    expect(worstOdd, `parity violated by ${worstOdd.toExponential(3)}`).toBe(0);
  }, 60_000);

  /**
   * Nothing below is branched for; it is what the Cody-Waite reduction happens
   * to produce, and this test forbids that changing silently.
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
          expect(
            Object.is(ours, theirs),
            `${name}(${String(x)}) = ${String(ours)}, platform gives ${String(theirs)}`,
          ).toBe(true);
        }
      }
    }
  });

  /**
   * `Math.sin(-0)` is `-0`; ours is `+0`, because `q = Math.round(-0 / π)` is
   * `-0` and `(-0) - (-0)` is `+0`, losing the sign before the kernel.
   * Deliberately not fixed: recovering it needs a branch in `reduce`, the
   * hottest function in the library, and `-0` cannot reach `sin` from a phase
   * with a nonzero constant term anyway.
   */
  it('differs from the platform in exactly one place: the sign of zero', () => {
    expect(Object.is(Math.sin(-0), -0), 'the platform still returns -0').toBe(true);
    expect(Object.is(sin(-0), 0), 'ours returns +0, by way of the reduction').toBe(true);
    // `===` and not `toBe`: vitest's `toBe` is `Object.is` and would separate
    // the two zeroes this line exists to join.
    expect(sin(-0) === Math.sin(-0), '-0 and +0 still compare equal').toBe(true);
    expect(Object.is(cos(-0), Math.cos(-0))).toBe(true);
  });

  /**
   * The reduction's three exact subtractions hold while |q| < 2^24, which is
   * what bounds the stated |x| ~ 1e5. Past it the result is not merely less
   * accurate: at `Number.MAX_VALUE`, `q * PI_1` overflows to `Infinity`.
   */
  it('holds to its stated range, and gives up outside it', () => {
    for (const x of [1e5, -1e5, 99999.5, 12345.6789]) {
      expect(Math.abs(sin(x) - Math.sin(x)), `sin(${x})`).toBeLessThan(1e-9);
      expect(Math.abs(cos(x) - Math.cos(x)), `cos(${x})`).toBeLessThan(1e-9);
    }
    expect(Number.isFinite(Math.sin(Number.MAX_VALUE))).toBe(true);
    expect(Number.isFinite(sin(Number.MAX_VALUE)), 'the reduction overflows').toBe(false);
  });
});
