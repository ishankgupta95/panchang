/**
 * Performance regression tests.
 *
 * Thresholds are set at ~50× the observed Node.js mean to absorb CI variance
 * while still catching catastrophic regressions (e.g. accidentally disabling
 * the LongitudeCache, infinite loops in binary search).
 *
 * Observed on Apple M-series (Node 20):
 *   fast mode  ~0.10ms   → threshold  25ms
 *   full mode  ~0.50ms   → threshold  50ms
 *   instant    ~0.20ms   → threshold   5ms
 *
 * Hermes targets (from PLAN §18.1, budget Android):
 *   fast mode  < 100ms
 *   full mode  < 500ms
 *   instant    <  20ms
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/index';
import { LongitudeCache } from '../../src/astronomy/cache';

const PUNE  = { latitude: 18.5204, longitude: 73.8567 };
const NYC   = { latitude: 40.7128, longitude: -74.0060 };
const DELHI = { latitude: 28.6139, longitude: 77.2090 };

function measureMs(fn: () => void, warmup = 3, runs = 10): number {
  // warmup
  for (let i = 0; i < warmup; i++) fn();
  const start = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - start) / runs;
}

describe('Performance regression — getDailyPanchang fast mode', () => {
  it('Pune summer < 25ms/call on Node', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, { timezone: 330, computeEndTimes: false }),
    );
    expect(ms, `fast mode took ${ms.toFixed(2)}ms, must be < 25ms`).toBeLessThan(25);
  });

  it('NYC (negative longitude) < 25ms/call on Node', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-07-04'), NYC, { timezone: -240, computeEndTimes: false }),
    );
    expect(ms, `fast mode took ${ms.toFixed(2)}ms, must be < 25ms`).toBeLessThan(25);
  });
});

describe('Performance regression — getDailyPanchang full mode', () => {
  it('Pune summer < 50ms/call on Node', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-07-04'), PUNE, { timezone: 330, computeEndTimes: true }),
    );
    expect(ms, `full mode took ${ms.toFixed(2)}ms, must be < 50ms`).toBeLessThan(50);
  });

  it('Delhi year-end < 50ms/call on Node', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-12-31'), DELHI, { timezone: 330, computeEndTimes: true }),
    );
    expect(ms, `full mode took ${ms.toFixed(2)}ms, must be < 50ms`).toBeLessThan(50);
  });

  it('high precision < 80ms/call on Node', () => {
    const ms = measureMs(() =>
      getDailyPanchang(new Date('2025-01-14'), PUNE, {
        timezone: 330,
        computeEndTimes: true,
        precision: 'high',
      }),
    );
    expect(ms, `high precision took ${ms.toFixed(2)}ms, must be < 80ms`).toBeLessThan(80);
  });
});

describe('Performance regression — getInstantPanchang', () => {
  it('Pune instant < 5ms/call on Node', () => {
    const moment = new Date('2025-07-04T06:00:00Z');
    const ms = measureMs(() => getInstantPanchang(moment, PUNE));
    expect(ms, `instant took ${ms.toFixed(2)}ms, must be < 5ms`).toBeLessThan(5);
  });
});

describe('LongitudeCache — hit ratio', () => {
  it('repeated same-day calls achieve > 50% cache hit rate', () => {
    const cache = new LongitudeCache('lahiri');

    const base = new Date('2025-07-04T00:30:00Z');
    // 3 passes over the same 30 timestamps (2-min spacing → unique 1-min buckets).
    // Pass 1 = all misses; passes 2 & 3 = all hits → hit rate = 2/3 ≈ 67%.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < 30; i++) {
        cache.getMoon(new Date(base.getTime() + i * 60_000 * 2));
        cache.getSun(new Date(base.getTime() + i * 60_000 * 2));
      }
    }

    const hitRate = cache.hits / (cache.hits + cache.misses);
    expect(hitRate, `cache hit rate ${(hitRate * 100).toFixed(1)}% must be > 50%`).toBeGreaterThan(0.5);
  });
});
