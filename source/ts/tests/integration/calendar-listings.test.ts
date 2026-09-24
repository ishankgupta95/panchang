import { describe, it, expect } from 'vitest';
import {
  computeFestivalsForYear, computeFestivalsInRange, computeEkadashiDatesForYear,
  computeEclipsesForYear, computeEclipsesInRange, computeMoonPhasesForYear,
  computeAuspiciousDatesForYear, computeAuspiciousDatesInRange, vivahRule,
  getHinduNewYear, convertGregorianToHindu, convertHinduToGregorian, computeSamvat,
  buildFestivalsTable, buildEclipsesTable, buildMoonPhasesTable, buildMuhurtaTable,
  PanchangError,
} from '../../src/index';
import { readFestivalsForDate } from '../../src/calendar/festivalsTable';
import type { GeoLocation } from '../../src/types/location';

const NY: GeoLocation = { latitude: 40.7128, longitude: -74.006 };
const PUNE: GeoLocation = { latitude: 18.5204, longitude: 73.8567 };
const DELHI: GeoLocation = { latitude: 28.6139, longitude: 77.209 };
const SYDNEY: GeoLocation = { latitude: -33.8688, longitude: 151.2093 };
const NY_ZONE = 'America/New_York';
const PROBE = { occasion: 'probe' };

function inZone(d: Date, zone: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const o = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` };
}

function atOffset(d: Date, offsetMinutes: number): string {
  return new Date(d.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

const iso = (d: Date): string => d.toISOString().slice(0, 10);

function datesOfYear(year: number): string[] {
  const out: string[] = [];
  for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += 86_400_000) out.push(iso(new Date(t)));
  return out;
}

function invalidDateCode(fn: () => unknown): string {
  try {
    fn();
  } catch (e: unknown) {
    return e instanceof PanchangError ? e.code : 'other';
  }
  return 'no error';
}

describe('DST zone: every civil day of the year once, at its local midnight', () => {
  it('computeFestivalsForYear in America/New_York', () => {
    const f = computeFestivalsForYear(2025, NY, { timezone: NY_ZONE });
    const local = f.map((x) => ({ ...inZone(x.date, NY_ZONE), key: x.festival.key }));
    expect(local.every((x) => x.time === '00:00')).toBe(true);
    expect(local.every((x) => x.date.startsWith('2025-'))).toBe(true);
    const keys = local.map((x) => `${x.date} ${x.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('2025-03-09 smarta_ekadashi');
    expect(keys).toContain('2025-12-31 pradosha');
  });

  it('computeAuspiciousDatesForYear in America/New_York', () => {
    const days = computeAuspiciousDatesForYear(2025, PROBE, NY, { timezone: NY_ZONE, includeFailures: true })
      .map((d) => inZone(d.date, NY_ZONE).date).sort();
    expect(days).toEqual(datesOfYear(2025));
  });

  it('a range starting at a summer local midnight neither repeats the fall-back day nor drops the last', () => {
    const days = computeAuspiciousDatesInRange(
      PROBE, new Date('2025-10-01T04:00:00Z'), new Date('2025-12-31T05:00:00Z'), NY,
      { timezone: NY_ZONE, includeFailures: true },
    ).map((d) => inZone(d.date, NY_ZONE).date).sort();
    expect(days.length).toBe(92);
    expect(new Set(days).size).toBe(92);
    expect(days[days.length - 1]).toBe('2025-12-31');
  });

  it('a range keeps its start time of day across the spring-forward day', () => {
    const days = computeAuspiciousDatesInRange(
      PROBE, new Date('2025-03-06T04:30:00Z'), new Date('2025-03-12T04:00:00Z'), NY,
      { timezone: NY_ZONE, includeFailures: true },
    ).map((d) => inZone(d.date, NY_ZONE)).sort((a, b) => a.date.localeCompare(b.date));
    expect(days.map((x) => x.date)).toEqual([
      '2025-03-05', '2025-03-06', '2025-03-07', '2025-03-08', '2025-03-09', '2025-03-10', '2025-03-11',
    ]);
    expect(days.every((x) => x.time === '23:30')).toBe(true);
  });

  it('instant listings file an event by the offset in force at each year boundary', () => {
    const ny1920 = computeMoonPhasesForYear(1920, { timezone: NY_ZONE });
    expect(ny1920[ny1920.length - 1]).toEqual({ phase: 'last_quarter', time: new Date('1921-01-01T04:34:21.974Z') });
    const syd2030 = computeMoonPhasesForYear(2030, { timezone: 'Australia/Sydney' });
    const syd2031 = computeMoonPhasesForYear(2031, { timezone: 'Australia/Sydney' });
    expect(syd2030.map((e) => e.time.getTime())).not.toContain(Date.parse('2030-12-31T13:36:07.665Z'));
    expect(syd2031[0]!.time.toISOString()).toBe('2030-12-31T13:36:07.665Z');
    const denver = { latitude: 39.7392, longitude: -104.9903 };
    const peak = Date.parse('2048-01-01T06:52:29.003Z');
    expect(computeEclipsesForYear(2047, denver, { timezone: 'America/Denver' }).map((e) => e.peak.getTime())).toContain(peak);
    expect(computeEclipsesForYear(2048, denver, { timezone: 'America/Denver' }).map((e) => e.peak.getTime())).not.toContain(peak);
  });

  it('a Mesha Sankranti civil day uses the offset in force at the transit', () => {
    expect(iso(getHinduNewYear(2008, 'punjab', SYDNEY, { timezone: 'Australia/Sydney' })!)).toBe('2008-04-13');
    expect(iso(getHinduNewYear(2008, 'west-bengal', SYDNEY, { timezone: 'Australia/Sydney' })!)).toBe('2008-04-14');
  });
});

