/**
 * @tier 1  Reference-almanac lists and month pages, plus public Onam records
 *
 * Masik Karthigai is Krittika's first sunset day, else its sunrise day; Karthigai Deepam
 * replaces it on the Tamil Karthigai day nearest that month's full moon. Onam is one
 * Thiruvonam per Chingam. Shravan Somvar and Mangala Gauri follow the masaSystem, and the
 * solar month in Nepal.
 */

import { describe, it, expect } from 'vitest';
import { computeFestivalsForYear, type YearlyListingOptions } from '../../src/calendar/yearly';
import { readTestData } from '../testdata';

interface Location { latitude: number; longitude: number }
interface YearList {
  key: string; city: string; location: Location; timezone: number;
  options: Partial<YearlyListingOptions>; year: number; dates: string[]; source: string;
}
interface Entry {
  key: string; date: string; city: string; location: Location; timezone: number;
  aloneWithinDays?: number; ordinal?: number; source: string;
}

const fixture = readTestData<{ yearLists: YearList[]; entries: Entry[] }>(
  'almanac', 'almanac-festival-rules-2026-09-nakshatra-solar.json',
);

const KARTHIGAI_KEYS = new Set(['masik_karthigai', 'karthigai_deepam']);
const DAY_MS = 86_400_000;

const yearCache = new Map<string, { key: string; date: string }[]>();

function localDates(
  year: number, loc: Location, timezone: number, options: Partial<YearlyListingOptions>,
  keep: (key: string) => boolean,
): string[] {
  const id = JSON.stringify([year, loc, timezone, options]);
  let days = yearCache.get(id);
  if (days === undefined) {
    days = computeFestivalsForYear(year, loc, { ...options, timezone }).map((f) => ({
      key: f.festival.key,
      date: new Date(f.date.getTime() + timezone * 60_000).toISOString().slice(0, 10),
    }));
    yearCache.set(id, days);
  }
  return days.filter((f) => keep(f.key)).map((f) => f.date);
}

describe('nakshatra, solar-month and vara-in-month festivals against the reference', () => {
  for (const l of fixture.yearLists) {
    it(`${l.key} ${l.city} ${l.year} ${JSON.stringify(l.options)}`, () => {
      expect(localDates(l.year, l.location, l.timezone, l.options, (k) => k === l.key), l.source)
        .toEqual(l.dates);
    });
  }

  for (const e of fixture.entries) {
    it(`${e.key} ${e.city} ${e.date}`, () => {
      const year = Number(e.date.slice(0, 4));
      const own = localDates(year, e.location, e.timezone, {}, (k) => k === e.key);
      expect(own, e.source).toContain(e.date);
      if (e.ordinal !== undefined) expect(own.indexOf(e.date) + 1, e.source).toBe(e.ordinal);
      if (e.aloneWithinDays !== undefined) {
        const target = Date.parse(e.date);
        const years = [year - 1, year, year + 1].filter((y) =>
          Math.abs(Date.parse(`${y}-07-01`) - target) < 190 * DAY_MS);
        const near = years
          .flatMap((y) => localDates(y, e.location, e.timezone, {}, (k) => KARTHIGAI_KEYS.has(k)))
          .filter((d) => Math.abs(Date.parse(d) - target) <= e.aloneWithinDays! * DAY_MS);
        expect(near, e.source).toEqual([e.date]);
      }
    });
  }

  it('Shravan Somvar 2025-08-18 is an Amanta Monday only (New Delhi, default Purnimanta)', () => {
    const dates = localDates(2025, { latitude: 28.6139, longitude: 77.209 }, 330, {},
      (k) => k === 'shravan_somvar');
    expect(dates).not.toContain('2025-08-18');
  });
});
