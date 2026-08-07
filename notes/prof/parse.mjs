/**
 * Aggregates self time from a V8 .cpuprofile, by source file and by function —
 * reproducing the breakdown in notes/v5-audit.md §1.0 so the two are comparable.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
const file = join(dir, readdirSync(dir).find(f => f.endsWith('.cpuprofile')));
const p = JSON.parse(readFileSync(file, 'utf8'));

const byId = new Map(p.nodes.map(n => [n.id, n]));
const selfUs = new Map();               // nodeId -> microseconds
for (let i = 0; i < p.samples.length; i++) {
  const id = p.samples[i];
  selfUs.set(id, (selfUs.get(id) ?? 0) + (p.timeDeltas[i] ?? 0));
}
const total = [...selfUs.values()].reduce((a, b) => a + b, 0);

const bucketOf = (url, fn) => {
  if (url.includes('astronomy-engine')) return 'astronomy-engine';
  if (url.includes('/prof/scan.mjs')) return 'panchang-ts (our code)';
  if (!url || url.startsWith('node:')) return fn === '(garbage collector)' ? 'GC' : 'node internals';
  return 'other';
};

const buckets = new Map(), fns = new Map();
for (const [id, us] of selfUs) {
  const n = byId.get(id); if (!n) continue;
  const { functionName: fn = '(anonymous)', url = '' } = n.callFrame;
  const b = bucketOf(url, fn);
  buckets.set(b, (buckets.get(b) ?? 0) + us);
  const key = `${b === 'astronomy-engine' ? 'AE' : b === 'GC' ? 'GC' : 'ours'}:${fn || '(anonymous)'}`;
  fns.set(key, (fns.get(key) ?? 0) + us);
}

const pct = us => `${((us / total) * 100).toFixed(1)}%`;
console.log(`total sampled: ${(total / 1000).toFixed(0)} ms\n`);
console.log('BY COMPONENT (self time)');
for (const [b, us] of [...buckets].sort((a, b2) => b2[1] - a[1])) {
  console.log(`  ${b.padEnd(26)} ${pct(us).padStart(6)}`);
}
console.log('\nTOP 22 FUNCTIONS (self time)');
for (const [k, us] of [...fns].sort((a, b) => b[1] - a[1]).slice(0, 22)) {
  console.log(`  ${k.padEnd(46)} ${pct(us).padStart(6)}`);
}
