/**
 * Structural diff of two dump.mjs outputs: non-numeric leaves, array lengths and
 * key order are invariants, numeric and Date leaves are summarised.
 *
 *   node diff.mjs before.json after.json
 */
import { readFileSync } from 'node:fs';

const before = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const after = JSON.parse(readFileSync(process.argv[3], 'utf8'));

// Both emitted forms; miss `*Local` and every time shift reads as a break.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const ISO_OFFSET = /(Z|[+-]\d{2}:\d{2})$/;

const invariants = [];
const numeric = new Map();
const times = new Map();

function note(map, leaf, delta, path, b, a) {
  let e = map.get(leaf);
  if (!e) { e = { max: 0, count: 0, worstPath: '', worstBefore: null, worstAfter: null }; map.set(leaf, e); }
  e.count++;
  if (Math.abs(delta) > Math.abs(e.max)) {
    e.max = delta; e.worstPath = path; e.worstBefore = b; e.worstAfter = a;
  }
}

function leafName(path) {
  const parts = path.split('.').filter((p) => !/^\d+$/.test(p) && !p.includes('|'));
  return parts.slice(-2).join('.') || path;
}

function walk(b, a, path) {
  if (b === a) return;
  if (b === null || a === null || b === undefined || a === undefined) {
    invariants.push({ path, before: b, after: a });
    return;
  }
  if (typeof b !== typeof a) { invariants.push({ path, before: b, after: a }); return; }

  if (typeof b === 'number') {
    if (b !== a) note(numeric, leafName(path), a - b, path, b, a);
    return;
  }
  if (typeof b === 'string') {
    if (ISO.test(b) && ISO.test(a)) {
      if (ISO_OFFSET.exec(b)[0] !== ISO_OFFSET.exec(a)[0]) {
        // The instant may move; the zone it is rendered in may not.
        invariants.push({ path: `${path}.<offset>`, before: b, after: a });
        return;
      }
      const d = Date.parse(a) - Date.parse(b);
      if (d !== 0) note(times, leafName(path), d, path, b, a);
    } else if (b !== a) {
      invariants.push({ path, before: b, after: a });
    }
    return;
  }
  if (typeof b === 'boolean') { invariants.push({ path, before: b, after: a }); return; }

  if (Array.isArray(b) !== Array.isArray(a)) { invariants.push({ path, before: 'array?', after: 'array?' }); return; }
  if (Array.isArray(b)) {
    if (b.length !== a.length) {
      invariants.push({ path: `${path}.length`, before: b.length, after: a.length });
      return;
    }
    for (let i = 0; i < b.length; i++) walk(b[i], a[i], `${path}.${i}`);
    return;
  }
  const kb = Object.keys(b), ka = Object.keys(a);
  if (kb.join(',') !== ka.join(',')) {
    invariants.push({ path: `${path}.<keys>`, before: kb.join(','), after: ka.join(',') });
    return;
  }
  for (const k of kb) walk(b[k], a[k], `${path}.${k}`);
}

const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
for (const k of keys) walk(before[k], after[k], k);

console.log(`\n=== INVARIANT / STRUCTURAL CHANGES (must be 0) : ${invariants.length} ===`);
for (const c of invariants.slice(0, 40)) {
  console.log(`  ${c.path}\n     before=${JSON.stringify(c.before)}\n     after =${JSON.stringify(c.after)}`);
}
if (invariants.length > 40) console.log(`  ... and ${invariants.length - 40} more`);

console.log(`\n=== NUMERIC LEAF DELTAS : ${numeric.size} distinct leaves ===`);
const numSorted = [...numeric.entries()].sort((x, y) => Math.abs(y[1].max) - Math.abs(x[1].max));
for (const [leaf, e] of numSorted) {
  console.log(`  ${leaf.padEnd(34)} max |Δ| = ${Math.abs(e.max).toExponential(3)}  over ${e.count} changed values`);
  console.log(`      worst: ${e.worstPath}  ${e.worstBefore} -> ${e.worstAfter}`);
}

console.log(`\n=== DATE/TIME LEAF SHIFTS : ${times.size} distinct leaves ===`);
const tSorted = [...times.entries()].sort((x, y) => Math.abs(y[1].max) - Math.abs(x[1].max));
for (const [leaf, e] of tSorted) {
  console.log(`  ${leaf.padEnd(34)} max |Δt| = ${Math.abs(e.max)} ms  over ${e.count} changed values`);
  console.log(`      worst: ${e.worstPath}  ${e.worstBefore} -> ${e.worstAfter}`);
}
console.log('');
