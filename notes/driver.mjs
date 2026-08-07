/**
 * Runs every bench configuration in its own process, N times, and reports the
 * median. Writes JSON next to itself so before/after can be diffed numerically.
 *
 *   node driver.mjs <label> [reps]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = join(HERE, 'bench.mjs');
const label = process.argv[2] ?? 'run';
const reps = Number(process.argv[3] ?? 5);

const names = execFileSync('node', [BENCH, '--list'], { encoding: 'utf8' }).trim().split('\n');

const results = {};
for (const name of names) {
  const samples = [];
  for (let i = 0; i < reps; i++) {
    samples.push(Number(execFileSync('node', [BENCH, name], { encoding: 'utf8' }).trim()));
  }
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const spread = ((samples.at(-1) - samples[0]) / med) * 100;
  results[name] = med;
  console.log(`${name.padEnd(30)} ${med.toFixed(4)} ms   (spread ${spread.toFixed(0)}%)`);
}

const out = join(HERE, `bench-${label}.json`);
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`\nwrote ${out}`);

const baseArg = process.argv[4];
if (baseArg) {
  const basePath = join(HERE, `bench-${baseArg}.json`);
  if (existsSync(basePath)) {
    const base = JSON.parse(readFileSync(basePath, 'utf8'));
    console.log(`\n${'config'.padEnd(30)} ${baseArg.padEnd(10)} ${label.padEnd(10)} change`);
    for (const name of names) {
      if (base[name] === undefined) continue;
      const pct = ((results[name] - base[name]) / base[name]) * 100;
      console.log(
        `${name.padEnd(30)} ${base[name].toFixed(4).padStart(9)} ${results[name].toFixed(4).padStart(9)}` +
        `   ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`,
      );
    }
  }
}
