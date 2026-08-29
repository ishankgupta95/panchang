import { describe, it, expect } from 'vitest';
import {
  getFestivalsYearRange,
  getFestivalsForYear,
  getFestivalsForDate,
} from '../../src/calendar/festivalsTable';
import { buildFestivalsTable } from '../../src/calendar/buildFestivalsTable';
import { getFestivalsInRange } from '../../src/calendar/yearly';

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const IST = { timezone: 330 as const };

const SAMPLE_YEAR = 2026;

const varanasiTable = buildFestivalsTable({
  location: VARANASI,
  timezoneOffsetMinutes: 330,
  startYear: SAMPLE_YEAR,
  endYear: SAMPLE_YEAR,
  languages: ['en', 'hi'],
  referenceLocation: 'Varanasi',
  note: 'test fixture',
});

describe('festivals table reader', () => {
  describe('metadata', () => {
    it('stamps what the table was built from', () => {
      expect(varanasiTable._meta.referenceLocation).toBe('Varanasi');
      expect(varanasiTable._meta.timezoneOffsetMinutes).toBe(330);
      expect(varanasiTable._meta.masaSystem).toBe('purnimanta');
      expect(varanasiTable._meta.ayanamsa).toBe('lahiri');
      expect(varanasiTable._meta.region).toBe('all');
      expect([...varanasiTable._meta.languages]).toEqual(['en', 'hi']);
    });

    it('reports its own year range', () => {
      expect(getFestivalsYearRange(varanasiTable))
        .toEqual({ start: SAMPLE_YEAR, end: SAMPLE_YEAR });
    });
  });

  describe('getFestivalsForYear', () => {
    it('returns null outside the table range', () => {
      expect(getFestivalsForYear(varanasiTable, SAMPLE_YEAR - 1)).toBeNull();
      expect(getFestivalsForYear(varanasiTable, SAMPLE_YEAR + 1)).toBeNull();
    });

    it('returns a sorted, non-empty array for in-range years', () => {
      const days = getFestivalsForYear(varanasiTable, SAMPLE_YEAR);
      expect(days).not.toBeNull();
      expect(days!.length).toBeGreaterThan(100);
      const dates = days!.map(d => d.date);
      expect(dates).toEqual([...dates].sort());
    });

    it('contains Diwali with the Purnimanta-paksha description (en default)', () => {
      const days = getFestivalsForYear(varanasiTable, SAMPLE_YEAR)!;
      const diwaliDay = days.find(d => d.festivals.some(f => f.name === 'Diwali'));
      expect(diwaliDay).toBeDefined();
      const diwali = diwaliDay!.festivals.find(f => f.name === 'Diwali')!;
      expect(diwali.type).toBe('major');
      expect(diwali.description).toContain('Purnimanta');
    });

    it('flattens to hi when requested', () => {
      const days = getFestivalsForYear(varanasiTable, SAMPLE_YEAR, 'hi')!;
      const diwaliDay = days.find(d => d.festivals.some(f => f.name === 'दिवाली'));
      expect(diwaliDay).toBeDefined();
      expect(diwaliDay!.festivals.some(f => f.name === 'दिवाली')).toBe(true);
    });
  });

  describe('getFestivalsForDate', () => {
    const diwaliDate = getFestivalsForYear(varanasiTable, SAMPLE_YEAR)!
      .find(d => d.festivals.some(f => f.name === 'Diwali'))!.date;

    it('accepts ISO YYYY-MM-DD strings', () => {
      const fests = getFestivalsForDate(varanasiTable, diwaliDate);
      expect(fests.some(f => f.name === 'Diwali')).toBe(true);
    });

    it('returns hi names when lang=hi', () => {
      const fests = getFestivalsForDate(varanasiTable, diwaliDate, 'hi');
      expect(fests.some(f => f.name === 'दिवाली')).toBe(true);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      const noonIst = new Date(`${diwaliDate}T06:30:00Z`);
      const fests = getFestivalsForDate(varanasiTable, noonIst);
      expect(fests.some(f => f.name === 'Diwali')).toBe(true);
    });

    it('returns [] for out-of-range dates', () => {
      expect(getFestivalsForDate(varanasiTable, `${SAMPLE_YEAR - 5}-01-01`)).toEqual([]);
      expect(getFestivalsForDate(varanasiTable, `${SAMPLE_YEAR + 5}-12-31`)).toEqual([]);
    });
  });

  describe('parity with live getFestivalsInRange for Varanasi', () => {
    it('matches live computation (non-eclipse emissions)', () => {
      const live = getFestivalsInRange(
        new Date(Date.UTC(SAMPLE_YEAR, 0, 1)),
        new Date(Date.UTC(SAMPLE_YEAR, 11, 31)),
        VARANASI,
        { ...IST, ayanamsa: 'lahiri', masaSystem: 'purnimanta', region: 'all', language: 'en' },
      );

      const liveMap = new Map<string, Set<string>>();
      for (const d of live) {
        if (d.festival.type === 'eclipse') continue;
        const key = toIstKey(d.date);
        (liveMap.get(key) ?? liveMap.set(key, new Set()).get(key)!).add(d.festival.name);
      }

      const tableMap = new Map<string, Set<string>>(
        getFestivalsForYear(varanasiTable, SAMPLE_YEAR)!.map(
          day => [day.date, new Set(day.festivals.map(f => f.name))],
        ),
      );

      expect([...tableMap.keys()].sort()).toEqual([...liveMap.keys()].sort());
      for (const [date, liveSet] of liveMap) {
        expect([...tableMap.get(date)!].sort(), `mismatch on ${date}`)
          .toEqual([...liveSet].sort());
      }
    });
  });
});

