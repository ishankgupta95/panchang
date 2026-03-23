import { describe, it, expect } from 'vitest';
import { LongitudeCache } from '../../src/astronomy/cache';

describe('LongitudeCache', () => {
  it('returns same value for timestamps in same 1-min bucket', () => {
    const cache = new LongitudeCache('lahiri');
    const d1 = new Date('2025-01-14T12:00:10Z');
    const d2 = new Date('2025-01-14T12:00:45Z');
    const v1 = cache.getMoon(d1);
    const v2 = cache.getMoon(d2);
    expect(v1).toBe(v2);
    expect(cache.hits).toBe(1);
    expect(cache.misses).toBe(1);
  });

  it('returns different values for different 1-min buckets', () => {
    const cache = new LongitudeCache('lahiri');
    const d1 = new Date('2025-01-14T12:00:00Z');
    const d2 = new Date('2025-01-14T12:05:00Z'); // 5 minutes later
    cache.getMoon(d1);
    cache.getMoon(d2);
    expect(cache.misses).toBe(2);
  });

  it('sun and moon caches are separate', () => {
    const cache = new LongitudeCache('lahiri');
    const d = new Date('2025-01-14T12:00:00Z');
    cache.getSun(d);
    cache.getMoon(d);
    expect(cache.misses).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('hit rate increases after repeated calls in same bucket', () => {
    const cache = new LongitudeCache('lahiri');
    const d = new Date('2025-01-14T06:00:30Z');
    cache.getSun(d);
    cache.getSun(new Date('2025-01-14T06:00:55Z'));
    cache.getSun(new Date('2025-01-14T06:00:01Z'));
    expect(cache.hits).toBe(2);
    expect(cache.misses).toBe(1);
  });
});
