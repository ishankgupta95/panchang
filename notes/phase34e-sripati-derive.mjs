#!/usr/bin/env node
/**
 * Phase 34e item 1 — Sripati cusp 2-12 midpoint derivation.
 *
 * Goal (anti-circular guarantee, per memory/feedback_fixture_repinning.md
 * + the locked Phase 34c shadbala-combust methodology): predict the 12
 * Sripati bhava-madhya cusps for each fixture chart BY HAND from first
 * principles, using only:
 *   - The library's already-verified `computeBhava` to extract ASC and MC
 *     (these are existing, tested, Meeus-eq-13.6 outputs — they are NOT
 *     the new code under test).
 *   - The classical Sripati Paddhati trisection formula applied here in
 *     plain JS, NOT via any new implementation.
 *
 * The predictions emitted by this script are then pinned in the research
 * notes and used to write the test file. The implementation in
 * `computeSripatiLagna({ includeCusps: true })` (or equivalent) must MATCH
 * these pinned predictions to within 1e-6° — NOT the other way around.
 *
 * Run with: node notes/phase34e-sripati-derive.mjs
 *
 * Sripati formula (BPHS Ch.5 + 5+ secondary-source unanimous consensus):
 *
 *   cusp[1]  = ASC                                  (bhava 1 madhya = lagna)
 *   cusp[4]  = (MC + 180) mod 360                   (bhava 4 madhya = IC)
 *   cusp[7]  = (ASC + 180) mod 360                  (bhava 7 madhya = DSC)
 *   cusp[10] = MC                                   (bhava 10 madhya)
 *
 *   arc_q1 = (cusp[4]  - cusp[1]) mod 360           (ASC -> IC arc, eastward)
 *   arc_q2 = (cusp[7]  - cusp[4]) mod 360           (IC  -> DSC arc)
 *   arc_q3 = (cusp[10] - cusp[7]) mod 360           (DSC -> MC arc)
 *   arc_q4 = (cusp[1]+360 - cusp[10]) mod 360       (MC  -> ASC arc)
 *
 *   cusp[2]  = ASC + arc_q1/3
 *   cusp[3]  = ASC + 2*arc_q1/3
 *   cusp[5]  = IC  + arc_q2/3
 *   cusp[6]  = IC  + 2*arc_q2/3
 *   cusp[8]  = DSC + arc_q3/3
 *   cusp[9]  = DSC + 2*arc_q3/3
 *   cusp[11] = MC  + arc_q4/3
 *   cusp[12] = MC  + 2*arc_q4/3
 *
 * All taken mod 360. By construction arc_q1==arc_q3 and arc_q2==arc_q4
 * (since IC = MC+180, DSC = ASC+180), so opposite cusps differ by 180°.
 *
 * Sources for the formula (unanimous across all surveyed):
 *   - Wikipedia "Bhāva" (https://en.wikipedia.org/wiki/Bh%C4%81va)
 *   - "Bhava Chart -- Chalit Chart" (planetarypositions.com)
 *   - "The Bhava Chalit Chart" (Jothishi.com)
 *   - "Vedic Astrology: Bhava Calculation or Calculation of Cusps"
 *     (prosperitynjoy blog)
 *   - "CUSP or KP CHART (Placidus System)" (nikhilworld.com)
 *   - Astro Shukla blog -- "Bhavas (Houses)"
 *   - Lalitha Anamika substack -- "W10: 1: Bhava Chalit Intro"
 *   - "Sripati Paddhati" -- Exotic India Art (book page)
 *
 * Drik panchang publishes nothing on Sripati cusps (full enumeration of
 * their 18 jyotish calculators in Phase 34e-jaimini research §1 -- same
 * inventory still applies; no Sripati/Bhava calculator surfaces).
 * ProKerala has no GET-style Sripati endpoint (their birth chart page
 * is form-only POST per Phase 34d's empirical verification of the
 * drik/ProKerala form-only-POST pattern).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const lib = await import(resolve(__dirname, '..', 'dist', 'index.cjs'));
const { computeBhava } = lib.default ?? lib;

const fixturePath = resolve(__dirname, '..', 'tests', 'fixtures', 'astrosage-charts.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

const SELECTED = [
  'Narendra Modi',          // lat 23.78  (mid-low, India)
  'Sachin Tendulkar',       // lat 18.97  (low,     India)
  'Mark Zuckerberg',        // lat 40.70  (mid,     USA East)
  'Bill Gates',             // lat 47.60  (high,    USA West)
  'Sri Sri Ravi Shankar',   // lat  8.77  (near-eq, India South)
];

function mod360(x) { return ((x % 360) + 360) % 360; }

function localToUtc(dateLocal, tzh) {
  // dateLocal is "YYYY-MM-DDTHH:mm:ss" in local civil time at tz=tzh hours
  // offset from UTC. Parse as UTC fields, then subtract tzh hours to get
  // the true UTC instant.
  const d = new Date(dateLocal + 'Z');
  return new Date(d.getTime() - tzh * 3600_000);
}

function sripatiCusps(ascSidereal, mcSidereal) {
  const ASC = mod360(ascSidereal);
  const MC  = mod360(mcSidereal);
  const IC  = mod360(MC + 180);
  const DSC = mod360(ASC + 180);

  const arc_q1 = mod360(IC  - ASC);
  const arc_q2 = mod360(DSC - IC);
  const arc_q3 = mod360(MC  - DSC);
  const arc_q4 = mod360(ASC + 360 - MC);

  return [
    ASC,                          // 1
    mod360(ASC + arc_q1 / 3),     // 2
    mod360(ASC + 2 * arc_q1 / 3), // 3
    IC,                           // 4
    mod360(IC  + arc_q2 / 3),     // 5
    mod360(IC  + 2 * arc_q2 / 3), // 6
    DSC,                          // 7
    mod360(DSC + arc_q3 / 3),     // 8
    mod360(DSC + 2 * arc_q3 / 3), // 9
    MC,                           // 10
    mod360(MC  + arc_q4 / 3),     // 11
    mod360(MC  + 2 * arc_q4 / 3), // 12
  ];
}

const RASHI_NAMES = [
  'Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya',
  'Tula', 'Vrischika', 'Dhanu', 'Makara', 'Kumbha', 'Meena',
];

function fmt(lon) {
  const r = Math.floor(lon / 30);
  const d = lon - r * 30;
  return `${lon.toFixed(6).padStart(11)}°  ${RASHI_NAMES[r].padEnd(10)} ${d.toFixed(4).padStart(8)}°`;
}

console.log('# Phase 34e item 1 — Sripati cusp predictions (hand-derived)\n');
console.log('Generated from first principles via classical Sripati Paddhati');
console.log('trisection formula applied to library-derived ASC+MC. The');
console.log('trisection step is implemented INLINE in this script, NOT in');
console.log('the library (which currently only computes cusp_1 = ASC).');
console.log('Predictions pinned in tests/unit/specialLagnas.test.ts; the');
console.log('post-implementation code is verified AGAINST these, not vice');
console.log('versa.\n');

const predictions = [];

for (const name of SELECTED) {
  const chart = fixture.charts.find(c => c.name === name);
  if (!chart) { console.error(`NOT FOUND: ${name}`); continue; }
  const utc = localToUtc(chart.dateLocal, chart.tzh);
  const loc = { latitude: chart.lat, longitude: chart.lon };
  const bhava = computeBhava(utc, loc, { houseSystem: 'whole-sign' });
  const ASC = bhava.ascendantLongitude;
  const MC  = bhava.mcLongitude;
  const cusps = sripatiCusps(ASC, MC);

  console.log(`## ${name}`);
  console.log(`Born ${chart.dateLocal} TZ${chart.tzh >= 0 ? '+' : ''}${chart.tzh}  lat=${chart.lat.toFixed(4)}  lon=${chart.lon.toFixed(4)}`);
  console.log(`UTC instant: ${utc.toISOString()}`);
  console.log(`ASC (sidereal, lahiri) = ${ASC.toFixed(8)}°    MC (sidereal, lahiri) = ${MC.toFixed(8)}°`);
  console.log(`IC = ${mod360(MC+180).toFixed(8)}°    DSC = ${mod360(ASC+180).toFixed(8)}°`);
  console.log(`arc_q1 (ASC->IC) = ${mod360(mod360(MC+180) - ASC).toFixed(8)}°  /  arc_q2 (IC->DSC) = ${mod360(mod360(ASC+180) - mod360(MC+180)).toFixed(8)}°`);
  console.log('');
  console.log('Predicted Sripati cusps (bhava madhyas):');
  console.log('  H | sidereal longitude    rashi      degree-in-rashi');
  console.log('  --+----------------------------------------------------');
  for (let i = 0; i < 12; i++) {
    console.log(`  ${(i+1).toString().padStart(2)}| ${fmt(cusps[i])}`);
  }
  console.log('');
  console.log('Anti-circular spot checks:');
  console.log(`  cusp[7]  - cusp[1]  = ${mod360(cusps[6] - cusps[0]).toFixed(8)}°   (must equal 180°)`);
  console.log(`  cusp[10] - cusp[4]  = ${mod360(cusps[9] - cusps[3]).toFixed(8)}°   (must equal 180°)`);
  console.log(`  cusp[8]  - cusp[2]  = ${mod360(cusps[7] - cusps[1]).toFixed(8)}°   (must equal 180°)`);
  console.log(`  cusp[3]  - cusp[1]  = ${mod360(cusps[2] - cusps[0]).toFixed(8)}°   (must equal 2 * arc_q1 / 3)`);
  console.log('');

  predictions.push({ name, utc: utc.toISOString(), lat: chart.lat, lon: chart.lon, ASC, MC, cusps });
}

console.log('\n## JSON pin block for test file\n');
console.log('```json');
console.log(JSON.stringify(predictions, null, 2));
console.log('```');
