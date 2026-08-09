#!/usr/bin/env node
/**
 * Phase 36.5 — pull Tier 0 **solar local circumstances** from NASA/Espenak's
 * *Solar Eclipse Visibility from Major Cities* catalogs.
 *
 *   node notes/eclipse-local-fetch.mjs
 *
 * Writes `tests/fixtures/nasa-eclipse-local.json`. Companion to
 * `notes/eclipse-fetch.mjs`, which pulls the geocentric Five Millennium Canon;
 * this file closes the gap that one names as its own limit.
 *
 * ## Why this file exists
 *
 * `tests/fixtures/nasa-eclipses.json` is **geocentric only** — one row per
 * eclipse, at the instant of greatest eclipse. That validates the whole lunar
 * path (a lunar eclipse looks the same to every observer who can see the Moon)
 * and the geocentric half of the solar path. It says nothing about *when the
 * partial phase begins at a named place*, which is exactly what
 * `getUpcomingSolarEclipse` reports.
 *
 * A differential test against `astronomy-engine` would not fill that gap: that
 * is the implementation being removed, and it carries no independent authority.
 * These catalogs do. They are Espenak's own predictions, published under NASA/
 * GSFC, computed by a route with nothing in common with ours, and they do not
 * move when this library moves.
 *
 * ## What each row gives
 *
 * Per the catalog key (`SEcirckey.html`): local calendar date, the global and
 * local eclipse type, the local times of first contact / maximum / last contact,
 * the Sun's altitude and azimuth at maximum, and the eclipse magnitude and
 * obscuration at maximum. Ten cities, 0001–3000 CE; this script keeps
 * 1901–2100, which is the span the library supports.
 *
 * ## Three things about the data that the parser has to respect
 *
 * 1. **Times are local *standard* time**, never daylight time — the page header
 *    states the offset per city and it is taken from there rather than assumed.
 * 2. **`r` and `s` suffixes mean the time is clipped to the horizon**, not to
 *    the geometry: `06:32r` is sunrise with the eclipse already in progress,
 *    `16:26s` is sunset with it still in progress. Those are *not* contact
 *    times and must not be compared against one. They are kept, flagged, and
 *    the test uses them for a different assertion — that our own contact sits
 *    on the far side of the horizon crossing.
 * 3. **An eclipse absent from a city's catalog is not visible from that city.**
 *    That is the negative case §36.5 asks for, and it is the one a solver gets
 *    wrong silently. It is only usable because these catalogs are *complete*
 *    over their span, which is what makes the row-count assertion below
 *    load-bearing rather than decorative.
 *
 * ## Time scale
 *
 * The catalogs print UT (as local standard time = UT + offset). The canon's
 * greatest-eclipse instants are TT. ΔT therefore does **not** cancel here the
 * way it does for the lunar comparison, and it cannot be made to: the observer's
 * position is a function of UT while the sky is a function of TT, so the two
 * time scales are both genuinely present in a local circumstance. The catalogs
 * were computed in 2003 with the ΔT extrapolation available then. The test
 * measures the residual in UT and reports the historical and future halves
 * separately, because only the historical half has an observed ΔT that both
 * sides agree on.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'tests/fixtures/nasa-eclipse-local.json';
const BASE = 'https://eclipse.gsfc.nasa.gov/SEcirc/';

const MONTHS = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

/** Span to keep, matching `notes/eclipse-fetch.mjs`. */
const FIRST_YEAR = 1901;
const LAST_YEAR = 2100;

/**
 * The two millennium catalogs that between them cover 1901–2100. The site
 * splits each city's 3,000 years into `1+01` (0001–1000), `1+11` (1001–2000)
 * and `1+21` (2001–3000).
 */
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

/** `SEcircNA/NewYorkNY0.html` → `{ dir: 'SEcircNA', stem: 'NewYorkNY' }`. */
async function discoverCities() {
  const html = await (await fetch(`${BASE}SEcirc.html`)).text();
  const seen = new Map();
  for (const m of html.matchAll(/HREF="(SEcirc[A-Z]{2})\/([A-Za-z]+?)0\.html"/gi)) {
    seen.set(`${m[1]}/${m[2]}`, { dir: m[1], stem: m[2] });
  }
  if (seen.size === 0) throw new Error('no city links found on SEcirc.html — the layout may have changed');
  return [...seen.values()];
}

/**
 * `40°43.0'N` → 40.7166…, `074°01.0'W` → −74.0166…
 *
 * The catalogs print the site to a tenth of an arcminute, which is 185 m. A
 * solar contact time moves ~0.5 s per kilometre of displacement across the
 * shadow, so the coordinate's own resolution is worth ~0.1 s — two orders below
 * the minute the times are printed to, and therefore not the binding term.
 */
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
  if (!lat || !lon || !tz || !name) throw new Error('header block not found — the layout may have changed');
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

/** Anything that looks like a data line, counted independently of {@link ROW}. */
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
      /** Type as seen from *this* site, lower case. `-` where the catalog omits it. */
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
  // A regex that silently drops the awkward rows is worse than one that fails:
  // the dropped rows are exactly the unusual eclipses. Same rule as
  // `eclipse-fetch.mjs`.
  if (rows.length !== shaped) {
    throw new Error(`parsed ${rows.length} of ${shaped} rows from ${url} — the layout may have changed`);
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

    // Local times are printed against the site's *standard* offset, and an
    // eclipse cannot straddle local midnight (the Sun has to be up), so all
    // three instants share the printed calendar date. Assert it rather than
    // assume it — a wrap would silently misdate a whole row.
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
      'Tier 0 solar LOCAL circumstances — NASA/Espenak, Solar Eclipse Visibility',
      'from Major Cities. Companion to nasa-eclipses.json, which is geocentric.',
      'Times are LOCAL STANDARD time (never daylight): UT = local - utcOffsetHours.',
      'A time carrying the flag `r` or `s` is clipped to sunrise/sunset and is NOT',
      'a contact time. An eclipse absent from a site is not visible from that site;',
      'these catalogs are complete over 0001-3000 CE, which is what makes that',
      'inference sound. Regenerate with `node notes/eclipse-local-fetch.mjs`.',
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
