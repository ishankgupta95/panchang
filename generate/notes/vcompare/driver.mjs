// Rotates which implementation goes first so a scheduling stall lands on all equally.
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
