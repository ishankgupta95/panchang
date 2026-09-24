/**
 * @tier 1  Reference-almanac festival pages and year lists, plus a competitor calendar where the almanac
 * has no capture (testdata/almanac/almanac-festival-selection-2026-09.json)
 *
 * Which day a festival takes when its tithi touches two: the first of two udaya days (Ugadi, Anant
 * Chaturdashi), the last for the Tritiya vratas, three muhurtas after sunrise (Raksha Bandhan, Akshaya
 * Tritiya), the larger share of madhyahna or pradosha (Ganesh Chaturthi, Diwali, Pradosh vrat), the nishita
 * ladder (Shivaratri), the Holika Dahan ladder with Holi the next day, Chhath counted from the Shashthi
 * udaya day, and Vijayadashami's Shravana rule. Each date must be the only emission within three days.
 */
import { describe, it, expect } from 'vitest';
import { computeFestivalsForYear, computeFestivalsInRange } from '../../src/calendar/yearly';
import type { FestivalRegion } from '../../src/types/options';
import { readTestData } from '../testdata';

interface Located {
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  tier: string;
  rule: string;
  _source: string;
}
interface DateCase extends Located {
  festival: string;
  date: string;
  region?: FestivalRegion;
}
interface ListCase extends Located {
  keys: string[];
  year: number;
  dates: string[];
}

const FIXTURE = readTestData<{ dates: DateCase[]; lists: ListCase[] }>(
  'almanac', 'almanac-festival-selection-2026-09.json',
);
const DAY_MS = 86_400_000;
const localDate = (d: Date, timezone: number): string =>
  new Date(d.getTime() + timezone * 60_000).toISOString().slice(0, 10);

describe('festival day selection vs external dates', () => {
  for (const c of FIXTURE.dates) {
    it(`${c.rule}: ${c.festival} ${c.city} ${c.date} (${c.tier})`, () => {
      const [y, m, d] = c.date.split('-').map(Number) as [number, number, number];
      const localMidnight = Date.UTC(y, m - 1, d) - c.timezone * 60_000;
      const emitted = computeFestivalsInRange(
        new Date(localMidnight - 3 * DAY_MS), new Date(localMidnight + 3 * DAY_MS), c.location,
        { timezone: c.timezone, ...(c.region === undefined ? {} : { region: c.region }) },
      ).filter((f) => f.festival.key === c.festival).map((f) => localDate(f.date, c.timezone));
      expect(emitted).toEqual([c.date]);
    });
  }
});

describe('festival year lists vs the reference almanac', () => {
  for (const l of FIXTURE.lists) {
    it(`${l.rule}: ${l.keys.join(' + ')} ${l.city} ${l.year}`, () => {
      const emitted = computeFestivalsForYear(l.year, l.location, { timezone: l.timezone })
        .filter((f) => l.keys.includes(f.festival.key)).map((f) => localDate(f.date, l.timezone));
      expect(emitted).toEqual(l.dates);
    });
  }
});
