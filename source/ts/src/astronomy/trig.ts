/** Deliberately not `Math.sin` / `Math.cos`, which are not specified to be correctly
 * rounded and so differ across V8, JavaScriptCore and Hermes: a tithi boundary
 * root-found on them would come out per-engine. */

/** π as three ≤29-bit doubles; `Math.PI`'s 53-bit truncation is the error this avoids. */
const PI_1 = 3.141592651605606;
const PI_2 = 1.9841871617964912e-9;
const PI_3 = -2.4354103367885187e-18;

const INVERSE_PI = 1 / Math.PI;

let reducedR = 0;
let reducedOdd = false;

function reduce(x: number): void {
  const q = Math.round(x * INVERSE_PI);
  reducedR = ((x - q * PI_1) - q * PI_2) - q * PI_3;
  reducedOdd = (q & 1) === 1;
}

/** Valid for |x| below ~10⁵, the range these series produce. */
export function sin(x: number): number {
  reduce(x);
  const r = reducedR;
  const r2 = r * r;
  const p = r * (1 + r2 * (-1 / 6 + r2 * (1 / 120 + r2 * (-1 / 5040
    + r2 * (1 / 362880 + r2 * (-1 / 39916800 + r2 * (1 / 6227020800
      - r2 / 1307674368000)))))));
  return reducedOdd ? -p : p;
}

export function cos(x: number): number {
  reduce(x);
  const r = reducedR;
  const r2 = r * r;
  const p = 1 + r2 * (-1 / 2 + r2 * (1 / 24 + r2 * (-1 / 720 + r2 * (1 / 40320
    + r2 * (-1 / 3628800 + r2 * (1 / 479001600
      + r2 * (-1 / 87178291200 + r2 / 20922789888000)))))));
  return reducedOdd ? -p : p;
}
