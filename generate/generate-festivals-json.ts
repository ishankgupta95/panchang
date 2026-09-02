/**
 *   npm run festivals:gen                 # -> ./festivals.json
 *   npm run festivals:gen -- path/out.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Built bundle, not src: src uses extensionless imports Node's ESM resolver rejects.
import { buildFestivalsTable } from '../source/ts/dist/index.js';

const REFERENCE = {
  name: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739,
  timezoneOffsetMinutes: 330,
};

const YEARS_PAST = 2;
const YEARS_FUTURE = 5;

// The "essentially universal within India" claim this note used to carry is not true, and the
// rates below are measured rather than asserted: build the 2024-2028 table at each city and take
// the symmetric difference against Varanasi's, so a festival shifting by a day counts twice.
const NOTE =
  'Festival dates are pre-computed for Varanasi (IST). A tithi ends at one instant worldwide, ' +
  'but the day it lands on is decided by local sunrise, so these dates are exact only for ' +
  'Varanasi. Measured against this table over 2024-2028: Chennai differs on 1.2% of entries, ' +
  'Bengaluru 1.7%, Delhi 2.2%, Kolkata 2.8%, Ujjain 3.0%, Mumbai and Ahmedabad 3.8%, Dwarka ' +
  '4.9%, Dibrugarh 6.0%, which is roughly 3 to 16 differing entries a year. Outside India the ' +
  'shift is larger. For anything that must be right for one place, build a location-specific ' +
  'table at runtime with buildFestivalsTable and cache it. Eclipses are excluded because ' +
  'visibility is location-dependent; use getUpcomingEclipses. Each entry carries both en and hi ' +
  'text (names and descriptions).';

function main(): void {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(`Building festivals for ${REFERENCE.name}: ${startYear}-${endYear}\n`);

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
  const outPath = resolve(process.argv[2] ?? 'festivals.json');
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
