/**
 * @tier 2  this repository (it inspects our own test sources)
 *
 * Enforces the tier declaration required by [TIERS.md](../TIERS.md).
 *
 * PLAN.md §36.0 F asks for the invariant/tolerance split to be "structural, not
 * a promise". A convention nobody checks is a promise; a test that fails when a
 * new validation file arrives without a tier marker is structural. The cost of
 * the marker is one line, and the thing it buys is that the question *which
 * authority does this number come from?* is answered at the point of temptation
 * — inside the file someone is about to re-pin — rather than in a document they
 * would have to think to open.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTS_ROOT = join(HERE, '..');

const TIER_RE = /@tier\s+([012])\b/;

function validationFiles(): string[] {
  return readdirSync(HERE)
    .filter((f) => f.endsWith('.test.ts'))
    .sort();
}

describe('test tier policy (PLAN.md §36.0 F)', () => {
  it('every file in tests/validation declares @tier 0, 1 or 2', () => {
    const missing: string[] = [];
    for (const file of validationFiles()) {
      const src = readFileSync(join(HERE, file), 'utf8');
      // Only the opening block comment counts — a marker buried next to one
      // assertion would not answer the question for the file as a whole.
      const header = src.slice(0, src.indexOf('*/') + 2);
      if (!TIER_RE.test(header)) missing.push(file);
    }
    expect(
      missing,
      `these files carry external-reference assertions with no tier declaration:\n  ${missing.join('\n  ')}\n`
      + 'Add `@tier 0|1|2` to the opening block comment — see tests/TIERS.md.',
    ).toEqual([]);
  });

  it('the Tier 0 files are the ones that claim independent authority', () => {
    // A guard against tier inflation: Tier 0 means a source outside this
    // project that does not move when this project moves. Adding a file here
    // should be a deliberate act, not a side effect of copying a header.
    const tier0 = validationFiles().filter((f) => {
      const src = readFileSync(join(HERE, f), 'utf8');
      return /@tier\s+0\b/.test(src.slice(0, src.indexOf('*/') + 2));
    });
    expect(tier0.sort()).toEqual([
      'tier0-crosschecks.test.ts',
      'tier0-deltat.test.ts',
      'tier0-horizons.test.ts',
      'tier0-own-deltat.test.ts',
      'tier0-own-eclipses.test.ts',
      'tier0-own-planets.test.ts',
      'tier0-own-sun-moon.test.ts',
      'tier0-usno-riseset.test.ts',
    ]);
  });

  it('TIERS.md exists and is reachable from the policy it describes', () => {
    const doc = readFileSync(join(TESTS_ROOT, 'TIERS.md'), 'utf8');
    expect(doc).toContain('@tier');
    expect(doc).toContain('Sensitivity coefficients');
  });
});
