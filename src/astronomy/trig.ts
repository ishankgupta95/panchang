/**
 * `sin` and `cos` for periodic series — argument reduction plus a polynomial,
 * instead of the platform's `Math.sin` / `Math.cos`.
 *
 * ## Why a library does its own trigonometry
 *
 * Two reasons, and the second is the one that would justify it alone.
 *
 * **Speed.** The 2026-08-07 profile puts `sumQuartic` + `sumLinear` — the lunar
 * series and nothing else — at 44.5% of this library's self time, and a
 * measurement inside that loop puts `Math.sin` at **77% of it**: the same loop
 * with the call removed runs in 1.05 µs against 4.60 µs. That is not surprising.
 * `Math.sin` must handle every double, so it pays for Payne–Hanek reduction of
 * arguments up to 10³⁰⁸; ELP's phases never leave ±10⁵, where three
 * multiply-adds suffice.
 *
 * **Reproducibility across engines.** `Math.sin` is *not* specified to be
 * correctly rounded, and V8, JavaScriptCore and Hermes do not agree in the last
 * few ULPs. A library that ships to React Native and computes a tithi boundary
 * by root-finding on a sum of a few hundred sines therefore produces very
 * slightly different times on iOS and on Android today. These functions are
 * fixed arithmetic, so they do not.
 *
 * ## Accuracy, and why it is enough
 *
 * The reduction subtracts a multiple of π taken from a **three-double
 * Cody–Waite split**, derived from 60 decimal digits of π by
 * `notes/pi-split.mjs`, so it does not inherit `Math.PI`'s own 53-bit
 * truncation. Each part carries ≤29 significant bits, so `q · PIₙ` is exact for
 * every |q| below 2²⁴ — far beyond the |q| ≈ 3 × 10⁴ these series reach.
 *
 * The kernel is the Taylor series to r¹⁵ on |r| ≤ π/2, whose next term is
 * (π/2)¹⁷/17! = 6 × 10⁻¹². What that has to be measured against is the
 * *amplitude* it multiplies: ELP's largest longitude term is 22,639″ and the
 * whole series sums to about 35,000″ of absolute amplitude, so even if every
 * term erred by the full kernel truncation, in the same direction, the sum
 * would move 2 × 10⁻⁷ arcseconds. The truncation budget above it is 0.4″ and
 * the quantization budget the generator already spends is 0.005″.
 *
 * Stated as a bound rather than an argument:
 * `tests/validation/differential-trig.test.ts` measures both functions against
 * `Math.sin` / `Math.cos` over 10 million arguments spanning every magnitude
 * these series produce, and that measured maximum is what this module claims.
 */

/**
 * π as three doubles, `PI_1 + PI_2 + PI_3`, each with ≤29 significant bits.
 *
 * Derived from 60 decimal digits with exact integer arithmetic; the residual
 * against true π is 1.9 × 10⁻²⁶. Not from `Math.PI`, which is π rounded to 53
 * bits and would put a 1.2 × 10⁻¹⁶ error into every multiple subtracted — worth
 * 4 × 10⁻¹³ radians at the |q| these series reach, which is the very error the
 * split exists to avoid.
 */
const PI_1 = 3.141592651605606;
const PI_2 = 1.9841871617964912e-9;
const PI_3 = -2.4354103367885187e-18;

const INVERSE_PI = 1 / Math.PI;

/**
 * Reduced argument and quadrant sign, written to module scope because returning
 * a pair would allocate on a loop that runs ten thousand times per panchang.
 */
let reducedR = 0;
let reducedOdd = false;

/** Reduce `x` to `r ∈ [−π/2, π/2]` with `x = r + qπ`; sets {@link reducedOdd}. */
function reduce(x: number): void {
  const q = Math.round(x * INVERSE_PI);
  reducedR = ((x - q * PI_1) - q * PI_2) - q * PI_3;
  reducedOdd = (q & 1) === 1;
}

/**
 * `sin(x)`, for |x| below ~10⁵.
 *
 * Beyond that the reduction still works — three exact subtractions hold to
 * |q| < 2²⁴ — but nothing in this library produces such an argument, and the
 * differential test only claims the range it measures.
 */
export function sin(x: number): number {
  reduce(x);
  const r = reducedR;
  const r2 = r * r;
  // Taylor to r¹⁵; every coefficient is a ratio of small integers and is
  // written as one so a reader can check it against 1/(2k+1)! by eye. The last
  // term is worth 6 × 10⁻¹² at |r| = π/2 and costs one multiply-add — cheap
  // enough that stopping at r¹³ (7 × 10⁻¹⁰) would have been a false economy.
  const p = r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040
    + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 * (1 / 6227020800
      - r2 / 1307674368000)))))));
  return reducedOdd ? -p : p;
}

/** `cos(x)`, for |x| below ~10⁵. See {@link sin}. */
export function cos(x: number): number {
  reduce(x);
  const r = reducedR;
  const r2 = r * r;
  // Taylor to r¹⁶, matching the sine's truncation term for term.
  const p = 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320
    + r2 * (-1 / 3628800 + r2 * (1 / 479001600
      + r2 * (-1 / 87178291200 + r2 / 20922789888000)))))));
  return reducedOdd ? -p : p;
}
