#!/usr/bin/env node
/**
 *   node generate/notes/horizons-fetch.mjs [outfile]
 *
 * `TIME_TYPE` is `TT`, not Horizons' default `UT`: UT1 minus UTC reaches
 * ±0.9 s, which at the Moon's 0.549″ per second is ±0.5″ of noise.
 * `QUANTITIES=31` is `ObsEcLon`/`ObsEcLat` in the true ecliptic and equinox of
 * date, the frame `src/astronomy/` returns.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'testdata/reference/horizons-positions.json';

const BODIES = [
  { name: 'Sun', command: '10' },
  { name: 'Moon', command: '301' },
  { name: 'Mercury', command: '199' },
  { name: 'Venus', command: '299' },
  { name: 'Mars', command: '499' },
  { name: 'Jupiter', command: '599' },
  { name: 'Saturn', command: '699' },
];

// JD (TT) bounds. 1900-01-01, 1950-01-01, 2050-01-01, 2100-01-01.
const JD_1900 = 2415020.5;
const JD_1950 = 2433282.5;
const JD_2050 = 2469807.5;
const JD_2100 = 2488069.5;

const EPOCHS = 250;
const CORE_SHARE = 0.7;

/** Numerical Recipes' `ranqd1` LCG. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Pseudo-random, not a fixed cadence, which would alias against the periods
 * being measured (the Moon every 29.53 days is one phase forever). */
function epochs() {
  const rnd = lcg(20260806);
  const out = [];
  for (let i = 0; i < EPOCHS; i++) {
    const core = rnd() < CORE_SHARE;
    let jd;
    if (core) {
      jd = JD_1950 + rnd() * (JD_2050 - JD_1950);
    } else {
      jd = rnd() < 0.5
        ? JD_1900 + rnd() * (JD_1950 - JD_1900)
        : JD_2050 + rnd() * (JD_2100 - JD_2050);
    }
    out.push(Math.round(jd * 1e6) / 1e6);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

async function fetchChunk(command, jds) {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'500@399'",
    TLIST_TYPE: "'JD'",
    TIME_TYPE: "'TT'",
    QUANTITIES: "'31'",
    CSV_FORMAT: "'YES'",
    TLIST: jds.map((j) => `'${j}'`).join(','),
  });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons HTTP ${res.status} for ${command}`);
  const text = await res.text();
  const soe = text.indexOf('$$SOE');
  const eoe = text.indexOf('$$EOE');
  if (soe < 0 || eoe < 0) {
    throw new Error(`Horizons returned no ephemeris for ${command}:\n${text.slice(0, 800)}`);
  }
  const rows = text.slice(soe + 5, eoe).trim().split('\n').filter(Boolean);
  if (rows.length !== jds.length) {
    throw new Error(`asked ${jds.length} epochs for ${command}, got ${rows.length}`);
  }
  // " 2000-Jan-01 12:00:00.000, , , 223.3148557,  5.1708744,"
  return rows.map((line) => {
    const f = line.split(',').map((x) => x.trim());
    const elon = Number(f[3]);
    const elat = Number(f[4]);
    if (!Number.isFinite(elon) || !Number.isFinite(elat)) {
      throw new Error(`unparseable Horizons row: ${line}`);
    }
    return { elon, elat };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const jds = epochs();
  console.error(`${jds.length} epochs, ${BODIES.length} bodies = ${jds.length * BODIES.length} positions`);

  const samples = {};
  for (const body of BODIES) {
    const rows = [];
    for (let i = 0; i < jds.length; i += 40) {
      const chunk = jds.slice(i, i + 40);
      rows.push(...(await fetchChunk(body.command, chunk)));
      process.stderr.write(`\r${body.name}: ${rows.length}/${jds.length}   `);
      await sleep(300);
    }
    process.stderr.write('\n');
    samples[body.name] = rows;
  }

  const out = {
    _comment: [
      'Tier 0 ground truth from JPL Horizons (DE441). Committed before any',
      'own-ephemeris code existed. This file does not',
      'originate from panchang-ts and does not change when panchang-ts does,',
      'which is the entire point: it is the only tier that can adjudicate an',
      'ephemeris change. Regenerate with `node generate/notes/horizons-fetch.mjs`.',
    ].join(' '),
    source: 'https://ssd.jpl.nasa.gov/api/horizons.api',
    ephemeris: 'DE441',
    retrieved: new Date().toISOString().slice(0, 10),
    frame: 'geocentric apparent; true ecliptic and equinox of date (Horizons ObsEcLon/ObsEcLat, QUANTITIES=31)',
    timeScale: 'TT',
    epochUnit: 'Julian Date, Terrestrial Time',
    epochSelection: `seeded LCG (seed 20260806), ${EPOCHS} draws, ${CORE_SHARE * 100}% from 1950-2050, remainder split evenly over 1900-1950 and 2050-2100`,
    jdTt: jds,
    /** Degrees, parallel to `jdTt`. */
    positions: samples,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.error(`wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
