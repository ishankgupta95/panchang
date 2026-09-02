#!/usr/bin/env node
/**
 * Derives the three-double Cody-Waite split of pi in `src/astronomy/trig.ts`.
 * Each part is rounded to a fixed binary place (2^-27, 2^-56, 2^-85), so
 * `q * PIn` stays exact for every |q| below 2^24.
 */
const SCALE = 10n ** 60n;
const PI_DIGITS = 3141592653589793238462643383279502884197169399375105820974944n;
let r = PI_DIGITS;
const parts = [];
for (const shift of [27n, 56n, 85n]) {
  const twoP = 2n ** shift;
  const num = (r * twoP * 2n + SCALE) / (SCALE * 2n);
  const part = Number(num) / Number(twoP);
  parts.push(part);
  r = r - (num * SCALE) / twoP;
}
console.log('PI1 =', parts[0].toPrecision(21));
console.log('PI2 =', parts[1].toExponential(20));
console.log('PI3 =', parts[2].toExponential(20));
console.log('residual (pi - sum) ~', Number(r) / Number(SCALE));
for (const p of parts) {
  const s = p.toString();
  console.log('  ', s, ' round-trip ok:', Number(s) === p);
}
console.log('sum vs Math.PI:', (parts[0] + parts[1] + parts[2]) === Math.PI, parts[0] + parts[1] + parts[2] - Math.PI);
