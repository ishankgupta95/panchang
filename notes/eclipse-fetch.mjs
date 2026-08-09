#!/usr/bin/env node
/**
 * Phase 36.5 — pull Tier 0 eclipse ground truth from the NASA/Espenak
 * *Five Millennium Canon of Solar Eclipses* and its lunar companion.
 *
 *   node notes/eclipse-fetch.mjs
 *
 * Writes `tests/fixtures/nasa-eclipses.json`. PLAN.md §36.5 names this canon as
 * the Tier 0 source for the eclipse work, and §36.0 B's rule applies as it did
 * to the Horizons fixture: it does not originate from this library and does not
 * move when this library moves, so a disagreement with it is evidence about us.
 *
 * ## What the canon does and does not settle
 *
 * This is the honest boundary of Tier 0 coverage for eclipses, and PLAN.md
 * flags it in advance ("solar local circumstances are the thinnest Tier 0
 * coverage"). What the catalogue publishes is **geocentric**:
 *
 * | | lunar | solar |
 * |---|---|---|
 * | instant of greatest eclipse (TD) | ✅ | ✅ |
 * | type (total / partial / annular / penumbral) | ✅ | ✅ |
 * | magnitude | ✅ penumbral *and* umbral | ✅ |
 * | duration of each phase | ✅ penumbral / partial / total | central duration only |
 * | **local circumstances for a given observer** | n/a — a lunar eclipse looks the same from everywhere it is visible | ❌ **not in this file** |
 *
 * That asymmetry is the whole difficulty of §36.5, and it is a property of the
 * problem rather than of this script. A lunar eclipse is shadow geometry: the
 * Moon is either in the umbra or it is not, and every observer who can see the
 * Moon sees the same contact times, so the canon's geocentric numbers *are* the
 * local ones. A solar eclipse is a shadow cast on a rotating ellipsoid, and
 * contact times differ by minutes between towns.
 *
 * So the canon validates the whole lunar path and the *geocentric* half of the
 * solar path. Validating solar **local** circumstances broadly would mean
 * scraping one page per eclipse per site; what this library does instead is
 * stated, with measurements, in `docs/v5-validation-report.md` § Step 5.
 *
 * ## Time scale
 *
 * The catalogue prints TD (= TT), and gives its own ΔT per eclipse so the UT
 * instant can be recovered. Both are kept: comparing in TT removes ΔT from the
 * comparison, exactly as `horizons-fetch.mjs` does, and ΔT is measured on its
 * own in `tier0-deltat.test.ts`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] ?? 'tests/fixtures/nasa-eclipses.json';

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Centuries to pull. 1901–2100 covers the span the library supports. */
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
  // The catalogue is a <pre> table wrapped in markup; strip tags and unescape.
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

/**
 * Lunar rows:
 *   cat, date, TD, ΔT, luna, saros, type, QSE, gamma,
 *   penumbral mag, umbral mag, pen dur, partial dur, total dur, lat, lon
 */
function parseLunar(text) {
  const out = [];
  // The type column is not a bare word: totals are printed `T`, `T-` or `T+`
  // depending on whether the Moon's limb clears the umbra, and penumbrals as
  // `N`, `Nb` or `Nt`. Matching `\w+` silently dropped 33 of 229 rows a century.
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
      /** Raw catalogue code (`T`, `T-`, `T+`, `P`, `N`, `Nb`, `Nt`). */
      type,
      /** First letter only — the distinction this library reports. */
      kind: type[0],
      gamma: Number(gamma),
      penumbralMagnitude: Number(penumbralMag),
      umbralMagnitude: Number(umbralMag),
      /** Full durations, minutes. Halve for a semi-duration. */
      penumbralDurationMin: Number(penDur) || 0,
      partialDurationMin: Number(parDur) || 0,
      totalDurationMin: Number(totDur) || 0,
    });
  }
  return out;
}

/**
 * Solar rows:
 *   cat, date, TD, ΔT, luna, saros, type, QLE, gamma, magnitude,
 *   lat, lon, sun alt, path width, central duration
 */
function parseSolar(text) {
  const out = [];
  // Extended past the magnitude to the greatest-eclipse **point**: latitude,
  // longitude and the Sun's altitude there. Those three are what make the
  // geocentric solar rows checkable at all — a local solver can be placed at
  // that point and asked what it sees, without this library ever having to
  // implement Besselian elements. They are printed to the whole degree, which
  // is ~55 km of latitude, so the check they support is on type, magnitude and
  // altitude rather than on a contact time.
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
      /** Raw catalogue code (`T`, `A`, `H`, `P`, and their qualified forms). */
      type,
      /** First letter only — the distinction this library reports. */
      kind: type[0],
      gamma: Number(gamma),
      magnitude: Number(magnitude),
      /** Greatest-eclipse point, degrees, to the whole degree as published. */
      greatestLatitude: latHemisphere === 'S' ? -Number(lat) : Number(lat),
      greatestLongitude: lonHemisphere === 'W' ? -Number(lon) : Number(lon),
      /** Sun's altitude at that point, degrees. Zero for a partial eclipse. */
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
    // Count the catalogue's own rows independently and require every one to
    // have parsed. A regex that silently drops the awkward rows is worse than
    // one that fails: the dropped rows are exactly the unusual eclipses.
    const expected = text.split('\n')
      .filter((l) => /^\s*\d{5}\s+-?\d{1,5}\s+\w{3}\s+\d{2}\s/.test(l)).length;
    if (rows.length !== expected) {
      throw new Error(`parsed ${rows.length} of ${expected} rows from ${page.url} — the layout may have changed`);
    }
    (page.kind === 'lunar' ? lunar : solar).push(...rows);
    console.error(`  ${page.kind.padEnd(5)} ${rows.length} rows  ${page.url}`);
  }
  lunar.sort((a, b) => a.jdGreatestTt - b.jdGreatestTt);
  solar.sort((a, b) => a.jdGreatestTt - b.jdGreatestTt);

  const out = {
    _comment: [
      'Tier 0 eclipse ground truth — NASA/Espenak Five Millennium Canon.',
      'Does not originate from panchang-ts and does not change when panchang-ts',
      'does. Greatest-eclipse instants are Terrestrial Dynamical Time (= TT);',
      'each row carries the canon\'s own DeltaT so a UT instant can be recovered.',
      'Solar rows are GEOCENTRIC: the canon does not publish local circumstances',
      'for an arbitrary observer, which is the documented limit of Tier 0',
      'coverage for the solar path. Regenerate with `node notes/eclipse-fetch.mjs`.',
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
