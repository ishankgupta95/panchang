#!/usr/bin/env node
/**
 *   node generate/notes/eclipse-fetch.mjs [outPath]
 *
 * Solar rows are geocentric; local solar circumstances come from
 * `eclipse-local-fetch.mjs`. Instants are TD (= TT) with the catalogue's own ΔT.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'testdata/reference/nasa-eclipses.json';

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

const PAGES = [
  { kind: 'lunar', url: 'https://eclipse.gsfc.nasa.gov/LEcat5/LE1901-2000.html' },
  { kind: 'lunar', url: 'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html' },
  { kind: 'solar', url: 'https://eclipse.gsfc.nasa.gov/SEcat5/SE1901-2000.html' },
  { kind: 'solar', url: 'https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html' },
];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const jdOf = (year, month, day, hour, minute, second) =>
  Date.UTC(year, month, day, hour, minute, second) / 86_400_000 + 2440587.5;

function parseLunar(text) {
  const out = [];
  // The type column is not a bare word (`T`, `T-`, `T+`, `N`, `Nb`, `Nt`), so
  // `\w+` there silently drops the unusual rows.
  const row = /^\s*(\d{5})\s+(-?\d{1,5})\s+(\w{3})\s+(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(\S+)\s+(\S+)\s+(\S+)/;
  for (const line of text.split('\n')) {
    const m = row.exec(line);
    if (!m) continue;
    const [, , y, mon, d, hh, mm, ss, deltaT, , saros, type, , gamma,
      penumbralMag, umbralMag, penDur, parDur, totDur] = m;
    if (!(mon in MONTHS)) continue;
    out.push({
      date: `${y}-${String(MONTHS[mon] + 1).padStart(2, '0')}-${d}`,
      jdGreatestTt: jdOf(Number(y), MONTHS[mon], Number(d), Number(hh), Number(mm), Number(ss)),
      deltaTSeconds: Number(deltaT),
      saros: Number(saros),
      type,
      kind: type[0],
      gamma: Number(gamma),
      penumbralMagnitude: Number(penumbralMag),
      umbralMagnitude: Number(umbralMag),
      penumbralDurationMin: Number(penDur) || 0,
      partialDurationMin: Number(parDur) || 0,
      totalDurationMin: Number(totDur) || 0,
    });
  }
  return out;
}

function parseSolar(text) {
  const out = [];
  // The greatest-eclipse point is published to the whole degree, about 55 km:
  // good for type, magnitude and altitude, never for a contact time.
  const row = /^\s*(\d{5})\s+(-?\d{1,5})\s+(\w{3})\s+(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(-?\d+)\s+(-?\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(\d+)([NS])\s+(\d+)([EW])\s+(-?\d+)/;
  for (const line of text.split('\n')) {
    const m = row.exec(line);
    if (!m) continue;
    const [, , y, mon, d, hh, mm, ss, deltaT, , saros, type, , gamma, magnitude,
      lat, latHemisphere, lon, lonHemisphere, sunAltitude] = m;
    if (!(mon in MONTHS)) continue;
    out.push({
      date: `${y}-${String(MONTHS[mon] + 1).padStart(2, '0')}-${d}`,
      jdGreatestTt: jdOf(Number(y), MONTHS[mon], Number(d), Number(hh), Number(mm), Number(ss)),
      deltaTSeconds: Number(deltaT),
      saros: Number(saros),
      type,
      kind: type[0],
      gamma: Number(gamma),
      magnitude: Number(magnitude),
      greatestLatitude: latHemisphere === 'S' ? -Number(lat) : Number(lat),
      greatestLongitude: lonHemisphere === 'W' ? -Number(lon) : Number(lon),
      /** Degrees; zero for a partial eclipse. */
      greatestSunAltitude: Number(sunAltitude),
    });
  }
  return out;
}

async function main() {
  const lunar = [];
  const solar = [];
  for (const page of PAGES) {
    const text = await fetchText(page.url);
    const rows = page.kind === 'lunar' ? parseLunar(text) : parseSolar(text);
    // The rows a loose regex drops are exactly the unusual eclipses.
    const expected = text.split('\n')
      .filter((l) => /^\s*\d{5}\s+-?\d{1,5}\s+\w{3}\s+\d{2}\s/.test(l)).length;
    if (rows.length !== expected) {
      throw new Error(`parsed ${rows.length} of ${expected} rows from ${page.url}; the layout may have changed`);
    }
    (page.kind === 'lunar' ? lunar : solar).push(...rows);
    console.error(`  ${page.kind.padEnd(5)} ${rows.length} rows  ${page.url}`);
  }
  lunar.sort((a, b) => a.jdGreatestTt - b.jdGreatestTt);
  solar.sort((a, b) => a.jdGreatestTt - b.jdGreatestTt);

  const out = {
    _comment: [
      'Tier 0 eclipse ground truth: NASA/Espenak Five Millennium Canon.',
      'Does not originate from panchang-ts and does not change when panchang-ts',
      'does. Greatest-eclipse instants are Terrestrial Dynamical Time (= TT);',
      'each row carries the canon\'s own DeltaT so a UT instant can be recovered.',
      'Solar rows are GEOCENTRIC: the canon does not publish local circumstances',
      'for an arbitrary observer, which is the documented limit of Tier 0',
      'coverage for the solar path. Regenerate with `node generate/notes/eclipse-fetch.mjs`.',
    ].join(' '),
    source: 'https://eclipse.gsfc.nasa.gov/',
    reference: 'Espenak & Meeus, Five Millennium Canon of Solar Eclipses (NASA/TP-2006-214141) and the lunar companion',
    retrieved: new Date().toISOString().slice(0, 10),
    timeScale: 'TD (= TT)',
    lunarTypeKey: 'T total, P partial, N penumbral (Nb/Nt = total penumbral variants)',
    solarTypeKey: 'T total, A annular, H hybrid, P partial',
    lunar,
    solar,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.error(`wrote ${OUT}  (${lunar.length} lunar, ${solar.length} solar)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
