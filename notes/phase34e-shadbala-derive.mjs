#!/usr/bin/env node
/**
 * Phase 34e item 5 — Shadbala sub-component delta prediction.
 *
 * Anti-circular guarantee (per memory/feedback_fixture_repinning.md +
 * locked Phase 34c shadbala-combust methodology): predicts the new
 * Bhava Bala totals per fixture chart BEFORE the library code change
 * lands, using:
 *   - The library's *current pre-item-5 build* (dist/index.cjs, 375.50
 *     KB) to extract baseline shadbala / bhavaBala values + chart
 *     ephemeris (Phase 29 R-tier validated).
 *   - The §2 BPHS Ch.27 sub-component formulas applied INLINE in this
 *     script (NOT via any new library code).
 *
 * The library implementation that follows must produce per-graha
 * deltas matching these predictions to within 1e-3 V. If observed
 * deltas diverge from predicted, the implementation is wrong — DO NOT
 * re-pin. Diagnose first.
 *
 * Run with: node notes/phase34e-shadbala-derive.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lib = await import(resolve(__dirname, '..', 'dist', 'index.cjs'));
const { computeRashiChart, computeShadbala, computeBhavaBala,
        computeDivisionalChart, computeDignity } = lib.default ?? lib;

const fixturePath = resolve(__dirname, '..', 'tests', 'fixtures', 'astrosage-charts.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const SELECTED = [
  'Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
  'Dhirubhai Ambani', 'Mukesh Ambani',
];

const VISIBLE = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

// Saptavargaja per BPHS Ch.27 verse 16-17 (collapsed-friendship mapping
// per library's computeDignity API — see research §2.1).
const SAPT_VALUES = {
  exalted:      45,
  moolatrikona: 45,
  own:          30,
  friend:       15,
  neutral:       7.5,
  enemy:         3.75,
  debilitated:   1.875,
};

const VARGAS = ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D30'];

// Ojha-Yugma per BPHS Ch.27 verse 18-19.
const MASCULINE = new Set(['Sun', 'Mars', 'Jupiter']);
const FEMININE_LIKE = new Set(['Moon', 'Mercury', 'Venus', 'Saturn']);

// Drekkana per BPHS Ch.27 verse 20.
const DREKKANA_GENDER_GROUP = {
  Sun: 0, Mars: 0, Jupiter: 0,         // Male → 1st decanate
  Mercury: 1, Saturn: 1,                // Eunuch → 2nd decanate
  Moon: 2, Venus: 2,                    // Female → 3rd decanate
};

const RASHI_LORD_NAME = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
];

function localToUtc(dateLocal, tzh) {
  return new Date(new Date(dateLocal + 'Z').getTime() - tzh * 3600_000);
}

function saptavargaja(graha, vargaRashis) {
  // vargaRashis = { D1, D2, D3, D7, D9, D12, D30 } → rashi index.
  let total = 0;
  const breakdown = {};
  for (const varga of VARGAS) {
    const r = vargaRashis[varga];
    const dignity = computeDignity(graha, r);
    const v = SAPT_VALUES[dignity];
    total += v;
    breakdown[varga] = { rashi: r, dignity, virupas: v };
  }
  return { total, breakdown };
}

function ojhaYugma(graha, d1Rashi, d9Rashi) {
  const d1Odd = (d1Rashi % 2) === 0; // rashi index 0 (Aries) = "1st sign" → odd
  const d9Odd = (d9Rashi % 2) === 0;
  let v = 0;
  if (MASCULINE.has(graha)) {
    if (d1Odd) v += 15;
    if (d9Odd) v += 15;
  } else if (FEMININE_LIKE.has(graha)) {
    if (!d1Odd) v += 15;
    if (!d9Odd) v += 15;
  }
  return { virupas: v, d1Rashi, d9Rashi, d1Parity: d1Odd ? 'odd' : 'even', d9Parity: d9Odd ? 'odd' : 'even' };
}

function drekkana(graha, degreeInRashi) {
  const idx = Math.floor(degreeInRashi / 10);     // 0, 1, or 2
  const want = DREKKANA_GENDER_GROUP[graha];
  const v = (idx === want) ? 15 : 0;
  return { virupas: v, decanateIndex: idx, requiredDecanate: want };
}

console.log('# Phase 34e item 5 — Shadbala sub-component delta predictions\n');

const allPredictions = [];

for (const name of SELECTED) {
  const chart = fixture.charts.find(c => c.name === name);
  const utc = localToUtc(chart.dateLocal, chart.tzh);
  const loc = { latitude: chart.lat, longitude: chart.lon };

  const rashi = computeRashiChart(utc, loc, { houseSystem: 'whole-sign' });
  const baselineBhavaBala = computeBhavaBala(utc, loc);

  // Per-graha deltas.
  const grahaDeltas = {};
  for (const g of VISIBLE) {
    const placement = rashi.planets.find(p => p.planet === g);
    const d1Rashi = placement.rashi.index;

    // Build vargaRashis by calling computeDivisionalChart for each varga.
    const vargaRashis = { D1: d1Rashi };
    for (const v of ['D2', 'D3', 'D7', 'D9', 'D12', 'D30']) {
      const dchart = computeDivisionalChart(utc, loc, v);
      const pp = dchart.planets.find(p => p.planet === g);
      vargaRashis[v] = pp.rashi.index;
    }
    const sapt = saptavargaja(g, vargaRashis);
    const ojha = ojhaYugma(g, vargaRashis.D1, vargaRashis.D9);
    const drek = drekkana(g, placement.degreeInRashi);
    grahaDeltas[g] = {
      saptavargaja: sapt.total,
      saptavargajaBreakdown: sapt.breakdown,
      ojhaYugma: ojha.virupas,
      drekkana: drek.virupas,
      totalDelta: sapt.total + ojha.virupas + drek.virupas,
    };
  }

  // Per-bhava cuspRashi → lord → delta lookup.
  const lagnaRashi = rashi.lagna.rashi.index;
  const houseDeltas = [];
  for (let i = 0; i < 12; i++) {
    const cuspRashi = (lagnaRashi + i) % 12;
    const lord = RASHI_LORD_NAME[cuspRashi];
    const delta = grahaDeltas[lord].totalDelta;
    houseDeltas.push({
      bhava: i + 1,
      cuspRashi,
      lord,
      baselineTotal: baselineBhavaBala.houses[i].total,
      delta,
      predictedNewTotal: baselineBhavaBala.houses[i].total + delta,
    });
  }

  console.log(`## ${name}`);
  console.log(`Lagna rashi = ${lagnaRashi}\n`);
  console.log('### Per-graha shadbala delta');
  console.log('graha    | sapta | ojha | drek | Δtotal | breakdown');
  for (const g of VISIBLE) {
    const d = grahaDeltas[g];
    console.log(`${g.padEnd(8)} | ${d.saptavargaja.toString().padStart(5)} | ${d.ojhaYugma.toString().padStart(4)} | ${d.drekkana.toString().padStart(4)} | ${d.totalDelta.toString().padStart(6)} | ${
      Object.entries(d.saptavargajaBreakdown).map(([v, b]) => `${v}=${b.dignity[0].toUpperCase()}${b.virupas}`).join(' ')
    }`);
  }
  console.log('');
  console.log('### Per-bhava bhavaBala delta');
  console.log('  B  | cuspRashi | lord    | baseline    | Δ      | predicted');
  for (const h of houseDeltas) {
    console.log(`  ${h.bhava.toString().padStart(2)} |    ${h.cuspRashi.toString().padStart(2)}     | ${h.lord.padEnd(7)} | ${h.baselineTotal.toFixed(4).padStart(11)} | ${h.delta.toFixed(4).padStart(6)} | ${h.predictedNewTotal.toFixed(4)}`);
  }
  console.log('');

  allPredictions.push({
    name,
    lagnaRashi,
    grahaDeltas,
    houseDeltas,
    predictedTotals: houseDeltas.map(h => Number(h.predictedNewTotal.toFixed(4))),
  });
}

console.log('\n## JSON pin block — predicted post-item-5 Bhava Bala totals\n');
console.log('```json');
console.log(JSON.stringify(allPredictions.map(p => ({
  name: p.name,
  totals: p.predictedTotals,
})), null, 2));
console.log('```');
