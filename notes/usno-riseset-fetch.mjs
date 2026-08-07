/**
 * US Naval Observatory rise/set, for a grid of locations and dates.
 *
 *   node notes/usno-riseset-fetch.mjs      # writes tests/fixtures/usno-riseset.json
 *
 * USNO is the right reference for this quantity: it is the body that defines
 * the convention this library implements — geometric altitude of the disc's
 * centre plus its semidiameter against 34' of assumed refraction — so a
 * disagreement is an ephemeris or solver difference and not a definitional one.
 * Published to the minute, so the resolution floor is +/-30 s.
 */
import { writeFileSync } from 'node:fs';

const LOCATIONS = [
  { name: 'Quito',      latitude: -0.18,    longitude: -78.47,   tz: -5 },
  { name: 'Chennai',    latitude: 13.0827,  longitude: 80.2707,  tz: 5.5 },
  { name: 'Pune',       latitude: 18.5204,  longitude: 73.8567,  tz: 5.5 },
  { name: 'NYC',        latitude: 40.7128,  longitude: -74.006,  tz: -5 },
  { name: 'London',     latitude: 51.5074,  longitude: -0.1278,  tz: 0 },
  { name: 'Sydney',     latitude: -33.8688, longitude: 151.2093, tz: 10 },
  { name: 'Reykjavik',  latitude: 64.1466,  longitude: -21.9426, tz: 0 },
  { name: 'Alert',      latitude: 82.5,     longitude: -62.35,   tz: -5 },
  { name: 'McMurdo',    latitude: -77.85,   longitude: 166.67,   tz: 12 },
];
const DATES = [
  '1950-03-03', '1950-08-15',
  '2025-03-20', '2025-06-21', '2025-09-22', '2025-12-21',
  '2088-05-09', '2088-11-21',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
for (const loc of LOCATIONS) {
  for (const date of DATES) {
    const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${date}`
      + `&coords=${loc.latitude},${loc.longitude}&tz=${loc.tz}`;
    let d = null;
    for (let attempt = 0; attempt < 3 && d === null; attempt++) {
      try {
        const res = await fetch(url);
        const j = await res.json();
        d = j?.properties?.data ?? null;
      } catch { await sleep(1500); }
    }
    if (d === null) { console.error(`FAILED ${loc.name} ${date}`); continue; }
    const pick = (arr, phen) => (arr ?? []).find((x) => x.phen === phen)?.time ?? null;
    const flags = (arr) => (arr ?? []).filter((x) => x.time === null).map((x) => x.phen);
    rows.push({
      location: loc.name, latitude: loc.latitude, longitude: loc.longitude, tz: loc.tz, date,
      sunrise: pick(d.sundata, 'Rise'), sunset: pick(d.sundata, 'Set'),
      moonrise: pick(d.moondata, 'Rise'), moonset: pick(d.moondata, 'Set'),
      sunFlags: flags(d.sundata), moonFlags: flags(d.moondata),
    });
    process.stderr.write('.');
    await sleep(350);
  }
}
writeFileSync(new URL('../tests/fixtures/usno-riseset.json', import.meta.url),
  JSON.stringify({ source: 'US Naval Observatory, aa.usno.navy.mil/api/rstt/oneday',
    retrieved: new Date().toISOString().slice(0, 10),
    note: 'Local clock times at the stated fixed UTC offset; no DST. Published to the minute.',
    rows }, null, 2));
console.error(`\nwrote ${rows.length} rows`);
