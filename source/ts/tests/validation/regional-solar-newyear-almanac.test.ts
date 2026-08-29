/**
 * @tier 1  Reference-almanac published regional new-year date pages (rule-level reference)
 *
 * Pinned from the almanac's per-festival date-time pages: puthandu (Chennai),
 * vishu-kani (Cochin), vaisakhi (Amritsar), pohela-boishakh (Kolkata). The four
 * traditions key the day off the Mesha transit MOMENT differently; 2025-2029 is
 * the smallest span covering every position of that moment relative to sunrise,
 * sunset and midnight, and without 2028 (post-sunset) three of the four rules
 * are indistinguishable. Assam (Bohag Bihu) is absent: the almanac publishes no
 * date page for it, so the key rides the generic Sankranti day.
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
  key: string;
  almanac: Record<number, string>;
}

const CASES: readonly RegionCase[] = [
  {
    region: 'tamil-nadu',
    location: { latitude: 13.0827, longitude: 80.2707 },
    key: 'puthandu',
    almanac: { 2025: '04-14', 2026: '04-14', 2027: '04-14', 2028: '04-14', 2029: '04-14' },
  },
  {
    region: 'kerala',
    location: { latitude: 9.9312, longitude: 76.2673 },
    key: 'vishu',
    almanac: { 2025: '04-14', 2026: '04-15', 2027: '04-15', 2028: '04-14', 2029: '04-14' },
  },
  {
    region: 'punjab',
    location: { latitude: 31.6340, longitude: 74.8723 },
    key: 'baisakhi',
    almanac: { 2025: '04-14', 2026: '04-14', 2027: '04-14', 2028: '04-13', 2029: '04-14' },
  },
  {
    region: 'west-bengal',
    location: { latitude: 22.5726, longitude: 88.3639 },
    key: 'pohela_boishakh',
    almanac: { 2025: '04-15', 2026: '04-15', 2027: '04-15', 2028: '04-14', 2029: '04-15' },
  },
];

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

describe('Regional solar new years: reference almanac 2025-2029', () => {
  for (const { region, location, key, almanac } of CASES) {
    describe(`${region} (${key})`, () => {
      for (const year of YEARS) {
        it(`${year} → ${almanac[year]}`, () => {
          const expected = `${year}-${almanac[year]}`;

          const newYear = getHinduNewYear(year, region, location, TZ);
          expect(newYear).not.toBeNull();
          expect(newYear!.toISOString().slice(0, 10)).toBe(expected);

          expect(emissionDays(year, region, location, key)).toEqual([almanac[year]]);
        }, 30_000);
      }
    });
  }

  it('the three rules genuinely separate in 2027 and 2028', () => {
    const day = (year: number, c: RegionCase) =>
      getHinduNewYear(year, c.region, c.location, TZ)!.toISOString().slice(0, 10);
    const [tamil, kerala, punjab, bengal] = CASES as unknown as [
      RegionCase, RegionCase, RegionCase, RegionCase,
    ];

    expect(day(2027, tamil)).toBe('2027-04-14');
    expect(day(2027, punjab)).toBe('2027-04-14');
    expect(day(2027, kerala)).toBe('2027-04-15');
    expect(day(2027, bengal)).toBe('2027-04-15');

    expect(day(2028, punjab)).toBe('2028-04-13');
    expect(day(2028, tamil)).toBe('2028-04-14');
    expect(day(2028, kerala)).toBe('2028-04-14');
    expect(day(2028, bengal)).toBe('2028-04-14');
  }, 30_000);

  it('reproduces the almanac’s printed Mesha Sankranti moments', () => {
    // The almanac's own "Sankranti Moment" line, IST.
    const ALMANAC_MOMENTS: Record<number, string> = {
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
      // The almanac truncates to the minute.
      const deltaMin = Math.abs(
        (new Date(`${ist}:00Z`).getTime() - new Date(`${ALMANAC_MOMENTS[year]}:00Z`).getTime()),
      ) / 60_000;
      expect(deltaMin, `${year}: ours ${ist} vs almanac ${ALMANAC_MOMENTS[year]}`)
        .toBeLessThanOrEqual(1);
    }
  }, 60_000);
});
