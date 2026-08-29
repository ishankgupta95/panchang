#!/usr/bin/env node
/**
 * Solar eclipse local circumstances from NASA/Espenak's *Solar Eclipse
 * Visibility from Major Cities* catalogs (row key: `SEcirckey.html`).
 *
 *   node generate/notes/eclipse-local-fetch.mjs
 *
 * The catalogs print UT and were computed in 2003 with the ΔT of the day, so ΔT
 * does not cancel against TT canon instants as it does for a lunar eclipse.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'testdata/reference/nasa-eclipse-local.json';
const BASE = 'https://eclipse.gsfc.nasa.gov/SEcirc/';

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const FIRST_YEAR = 1901;
const LAST_YEAR = 2100;

/** The site splits each city into `1+01` (0001-1000), `1+11` and `1+21`. */
const CATALOG_SUFFIXES = ['1+11.html', '1+21.html'];

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#176;/g, '°')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function discoverCities() {
  const html = await (await fetch(`${BASE}SEcirc.html`)).text();
  const seen = new Map();
  for (const m of html.matchAll(/HREF="(SEcirc[A-Z]{2})\/([A-Za-z]+?)0\.html"/gi)) {
    seen.set(`${m[1]}/${m[2]}`, { dir: m[1], stem: m[2] });
  }
  if (seen.size === 0) throw new Error('no city links found on SEcirc.html: the layout may have changed');
  return [...seen.values()];
}

function parseSexagesimal(text) {
  const m = /^(\d+)°\s*([\d.]+)'([NSEW])$/.exec(text.replace(/\s+/g, ''));
  if (!m) throw new Error(`unparsable coordinate ${JSON.stringify(text)}`);
  const value = Number(m[1]) + Number(m[2]) / 60;
  return m[3] === 'S' || m[3] === 'W' ? -value : value;
}

function parseHeader(text) {
  const lat = /Latitude:\s*\n?\s*([^\n]+?)\s*\n/.exec(text);
  const lon = /Longitude:\s*\n?\s*([^\n]+?)\s*\n/.exec(text);
  const tz = /Time Zone:\s*\n?\s*(-?[\d.]+)\s*h/.exec(text);
  const name = /Solar Eclipses Visible from\s*\n\s*([^\n]+?)\s*\n/.exec(text);
  if (!lat || !lon || !tz || !name) throw new Error('header block not found: the layout may have changed');
  return {
    name: name[1],
    latitude: parseSexagesimal(lat[1]),
    longitude: parseSexagesimal(lon[1]),
    utcOffsetHours: Number(tz[1]),
  };
}

/** A catalog row, e.g. ` 2026 Aug 12   T:p   12:07  12:54  13:38  62 208 0.185 0.094 …`. */
const ROW = new RegExp(
  '^\\s*(\\d{4})\\s+([A-Z][a-z]{2})\\s+(\\d{2})\\s+' +      // date
  '([PAHT]):([pahtr-])\\s+' +                                // global:local type
  '(\\d{2}):(\\d{2})([rs]?)\\s+' +                           // begins
  '(\\d{2}):(\\d{2})([rs]?)\\s+' +                           // maximum
  '(\\d{2}):(\\d{2})([rs]?)\\s+' +                           // ends
  '(-?\\d+)\\s+(-?\\d+)\\s+' +                               // sun alt, azm
  '([\\d.]+)\\s+([\\d.]+)',                                  // magnitude, obscuration
);

/** Counted independently of {@link ROW} to catch dropped rows. */
const ROW_SHAPE = /^\s*\d{4}\s+[A-Z][a-z]{2}\s+\d{2}\s+[PAHT]:/;

function parseRows(text, url) {
  const rows = [];
  let shaped = 0;
  for (const line of text.split('\n')) {
    if (!ROW_SHAPE.test(line)) continue;
    shaped++;
    const m = ROW.exec(line);
    if (!m) continue;
    const [, y, mon, d, globalType, localType,
      bh, bm, bf, xh, xm, xf, eh, em, ef, alt, azm, mag, obs] = m;
    if (!(mon in MONTHS)) continue;
    rows.push({
      date: `${y}-${String(MONTHS[mon]).padStart(2, '0')}-${d}`,
      /** Type over the whole Earth: P partial, A annular, H hybrid, T total. */
      globalType,
      /** Same, as seen from this site, lower case. `-` where the catalog omits it. */
      localType,
      begins: `${bh}:${bm}`,
      /** `r` = clipped to sunrise, `s` = clipped to sunset, `''` = a real contact. */
      beginsFlag: bf,
      maximum: `${xh}:${xm}`,
      maximumFlag: xf,
      ends: `${eh}:${em}`,
      endsFlag: ef,
      sunAltitudeDeg: Number(alt),
      sunAzimuthDeg: Number(azm),
      magnitude: Number(mag),
      obscuration: Number(obs),
    });
  }
  // The rows a regex quietly drops are exactly the unusual eclipses.
  if (rows.length !== shaped) {
    throw new Error(`parsed ${rows.length} of ${shaped} rows from ${url}: the layout may have changed`);
  }
  return rows;
}

async function main() {
  const cities = await discoverCities();
  console.error(`${cities.length} cities`);
  const sites = [];

  for (const city of cities) {
    let header = null;
    const rows = [];
    const urls = [];
    for (const suffix of CATALOG_SUFFIXES) {
      const url = `${BASE}${city.dir}/${city.stem}${suffix}`;
      const text = await fetchText(url);
      header ??= parseHeader(text);
      rows.push(...parseRows(text, url));
      urls.push(url);
    }
    const kept = rows.filter((r) => {
      const year = Number(r.date.slice(0, 4));
      return year >= FIRST_YEAR && year <= LAST_YEAR;
    });
    kept.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // The Sun has to be up, so all three instants share the printed date.
    for (const r of kept) {
      if (!(r.begins <= r.maximum && r.maximum <= r.ends)) {
        throw new Error(`${header.name} ${r.date}: times out of order (${r.begins}/${r.maximum}/${r.ends})`);
      }
    }

    sites.push({ ...header, catalogs: urls, eclipses: kept });
    console.error(`  ${header.name.padEnd(22)} ${String(kept.length).padStart(4)} rows in ${FIRST_YEAR}-${LAST_YEAR}`);
  }

  const total = sites.reduce((n, s) => n + s.eclipses.length, 0);
  const out = {
    _comment: [
      'Tier 0 solar LOCAL circumstances: NASA/Espenak, Solar Eclipse Visibility',
      'from Major Cities. Companion to nasa-eclipses.json, which is geocentric.',
      'Times are LOCAL STANDARD time (never daylight): UT = local - utcOffsetHours.',
      'A time carrying the flag `r` or `s` is clipped to sunrise/sunset and is NOT',
      'a contact time. An eclipse absent from a site is not visible from that site;',
      'these catalogs are complete over 0001-3000 CE, which is what makes that',
      'inference sound. Regenerate with `node generate/notes/eclipse-local-fetch.mjs`.',
    ].join(' '),
    source: BASE,
    reference: 'Eclipse Predictions by Fred Espenak, NASA/GSFC',
    key: `${BASE}SEcirckey.html`,
    retrieved: new Date().toISOString().slice(0, 10),
    span: [FIRST_YEAR, LAST_YEAR],
    timeScale: 'local standard time (UT + utcOffsetHours)',
    sites,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  console.error(`wrote ${OUT}  (${sites.length} sites, ${total} local circumstances)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
