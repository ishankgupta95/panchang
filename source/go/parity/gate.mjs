/**
 *   node --max-old-space-size=4096 gate.mjs <stage> [tsDump] [goDump] [--bands=path]
 *
 * A BAND breach is a defect. A PIN records where the port measures today, far
 * inside the band, and breaches fatally too unless `--allow-pin-drift`, which CI
 * never passes. Pins are keyed by `platform/arch` because leaf counts genuinely
 * differ between darwin/arm64 and linux/x64 while every band holds on both.
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compare, bySeverity } from './difflib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOST = `${process.platform}/${process.arch}`;

const argv = process.argv.slice(2);
const allowPinDrift = argv.includes('--allow-pin-drift');
// `--bands=<path>` lets `gate.test.mjs` drive every check to a failure.
const bandsArg = argv.find((a) => a.startsWith('--bands='));
const bandsPath = bandsArg ? bandsArg.slice('--bands='.length) : join(HERE, 'bands.json');
const BANDS = JSON.parse(readFileSync(bandsPath, 'utf8'));
const positional = argv.filter((a) => !a.startsWith('--'));
const [stage, tsArg, goArg] = positional;

if (!stage || !BANDS.stages[stage]) {
  console.error(`gate: usage: node gate.mjs <${Object.keys(BANDS.stages).join('|')}> [tsDump] [goDump] [--allow-pin-drift] [--bands=path]`);
  process.exit(2);
}
const spec = BANDS.stages[stage];
const tsPath = tsArg ?? join(HERE, 'out', `dump-${spec.tsLabel}.json`);
const goPath = goArg ?? join(HERE, 'out', `dump-${spec.goLabel}.json`);

const checks = [];
const band = (ok, label, detail) => checks.push({ severity: 'BAND', ok, label, detail });
const pin = (ok, label, detail) => checks.push({ severity: 'PIN', ok, label, detail });
const notice = (label, detail) => checks.push({ severity: 'NOTICE', ok: true, label, detail });

let tsSize, goSize;
try {
  tsSize = statSync(tsPath).size;
  goSize = statSync(goPath).size;
} catch (e) {
  console.error(`gate: ${e.message}`);
  console.error('gate: produce both dumps first, see docs/ci.md');
  process.exit(2);
}

const p = spec.pins[HOST] ?? null;

// Document size is pinned because a leaf-by-leaf diff can be clean while the
// document is the wrong length, as when the harness blanks an array on one side.
if (p) {
  pin(tsSize === p.bytes.ts, `TS document bytes on ${HOST}`, `${tsSize} vs pinned ${p.bytes.ts}`);
  pin(goSize === p.bytes.go, `Go document bytes on ${HOST}`, `${goSize} vs pinned ${p.bytes.go}`);
}

const before = JSON.parse(readFileSync(tsPath, 'utf8'));
const after = JSON.parse(readFileSync(goPath, 'utf8'));
const { invariants, numeric, times } = compare(before, after);

const worstOf = (map) => {
  const sorted = bySeverity(map);
  return sorted.length ? { leaf: sorted[0][0], ...sorted[0][1], abs: Math.abs(sorted[0][1].max) } : null;
};
const totalOf = (map) => [...map.values()].reduce((n, e) => n + e.count, 0);

// Invariants: names, indices, counts, booleans, lengths, key order, offsets.
band(invariants.length === BANDS.bands.invariants, 'invariants',
  `${invariants.length}, band ${BANDS.bands.invariants}` +
  (invariants.length ? `\n      first: ${invariants.slice(0, 5).map((c) => `${c.path} ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`).join('\n      ')}` : ''));

const worstTime = worstOf(times);
band(!worstTime || worstTime.abs <= BANDS.bands.instantMs, 'published instants',
  worstTime ? `worst |Δt| = ${worstTime.abs} ms at ${worstTime.worstPath}, band ${BANDS.bands.instantMs} ms`
            : `no shifted instants, band ${BANDS.bands.instantMs} ms`);

const worstNum = worstOf(numeric);
band(!worstNum || worstNum.abs <= BANDS.bands.numericAbs, 'numeric leaves',
  worstNum ? `worst |Δ| = ${worstNum.abs.toExponential(3)} at ${worstNum.worstPath}, band ${BANDS.bands.numericAbs}`
           : `no numeric deltas, band ${BANDS.bands.numericAbs}`);

if (p) {
  pin(invariants.length === p.invariants, 'invariant count pin', `${invariants.length} vs ${p.invariants}`);
  pin(times.size === p.timeLeaves, 'shifted-instant leaf pin', `${times.size} vs ${p.timeLeaves}`);
  pinOrTighten(numeric.size, p.numericLeaves, 'numeric leaf count');
  pinOrTighten(totalOf(numeric), p.changedNumericValues, 'changed numeric values');
  pinOrTighten(worstNum ? worstNum.abs : 0, p.worstNumericAbs, 'worst numeric |Δ|', (v) => v.toExponential(17));
  pin(!worstNum || worstNum.leaf === p.worstNumericLeaf, 'worst numeric leaf',
    `${worstNum ? worstNum.leaf : '(none)'} vs ${p.worstNumericLeaf}`);
  pin(!worstNum || worstNum.worstPath === p.worstNumericPath, 'worst numeric path',
    `${worstNum ? worstNum.worstPath : '(none)'} vs ${p.worstNumericPath}`);
} else {
  notice(`${HOST} has no pin block; bands asserted, pins only reported`,
    `paste this under stages.${stage}.pins:\n` +
    `          "${HOST}": {\n` +
    `            "invariants": ${invariants.length},\n` +
    `            "timeLeaves": ${times.size},\n` +
    `            "numericLeaves": ${numeric.size},\n` +
    `            "changedNumericValues": ${totalOf(numeric)},\n` +
    `            "worstNumericLeaf": ${JSON.stringify(worstNum ? worstNum.leaf : null)},\n` +
    `            "worstNumericAbs": ${worstNum ? worstNum.abs : 0},\n` +
    `            "worstNumericPath": ${JSON.stringify(worstNum ? worstNum.worstPath : null)},\n` +
    `            "bytes": { "ts": ${tsSize}, "go": ${goSize} }\n` +
    `          }`);
}

// Below the pin something got better, which owes an explanation but must not
// block a PR.
function pinOrTighten(got, want, label, fmt = String) {
  if (got > want) {
    pin(false, `${label} pin`, `${fmt(got)} vs pinned ${fmt(want)}, above the pin`);
  } else if (got < want) {
    notice(`${label} TIGHTENED`, `${fmt(got)} vs pinned ${fmt(want)}, re-pin in bands.json and record the cause`);
  } else {
    pin(true, `${label} pin`, `${fmt(got)}`);
  }
}

console.log(`\nparity gate: stage ${stage}, host ${HOST}, node ${process.version}`);
console.log(`  TS  ${tsPath}  (${tsSize} bytes)`);
console.log(`  Go  ${goPath}  (${goSize} bytes)\n`);

let failed = 0;
for (const c of checks) {
  if (c.severity === 'NOTICE') {
    console.log(`  NOTICE  ${c.label}\n          ${c.detail}`);
    continue;
  }
  if (c.ok) {
    console.log(`  ok      [${c.severity}] ${c.label}: ${c.detail}`);
    continue;
  }
  if (c.severity === 'PIN' && allowPinDrift) {
    console.log(`  waived  [PIN] ${c.label}: ${c.detail}  (--allow-pin-drift)`);
    continue;
  }
  console.log(`  FAIL    [${c.severity}] ${c.label}: ${c.detail}`);
  failed++;
}

if (failed) {
  const bands = checks.filter((c) => !c.ok && c.severity === 'BAND').length;
  console.log(`\nparity gate: FAILED, ${failed} check(s), ${bands} of them band breaches\n`);
  process.exit(1);
}
console.log('\nparity gate: OK\n');
