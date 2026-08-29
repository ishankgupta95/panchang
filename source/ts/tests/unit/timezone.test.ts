import { describe, it, expect } from 'vitest';
import { getLocalMidnightUtc, utcToLocalDisplay } from '../../src/utils/timezone';

// Inputs use `Date.UTC`: `new Date(y, m, d)` is a different instant per host.
describe('getLocalMidnightUtc', () => {
  it('IST (330): noon-UTC Jan 14 anchors Jan 14 IST → Jan 13 18:30 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 12, 0, 0));
    const result = getLocalMidnightUtc(date, 330);
    expect(result.toISOString()).toBe('2025-01-13T18:30:00.000Z');
  });

  it('EST (-300): noon-UTC Jan 14 anchors Jan 14 EST → Jan 14 05:00 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 12, 0, 0));
    const result = getLocalMidnightUtc(date, -300);
    expect(result.toISOString()).toBe('2025-01-14T05:00:00.000Z');
  });

  it('UTC (0): noon-UTC Jan 14 anchors Jan 14 UTC → Jan 14 00:00 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 12, 0, 0));
    const result = getLocalMidnightUtc(date, 0);
    expect(result.toISOString()).toBe('2025-01-14T00:00:00.000Z');
  });

  it('Samoa (780): noon-UTC Jan 14 anchors Jan 15 SST → Jan 14 11:00 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 12, 0, 0));
    const result = getLocalMidnightUtc(date, 780);
    expect(result.toISOString()).toBe('2025-01-14T11:00:00.000Z');
  });

  it('IST (330): 23:00 UTC Jan 14 anchors Jan 15 IST → Jan 14 18:30 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 23, 0, 0));
    const result = getLocalMidnightUtc(date, 330);
    expect(result.toISOString()).toBe('2025-01-14T18:30:00.000Z');
  });
});

describe('utcToLocalDisplay', () => {
  it('shifts UTC date by IST offset', () => {
    const utc = new Date('2025-01-14T01:34:00Z');
    const local = utcToLocalDisplay(utc, 330);
    expect(local.getUTCHours()).toBe(7);
    expect(local.getUTCMinutes()).toBe(4);
  });
});