describe('west of UTC: a day-valued result falls within the local day it names', () => {
  it('Ekadashi dates, read in the zone, equal the Smarta Ekadashi days of the festival listing', () => {
    for (const year of [2025, 2033]) {
      const ekadashi = computeEkadashiDatesForYear(year, NY, { timezone: -300 }).map((d) => atOffset(d, -300));
      const smarta = [...new Set(computeFestivalsForYear(year, NY, { timezone: -300 })
        .filter((x) => x.festival.key === 'smarta_ekadashi').map((x) => atOffset(x.date, -300)))];
      expect(ekadashi).toEqual(smarta);
    }
    const y2025 = computeEkadashiDatesForYear(2025, NY, { timezone: -300 });
    expect(y2025.map((d) => atOffset(d, -300))).toContain('2025-03-09');
    expect(y2025.map((d) => atOffset(d, -300))).toContain('2025-06-21');
    expect(y2025.map(iso)).toContain('2025-03-10');
    const y2033 = computeEkadashiDatesForYear(2033, NY, { timezone: -300 }).map((d) => atOffset(d, -300));
    expect(y2033).toContain('2033-12-31');
    expect(y2033.every((d) => d.startsWith('2033-'))).toBe(true);
  });

  it('both new-year branches and convertHinduToGregorian fall within the local day, and round-trip', () => {
    expect(atOffset(getHinduNewYear(2026, 'all', NY, { timezone: -300 })!, -300)).toBe('2026-03-19');
    // Transit 2025-04-13 17:01 at -300, before sunset (about 18:30): Puthandu is 04-13 in New York.
    const puthandu = getHinduNewYear(2025, 'tamil-nadu', NY, { timezone: -300 })!;
    expect(atOffset(puthandu, -300)).toBe('2025-04-13');
    expect(iso(puthandu)).toBe('2025-04-14');
    const coords = { vikramSamvat: 2081, masaIndex: 11, paksha: 'shukla' as const, pakshaTithi: 11 };
    const days = convertHinduToGregorian(coords, NY, { timezone: -300 });
    expect(days.map((d) => atOffset(d, -300))).toEqual(['2025-03-09']);
    const back = convertGregorianToHindu(days[0]!, NY, { timezone: -300 });
    expect([back.vikramSamvat, back.masaIndex, back.paksha, back.pakshaTithi]).toEqual([2081, 11, 'shukla', 11]);
  });

  it('a festivals table files every day under its own year, 31 December included', () => {
    const table = buildFestivalsTable({
      location: NY, timezoneOffsetMinutes: -300, startYear: 2025, endYear: 2026, languages: ['en'],
    });
    for (const [year, days] of Object.entries(table.years)) {
      expect(days.every((d) => d.date.startsWith(`${year}-`))).toBe(true);
    }
    const keys = readFestivalsForDate(table, '2025-12-31').map((f) => f.key);
    expect(keys).toContain('masik_karthigai');
    expect(keys).toContain('pradosha');
  });
});

