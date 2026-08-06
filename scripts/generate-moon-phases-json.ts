/**
 * Moon-phases JSON Generator
 *
 * Thin CLI wrapper around `buildMoonPhasesTable`, kept as a worked example of
 * the compute-and-cache pattern. The library ships **no** pre-computed table:
 * generate your own, commit it to *your* project, and read it back with
 * `panchang-ts/moon-phases`.
 *
 * The window is dynamic — 2 years past through 5 years future relative to the
 * run date. Lunar phases are astronomical instants (the same worldwide); the
 * timezone below only decides which calendar date each instant lands on.
 *
 * Usage:
 *   npm run moon-phases:gen                 # -> ./moonPhases.json
 *   npm run moon-phases:gen -- path/out.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Imports from the built bundle so we don't fight Node's ESM resolver.
// `npm run moon-phases:gen` runs `npm run build` first.
import { buildMoonPhasesTable } from '../dist/index.js';

const TZ_OFFSET = 330; // IST (UTC+5:30)
const REFERENCE = 'India (IST)';

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

const NOTE =
  'Moon phases pre-computed for IST (India): new / first quarter / full / ' +
  'last quarter. Phases are astronomical instants — the same worldwide; the ' +
  'date column is each instant mapped to IST. New moon = Amavasya, full moon ' +
  '= Purnima (these are precise instants, distinct from the same-named tithis, ' +
  'which are ~24h windows). For another timezone, build a table at runtime ' +
  'with buildMoonPhasesTable. Times are ISO UTC. Each entry carries both en ' +
  'and hi text.';

function main(): void {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(`Building Moon phases for ${REFERENCE}: ${startYear}–${endYear}\n`);

  const file = buildMoonPhasesTable({
    timezoneOffsetMinutes: TZ_OFFSET,
    startYear,
    endYear,
    languages: ['en', 'hi'],
    referenceLocation: REFERENCE,
    generatedAt: now.toISOString(),
    note: NOTE,
  });

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // Output path: first CLI arg, else `<name>` in the current directory.
  // Nothing is written into the package — consumers own their table.
  const outPath = resolve(process.argv[2] ?? 'moonPhases.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const totalDays = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  const totalPhases = Object.values(file.years).reduce(
    (s, d) => s + d.reduce((s2, day) => s2 + day.phases.length, 0),
    0,
  );
  process.stderr.write(
    `Wrote ${outPath}\n` +
    `  ${endYear - startYear + 1} years, ${totalDays} phase days, ${totalPhases} phase events\n`,
  );
}

main();
