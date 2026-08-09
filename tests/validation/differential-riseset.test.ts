/**
 * @tier 2  this repository — the shipped rise/set solver against its own frozen reference
 *
 * PLAN.md §36.0 H, step 5, for Phase 36.3. The shipped solver interpolates
 * three things to be fast; this measures what each one costs by comparing it
 * against a solver that interpolates nothing:
 *
 * | | shipped | reference |
 * |---|---|---|
 * | body position | 11-node Chebyshev per 4 UTC days | evaluated at every probe |
 * | lunar distance | 75-term tier (5 km) | full 469-term series |
 * | nutation | day endpoints, linear between | evaluated at every probe |
 * | bracket scan | 12-minute grid + slope-bounded subdivision | 30-second grid, exhaustive |
 *
 * Both sides read the same ephemeris, so the series' own accuracy — which is
 * Tier 0's question, answered in `tier0-own-sun-moon.test.ts` — cancels exactly
 * and what is left is the approximation this module chose to make.
 *
 * ## Why the locations are what they are
 *
 * Rise/set is not uniformly hard. At the equator the Sun crosses the horizon
 * almost vertically and any solver finds the root; at 82.5 °N the Moon can
 * graze the horizon for minutes, altitude and its derivative both near zero,
 * and a fixed grid can step straight over a rise-and-set pair. Quito, Alert and
 * McMurdo are in the list precisely because they are the cases where a scan
 * that merely *looks* correct at Pune falls apart.
 *
 * The event **count** matching everywhere is the assertion that matters most
 * here. A time that is off by a second is a tolerance question; an event that
 * was never found is a wrong answer, and it is the failure mode a grid invites.
 */
import { describe, it, expect } from 'vitest';
import { dayEvents, clearRiseSetTracks } from '../../src/astronomy/riseSet';
import { dayEventsReference } from '../reference/riseset-reference';

const DAY_MS = 86_400_000;

const LOCATIONS = [
  { name: 'Quito', latitude: -0.18, longitude: -78.47 },
  { name: 'Pune', latitude: 18.52, longitude: 73.86 },
  { name: 'London', latitude: 51.51, longitude: -0.13 },
  { name: 'Reykjavik', latitude: 64.15, longitude: -21.94 },
  { name: 'Alert', latitude: 82.5, longitude: -62.35 },
  { name: 'McMurdo', latitude: -77.85, longitude: 166.67 },
] as const;

/** Three epochs a century apart, so the fit is exercised across the span. */
const EPOCHS = [Date.UTC(1950, 2, 3), Date.UTC(2025, 6, 9), Date.UTC(2088, 10, 21)];
const DAYS_PER_EPOCH = 12;

describe('§36.0 H — interpolated rise/set vs the direct solver', () => {
  for (const body of ['sun', 'moon'] as const) {
    it(`${body}: same events, same instants`, () => {
      clearRiseSetTracks();
      let cases = 0;
      let countMismatches = 0;
      let worstMs = 0;
      let worstAt = '';
      /**
       * Tracked separately because the two populations are not comparable.
       * Rise-time error is declination error divided by the body's altitude
       * rate, and above ~65° that rate approaches zero as the body grazes the
       * horizon — the same fit that lands within a millisecond at Pune is worth
       * tens of milliseconds at Alert. Reporting one number for both would
       * either hide the polar case or slander the ordinary one.
       */
      let worstTemperateMs = 0;

      for (const location of LOCATIONS) {
        for (const epoch of EPOCHS) {
          for (let d = 0; d < DAYS_PER_EPOCH; d++) {
            const dayIndex = Math.floor((epoch + d * DAY_MS) / DAY_MS);
            for (const direction of [1, -1] as const) {
              const mine = dayEvents(body, direction, location, dayIndex);
              const truth = dayEventsReference(body, direction, location, dayIndex);
              cases++;
              if (mine.length !== truth.length) {
                countMismatches++;
                continue;
              }
              for (let i = 0; i < mine.length; i++) {
                const delta = Math.abs((mine[i] as number) - (truth[i] as number));
                if (delta > worstMs) {
                  worstMs = delta;
                  worstAt = `${location.name} ${new Date(truth[i] as number).toISOString()} dir=${direction}`;
                }
                if (Math.abs(location.latitude) < 65 && delta > worstTemperateMs) {
                  worstTemperateMs = delta;
                }
              }
            }
          }
        }
      }

      expect(cases).toBeGreaterThanOrEqual(LOCATIONS.length * EPOCHS.length * DAYS_PER_EPOCH * 2);
      expect(
        countMismatches,
        'the interpolated scan found a different number of events than the exhaustive one',
      ).toBe(0);
      // Below 65°. Measured 2026-08-07: Sun 1.946 ms, Moon 4.234 ms.
      //
      // Almost none of that is the interpolation. Both solvers bisect to ~1 ms,
      // which is the floor; the rest is the **lunar distance tier** — the track
      // reads 75 terms (5 km) where the reference reads 469, and `moon.ts`
      // measures that tier at 0.003 s of rise time, which is the 4.2 ms here.
      // Two things confirm the attribution: the Sun, which has no such tier,
      // sits at half the Moon's figure, and the numbers are *identical* across
      // every (block span × node count) in `notes/track-fit.src.ts`'s sweep,
      // including the 1 day × 7 this replaced — a fit contributing nothing
      // cannot change when it is refitted.
      expect(
        worstTemperateMs,
        `worst |Δt| below 65° was ${worstTemperateMs.toFixed(3)} ms`,
      ).toBeLessThan(10);
      // Including the polar sites, where a grazing event divides by an altitude
      // rate approaching zero. Measured: Sun 4.005 ms, Moon 23.918 ms, both at
      // Alert (82.5 °N). For scale, this solver and the `SearchRiseSet` it
      // replaces differ by 4.9 s at that same location — the geometry, not
      // either solver, is what is uncertain there.
      expect(worstMs, `worst |Δt| ${worstMs.toFixed(3)} ms at ${worstAt}`).toBeLessThan(60);
    }, 300_000);
  }

  it('the track cache cannot change an answer, only the work to get one', () => {
    // The tracks are module-level and shared across calls, exactly like the
    // Chebyshev blocks in `cache.ts`. That is only sound because a track is a
    // pure function of (body, day) — so clearing the cache mid-stream must be
    // invisible, and a value computed cold must equal one computed warm.
    const location = LOCATIONS[1]!;
    const dayIndex = Math.floor(Date.UTC(2025, 3, 17) / DAY_MS);

    clearRiseSetTracks();
    const cold = dayEvents('moon', 1, location, dayIndex).slice();
    const warm = dayEvents('moon', 1, location, dayIndex).slice();
    clearRiseSetTracks();
    // Build a neighbouring day first, so the store is populated differently.
    dayEvents('moon', -1, location, dayIndex + 1);
    dayEvents('sun', 1, location, dayIndex - 1);
    const reordered = dayEvents('moon', 1, location, dayIndex).slice();

    expect(warm).toEqual(cold);
    expect(reordered).toEqual(cold);
  });
});