describe('years 1900 and 2100 at +330 and -300', () => {
  const cases: [number, number, GeoLocation][] = [
    [1900, 330, PUNE], [1900, -300, NY], [2100, 330, PUNE], [2100, -300, NY],
  ];
  for (const [year, tz, loc] of cases) {
    it(`${year} at ${tz}`, () => {
      const phases = computeMoonPhasesForYear(year, { timezone: tz });
      expect(phases.length).toBeGreaterThanOrEqual(48);
      expect(phases.every((e) => atOffset(e.time, tz).startsWith(`${year}-`))).toBe(true);
      const eclipses = computeEclipsesForYear(year, loc, { timezone: tz });
      expect(eclipses.every((e) => atOffset(e.peak, tz).startsWith(`${year}-`))).toBe(true);
      const festivals = computeFestivalsForYear(year, loc, { timezone: tz });
      expect(festivals.length).toBeGreaterThan(200);
      expect(festivals.every((x) => atOffset(x.date, tz).startsWith(`${year}-`))).toBe(true);
      const scored = computeAuspiciousDatesForYear(year, vivahRule, loc, { timezone: tz, includeFailures: true })
        .map((d) => atOffset(d.date, tz)).sort();
      expect(scored).toEqual(datesOfYear(year));
      const muhurta = buildMuhurtaTable({
        rule: vivahRule, location: loc, timezoneOffsetMinutes: tz,
        startYear: year, endYear: year, includeFailures: true,
      });
      expect(muhurta.years[String(year)]!.map((d) => d.date)).toEqual(datesOfYear(year));
      const opts = { location: loc, timezoneOffsetMinutes: tz, startYear: year, endYear: year };
      for (const table of [buildMoonPhasesTable(opts), buildEclipsesTable({ ...opts, visibleOnly: false })]) {
        expect(Object.keys(table.years)).toEqual([String(year)]);
      }
      expect(buildMoonPhasesTable(opts).years[String(year)]!.length).toBeGreaterThanOrEqual(48);
      const fest = buildFestivalsTable({ ...opts, languages: ['en'] });
      expect(fest.years[String(year)]!.every((d) => d.date.startsWith(`${year}-`))).toBe(true);
    });
  }

  it('1899 and 2101 are still rejected', () => {
    expect(invalidDateCode(() => computeMoonPhasesForYear(1899, { timezone: 330 }))).toBe('INVALID_DATE');
    expect(invalidDateCode(() => computeMoonPhasesForYear(2101, { timezone: -300 }))).toBe('INVALID_DATE');
    expect(invalidDateCode(() => computeEclipsesForYear(1899, NY, { timezone: -300 }))).toBe('INVALID_DATE');
    expect(invalidDateCode(() => buildMoonPhasesTable({ timezoneOffsetMinutes: 330, startYear: 2101, endYear: 2101 })))
      .toBe('INVALID_DATE');
  });
});

describe('a two-digit year is that year, not 1900 plus it', () => {
  it('reports INVALID_DATE from every year listing and table builder', () => {
    const calls: [string, () => unknown][] = [
      ['auspicious', () => computeAuspiciousDatesForYear(26, vivahRule, PUNE, { timezone: 330 })],
      ['festivals', () => computeFestivalsForYear(50, PUNE, { timezone: 330 })],
      ['eclipses', () => computeEclipsesForYear(50, PUNE, { timezone: 330 })],
      ['moonPhases', () => computeMoonPhasesForYear(50, { timezone: 330 })],
      ['newYear', () => getHinduNewYear(50, 'all', PUNE, { timezone: 330 })],
      ['muhurtaTable', () => buildMuhurtaTable({
        rule: vivahRule, location: PUNE, timezoneOffsetMinutes: 330, startYear: 26, endYear: 26,
      })],
      ['festivalsTable', () => buildFestivalsTable({
        location: PUNE, timezoneOffsetMinutes: 330, startYear: 0, endYear: 0, languages: ['en'],
      })],
      ['moonPhasesTable', () => buildMoonPhasesTable({ timezoneOffsetMinutes: 330, startYear: 26, endYear: 26 })],
      ['eclipsesTable', () => buildEclipsesTable({
        location: PUNE, timezoneOffsetMinutes: 330, startYear: 26, endYear: 26,
      })],
    ];
    for (const [name, fn] of calls) expect([name, invalidDateCode(fn)]).toEqual([name, 'INVALID_DATE']);
  });

  it('computeSamvat turns over at the Chaitra new moon of years 0 to 99 too', () => {
    const at = (y: number, m: number, d: number): Date => {
      const date = new Date(0);
      date.setUTCFullYear(y, m, d);
      return date;
    };
    expect(computeSamvat(at(50, 5, 1))).toMatchObject({ vikramSamvat: 107, shakaSamvat: -28 });
    expect(computeSamvat(at(99, 5, 1)).vikramSamvat).toBe(156);
    expect(computeSamvat(at(99, 0, 5)).vikramSamvat).toBe(155);
  });
});

