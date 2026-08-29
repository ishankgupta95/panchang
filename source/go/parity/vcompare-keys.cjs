/**
 * Keys shared with `vcompare-adapter.cjs`; the Go binary must reproduce them byte
 * for byte, so coordinates take a fixed 6 decimals: Go's `FormatFloat(x, 'g', -1,
 * 64)` and JS's `String(x)` disagree on shortest round-trip for some values.
 */
'use strict';

const num = (x) => Number(x).toFixed(6);
const inst = (d) => new Date(d).toISOString();

const KEYS = {
  getDailyPanchang: ([date, loc, opts]) =>
    `${inst(date)}|${num(loc.latitude)}|${num(loc.longitude)}|${String(opts.timezone)}`,
  getUpcomingLunarEclipse: ([date, loc, count]) =>
    `${inst(date)}|${num(loc.latitude)}|${num(loc.longitude)}|${count === undefined ? '' : String(count)}`,
  getUpcomingSolarEclipse: ([date, loc, count]) =>
    `${inst(date)}|${num(loc.latitude)}|${num(loc.longitude)}|${count === undefined ? '' : String(count)}`,
};

function resolveTarget(spec) {
  const { resolve } = require('node:path');
  if (!spec) throw new Error('vcompare: no module specified');
  return spec.startsWith('/') ? spec : resolve(process.cwd(), spec);
}

module.exports = { KEYS, resolveTarget };
