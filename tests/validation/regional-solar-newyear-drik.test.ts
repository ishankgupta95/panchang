/**
 * @tier 1  DrikPanchang published regional new-year date pages (rule-level reference)
 *
 * The four traditions that anchor their new year on Mesha Sankranti key the
 * day off the transit MOMENT in three different ways, so in the same year they
 * can fall on three different dates. Before 2026-08-14 the library put all of
 * them on the generic Sankranti observance day, which is right only for Tamil
 * Nadu.
 *
 * Sources (fetched 2026-08-14), one location per region:
 *   Puthandu        /festivals/puthandu/tamil-newyear-date-time.html   (Chennai)
 *   Vishu Kani      /festivals/vishu/vishu-kani-date-time.html         (Cochin)
 *   Vaisakhi        /festivals/vaisakhi/vaisakhi-date-time.html        (Amritsar)
 *   Pohela Boishakh /festivals/pohela-boishakh/pohela-boishakh-date-time.html (Kolkata)
 *
 * 2025–2029 was chosen because its five Mesha transit moments cover every
 * position a transit can take relative to sunrise, sunset and midnight —
 * without all five, three of the four rules are indistinguishable:
 *
 *   2025  Apr 14 03:30 IST  (after midnight, before sunrise)
 *   2026  Apr 14 09:39 IST  (morning daylight)
 *   2027  Apr 14 15:33 IST  (afternoon daylight)
 *   2028  Apr 13 21:47 IST  (after sunset, before midnight)   ← the decisive one
 *   2029  Apr 14 03:56 IST  (after midnight, before sunrise)
 *
 * Each transit moment above is reproduced by `computeSankrantisForYear` to the
 * minute against drik's own printed "Sankranti Moment", so the table below
 * tests the DAY RULES rather than the ephemeris.
 *
 * Assam (Bohag Bihu) is deliberately absent: DrikPanchang publishes no Bohag
 * or Rongali Bihu date page, so its rule could not be pinned to a reference
 * and the key still rides the generic Sankranti day.
 */

import { describe, it, expect } from 'vitest';
import { getHinduNewYear } from '../../src/calendar/convert';
import { computeSankrantisForYear } from '../../src/calendar/yearly';
import { getDailyPanchang } from '../../src/core/panchang';
import type { FestivalRegion } from '../../src/types/options';
import type { GeoLocation } from '../../src/types/location';

const TZ = { timezone: 330 };
const YEARS = [2025, 2026, 2027, 2028, 2029] as const;

interface RegionCase {
  region: FestivalRegion;
  location: GeoLocation;
  /** Festival key the day-panchang emits. */
  key: string;
  /** Drik's published date per year, as MM-DD. */
  drik: Record<number, string>;
}

const CASES: readonly RegionCase[] = [
  {
    region: 'tamil-nadu',
    location: { latitude: 13.0827, longitude: 80.2707 },   // Chennai
    key: 'puthandu',
    drik: { 2025: '04-14', 2026: '04-14', 2027: '04-14', 2028: '04-14', 2029: '04-14' },
  },
  {
    region: 'kerala',
    location: { latitude: 9.9312, longitude: 76.2673 },    // Cochin
    key: 'vishu',
    drik: { 2025: '04-14', 2026: '04-15', 2027: '04-15', 2028: '04-14', 2029: '04-14' },
  },
  {
    region: 'punjab',
    location: { latitude: 31.6340, longitude: 74.8723 },   // Amritsar
    key: 'baisakhi',
    drik: { 2025: '04-14', 2026: '04-14', 2027: '04-14', 2028: '04-13', 2029: '04-14' },
  },
  {
    region: 'west-bengal',
    location: { latitude: 22.5726, longitude: 88.3639 },   // Kolkata
    key: 'pohela_boishakh',
    drik: { 2025: '04-15', 2026: '04-15', 2027: '04-15', 2028: '04-14', 2029: '04-15' },
  },
];

/** Days in Apr 10–18 whose festival list carries `key`, as MM-DD. */
function emissionDays(
  year: number, region: FestivalRegion, location: GeoLocation, key: string,
): string[] {
  const days: string[] = [];
  for (let d = 10; d <= 18; d++) {
    const p = getDailyPanchang(new Date(Date.UTC(year, 3, d)), location, {
      ...TZ, region, sections: ['festivals'],
    });
    if (p?.festivals.some((f) => f.key === key)) {
      days.push(`04-${String(d).padStart(2, '0')}`);
    }
  }
  return days;
}

describe('Regional solar new years — drik 2025–2029', () => {
  for (const { region, location, key, drik } of CASES) {
    describe(`${region} (${key})`, () => {
      for (const year of YEARS) {
        it(`${year} → ${drik[year]}`, () => {
          const expected = `${year}-${drik[year]}`;

          const newYear = getHinduNewYear(year, region, location, TZ);
          expect(newYear).not.toBeNull();
          expect(newYear!.toISOString().slice(0, 10)).toBe(expected);

          // The day-panchang emission must agree with `getHinduNewYear`, and
          // must fire on exactly one day — the two surfaces used to disagree
          // because only one of them knew about the transit moment.
          expect(emissionDays(year, region, location, key)).toEqual([drik[year]]);
        }, 30_000);
      }
    });
  }

  it('the three rules genuinely separate in 2027 and 2028', () => {
    // Guards against a future refactor collapsing them back onto one day.
    const day = (year: number, c: RegionCase) =>
      getHinduNewYear(year, c.region, c.location, TZ)!.toISOString().slice(0, 10);
    const [tamil, kerala, punjab, bengal] = CASES as unknown as [
      RegionCase, RegionCase, RegionCase, RegionCase,
    ];

    // 2027 (afternoon transit): Kerala and Bengal run a day ahead of Tamil Nadu.
    expect(day(2027, tamil)).toBe('2027-04-14');
    expect(day(2027, punjab)).toBe('2027-04-14');
    expect(day(2027, kerala)).toBe('2027-04-15');
    expect(day(2027, bengal)).toBe('2027-04-15');

    // 2028 (post-sunset transit): Punjab falls a day BEHIND the rest.
    expect(day(2028, punjab)).toBe('2028-04-13');
    expect(day(2028, tamil)).toBe('2028-04-14');
    expect(day(2028, kerala)).toBe('2028-04-14');
    expect(day(2028, bengal)).toBe('2028-04-14');
  }, 30_000);

  it('reproduces drik’s printed Mesha Sankranti moments', () => {
    // Drik's own "Sankranti Moment" line on the pages above, IST.
    const DRIK_MOMENTS: Record<number, string> = {
      2025: '2025-04-14 03:30',
      2026: '2026-04-14 09:39',
      2027: '2027-04-14 15:33',
      2028: '2028-04-13 21:47',
      2029: '2029-04-14 03:56',
    };
    const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
    for (const year of YEARS) {
      const mesha = computeSankrantisForYear(year, CHENNAI, TZ).find((s) => s.rashi === 0);
      expect(mesha, `${year} Mesha transit`).toBeDefined();
      const ist = new Date(mesha!.moment.getTime() + 330 * 60_000)
        .toISOString().slice(0, 16).replace('T', ' ');
      // Drik truncates to the minute; allow the one-minute rounding difference.
      const deltaMin = Math.abs(
        (new Date(`${ist}:00Z`).getTime() - new Date(`${DRIK_MOMENTS[year]}:00Z`).getTime()),
      ) / 60_000;
      expect(deltaMin, `${year}: ours ${ist} vs drik ${DRIK_MOMENTS[year]}`).toBeLessThanOrEqual(1);
    }
  }, 60_000);
});
