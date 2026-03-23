import { describe, it, expect } from 'vitest';
import { findTransitionTime } from '../../src/utils/search';

describe('findTransitionTime', () => {
  it('finds the moment a step function changes', () => {
    // Mock: index 5 before hour 10, index 6 from hour 10 onward
    const getIndex = (d: Date) => (d.getUTCHours() >= 10 ? 6 : 5);
    const start = new Date('2025-01-14T00:00:00Z');
    const end = new Date('2025-01-14T23:59:00Z');

    const result = findTransitionTime(start, end, 5, getIndex, 15, 60_000);
    expect(result.getUTCHours()).toBe(10);
    expect(result.getUTCMinutes()).toBeLessThanOrEqual(1);
  });

  it('works with tight tolerance', () => {
    const changeAt = new Date('2025-01-14T15:30:00Z').getTime();
    const getIndex = (d: Date) => (d.getTime() >= changeAt ? 3 : 2);
    const start = new Date('2025-01-14T00:00:00Z');
    const end = new Date('2025-01-15T00:00:00Z');

    const result = findTransitionTime(start, end, 2, getIndex, 25, 1000);
    expect(Math.abs(result.getTime() - changeAt)).toBeLessThan(2000);
  });
});
