// Human report, always exits 0; `gate.mjs` is the machine gate on the bands.
// Usage: node diff.mjs before.json after.json
import { readFileSync } from 'node:fs';
import { compare, bySeverity } from './difflib.mjs';

const before = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const after = JSON.parse(readFileSync(process.argv[3], 'utf8'));

const { invariants, numeric, times } = compare(before, after);

console.log(`\n=== INVARIANT / STRUCTURAL CHANGES (must be 0) : ${invariants.length} ===`);
for (const c of invariants.slice(0, 40)) {
  console.log(`  ${c.path}\n     before=${JSON.stringify(c.before)}\n     after =${JSON.stringify(c.after)}`);
}
if (invariants.length > 40) console.log(`  ... and ${invariants.length - 40} more`);

console.log(`\n=== NUMERIC LEAF DELTAS : ${numeric.size} distinct leaves ===`);
for (const [leaf, e] of bySeverity(numeric)) {
  console.log(`  ${leaf.padEnd(34)} max |Δ| = ${Math.abs(e.max).toExponential(3)}  over ${e.count} changed values`);
  console.log(`      worst: ${e.worstPath}  ${e.worstBefore} -> ${e.worstAfter}`);
}

console.log(`\n=== DATE/TIME LEAF SHIFTS : ${times.size} distinct leaves ===`);
for (const [leaf, e] of bySeverity(times)) {
  console.log(`  ${leaf.padEnd(34)} max |Δt| = ${Math.abs(e.max)} ms  over ${e.count} changed values`);
  console.log(`      worst: ${e.worstPath}  ${e.worstBefore} -> ${e.worstAfter}`);
}
console.log('');
