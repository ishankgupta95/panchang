#!/usr/bin/env node
/**
 * Derive the three-double Cody-Waite split of pi used by `src/astronomy/trig.ts`.
 *
 *   node notes/pi-split.mjs
 *
 * It exists so those three constants can be regenerated and audited rather than
 * trusted. `Math.PI` is pi rounded to 53 bits, so a reduction built on it puts
 * 1.2e-16 into every multiple subtracted; the split below is taken from 60
 * decimal digits with exact integer arithmetic and is good to 1.9e-26.
 *
 * Each part is rounded to a fixed binary place (2^-27, 2^-56, 2^-85), which
 * caps it at ~29 significant bits — so `q * PIn` is exact in a double for every
 * |q| below 2^24, which is three orders beyond anything these series reach.
 */
// derived from 60 decimal digits with BigInt so nothing depends on Math.PI.
const SCALE = 10n ** 60n;
const PI_DIGITS = 3141592653589793238462643383279502884197169399375105820974944n; // pi * 10^60 (61 digits)
let r = PI_DIGITS; // pi * SCALE
const parts = [];
for (const shift of [27n, 56n, 85n]) {
  const twoP = 2n ** shift;
  // round(r/SCALE * 2^shift) / 2^shift
  const num = (r * twoP * 2n + SCALE) / (SCALE * 2n); // round-half-up
  const part = Number(num) / Number(twoP);
  parts.push(part);
  r = r - (num * SCALE) / twoP;
}
console.log('PI1 =', parts[0].toPrecision(21));
console.log('PI2 =', parts[1].toExponential(20));
console.log('PI3 =', parts[2].toExponential(20));
console.log('residual (pi - sum) ~', Number(r) / Number(SCALE));
// sanity: each part must be exactly representable and have few bits
for (const p of parts) {
  const s = p.toString();
  console.log('  ', s, ' round-trip ok:', Number(s) === p);
}
console.log('sum vs Math.PI:', (parts[0] + parts[1] + parts[2]) === Math.PI, parts[0] + parts[1] + parts[2] - Math.PI);
