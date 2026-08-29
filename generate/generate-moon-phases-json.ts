/**
 *   npm run moon-phases:gen                 # -> ./moonPhases.json
 *   npm run moon-phases:gen -- path/out.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The built bundle, not source: `npm run moon-phases:gen` builds first.
import { buildMoonPhasesTable } from '../source/ts/dist/index.js';

const TZ_OFFSET = 330;
const REFERENCE = 'India (IST)';

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

const NOTE =
  'Moon phases pre-computed for IST (India): new / first quarter / full / ' +
  'last quarter. Phases are astronomical instants, the same worldwide; the ' +
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

  process.stderr.write(`Building Moon phases for ${REFERENCE}: ${startYear}-${endYear}\n`);

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
