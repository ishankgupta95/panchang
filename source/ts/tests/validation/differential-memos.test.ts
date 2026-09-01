/**
 * @tier 2  this repository, the two module-level memos against themselves
 */
import { describe, it, expect } from 'vitest';
import { nutation } from '../../src/astronomy/frame';
import { earthRect, heliocentricRect } from '../../src/astronomy/vsop87';

/** Julian centuries TT, spanning beyond the supported range. */
const EPOCHS = [
  -1.4, -1.0, -0.5, -0.123456789, 0, 1e-9, 0.25, 0.256789, 0.5, 0.75,
  1.0, 1.25, 1.4, 1.499999, -0.75, 0.3333333333333333,
];

/** The memos hold 16 and 4 entries, so 40 arguments evict repeatedly. */
const FLUSH = Array.from({ length: 40 }, (_, i) => -1.5 + (i * 3) / 40 + 0.0137);

describe('module-level memos are pure functions of their argument', () => {
  it('nutation: cold, warm, evicted and interleaved all agree', () => {
    const cold = EPOCHS.map((t) => ({ ...nutation(t) }));

    const warm = EPOCHS.map((t) => ({ ...nutation(t) }));
    expect(warm).toEqual(cold);

    for (const t of FLUSH) nutation(t);
    const evicted = EPOCHS.map((t) => ({ ...nutation(t) }));
    expect(evicted).toEqual(cold);

    const interleaved = EPOCHS.map((t, i) => {
      nutation(FLUSH[i % FLUSH.length]!);
      return { ...nutation(t) };
    });
    expect(interleaved).toEqual(cold);

    const reversed = [...EPOCHS].reverse().map((t) => ({ ...nutation(t) }));
    expect(reversed).toEqual([...cold].reverse());
  });

  it('nutation: neighbouring arguments are not conflated', () => {
    const t = 0.25;
    const oneMillisecondLater = t + 1 / (86_400_000 * 36525);
    const a = nutation(t).dpsi;
    const b = nutation(oneMillisecondLater).dpsi;
    expect(oneMillisecondLater).not.toBe(t);
    expect(b).not.toBe(a);
  });

  it('earthRect: cold, warm, evicted and interleaved all agree', () => {
    const days = EPOCHS.map((t) => t * 36525);
    const read = (ttDays: number): number[] => {
      const out = new Float64Array(3);
      earthRect(ttDays, out);
      return [...out];
    };

    const cold = days.map(read);
    expect(days.map(read)).toEqual(cold);

    for (const t of FLUSH) read(t * 36525);
    expect(days.map(read)).toEqual(cold);
    expect([...days].reverse().map(read)).toEqual([...cold].reverse());

    const interleaved = days.map((d, i) => {
      read(FLUSH[i % FLUSH.length]! * 36525);
      return read(d);
    });
    expect(interleaved).toEqual(cold);
  });

  it('earthRect: a hit copies out rather than aliasing the memo', () => {
    const ttDays = 9131.25;
    const first = new Float64Array(3);
    const second = new Float64Array(3);
    earthRect(ttDays, first);
    const snapshot = [...first];
    first[0] = 12345;
    earthRect(ttDays, second);
    expect([...second]).toEqual(snapshot);
    const third = new Float64Array(3);
    earthRect(ttDays, third);
    expect([...third]).toEqual(snapshot);
  });

  it('earthRect: the memo cannot change the answer the series gives', () => {
    const ttDays = 9131.25;
    const memoized = new Float64Array(3);
    const coarse = new Float64Array(3);
    earthRect(ttDays, memoized);
    heliocentricRect('earth', ttDays, coarse);
    const separation = Math.hypot(
      (memoized[0] as number) - (coarse[0] as number),
      (memoized[1] as number) - (coarse[1] as number),
      (memoized[2] as number) - (coarse[2] as number),
    );
    expect(separation).toBeGreaterThan(0);
    expect(separation).toBeLessThan(5e-6);
  });
});
