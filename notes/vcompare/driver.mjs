/**
 * Runs one benchmark configuration on every implementation under test,
 * rotating which one goes first so a scheduling stall lands on all of them
 * equally — the same reason tests/perf/perf.test.ts interleaves its two
 * measurements. Reports each median and the ratio against the first column.
 *
 * Three columns, not two, because that is what settled the question this
 * harness was rebuilt to answer. `package.json` said `4.3.1` for seven commits
 * after 4.3.1 was published, so "the 4.3.1 tree" and "the published 4.3.1" are
 * different software — by 13× on a default call. Benchmarking one and labelling
 * it the other is how the release notes came to quote a baseline that could not
 * be reproduced. Keep all three visible and the ambiguity cannot come back.
 *
 *   PUBLISHED  npm panchang-ts@4.3.1        — what users actually have
 *   HEAD       git HEAD, built              — the pre-Phase-36 tree
 *   WORKING    dist/ from the working tree  — the release candidate
 *
 * HEAD is optional: without `HEAD_DIR` the run is a two-column comparison.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

const HERE = new URL('.', import.meta.url).pathname;
const BENCH = `${HERE}bench.mjs`;
const REPS = Number(process.argv[2] ?? 11);

const DEFAULT_HEAD = `${HERE}head/index.cjs`;
const targets = [
  { name: '4.3.1-npm', dir: process.env.V4_DIR ?? `${HERE}v4/node_modules/panchang-ts` },
  { name: 'HEAD-tree', dir: process.env.HEAD_DIR ?? DEFAULT_HEAD },
  { name: '5.0.0', dir: process.env.V5_DIR ?? new URL('../../dist/index.cjs', import.meta.url).pathname },
].filter((t) => existsSync(t.dir));

if (targets.length < 2) {
  console.error(`need at least two implementations; found ${targets.map((t) => t.name).join(', ')}`);
  process.exit(2);
}

const names = execFileSync('node', [BENCH, '--list'], {
  encoding: 'utf8', env: { ...process.env, PT_MODULE: targets.at(-1).dir },
}).trim().split('\n');

const run = (mod, name) => Number(execFileSync('node', [BENCH, name], {
  encoding: 'utf8', env: { ...process.env, PT_MODULE: mod },
}).trim());

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const out = {};
const header = ['config'.padEnd(28), ...targets.map((t) => t.name.padStart(11))].join(' ');
console.log(`${header}   vs first`);

for (const name of names) {
  const samples = targets.map(() => []);
  for (let i = 0; i < REPS; i++) {
    // Rotate the starting implementation each repetition.
    for (let k = 0; k < targets.length; k++) {
      const idx = (i + k) % targets.length;
      samples[idx].push(run(targets[idx].dir, name));
    }
  }
  const medians = samples.map(med);
  out[name] = Object.fromEntries(targets.map((t, i) => [t.name, {
    median: medians[i],
    spreadPct: ((Math.max(...samples[i]) - Math.min(...samples[i])) / medians[i]) * 100,
    speedupVsFirst: medians[0] / medians[i],
  }]));
  const cols = medians.map((m) => m.toFixed(4).padStart(11)).join(' ');
  const ratios = medians.slice(1).map((m) => `${(medians[0] / m).toFixed(2)}x`).join(' ');
  console.log(`${name.padEnd(28)} ${cols}   ${ratios}`);
}

writeFileSync(`${HERE}cmp-results.json`, JSON.stringify(out, null, 2));
console.log(`\nwrote ${HERE}cmp-results.json`);
