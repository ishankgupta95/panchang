/**
 *   node tables-gate.mjs [tsDir] [goDir] [--bands=path] [--allow-pin-drift]
 *
 *   defaults: out/tables-ts-full against out/tables-go-full
 *
 * The eclipse tables' `obscuration` and `magnitude` end in the platform's
 * `asin`/`sqrt` and can never be bit-identical between V8 and Go, so they are
 * masked out and compared under the numeric band; every other byte must match.
 *
 * Exit codes: 0 clean, 1 a band or pin breach, 2 the gate could not run.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const allowPinDrift = argv.includes('--allow-pin-drift');
const bandsArg = argv.find((a) => a.startsWith('--bands='));
const BANDS = JSON.parse(readFileSync(bandsArg ? bandsArg.slice('--bands='.length) : join(HERE, 'bands.json'), 'utf8'));
const spec = BANDS.tables;
const positional = argv.filter((a) => !a.startsWith('--'));
const tsDir = positional[0] ?? join(HERE, 'out', 'tables-ts-full');
const goDir = positional[1] ?? join(HERE, 'out', 'tables-go-full');

const checks = [];
const band = (ok, label, detail) => checks.push({ severity: 'BAND', ok, label, detail });
const pin = (ok, label, detail) => checks.push({ severity: 'PIN', ok, label, detail });
const notice = (label, detail) => checks.push({ severity: 'NOTICE', ok: true, label, detail });

const listJSON = (d) => {
  if (!statSync(d, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`tables-gate: ${d} is not a directory; run the full dump on both sides first`);
    process.exit(2);
  }
  return readdirSync(d).filter((f) => f.endsWith('.json')).sort();
};
const tsFiles = listJSON(tsDir);
const goFiles = listJSON(goDir);

if (tsFiles.join(',') !== goFiles.join(',')) {
  console.error(`tables-gate: the two directories hold different files\n  ts: ${tsFiles.join(' ')}\n  go: ${goFiles.join(' ')}`);
  process.exit(2);
}
pin(tsFiles.length === spec.files, 'table file count', `${tsFiles.length} vs ${spec.files}`);

/** One `*`, matched against a basename; no directory handling. */
const globs = (pattern, name) => {
  const i = pattern.indexOf('*');
  if (i < 0) return pattern === name;
  return name.startsWith(pattern.slice(0, i)) && name.endsWith(pattern.slice(i + 1));
};

/** Mask both sides everywhere: masking what differs compares bytes equal by selection. */
const NUM = String.raw`-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?`;
const maskRe = new RegExp(String.raw`("(?:${spec.maskedKeys.join('|')})": )(${NUM})`, 'g');
const mask = (text) => text.replace(maskRe, '$1<masked>');

let byteIdenticalCount = 0;
let maskedCount = 0;
let differingLines = 0;
let worstAbs = 0;
let worstWhere = '(none)';

