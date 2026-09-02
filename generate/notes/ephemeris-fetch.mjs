#!/usr/bin/env node
/**
 *   node generate/notes/ephemeris-fetch.mjs
 *
 * `vsop87.chk` is IMCCE's own substitution results, fetched so the parser can
 * be validated on its own: against the Horizons fixture a parse error and a
 * theory error look identical.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const OUT = process.argv[2] ?? 'testdata/ephemeris';

const VIZIER = 'https://cdsarc.cds.unistra.fr/ftp';
const IERS = 'https://iers-conventions.obspm.fr/content/chapter5/additional_info';

/** Earth is in the list because the Sun's position is computed from it. */
const VSOP_BODIES = ['ear', 'mer', 'ven', 'mar', 'jup', 'sat'];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  // A length floor would be wrong: ELP22 legitimately holds four terms.
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2 || /^\s*</.test(text)) {
    throw new Error(`not a coefficient table at ${url}:\n${text.slice(0, 200)}`);
  }
  return text;
}

function bundle(parts) {
  return parts.map(([name, text]) => `===== ${name} =====\n${text}`).join('');
}

function emit(file, text) {
  const gz = gzipSync(Buffer.from(text, 'utf8'), { level: 9 });
  writeFileSync(`${OUT}/${file}.gz`, gz);
  console.error(`  ${file}.gz  ${(gz.length / 1024).toFixed(0)} KB  (${(text.length / 1024).toFixed(0)} KB raw)`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  console.error('VSOP87D (VizieR VI/81)');
  const vsop = [];
  for (const b of VSOP_BODIES) {
    vsop.push([`VSOP87D.${b}`, await get(`${VIZIER}/VI/81/VSOP87D.${b}`)]);
    process.stderr.write(`\r  fetched ${vsop.length}/${VSOP_BODIES.length}   `);
  }
  process.stderr.write('\n');
  emit('vsop87d.txt', bundle(vsop));
  emit('vsop87.chk.txt', await get(`${VIZIER}/VI/81/vsop87.chk`));

  console.error('ELP2000-82B (VizieR VI/79)');
  const elp = [];
  for (let i = 1; i <= 36; i++) {
    elp.push([`ELP${i}`, await get(`${VIZIER}/VI/79/ELP${i}`)]);
    process.stderr.write(`\r  fetched ${elp.length}/36   `);
  }
  process.stderr.write('\n');
  emit('elp2000-82b.txt', bundle(elp));

  console.error('IAU 2000A nutation (IERS Conventions 2010, ch. 5)');
  emit('iers-nutation.txt', bundle([
    ['tab5.3a', await get(`${IERS}/tab5.3a.txt`)],
    ['tab5.3b', await get(`${IERS}/tab5.3b.txt`)],
  ]));

  writeFileSync(`${OUT}/PROVENANCE.md`, PROVENANCE);
  console.error(`wrote ${OUT}/`);
}

const PROVENANCE = `# Ephemeris source tables: provenance

Fetched by [generate/notes/ephemeris-fetch.mjs](../../generate/notes/ephemeris-fetch.mjs). Do not
hand-edit: re-run the script and diff instead. Each bundle is the upstream files
concatenated verbatim, separated by a \`===== NAME =====\` line.

| bundle | upstream | reference |
|---|---|---|
| \`vsop87d.txt.gz\` | ${VIZIER}/VI/81/VSOP87D.{ear,mer,ven,mar,jup,sat} | Bretagnon P., Francou G., *A&A* **202**, 309 (1988) |
| \`vsop87.chk.txt.gz\` | ${VIZIER}/VI/81/vsop87.chk | IMCCE's own substitution results, used to validate the parser |
| \`elp2000-82b.txt.gz\` | ${VIZIER}/VI/79/ELP1 … ELP36 | Chapront-Touzé M., Chapront J., *A&A* **124**, 50 (1983); **190**, 342 (1988) |
| \`iers-nutation.txt.gz\` | ${IERS}/tab5.3{a,b}.txt | IERS Conventions (2010), ch. 5, IAU 2000A nutation, 2000_R06 expression |

## Who reads these

- \`generate/notes/ephemeris-generate.mjs\` truncates them into \`src/astronomy/series/\`
  under a stated error budget, and prints the resulting term counts.
- \`tests/reference/\` evaluates them **untruncated**, as the frozen reference
  implementation. The shipped series is differential-tested against that
  reference, so the truncation budget is measured rather than asserted.

Nothing in \`src/\` reads these files; the published package does not contain them
(the package's \`files\` allow-list excludes \`testdata/\`).
`;

main().catch((e) => { console.error(e); process.exit(1); });
