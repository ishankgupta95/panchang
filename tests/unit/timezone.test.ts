import { describe, it, expect } from 'vitest';
import { getLocalMidnightUtc, utcToLocalDisplay } from '../../src/utils/timezone';

describe('getLocalMidnightUtc', () => {
  it('IST (330): Jan 14 midnight → Jan 13 18:30 UTC', () => {
    const date = new Date(2025, 0, 14);
    const result = getLocalMidnightUtc(date, 330);
    expect(result.toISOString()).toBe('2025-01-13T18:30:00.000Z');
  });

  it('EST (-300): Jan 14 midnight → Jan 14 05:00 UTC', () => {
    const date = new Date(2025, 0, 14);
    const result = getLocalMidnightUtc(date, -300);
    expect(result.toISOString()).toBe('2025-01-14T05:00:00.000Z');
  });

  it('UTC (0): Jan 14 midnight → Jan 14 00:00 UTC', () => {
    const date = new Date(2025, 0, 14);
    const result = getLocalMidnightUtc(date, 0);
    expect(result.toISOString()).toBe('2025-01-14T00:00:00.000Z');
  });
});

describe('utcToLocalDisplay', () => {
  it('shifts UTC date by IST offset', () => {
    const utc = new Date('2025-01-14T01:34:00Z'); // sunrise UTC
    const local = utcToLocalDisplay(utc, 330);
    expect(local.getUTCHours()).toBe(7);
    expect(local.getUTCMinutes()).toBe(4);
  });
});
