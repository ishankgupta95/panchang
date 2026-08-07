#!/usr/bin/env node
/**
 * Phase 36.2–36.4 — pull the published ephemeris coefficient tables and commit
 * them, gzipped and byte-identical, as the source the generator truncates from.
 *
 *   node notes/ephemeris-fetch.mjs
 *
 * Writes `tests/fixtures/ephemeris-source/*.gz`. Re-running it and diffing is
 * the audit: the bundles are concatenations of the upstream files with a
 * `===== NAME =====` separator line and nothing else changed, so
 * `gunzip -c … | sed -n '/===== ELP1 /,/===== ELP2 /p'` is comparable to a fresh
 * `curl` of VizieR.
 *
 * ## Why the raw tables are committed rather than trusted
 *
 * These are thousands of periodic-term coefficients — data, not logic. PLAN.md
 * §36.2's sourcing decision was to fetch the full published tables and truncate
 * them offline, "exactly as `notes/horizons-fetch.mjs` sits beside the Horizons
 * fixture", so that the series which ships can be checked against something
 * rather than believed. Two consumers depend on that:
 *
 *  - `notes/ephemeris-generate.mjs` truncates these to the shipped series in
 *    `src/astronomy/series/`, to a stated error budget;
 *  - `tests/reference/` evaluates them **untruncated** as the frozen reference
 *    implementation §36.0 H requires. The differential test between the two is
 *    therefore a direct measurement of the truncation budget, which is the
 *    property that makes the budget a fact rather than a claim.
 *
 * The bundles cost ~1.2 MB gzipped in the repository. They are under `tests/`,
 * which `.npmignore` excludes, so nothing reaches the published package.
 *
 * ## Sources, and their licence status
 *
 * | table | catalogue | authors |
 * |---|---|---|
 * | VSOP87D | VizieR **VI/81** | Bretagnon & Francou 1988, A&A 202, 309 (Bureau des Longitudes / IMCCE) |
 * | ELP2000-82B | VizieR **VI/79** | Chapront-Touzé & Chapront 1983/1988 (Bureau des Longitudes / IMCCE) |
 * | IAU 2000A nutation (2000_R06) | IERS Conventions 2010, ch. 5 tables 5.3a/5.3b | IERS |
 *
 * All three are published reference data in the public domain, distributed for
 * exactly this use. `vsop87.chk` — IMCCE's own substitution results — is fetched
 * too and is not decoration: it validates the parser independently of anything
 * this library computes, which is the one thing the Horizons fixture cannot do
 * (a parse error and a theory error look identical against Horizons).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const OUT = process.argv[2] ?? 'tests/fixtures/ephemeris-source';

const VIZIER = 'https://cdsarc.cds.unistra.fr/ftp';
const IERS = 'https://iers-conventions.obspm.fr/content/chapter5/additional_info';

/** Bodies whose VSOP87D series this library uses: Earth (for the Sun) + Mercury–Saturn. */
const VSOP_BODIES = ['ear', 'mer', 'ven', 'mar', 'jup', 'sat'];

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  // A length floor would be wrong here — ELP22 legitimately holds four terms.
  // What every one of these files does have is a title line and at least one
  // data line, and none of them is HTML, which is what a proxy error page is.
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2 || /^\s*</.test(text)) {
    throw new Error(`not a coefficient table at ${url}:\n${text.slice(0, 200)}`);
  }
  return text;
}

/**
 * Concatenate upstream files into one bundle, preserving each byte and marking
 * the boundaries. The separator is the only thing this script adds.
 */
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

const PROVENANCE = `# Ephemeris source tables — provenance

Fetched by [notes/ephemeris-fetch.mjs](../../../notes/ephemeris-fetch.mjs). Do not
hand-edit: re-run the script and diff instead. Each bundle is the upstream files
concatenated verbatim, separated by a \`===== NAME =====\` line.

| bundle | upstream | reference |
|---|---|---|
| \`vsop87d.txt.gz\` | ${VIZIER}/VI/81/VSOP87D.{ear,mer,ven,mar,jup,sat} | Bretagnon P., Francou G., *A&A* **202**, 309 (1988) |
| \`vsop87.chk.txt.gz\` | ${VIZIER}/VI/81/vsop87.chk | IMCCE's own substitution results — used to validate the parser |
| \`elp2000-82b.txt.gz\` | ${VIZIER}/VI/79/ELP1 … ELP36 | Chapront-Touzé M., Chapront J., *A&A* **124**, 50 (1983); **190**, 342 (1988) |
| \`iers-nutation.txt.gz\` | ${IERS}/tab5.3{a,b}.txt | IERS Conventions (2010), ch. 5 — IAU 2000A nutation, 2000_R06 expression |

## Who reads these

- \`notes/ephemeris-generate.mjs\` truncates them into \`src/astronomy/series/\`
  under a stated error budget, and prints the resulting term counts.
- \`tests/reference/\` evaluates them **untruncated**, as the frozen reference
  implementation of PLAN.md §36.0 H. The shipped series is differential-tested
  against that reference, so the truncation budget is measured rather than
  asserted.

Nothing in \`src/\` reads these files; the published package does not contain them
(\`.npmignore\` excludes \`tests/\`).
`;

main().catch((e) => { console.error(e); process.exit(1); });
