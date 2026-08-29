/**
 * @tier 2  this repository (it inspects our own test sources)
 *
 * Enforces the tier declaration required by
 * [docs/validation-tiers.md](../../../../docs/validation-tiers.md).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const TIER_RE = /@tier\s+([012])\b/;

function validationFiles(): string[] {
  return readdirSync(HERE)
    .filter((f) => f.endsWith('.test.ts'))
    .sort();
}

describe('test tier policy', () => {
  it('every file in tests/validation declares @tier 0, 1 or 2', () => {
    const missing: string[] = [];
    for (const file of validationFiles()) {
      const src = readFileSync(join(HERE, file), 'utf8');
      const header = src.slice(0, src.indexOf('*/') + 2);
      if (!TIER_RE.test(header)) missing.push(file);
    }
    expect(
      missing,
      `these files carry external-reference assertions with no tier declaration:\n  ${missing.join('\n  ')}\n`
      + 'Add `@tier 0|1|2` to the opening block comment, see docs/validation-tiers.md.',
    ).toEqual([]);
  });

  it('the Tier 0 files are the ones that claim independent authority', () => {
    // Tier 0 means an authority outside this project, so the list is pinned by hand.
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

  it('the tier policy document exists and is reachable from the policy it describes', () => {
    const doc = readFileSync(join(REPO_ROOT, 'docs', 'validation-tiers.md'), 'utf8');
    expect(doc).toContain('@tier');
    expect(doc).toContain('Sensitivity coefficients');
  });
});
