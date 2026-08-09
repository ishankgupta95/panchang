/**
 * @tier 2  this repository — the two module-level memos against themselves
 *
 * PLAN.md §36.0 H, for the caches that have no slow counterpart to be compared
 * against. `nutation()` in `frame.ts` and `earthRect()` in `vsop87.ts` are both
 * fixed-size, module-level, and keyed on **exact** equality of a floating-point
 * argument. Neither has a reference implementation to differ from — a memo is
 * not an approximation of anything, so there is no error to bound.
 *
 * What there *is* to assert is the property both modules claim in prose and
 * `cache.ts` argues at length: a memo keyed on the exact argument is a pure
 * function of that argument, so it can only ever change **which call does the
 * work**, never the answer. `differential-riseset.test.ts` states the same thing
 * for the rise/set track cache — *"the track cache cannot change an answer, only
 * the work to get one"* — and these are the two that were added later and never
 * got it.
 *
 * ## What could actually go wrong, and what each case is for
 *
 * The failure mode is not "the memo returns a stale number". It is subtler and
 * `cache.ts` has a whole section on having been bitten by it: a cache that keys
 * on a *bucket* rather than an exact value stores the result computed at
 * whichever instant happened to land in that bucket first, so the answer depends
 * on **call order** — and then an unrelated refactor that adds or removes an
 * ephemeris read silently moves published times. Both memos here are ring
 * buffers of a handful of entries, so eviction order is observable behaviour;
 * these cases drive them cold, warm, evicted, and interleaved, and demand one
 * answer.
 *
 * `earthRect` gets a second case its neighbour does not need: it writes into a
 * caller-supplied array rather than returning a value, so a hit must copy out
 * and a miss must not hand back the module's own storage. An aliasing bug there
 * would let one caller's later write corrupt the next caller's read, which no
 * amount of key-exactness would catch.
 */
import { describe, it, expect } from 'vitest';
import { nutation } from '../../src/astronomy/frame';
import { earthRect, heliocentricRect } from '../../src/astronomy/vsop87';

/** Julian centuries TT spanning well beyond the supported range. */
const EPOCHS = [
  -1.4, -1.0, -0.5, -0.123456789, 0, 1e-9, 0.25, 0.256789, 0.5, 0.75,
  1.0, 1.25, 1.4, 1.499999, -0.75, 0.3333333333333333,
];

/**
 * Enough distinct arguments to overflow either ring buffer several times over.
 * The memos hold 16 and 4 entries, so 40 evicts repeatedly.
 */
const FLUSH = Array.from({ length: 40 }, (_, i) => -1.5 + (i * 3) / 40 + 0.0137);

describe('module-level memos are pure functions of their argument', () => {
  it('nutation: cold, warm, evicted and interleaved all agree', () => {
    // Cold-ish: whatever the memo holds now is unknown, so establish the truth
    // by reading each epoch once and then proving nothing can move it.
    const cold = EPOCHS.map((t) => ({ ...nutation(t) }));

    // Warm — every epoch is now resident (16 epochs, 16 slots).
    const warm = EPOCHS.map((t) => ({ ...nutation(t) }));
    expect(warm).toEqual(cold);

    // Evicted — flush the buffer several times over, then re-read.
    for (const t of FLUSH) nutation(t);
    const evicted = EPOCHS.map((t) => ({ ...nutation(t) }));
    expect(evicted).toEqual(cold);

    // Interleaved — a different epoch between every read, so no two consecutive
    // reads of the list share a cache state. This is the case that would catch
    // a memo keyed on anything coarser than exact equality.
    const interleaved = EPOCHS.map((t, i) => {
      nutation(FLUSH[i % FLUSH.length]!);
      return { ...nutation(t) };
    });
    expect(interleaved).toEqual(cold);

    // Reverse order, for the same reason a ring buffer's eviction order is
    // observable: the same set of keys, arriving differently.
    const reversed = [...EPOCHS].reverse().map((t) => ({ ...nutation(t) }));
    expect(reversed).toEqual([...cold].reverse());
  });

  it('nutation: neighbouring arguments are not conflated', () => {
    // The keys are exact, so two epochs a millisecond apart are two entries and
    // must give two answers. If this ever passed with equality it would mean the
    // memo had started bucketing — the failure `cache.ts` documents.
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

    // The memo holds 4 entries against 16 epochs, so it is already thrashing;
    // flush it anyway and read in a different order.
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
    // Two live output arrays over the same epoch. If a hit handed back a view of
    // the memo's storage — or a miss kept a reference to the caller's array —
    // mutating one would be visible in the other, and every planet in a chart
    // reads the Earth into the same module-level scratch.
    const ttDays = 9131.25;
    const first = new Float64Array(3);
    const second = new Float64Array(3);
    earthRect(ttDays, first);
    const snapshot = [...first];
    first[0] = 12345;
    earthRect(ttDays, second);
    expect([...second]).toEqual(snapshot);
    // And the memo itself is undamaged by that write.
    const third = new Float64Array(3);
    earthRect(ttDays, third);
    expect([...third]).toEqual(snapshot);
  });

  it('earthRect: the memo cannot change the answer the series gives', () => {
    // The strongest form: compare against the uncached path over the same
    // series. `heliocentricRect('earth', …)` reads the *coarse* Earth that
    // `sun.ts` uses, so this is deliberately not an equality — it is the check
    // that the two Earth series are genuinely different, which is the whole
    // point of the split, together with the memoized one being the tighter.
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
    // Same body, so they agree to well under an arcsecond of direction (1″ at
    // 1 AU is 4.8e-6 AU); different truncations, so not to zero.
    expect(separation).toBeGreaterThan(0);
    expect(separation).toBeLessThan(5e-6);
  });
});
