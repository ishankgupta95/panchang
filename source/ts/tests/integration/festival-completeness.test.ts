import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { computeEkadashiDatesForYear, computeFestivalsForYear } from '../../src/calendar/yearly';

const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
const KOCHI = { latitude: 9.9312, longitude: 76.2673 };

const keysOn = (
  y: number, m: number, d: number,
  loc: { latitude: number; longitude: number }, timezone: number | string, region?: 'kerala',
): string[] =>
  getDailyPanchang(new Date(Date.UTC(y, m - 1, d, 12)), loc, {
    timezone, ...(region === undefined ? {} : { region }),
  })!.festivals.map((f) => f.key);

const countInYear = (
  y: number, loc: { latitude: number; longitude: number }, timezone: number | string,
  key: string, region?: 'kerala',
): number =>
  computeFestivalsForYear(y, loc, { timezone, ...(region === undefined ? {} : { region }) })
    .filter((f) => f.festival.key === key).length;

describe('festivals that no day used to claim', () => {
  it('Navaratri: a kshaya Nija Pratipada on the last day of Adhika Ashwina (Sydney 2020-10-17)', () => {
    const r = getDailyPanchang(new Date(Date.UTC(2020, 9, 17, 12)), SYDNEY, { timezone: 'Australia/Sydney' })!;
    expect(r.calendar.chandramasa.isAdhika).toBe(true);
    expect(r.festivals.map((f) => f.key)).toContain('navaratri');
    expect(keysOn(2020, 10, 18, SYDNEY, 'Australia/Sydney')).not.toContain('navaratri');
    expect(countInYear(2020, SYDNEY, 'Australia/Sydney', 'navaratri')).toBe(1);
  });

  it('Sankashti: Chaturthi touching no moonrise falls back to sunrise, as Karva Chauth does (Delhi 2025-10-10)', () => {
    const keys = keysOn(2025, 10, 10, DELHI, 330);
    expect(keys).toContain('karva_chauth');
    expect(keys).toContain('sankashti_chaturthi');
    expect(countInYear(2025, DELHI, 330, 'sankashti_chaturthi')).toBe(12);
  });

  it('Smarta Ekadashi: vriddha day 1 before a kshaya Dwadashi, matching the yearly list (Chennai 2030-03-15)', () => {
    const day1 = keysOn(2030, 3, 15, CHENNAI, 330);
    const day2 = keysOn(2030, 3, 16, CHENNAI, 330);
    expect(day1).toEqual(expect.arrayContaining(['smarta_ekadashi', 'ekadashi']));
    expect(day1).not.toContain('vaishnava_ekadashi');
    expect(day2).toContain('vaishnava_ekadashi');
    expect(day2).not.toContain('smarta_ekadashi');
    const yearly = computeEkadashiDatesForYear(2030, CHENNAI, { timezone: 330 })
      .map((d) => d.toISOString().slice(0, 10));
    expect(yearly).toContain('2030-03-15');
  });

  it('Onam: a solar-month festival is not suppressed by an Adhika Bhadrapada (Kochi 2012-08-29)', () => {
    const r = getDailyPanchang(new Date(Date.UTC(2012, 7, 29, 12)), KOCHI, { timezone: 330, region: 'kerala' })!;
    expect(r.calendar.chandramasa.isAdhika).toBe(true);
    expect(r.festivals.map((f) => f.key)).toContain('onam');
    expect(countInYear(2012, KOCHI, 330, 'onam', 'kerala')).toBe(1);
  });
});