describe('buildFestivalsTable (another location)', () => {
  const NYC = { latitude: 40.7128, longitude: -74.006 };
  const NYC_OFFSET = -300;

  const built = buildFestivalsTable({
    location: NYC,
    timezoneOffsetMinutes: NYC_OFFSET,
    startYear: SAMPLE_YEAR,
    endYear: SAMPLE_YEAR,
    languages: ['en'],
    referenceLocation: 'New York',
    note: 'test',
  });

  it('stamps the requested location and timezone into _meta', () => {
    expect(built._meta.referenceLocation).toBe('New York');
    expect(built._meta.timezoneOffsetMinutes).toBe(NYC_OFFSET);
    expect(built._meta.startYear).toBe(SAMPLE_YEAR);
    expect(built._meta.endYear).toBe(SAMPLE_YEAR);
    expect([...built._meta.languages]).toEqual(['en']);
  });

  it('produces a year readable by getFestivalsForYear', () => {
    const days = getFestivalsForYear(built, SAMPLE_YEAR, 'en');
    expect(days).not.toBeNull();
    expect(days!.length).toBeGreaterThan(50);
    expect(days!.some(d => d.festivals.some(f => f.name === 'Diwali'))).toBe(true);
  });

  it('matches live getFestivalsInRange for the same location', () => {
    const live = getFestivalsInRange(
      new Date(Date.UTC(SAMPLE_YEAR, 0, 1)),
      new Date(Date.UTC(SAMPLE_YEAR, 11, 31)),
      NYC,
      { timezone: NYC_OFFSET, ayanamsa: 'lahiri', masaSystem: 'purnimanta', region: 'all', language: 'en' },
    );
    const liveDates = new Set<string>();
    for (const d of live) {
      if (d.festival.type === 'eclipse') continue;
      liveDates.add(toKey(d.date, NYC_OFFSET));
    }
    const tableDates = new Set(getFestivalsForYear(built, SAMPLE_YEAR, 'en')!.map(d => d.date));
    expect([...tableDates].sort()).toEqual([...liveDates].sort());
  });

  it('getFestivalsForDate respects the source table timezone', () => {
    const diwali = getFestivalsForYear(built, SAMPLE_YEAR, 'en')!
      .find(d => d.festivals.some(f => f.name === 'Diwali'))!;
    const fests = getFestivalsForDate(built, diwali.date, 'en');
    expect(fests.some(f => f.name === 'Diwali')).toBe(true);
  });

  it('falls back gracefully when a missing locale is requested', () => {
    const days = getFestivalsForYear(built, SAMPLE_YEAR, 'hi')!;
    const diwaliDay = days.find(d => d.festivals.some(f => f.name === 'Diwali'));
    expect(diwaliDay).toBeDefined();
  });

  it('rejects an inverted year range', () => {
    expect(() => buildFestivalsTable({
      location: NYC, timezoneOffsetMinutes: NYC_OFFSET,
      startYear: 2030, endYear: 2029,
    })).toThrow(/must be ≤/);
  });
});

function toIstKey(d: Date): string {
  return toKey(d, 330);
}

function toKey(d: Date, offsetMinutes: number): string {
  const shifted = new Date(d.getTime() + offsetMinutes * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