describe('a kshaya Chaitra Shukla Pratipada', () => {
  it('opens the year on the day that contains it, the day Ugadi is emitted (2026 at Delhi)', () => {
    const ugadi = computeFestivalsInRange(
      new Date('2026-03-16T00:00:00Z'), new Date('2026-03-23T00:00:00Z'), DELHI, { timezone: 330 },
    ).filter((x) => x.festival.key === 'ugadi').map((x) => atOffset(x.date, 330));
    expect(ugadi).toEqual(['2026-03-19']);
    for (const region of ['all', 'maharashtra', 'karnataka'] as const) {
      expect(iso(getHinduNewYear(2026, region, DELHI, { timezone: 330 })!)).toBe('2026-03-19');
    }
  });
});

describe('Adhika Chaitra in purnimanta', () => {
  it('round-trips its Krishna paksha', () => {
    const hindu = convertGregorianToHindu(new Date('2029-04-05T06:00:00Z'), DELHI, { timezone: 330 });
    expect(hindu).toMatchObject({ masaIndex: 0, paksha: 'krishna', pakshaTithi: 7, isAdhika: true, vikramSamvat: 2086 });
    const coords = { vikramSamvat: 2086, masaIndex: 0, paksha: 'krishna' as const, pakshaTithi: 7 };
    expect(convertHinduToGregorian({ ...coords, adhikaOnly: true }, DELHI, { timezone: 330 }).map(iso))
      .toEqual(['2029-04-05']);
    expect(convertHinduToGregorian(coords, DELHI, { timezone: 330 }).map(iso))
      .toEqual(['2029-04-05', '2030-03-25']);
  });
});

describe('eclipses are selected by their peak', () => {
  it('lists an eclipse peaking inside a range whose syzygy precedes it, and not one that peaked before', () => {
    expect(computeEclipsesInRange(new Date('1976-04-29T11:00:00Z'), new Date('1976-04-30T00:00:00Z'), PUNE)
      .map((e) => e.peak.toISOString())).toEqual(['1976-04-29T12:22:11.020Z']);
    expect(computeEclipsesInRange(new Date('2042-10-14T01:00:00Z'), new Date('2042-10-15T00:00:00Z'), PUNE))
      .toEqual([]);
  });

  it('lists a year-straddling eclipse in exactly one year', () => {
    const darwin = { latitude: -12.4634, longitude: 130.8456 };
    const peak = Date.parse('2066-12-31T14:28:06.335Z');
    const count = (year: number, loc: GeoLocation, tz: number | string, ms: number): number =>
      computeEclipsesForYear(year, loc, { timezone: tz })
        .filter((e) => Math.abs(e.peak.getTime() - ms) < 60_000).length;
    expect([count(2066, darwin, 'Australia/Darwin', peak), count(2067, darwin, 'Australia/Darwin', peak)])
      .toEqual([1, 0]);
    const straddle = Date.parse('2009-12-31T19:22:39.805Z');
    expect([count(2009, DELHI, 285, straddle), count(2010, DELHI, 285, straddle)]).toEqual([0, 1]);
  });
});

describe('a trisprisha Smarta Ekadashi on 31 December', () => {
  it('stays in its own year', () => {
    const y1911 = computeEkadashiDatesForYear(1911, DELHI, { timezone: 330 }).map(iso);
    const y1912 = computeEkadashiDatesForYear(1912, DELHI, { timezone: 330 }).map(iso);
    expect(y1911[y1911.length - 1]).toBe('1911-12-31');
    expect(y1912).not.toContain('1912-01-01');
  });
});
