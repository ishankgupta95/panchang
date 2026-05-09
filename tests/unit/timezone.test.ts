import { describe, it, expect } from 'vitest';
import { getLocalMidnightUtc, utcToLocalDisplay } from '../../src/utils/timezone';

// `getLocalMidnightUtc` reads the calendar day from the input Date's
// instant *as interpreted in the configured offset*. Tests use explicit
// UTC instants (via `Date.UTC`) so the result is independent of the host
// runtime's timezone — a Date constructed with `new Date(y, m, d)` would
// resolve to different absolute instants on different hosts and only
// happen to satisfy the `(host TZ) === (offset)` case.
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

  // Host-TZ independence: an extreme far-east offset (e.g. Samoa +13)
  // would push noon-UTC Jan 14 into Jan 15 by host-local fields, but the
  // function uses the configured offset so the calendar day is stable.
  it('Samoa (780): noon-UTC Jan 14 anchors Jan 15 SST → Jan 14 11:00 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 12, 0, 0));
    const result = getLocalMidnightUtc(date, 780);
    expect(result.toISOString()).toBe('2025-01-14T11:00:00.000Z');
  });

  // An instant near the day boundary in the target offset is anchored
  // to the calendar day that contains the instant in *that* offset.
  it('IST (330): 23:00 UTC Jan 14 anchors Jan 15 IST → Jan 14 18:30 UTC', () => {
    const date = new Date(Date.UTC(2025, 0, 14, 23, 0, 0));
    const result = getLocalMidnightUtc(date, 330);
    expect(result.toISOString()).toBe('2025-01-14T18:30:00.000Z');
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
