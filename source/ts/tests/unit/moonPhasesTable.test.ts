import { describe, it, expect } from 'vitest';
import {
  getMoonPhasesYearRange,
  getMoonPhasesForYear,
  getMoonPhasesForDate,
} from '../../src/calendar/moonPhasesTable';
import { buildMoonPhasesTable } from '../../src/calendar/buildMoonPhasesTable';
import { getMoonPhasesInRange } from '../../src/astronomy/moonPhase';

const IST_OFFSET = 330;
const PHASES = ['new', 'first_quarter', 'full', 'last_quarter'] as const;
// The library ships no table, so the suite builds the one it reads.
const START_YEAR = 2025;
const END_YEAR = 2027;
const SAMPLE_YEAR = START_YEAR;

const table = buildMoonPhasesTable({
  timezoneOffsetMinutes: IST_OFFSET,
  startYear: START_YEAR,
  endYear: END_YEAR,
  languages: ['en', 'hi'],
  referenceLocation: 'India (IST)',
  note: 'test fixture',
});

describe('Moon-phases table reader', () => {
  describe('metadata', () => {
    it('stamps timezone and locales', () => {
      expect(table._meta.referenceLocation).toContain('IST');
      expect(table._meta.timezoneOffsetMinutes).toBe(330);
      expect([...table._meta.languages]).toEqual(['en', 'hi']);
    });

    it('reports its own year range', () => {
      expect(getMoonPhasesYearRange(table)).toEqual({ start: START_YEAR, end: END_YEAR });
    });
  });

  describe('getMoonPhasesForYear', () => {
    it('returns null outside the table range', () => {
      expect(getMoonPhasesForYear(table, START_YEAR - 1)).toBeNull();
      expect(getMoonPhasesForYear(table, END_YEAR + 1)).toBeNull();
    });

    it('has ~49-50 events, sorted, all 4 phases, dates in-year', () => {
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        const days = getMoonPhasesForYear(table, y);
        expect(days, `year ${y}`).not.toBeNull();
        const dates = days!.map(d => d.date);
        expect(dates).toEqual([...dates].sort());
        const flat = days!.flatMap(d => d.phases.map(p => ({ ...p, date: d.date })));
        // ~12.37 lunations/year x 4 quarters is ~49.5 events.
        expect(flat.length).toBeGreaterThanOrEqual(48);
        expect(flat.length).toBeLessThanOrEqual(51);
        for (const p of flat) {
          expect(PHASES).toContain(p.phase);
          expect(p.date.slice(0, 4)).toBe(String(y));
          expect(Number.isNaN(Date.parse(p.time))).toBe(false);
        }
        for (const phase of PHASES) {
          const n = flat.filter(p => p.phase === phase).length;
          expect(n, `${phase} in ${y}`).toBeGreaterThanOrEqual(11);
        }
      }
    });

    it('flattens to hi (पूर्णिमा for full, अमावस्या for new)', () => {
      const flat = getMoonPhasesForYear(table, SAMPLE_YEAR, 'hi')!.flatMap(d => d.phases);
      expect(flat.find(p => p.phase === 'full')!.name).toBe('पूर्णिमा');
      expect(flat.find(p => p.phase === 'new')!.name).toBe('अमावस्या');
    });
  });

  describe('getMoonPhasesForDate', () => {
    const sample = getMoonPhasesForYear(table, SAMPLE_YEAR)![0]!;

    it('accepts ISO YYYY-MM-DD strings', () => {
      const got = getMoonPhasesForDate(table, sample.date);
      expect(got.length).toBeGreaterThan(0);
      expect(PHASES).toContain(got[0]!.phase);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      const noonIst = new Date(`${sample.date}T06:30:00Z`);
      expect(getMoonPhasesForDate(table, noonIst).map(p => p.phase))
        .toEqual(sample.phases.map(p => p.phase));
    });

    it('returns [] for out-of-range dates', () => {
      expect(getMoonPhasesForDate(table, `${START_YEAR - 5}-01-01`)).toEqual([]);
    });
  });

  describe('parity with live getMoonPhasesInRange (IST dates)', () => {
    it('matches the live computation (date|phase)', () => {
      const live = getMoonPhasesInRange(
        new Date(Date.UTC(SAMPLE_YEAR, 0, 1)),
        new Date(Date.UTC(SAMPLE_YEAR, 11, 31, 23, 59, 59, 999)),
      );
      const liveKeys = live
        .map(p => `${toIstKey(p.time)}|${p.phase}`)
        .filter(k => k.slice(0, 4) === String(SAMPLE_YEAR))
        .sort();
      const tableKeys = getMoonPhasesForYear(table, SAMPLE_YEAR)!
        .flatMap(d => d.phases.map(p => `${d.date}|${p.phase}`))
        .sort();
      expect(tableKeys).toEqual(liveKeys);
    });
  });
});

describe('buildMoonPhasesTable (other timezones)', () => {
  it('maps the same phase instant onto different local dates per timezone', () => {
    // The new moon at 2026-01-18T19:52Z is 2026-01-18 in UTC but 2026-01-19 in IST.
    const utc = buildMoonPhasesTable({ timezoneOffsetMinutes: 0, startYear: 2026, endYear: 2026, languages: ['en'] });
    const ist = buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2026, endYear: 2026, languages: ['en'] });

    const findNew = (f: typeof utc) =>
      getMoonPhasesForYear(f, 2026, 'en')!
        .flatMap(d => d.phases.map(p => ({ ...p, date: d.date })))
        .find(p => p.phase === 'new' && p.time.startsWith('2026-01-18'))!;

    expect(findNew(utc).date).toBe('2026-01-18');
    expect(findNew(ist).date).toBe('2026-01-19');
    expect(utc._meta.timezoneOffsetMinutes).toBe(0);
  });

  it('matches live getMoonPhasesInRange for the same timezone', () => {
    const built = buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2026, endYear: 2026, languages: ['en'] });
    const live = getMoonPhasesInRange(
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)),
    );
    const liveKeys = live
      .map(p => `${toIstKey(p.time)}|${p.phase}`)
      .filter(k => k.slice(0, 4) === '2026')
      .sort();
    const tableKeys = getMoonPhasesForYear(built, 2026, 'en')!
      .flatMap(d => d.phases.map(p => `${d.date}|${p.phase}`))
      .sort();
    expect(tableKeys).toEqual(liveKeys);
  });

  it('falls back gracefully when a missing locale is requested', () => {
    const built = buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2026, endYear: 2026, languages: ['en'] });
    const full = getMoonPhasesForYear(built, 2026, 'hi')!.flatMap(d => d.phases).find(p => p.phase === 'full');
    expect(full!.name).toBe('Full Moon');
  });

  it('rejects an inverted year range', () => {
    expect(() => buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2030, endYear: 2029 }))
      .toThrow(/must be ≤/);
  });
});

function toIstKey(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
