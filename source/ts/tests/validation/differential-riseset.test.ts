/**
 * @tier 2  this repository: the shipped rise/set solver against its own frozen reference
 *
 * The reference interpolates nothing, so what is left is this module's own
 * approximation. Near the pole a grid can step over a grazing rise-set pair.
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

const EPOCHS = [Date.UTC(1950, 2, 3), Date.UTC(2025, 6, 9), Date.UTC(2088, 10, 21)];
const DAYS_PER_EPOCH = 12;

describe('differential: interpolated rise/set vs the direct solver', () => {
  for (const body of ['sun', 'moon'] as const) {
    it(`${body}: same events, same instants`, () => {
      clearRiseSetTracks();
      let cases = 0;
      let countMismatches = 0;
      let worstMs = 0;
      let worstAt = '';
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
      expect(
        worstTemperateMs,
        `worst |Δt| below 65° was ${worstTemperateMs.toFixed(3)} ms`,
      ).toBeLessThan(10);
      expect(worstMs, `worst |Δt| ${worstMs.toFixed(3)} ms at ${worstAt}`).toBeLessThan(60);
    }, 300_000);
  }

  it('the track cache cannot change an answer, only the work to get one', () => {
    const location = LOCATIONS[1]!;
    const dayIndex = Math.floor(Date.UTC(2025, 3, 17) / DAY_MS);

    clearRiseSetTracks();
    const cold = dayEvents('moon', 1, location, dayIndex).slice();
    const warm = dayEvents('moon', 1, location, dayIndex).slice();
    clearRiseSetTracks();
    dayEvents('moon', -1, location, dayIndex + 1);
    dayEvents('sun', 1, location, dayIndex - 1);
    const reordered = dayEvents('moon', 1, location, dayIndex).slice();

    expect(warm).toEqual(cold);
    expect(reordered).toEqual(cold);
  });
});
