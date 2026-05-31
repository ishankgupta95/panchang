/**
 * Eclipses JSON Generator
 *
 * Thin CLI wrapper around `buildEclipsesTable` that produces the bundled
 * India table at `src/data/eclipses.json`. The window is dynamic — 2 years
 * past through 5 years future relative to the run date — matching the
 * festivals generator, so the two tables cover the same span.
 *
 * The table is computed for Varanasi (IST) and lists only eclipses visible
 * from there (the eclipsed body above the horizon at greatest eclipse). Within
 * India visibility is essentially uniform; users elsewhere should build a
 * location-specific table at runtime with `buildEclipsesTable` and cache it.
 *
 * Usage:
 *   npm run eclipses:gen   # builds the lib, then runs this
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imports from the built bundle so we don't fight Node's ESM resolver
// (the source uses extensionless imports under `moduleResolution: bundler`).
// `npm run eclipses:gen` runs `npm run build` first.
import { buildEclipsesTable } from '../dist/index.js';

const REFERENCE = {
  name: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739,
  timezoneOffsetMinutes: 330, // IST (UTC+5:30)
};

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

const NOTE =
  'Eclipses pre-computed for Varanasi (IST), visible from there during any ' +
  'phase (eclipsed body above the horizon between first and last contact — so ' +
  'an eclipse in progress at moon/sunrise or moon/sunset is included). ' +
  'visibleAtPeak flags whether greatest eclipse itself is observable. Within ' +
  'India visibility is essentially uniform; elsewhere it differs, so build a ' +
  'location-specific table at runtime with buildEclipsesTable and cache it. ' +
  'Solar eclipses carry the subtype seen from Varanasi (a globally-total ' +
  'eclipse may show as partial). Times are ISO UTC. Sutak: 4 prahara (12h) ' +
  'before first contact for solar, 3 prahara (9h) for umbral (partial/total) ' +
  'lunar, ending at moksha; penumbral lunar eclipses carry no sutak and are ' +
  'not religiously observed (drik / pandit consensus). Each entry carries ' +
  'both en and hi text.';

function main(): void {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(`Building eclipses for ${REFERENCE.name}: ${startYear}–${endYear}\n`);

  const file = buildEclipsesTable({
    location: { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude },
    timezoneOffsetMinutes: REFERENCE.timezoneOffsetMinutes,
    startYear,
    endYear,
    languages: ['en', 'hi'],
    visibleOnly: true,
    referenceLocation: REFERENCE.name,
    generatedAt: now.toISOString(),
    note: NOTE,
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const outPath = resolve(__dirname, '..', 'src', 'data', 'eclipses.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const totalDays = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  const totalEclipses = Object.values(file.years).reduce(
    (s, d) => s + d.reduce((s2, day) => s2 + day.eclipses.length, 0),
    0,
  );
  process.stderr.write(
    `Wrote ${outPath}\n` +
    `  ${endYear - startYear + 1} years, ${totalDays} eclipse days, ${totalEclipses} eclipses\n`,
  );
}

main();
