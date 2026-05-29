import { describe, it, expect } from 'vitest';
import {
  FESTIVALS_META,
  FESTIVALS_YEAR_RANGE,
  getFestivalsForYear,
  getFestivalsForDate,
} from '../../src/calendar/festivalsTable';
import { buildFestivalsTable } from '../../src/calendar/buildFestivalsTable';
import { getFestivalsInRange } from '../../src/calendar/yearly';

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const IST = { timezone: 330 as const };

// Earliest bundled year is always present regardless of when the table was
// last regenerated (the generator uses a rolling 2-past / 5-future window).
const SAMPLE_YEAR = FESTIVALS_YEAR_RANGE.start;

describe('static festivals table', () => {
  describe('metadata', () => {
    it('declares Varanasi / IST / Purnimanta / Lahiri / all-regions / en+hi', () => {
      expect(FESTIVALS_META.referenceLocation).toBe('Varanasi');
      expect(FESTIVALS_META.timezoneOffsetMinutes).toBe(330);
      expect(FESTIVALS_META.masaSystem).toBe('purnimanta');
      expect(FESTIVALS_META.ayanamsa).toBe('lahiri');
      expect(FESTIVALS_META.region).toBe('all');
      expect([...FESTIVALS_META.languages]).toEqual(['en', 'hi']);
    });

    it('spans a rolling 2-past / 5-future window (8 years inclusive)', () => {
      expect(FESTIVALS_YEAR_RANGE.end - FESTIVALS_YEAR_RANGE.start).toBe(7);
    });
  });

  describe('getFestivalsForYear', () => {
    it('returns null outside the bundled range', () => {
      expect(getFestivalsForYear(FESTIVALS_YEAR_RANGE.start - 1)).toBeNull();
      expect(getFestivalsForYear(FESTIVALS_YEAR_RANGE.end + 1)).toBeNull();
    });

    it('returns a sorted, non-empty array for in-range years', () => {
      const days = getFestivalsForYear(SAMPLE_YEAR);
      expect(days).not.toBeNull();
      expect(days!.length).toBeGreaterThan(100);
      const dates = days!.map(d => d.date);
      expect(dates).toEqual([...dates].sort());
    });

    it('contains Diwali with the Purnimanta-paksha description (en default)', () => {
      const days = getFestivalsForYear(SAMPLE_YEAR)!;
      const diwaliDay = days.find(d => d.festivals.some(f => f.name === 'Diwali'));
      expect(diwaliDay).toBeDefined();
      const diwali = diwaliDay!.festivals.find(f => f.name === 'Diwali')!;
      expect(diwali.type).toBe('major');
      expect(diwali.description).toContain('Purnimanta');
    });

    it('flattens to hi when requested', () => {
      const days = getFestivalsForYear(SAMPLE_YEAR, 'hi')!;
      const diwaliDay = days.find(d => d.festivals.some(f => f.name === 'दिवाली'));
      expect(diwaliDay).toBeDefined();
      expect(diwaliDay!.festivals.some(f => f.name === 'दिवाली')).toBe(true);
    });
  });

  describe('getFestivalsForDate', () => {
    // Resolve Diwali's actual date in the sample year so the assertion is
    // stable across regenerations of the rolling window.
    const diwaliDate = getFestivalsForYear(SAMPLE_YEAR)!
      .find(d => d.festivals.some(f => f.name === 'Diwali'))!.date;

    it('accepts ISO YYYY-MM-DD strings', () => {
      const fests = getFestivalsForDate(diwaliDate);
      expect(fests.some(f => f.name === 'Diwali')).toBe(true);
    });

    it('returns hi names when lang=hi', () => {
      const fests = getFestivalsForDate(diwaliDate, 'hi');
      expect(fests.some(f => f.name === 'दिवाली')).toBe(true);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      // Noon IST on Diwali — unambiguous calendar date in IST.
      const noonIst = new Date(`${diwaliDate}T06:30:00Z`);
      const fests = getFestivalsForDate(noonIst);
      expect(fests.some(f => f.name === 'Diwali')).toBe(true);
    });

    it('returns [] for out-of-range dates', () => {
      expect(getFestivalsForDate(`${FESTIVALS_YEAR_RANGE.start - 5}-01-01`)).toEqual([]);
      expect(getFestivalsForDate(`${FESTIVALS_YEAR_RANGE.end + 5}-12-31`)).toEqual([]);
    });
  });

  describe('parity with live getFestivalsInRange for Varanasi', () => {
    // Recompute the sample year live and diff against the bundled table.
    // If this drifts, regenerate via `npm run festivals:gen`.
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
        getFestivalsForYear(SAMPLE_YEAR)!.map(
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

describe('buildFestivalsTable (location-specific, runtime)', () => {
  const NYC = { latitude: 40.7128, longitude: -74.006 };
  const NYC_OFFSET = -300; // US Eastern (EST), UTC-5

  // One year, en only — keeps this fast.
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

  it('produces a year readable by getFestivalsForYear via the source arg', () => {
    const days = getFestivalsForYear(SAMPLE_YEAR, 'en', built);
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
    const tableDates = new Set(getFestivalsForYear(SAMPLE_YEAR, 'en', built)!.map(d => d.date));
    expect([...tableDates].sort()).toEqual([...liveDates].sort());
  });

  it('getFestivalsForDate respects the source table timezone', () => {
    const diwali = getFestivalsForYear(SAMPLE_YEAR, 'en', built)!
      .find(d => d.festivals.some(f => f.name === 'Diwali'))!;
    const fests = getFestivalsForDate(diwali.date, 'en', built);
    expect(fests.some(f => f.name === 'Diwali')).toBe(true);
  });

  it('falls back gracefully when a missing locale is requested', () => {
    // built only has 'en'; asking for 'hi' should yield the en string.
    const days = getFestivalsForYear(SAMPLE_YEAR, 'hi', built)!;
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