for (const name of tsFiles) {
  const a = readFileSync(join(tsDir, name));
  const b = readFileSync(join(goDir, name));

  const isByte = spec.byteIdentical.some((p) => globs(p, name));
  const isMasked = spec.maskedIdentical.some((p) => globs(p, name));
  if (isByte === isMasked) {
    band(false, `${name} is unclassified`, `matched byteIdentical=${isByte} maskedIdentical=${isMasked}; add it to exactly one list in bands.json`);
    continue;
  }

  if (isByte) {
    const same = a.equals(b);
    band(same, `${name} byte-identical`, same ? `${a.length} bytes` : firstDifference(a, b));
    if (same) byteIdenticalCount++;
    continue;
  }

  maskedCount++;
  const la = a.toString('utf8').split('\n');
  const lb = b.toString('utf8').split('\n');
  if (la.length !== lb.length) {
    band(false, `${name} line count`, `${la.length} vs ${lb.length}`);
    continue;
  }

  let bad = 0;
  let lines = 0;
  for (let i = 0; i < la.length; i++) {
    if (la[i] === lb[i]) continue;
    lines++;
    const ma = la[i].match(new RegExp(String.raw`^\s*"(${spec.maskedKeys.join('|')})": (${NUM}),?$`));
    const mb = lb[i].match(new RegExp(String.raw`^\s*"(${spec.maskedKeys.join('|')})": (${NUM}),?$`));
    if (!ma || !mb || ma[1] !== mb[1]) {
      band(false, `${name}:${i + 1} differs outside the masked keys`, `\n          ts: ${la[i].trim()}\n          go: ${lb[i].trim()}`);
      bad++;
      continue;
    }
    const d = Math.abs(Number(ma[2]) - Number(mb[2]));
    if (d > spec.numericAbs) {
      band(false, `${name}:${i + 1} ${ma[1]} outside the numeric band`, `|Δ| = ${d.toExponential(3)}, band ${spec.numericAbs}`);
      bad++;
    }
    if (d > worstAbs) { worstAbs = d; worstWhere = `${name}:${i + 1} ${ma[1]}`; }
  }
  differingLines += lines;

  const maskedSame = mask(a.toString('utf8')) === mask(b.toString('utf8'));
  band(maskedSame, `${name} identical outside ${spec.maskedKeys.join('/')}`,
    maskedSame ? `${lines} differing line(s), all masked keys` : 'the masked documents differ: something other than those two keys moved');
  if (bad === 0 && maskedSame) {
    // no further check
  }
}

pinOrTighten(byteIdenticalCount, spec.pins.byteIdenticalFiles, 'byte-identical files', (n) => `${n}`, true);
pin(maskedCount === spec.pins.maskedFiles, 'masked-comparison files', `${maskedCount} vs ${spec.pins.maskedFiles}`);
pinOrTighten(differingLines, spec.pins.differingLines, 'differing lines');
pinOrTighten(worstAbs, spec.pins.worstAbs, 'worst masked |Δ|', (v) => v.toExponential(17));
if (worstAbs > 0) notice('worst masked delta', `${worstAbs.toExponential(3)} at ${worstWhere}`);

/** Above the pin is a breach, below it a tightening that owes a re-pin. */
function pinOrTighten(got, want, label, fmt = String, moreIsBetter = false) {
  const worse = moreIsBetter ? got < want : got > want;
  const better = moreIsBetter ? got > want : got < want;
  if (worse) {
    pin(false, `${label} pin`, `${fmt(got)} vs pinned ${fmt(want)}`);
  } else if (better) {
    notice(`${label} TIGHTENED`, `${fmt(got)} vs pinned ${fmt(want)}, re-pin in bands.json and record the cause`);
  } else {
    pin(true, `${label} pin`, `${fmt(got)}`);
  }
}

function firstDifference(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      const line = a.subarray(0, i).toString('utf8').split('\n').length;
      return `first difference at byte ${i} (line ${line}); lengths ${a.length} vs ${b.length}`;
    }
  }
  return `identical for ${n} bytes, then lengths differ: ${a.length} vs ${b.length}`;
}

console.log(`\ntable byte gate, ${tsFiles.length} files`);
console.log(`  TS  ${tsDir}`);
console.log(`  Go  ${goDir}\n`);

let failed = 0;
for (const c of checks) {
  if (c.severity === 'NOTICE') { console.log(`  NOTICE  ${c.label}\n          ${c.detail}`); continue; }
  if (c.ok) { console.log(`  ok      [${c.severity}] ${c.label}: ${c.detail}`); continue; }
  if (c.severity === 'PIN' && allowPinDrift) { console.log(`  waived  [PIN] ${c.label}: ${c.detail}  (--allow-pin-drift)`); continue; }
  console.log(`  FAIL    [${c.severity}] ${c.label}: ${c.detail}`);
  failed++;
}
if (failed) {
  console.log(`\ntable byte gate: FAILED, ${failed} check(s)\n`);
  process.exit(1);
}
console.log('\ntable byte gate: OK\n');
