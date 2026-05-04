/**
 * Phase 29 non-regression perf assertion.
 *
 * Phase 29 added 6 new public helpers (`computeLagna`, `computeBhava`,
 * `computeRashiChart`, `computeNavamsa`, `computeAshtakoot`,
 * `computeMangalDosha`, `computeSadeSati`, `computeDignity`,
 * `computeVimshottariPratyantar`). None of these are called by
 * `getDailyPanchang` — they're additive exports that only run when the
 * consumer opts in. This file verifies that property:
 *
 *   1. `getDailyPanchang` perf stays within the existing budget after
 *      Phase 29 modules are imported.
 *   2. Importing and exercising Phase 29 helpers does NOT degrade the
 *      `getDailyPanchang` per-call cost.
 *
 * Threshold parity with `tests/perf/perf.test.ts`:
 *   fast mode  < 25ms
 *   full mode  < 50ms
 */

import { describe, it, expect } from 'vitest';
import {
  getDailyPanchang,
  computeLagna, computeRashiChart, computeNavamsa,
  computeAshtakoot, computeMangalDosha, computeSadeSati,
  computeDignity, computeBhava, computeVimshottariDashaFromBirth,
  computeVimshottariPratyantar,
} from '../../src/index';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

function measureMs(fn: () => void, warmup = 3, runs = 10): number {
  for (let i = 0; i < warmup; i++) fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

describe('Phase 29 non-regression — getDailyPanchang stays within budget', () => {
  it('fast mode < 25ms after Phase 29 modules imported (no transitive leak)', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, { timezone: 330, computeEndTimes: false }),
    );
    expect(ms, `fast mode took ${ms.toFixed(2)}ms; Phase 29 must not regress`).toBeLessThan(25);
  });

  it('full mode < 50ms after Phase 29 modules imported (no transitive leak)', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, { timezone: 330, computeEndTimes: true }),
    );
    expect(ms, `full mode took ${ms.toFixed(2)}ms; Phase 29 must not regress`).toBeLessThan(50);
  });
});

describe('Phase 29 non-regression — exercising Phase 29 helpers does NOT degrade daily panchang', () => {
  it('intermixed Phase 29 + getDailyPanchang calls keep fast-mode under budget', () => {
    const date = new Date('1990-06-15T10:30:00Z');
    const dayDate = new Date('2025-07-04');

    // Warm both code paths.
    for (let i = 0; i < 3; i++) {
      computeLagna(date, PUNE);
      computeRashiChart(date, PUNE);
      computeNavamsa(date, PUNE);
      computeBhava(date, PUNE, { houseSystem: 'placidus-kp' });
      computeAshtakoot({ rashi: 0, nakshatra: 0 }, { rashi: 7, nakshatra: 16 });
      computeMangalDosha(computeRashiChart(date, PUNE));
      computeSadeSati(7, dayDate);
      computeDignity('Mars', 0);
      const dasha = computeVimshottariDashaFromBirth(date);
      computeVimshottariPratyantar(dasha.mahaDashas[0]!.antarDashas[0]!);
      getDailyPanchang(dayDate, PUNE, { timezone: 330 });
    }

    // Steady-state: getDailyPanchang per-call cost while interleaved with Phase 29.
    const start = performance.now();
    const RUNS = 20;
    for (let i = 0; i < RUNS; i++) {
      getDailyPanchang(dayDate, PUNE, { timezone: 330, computeEndTimes: false });
    }
    const msPerCall = (performance.now() - start) / RUNS;
    expect(msPerCall, `intermixed fast-mode ${msPerCall.toFixed(2)}ms`).toBeLessThan(25);
  });
});
