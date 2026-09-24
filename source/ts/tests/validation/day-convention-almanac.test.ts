/**
 * @tier 1  reference-almanac Pana Sankranti pages (Bhubaneswar) and its 2027 Sankranti moments
 *
 * testdata/almanac/almanac-day-convention-2026-09.json. Odisha's new year is the Mesha Sankranti
 * day, moved to the next date by a transit late in the evening. West of UTC every Sankranti date and
 * solar new year is the UTC midnight that falls within the local day, so reading it in the zone gives
 * the day the almanac's rules name. If a day moves, do not re-pin.
 */
import { describe, it, expect } from 'vitest';
import { getHinduNewYear } from '../../src/calendar/convert';
import { computeSankrantisForYear } from '../../src/calendar/yearly';
import type { FestivalRegion } from '../../src/types/options';
import { readTestData } from '../testdata';

interface Fixture {
  panaSankranti: {
    location: { latitude: number; longitude: number };
    entries: { year: number; date: string }[];
  };
  westOfUtc2027: {
    location: { latitude: number; longitude: number };
    timezone: number;
    sankrantis: { rashi: number; day: string }[];
    newYears: { region: FestivalRegion; day: string }[];
  };
}

const FIXTURE = readTestData<Fixture>('almanac', 'almanac-day-convention-2026-09.json');

function inZone(d: Date, zone: number | string): string {
  if (typeof zone === 'number') return new Date(d.getTime() + zone * 60_000).toISOString().slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

describe('Odisha new year (Pana Sankranti), Bhubaneswar', () => {
  const { location, entries } = FIXTURE.panaSankranti;
  it('fixture shape', () => {
    expect(entries).toHaveLength(10);
    expect(FIXTURE.westOfUtc2027.sankrantis).toHaveLength(11);
    expect(FIXTURE.westOfUtc2027.newYears).toHaveLength(6);
  });
  for (const { year, date } of entries) {
    it(`${year} -> ${date}`, () => {
      for (const timezone of [330, 'Asia/Kolkata']) {
        const d = getHinduNewYear(year, 'odisha', location, { timezone });
        expect(d).not.toBeNull();
        expect(inZone(d!, timezone)).toBe(date);
        expect(d!.toISOString().slice(0, 10)).toBe(date);
      }
    });
  }
});

describe('west of UTC: Sankranti dates and solar new years fall within the local day', () => {
  const { location, sankrantis, newYears } = FIXTURE.westOfUtc2027;
  for (const zone of [FIXTURE.westOfUtc2027.timezone, 'America/New_York']) {
    it(`2027 Sankrantis read in ${zone}`, () => {
      const list = computeSankrantisForYear(2027, location, { timezone: zone });
      for (const { rashi, day } of sankrantis) {
        const event = list.find((s) => s.rashi === rashi);
        expect(event, `rashi ${rashi}`).toBeDefined();
        expect(inZone(event!.date, zone), `rashi ${rashi}`).toBe(day);
        expect(event!.date.getUTCHours()).toBe(0);
      }
    });

    it(`2027 solar new years read in ${zone}`, () => {
      for (const { region, day } of newYears) {
        const d = getHinduNewYear(2027, region, location, { timezone: zone });
        expect(d, region).not.toBeNull();
        expect(inZone(d!, zone), region).toBe(day);
      }
    });
  }
});
