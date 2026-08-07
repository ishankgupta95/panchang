/**
 * Muhurta JSON Generator
 *
 * Thin CLI wrapper around `buildMuhurtaTable`, kept as a worked example of the
 * compute-and-cache pattern — the muhurta counterpart to
 * `generate-festivals-json.ts`. The library ships **no** pre-computed table:
 * generate your own for the occasion and location you care about, commit it to
 * *your* project, and read it back with `panchang-ts/muhurta`.
 *
 * Muhurta scores are location- *and* rule-dependent, more so than festival
 * dates: a table built for Varanasi and `vivah` says nothing about Chicago or
 * about `grihaPravesh`. Change both constants below to your own.
 *
 * Usage:
 *   npm run muhurta:gen                        # -> ./muhurta-vivah.json
 *   npm run muhurta:gen -- path/out.json       # explicit path
 *   npm run muhurta:gen -- out.json grihaPravesh
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Imports from the built bundle so we don't fight Node's ESM resolver
// (the source uses extensionless imports under `moduleResolution: bundler`).
// `npm run muhurta:gen` runs `npm run build` first.
import { buildMuhurtaTable, STOCK_MUHURTA_RULES } from '../dist/index.js';

const REFERENCE = {
  name: 'Varanasi',
  latitude: 25.3176,
  longitude: 82.9739,
  timezoneOffsetMinutes: 330, // IST (UTC+5:30)
};

const YEARS_PAST = 0;
const YEARS_FUTURE = 5;

const NOTE =
  'Pre-computed muhurta table for one occasion at Varanasi (IST). Scores are ' +
  'location- and rule-dependent, so this table says nothing about another ' +
  'place or another occasion — build your own with buildMuhurtaTable. Only ' +
  'days that pass the rule are stored; pass includeFailures to keep the rest.';

function main(): void {
  const outArg = process.argv[2];
  const occasion = process.argv[3] ?? 'vivah';

  const rule = STOCK_MUHURTA_RULES[occasion];
  if (!rule) {
    process.stderr.write(
      `Unknown occasion "${occasion}". Available: ` +
      `${Object.keys(STOCK_MUHURTA_RULES).join(', ')}\n`,
    );
    process.exit(1);
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = currentYear - YEARS_PAST;
  const endYear = currentYear + YEARS_FUTURE;

  process.stderr.write(
    `Building muhurta (${occasion}) for ${REFERENCE.name}: ${startYear}–${endYear}\n`,
  );

  const file = buildMuhurtaTable({
    rule,
    location: { latitude: REFERENCE.latitude, longitude: REFERENCE.longitude },
    timezoneOffsetMinutes: REFERENCE.timezoneOffsetMinutes,
    startYear,
    endYear,
    ayanamsa: 'lahiri',
    masaSystem: 'purnimanta',
    referenceLocation: REFERENCE.name,
    generatedAt: now.toISOString(),
    note: NOTE,
  });

  // Output path: first CLI arg, else `muhurta-<occasion>.json` in the current
  // directory. Nothing is written into the package — consumers own their table.
  const outPath = resolve(outArg ?? `muhurta-${occasion}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');

  const totalDays = Object.values(file.years).reduce((s, d) => s + d.length, 0);
  process.stderr.write(
    `Wrote ${outPath}\n` +
    `  ${endYear - startYear + 1} years, ${totalDays} auspicious days, ` +
    `${file._dict.length} distinct scoring factors\n`,
  );
}

main();
