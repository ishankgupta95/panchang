import { describe, it, expect } from 'vitest';
import { LongitudeCache } from '../../src/astronomy/cache';

describe('LongitudeCache', () => {
  it('memoizes on the exact instant, not a time bucket', () => {
    const cache = new LongitudeCache('lahiri');
    const d1 = new Date('2025-01-14T12:00:10Z');
    const d2 = new Date('2025-01-14T12:00:45Z');
    const v1 = cache.getMoon(d1);
    const v2 = cache.getMoon(d2);
    expect(v1).not.toBe(v2);
    expect(cache.hits).toBe(0);
    expect(cache.misses).toBe(2);
  });

  it('returns the cached value for a repeated instant', () => {
    const cache = new LongitudeCache('lahiri');
    const d = new Date('2025-01-14T12:00:10Z');
    const v1 = cache.getMoon(d);
    const v2 = cache.getMoon(new Date(d.getTime()));
    expect(v1).toBe(v2);
    expect(cache.hits).toBe(1);
    expect(cache.misses).toBe(1);
  });

  it('is order-independent: the value for an instant never depends on history', () => {
    const instants = [0, 7_000, 23_500, 41_000, 59_999, 60_001].map(
      (off) => new Date(Date.parse('2025-01-14T12:00:00Z') + off),
    );
    const forward = new LongitudeCache('lahiri');
    const reverse = new LongitudeCache('lahiri');
    const a = instants.map((d) => forward.getMoon(d));
    const b = [...instants].reverse().map((d) => reverse.getMoon(d)).reverse();
    expect(a).toEqual(b);
  });

  it('returns different values for different instants', () => {
    const cache = new LongitudeCache('lahiri');
    cache.getMoon(new Date('2025-01-14T12:00:00Z'));
    cache.getMoon(new Date('2025-01-14T12:05:00Z'));
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

  it('hit rate increases when the same instant is re-read', () => {
    const cache = new LongitudeCache('lahiri');
    const t = Date.parse('2025-01-14T06:00:30Z');
    cache.getSun(new Date(t));
    cache.getSun(new Date(t));
    cache.getSun(new Date(t));
    expect(cache.hits).toBe(2);
    expect(cache.misses).toBe(1);
  });
});
