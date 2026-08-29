/**
 * A `PT_MODULE` that delegates to a real implementation, recording every call.
 *
 *   PT_REAL_MODULE=./dist/index.cjs \
 *   VCOMPARE_OUT=go/parity/out/vcompare-ts.json \
 *   PT_MODULE=source/go/parity/vcompare-record.cjs \
 *     node generate/notes/vcompare/almanac.mjs
 */
'use strict';

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { KEYS, resolveTarget } = require('./vcompare-keys.cjs');

const real = require(resolveTarget(process.env.PT_REAL_MODULE));
const outPath = process.env.VCOMPARE_OUT || 'source/go/parity/out/vcompare-ts.json';

// Merged into whatever is at VCOMPARE_OUT, so runs accumulate, not clobber.
const recorded = {};
if (existsSync(outPath)) {
  const prior = JSON.parse(readFileSync(outPath, 'utf8'));
  for (const name of Object.keys(prior)) recorded[name] = { ...prior[name] };
}

const wrapped = {};
for (const k of Object.keys(real)) wrapped[k] = real[k];

for (const [name, keyOf] of Object.entries(KEYS)) {
  const fn = real[name];
  if (typeof fn !== 'function') continue;
  wrapped[name] = (...args) => {
    const result = fn(...args);
    (recorded[name] ??= {})[keyOf(args)] = result;
    return result;
  };
}

process.on('exit', () => {
  mkdirSync(dirname(outPath), { recursive: true });
  const sorted = {};
  for (const name of Object.keys(recorded).sort()) {
    sorted[name] = {};
    for (const key of Object.keys(recorded[name]).sort()) sorted[name][key] = recorded[name][key];
  }
  writeFileSync(outPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  process.stderr.write(
    `vcompare-record: wrote ${outPath} (${Object.entries(sorted).map(([n, m]) => `${n}=${Object.keys(m).length}`).join(', ')})\n`,
  );
});

module.exports = wrapped;
