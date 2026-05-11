#!/usr/bin/env node
/**
 * Phase 34e item 3 — Trikonargala (5/9) prediction derivation.
 *
 * Anti-circular: applies the §3 algorithm BY HAND in this script, NOT
 * via any new library code. Uses `computeRashiChart` from the already-
 * built library only to extract `chart.planets[].house` (the existing
 * Phase 29-validated chart placements). Predictions are pinned in the
 * test file; the library's new opt-in `computeArgala({
 * includeTrikonargala: true })` is verified AGAINST these pins.
 *
 * Run with: node notes/phase34e-trikonargala-derive.mjs
 *
 * Rule (from notes/phase34e-trikonargala-research.md §3):
 *   For each bhava B in 1..12:
 *     For each planet p in chart.planets:
 *       offset = (p.house − B + 12) mod 12
 *       isFifth = (offset == 4)
 *       isNinth = (offset == 8)
 *       if p == 'Ketu':
 *         5th -> virodhakas (reversal); 9th -> sources (reversal)
 *       else:
 *         5th -> sources;                 9th -> virodhakas
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lib = await import(resolve(__dirname, '..', 'dist', 'index.cjs'));
const { computeRashiChart } = lib.default ?? lib;

const fixturePath = resolve(__dirname, '..', 'tests', 'fixtures', 'astrosage-charts.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const SELECTED = [
  'Narendra Modi',
  'Sachin Tendulkar',
  'Ratan Tata',
];

function localToUtc(dateLocal, tzh) {
  const d = new Date(dateLocal + 'Z');
  return new Date(d.getTime() - tzh * 3600_000);
}

function trikonargala(planets) {
  const out = [];
  for (let B = 1; B <= 12; B++) {
    const sources = [];
    const virodhakas = [];
    for (const p of planets) {
      const offset = ((p.house - B) + 12) % 12;
      const isFifth = offset === 4;
      const isNinth = offset === 8;
      if (!isFifth && !isNinth) continue;
      if (p.planet === 'Ketu') {
        if (isFifth) virodhakas.push(p.planet);
        if (isNinth) sources.push(p.planet);
      } else {
        if (isFifth) sources.push(p.planet);
        if (isNinth) virodhakas.push(p.planet);
      }
    }
    out.push({ bhava: B, sources, virodhakas });
  }
  return out;
}

console.log('# Phase 34e item 3 — Trikonargala (5/9) predictions (hand-derived)\n');

const predictions = [];

for (const name of SELECTED) {
  const chart = fixture.charts.find(c => c.name === name);
  const utc = localToUtc(chart.dateLocal, chart.tzh);
  const loc = { latitude: chart.lat, longitude: chart.lon };
  const rashi = computeRashiChart(utc, loc, { houseSystem: 'whole-sign' });
  const planetHouses = rashi.planets.map(p => ({ planet: p.planet, house: p.house, rashi: p.rashi.index }));
  const trikona = trikonargala(rashi.planets);

  console.log(`## ${name}`);
  console.log(`Lagna rashi = ${rashi.lagna.rashi.index} (${rashi.lagna.rashi.name})`);
  console.log('Planet house map:');
  planetHouses.forEach(ph => console.log(`  ${ph.planet.padEnd(8)} rashi=${ph.rashi}  house=${ph.house}`));
  console.log('');
  console.log('Trikonargala (5/9) predictions per bhava:');
  console.log('  B  | sources                       | virodhakas');
  console.log('  ---+-------------------------------+---------------------------');
  trikona.forEach(t => {
    const s = (t.sources.join(', ') || '—').padEnd(31);
    const v = t.virodhakas.join(', ') || '—';
    console.log(`  ${t.bhava.toString().padStart(2)} | ${s} | ${v}`);
  });
  console.log('');

  predictions.push({ name, lagnaRashi: rashi.lagna.rashi.index, planetHouses, trikona });
}

console.log('\n## Anti-circular invariants\n');
predictions.forEach(p => {
  // Each non-Ketu planet should appear in exactly 2 lists across all 12 bhavas.
  const counts = {};
  p.trikona.forEach(t => {
    t.sources.forEach(g => { counts[g] = (counts[g] || 0) + 1; });
    t.virodhakas.forEach(g => { counts[g] = (counts[g] || 0) + 1; });
  });
  console.log(`${p.name}: per-graha 2-list invariant`);
  Object.entries(counts).sort().forEach(([g, n]) => {
    const ok = n === 2 ? '✓' : '✗';
    console.log(`  ${ok} ${g.padEnd(8)} appears in ${n} list(s)`);
  });
});

console.log('\n## JSON pin block\n');
console.log('```json');
console.log(JSON.stringify(predictions, null, 2));
console.log('```');
