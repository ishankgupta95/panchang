/**
 * Festivals JSON Generator
 *
 * Thin CLI wrapper around `buildFestivalsTable` that produces the bundled
 * India table at `src/data/festivals.json`. The window is dynamic — 2 years
 * past through 5 years future relative to the run date — so re-running keeps
 * the table fresh without editing constants.
 *
 * The table is computed for Varanasi (IST). Within India these dates are
 * essentially universal; users elsewhere should build a location-specific
 * table at runtime with `buildFestivalsTable` and cache it (see README).
 *
 * Usage:
 *   npm run festivals:gen   # builds the lib, then runs this
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imports from the built bundle so we don't fight Node's ESM resolver
// (the source uses extensionless imports under `moduleResolution: bundler`).
// `npm run festivals:gen` runs `npm run build` first.
import { buildFestivalsTable } from '../dist/index.js';

const REFERENCE = {
  name: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739,
  timezoneOffsetMinutes: 330, // IST (UTC+5:30)
};

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

const NOTE =
  'Festival dates are pre-computed for Varanasi (IST). Within India these ' +
  'dates are essentially universal; elsewhere (EU / North America / rest of ' +
  'world) festivals can shift by ±1 day — build a location-specific table at ' +
  'runtime with buildFestivalsTable and cache it. Eclipses are excluded ' +
  'because visibility is location-dependent; use getUpcomingEclipses. Each ' +
  'entry carries both en and hi text (names and descriptions).';

function main(): void {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(`Building festivals for ${REFERENCE.name}: ${startYear}–${endYear}\n`);

  const file = buildFestivalsTable({
    location: { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude },
    timezoneOffsetMinutes: REFERENCE.timezoneOffsetMinutes,
    startYear,
    endYear,
    languages: ['en', 'hi'],
    ayanamsa: 'lahiri',
    masaSystem: 'purnimanta',
    region: 'all',
    referenceLocation: REFERENCE.name,
    generatedAt: now.toISOString(),
    note: NOTE,
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outPath = resolve(__dirname, '..', 'src', 'data', 'festivals.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const totalDays = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  const totalFests = Object.values(file.years).reduce(
    (s, d) => s + d.reduce((s2, day) => s2 + day.festivals.length, 0),
    0,
  );
  process.stderr.write(
    `Wrote ${outPath}\n` +
    `  ${endYear - startYear + 1} years, ${totalDays} festival days, ${totalFests} emissions\n`,
  );
}

main();
