import { describe, it, expect } from 'vitest';
import {
  MOON_PHASES_META,
  MOON_PHASES_YEAR_RANGE,
  getMoonPhasesForYear,
  getMoonPhasesForDate,
} from '../../src/calendar/moonPhasesTable';
import { buildMoonPhasesTable } from '../../src/calendar/buildMoonPhasesTable';
import { getMoonPhasesInRange } from '../../src/astronomy/moonPhase';

const IST_OFFSET = 330;
const PHASES = ['new', 'first_quarter', 'full', 'last_quarter'] as const;
const SAMPLE_YEAR = MOON_PHASES_YEAR_RANGE.start;

describe('static Moon-phases table', () => {
  describe('metadata', () => {
    it('declares IST / en+hi', () => {
      expect(MOON_PHASES_META.referenceLocation).toContain('IST');
      expect(MOON_PHASES_META.timezoneOffsetMinutes).toBe(330);
      expect([...MOON_PHASES_META.languages]).toEqual(['en', 'hi']);
    });

    it('spans a rolling 2-past / 5-future window (8 years inclusive)', () => {
      expect(MOON_PHASES_YEAR_RANGE.end - MOON_PHASES_YEAR_RANGE.start).toBe(7);
    });
  });

  describe('getMoonPhasesForYear', () => {
    it('returns null outside the bundled range', () => {
      expect(getMoonPhasesForYear(MOON_PHASES_YEAR_RANGE.start - 1)).toBeNull();
      expect(getMoonPhasesForYear(MOON_PHASES_YEAR_RANGE.end + 1)).toBeNull();
    });

    it('has ~49–50 events, sorted, all 4 phases, dates in-year', () => {
      for (let y = MOON_PHASES_YEAR_RANGE.start; y <= MOON_PHASES_YEAR_RANGE.end; y++) {
        const days = getMoonPhasesForYear(y);
        expect(days, `year ${y}`).not.toBeNull();
        const dates = days!.map(d => d.date);
        expect(dates).toEqual([...dates].sort());
        const flat = days!.flatMap(d => d.phases.map(p => ({ ...p, date: d.date })));
        // ~12.37 lunations/year × 4 quarters ≈ 49.5.
        expect(flat.length).toBeGreaterThanOrEqual(48);
        expect(flat.length).toBeLessThanOrEqual(51);
        for (const p of flat) {
          expect(PHASES).toContain(p.phase);
          expect(p.date.slice(0, 4)).toBe(String(y));
          expect(Number.isNaN(Date.parse(p.time))).toBe(false);
        }
        // Every phase occurs ~12–13 times a year.
        for (const phase of PHASES) {
          const n = flat.filter(p => p.phase === phase).length;
          expect(n, `${phase} in ${y}`).toBeGreaterThanOrEqual(11);
        }
      }
    });

    it('flattens to hi (पूर्णिमा for full, अमावस्या for new)', () => {
      const flat = getMoonPhasesForYear(SAMPLE_YEAR, 'hi')!.flatMap(d => d.phases);
      expect(flat.find(p => p.phase === 'full')!.name).toBe('पूर्णिमा');
      expect(flat.find(p => p.phase === 'new')!.name).toBe('अमावस्या');
    });
  });

  describe('getMoonPhasesForDate', () => {
    const sample = getMoonPhasesForYear(SAMPLE_YEAR)![0];

    it('accepts ISO YYYY-MM-DD strings', () => {
      const got = getMoonPhasesForDate(sample.date);
      expect(got.length).toBeGreaterThan(0);
      expect(PHASES).toContain(got[0].phase);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      const noonIst = new Date(`${sample.date}T06:30:00Z`);
      expect(getMoonPhasesForDate(noonIst).map(p => p.phase))
        .toEqual(sample.phases.map(p => p.phase));
    });

    it('returns [] for out-of-range dates', () => {
      expect(getMoonPhasesForDate(`${MOON_PHASES_YEAR_RANGE.start - 5}-01-01`)).toEqual([]);
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
      const tableKeys = getMoonPhasesForYear(SAMPLE_YEAR)!
        .flatMap(d => d.phases.map(p => `${d.date}|${p.phase}`))
        .sort();
      expect(tableKeys).toEqual(liveKeys);
    });
  });
});

describe('buildMoonPhasesTable (timezone-specific, runtime)', () => {
  it('maps the same phase instant onto different local dates per timezone', () => {
    // The new moon at 2026-01-18T19:52Z is 2026-01-18 in UTC but 2026-01-19 in IST.
    const utc = buildMoonPhasesTable({ timezoneOffsetMinutes: 0, startYear: 2026, endYear: 2026, languages: ['en'] });
    const ist = buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2026, endYear: 2026, languages: ['en'] });

    const findNew = (f: typeof utc) =>
      getMoonPhasesForYear(2026, 'en', f)!
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
    const tableKeys = getMoonPhasesForYear(2026, 'en', built)!
      .flatMap(d => d.phases.map(p => `${d.date}|${p.phase}`))
      .sort();
    expect(tableKeys).toEqual(liveKeys);
  });

  it('falls back gracefully when a missing locale is requested', () => {
    const built = buildMoonPhasesTable({ timezoneOffsetMinutes: IST_OFFSET, startYear: 2026, endYear: 2026, languages: ['en'] });
    const full = getMoonPhasesForYear(2026, 'hi', built)!.flatMap(d => d.phases).find(p => p.phase === 'full');
    expect(full!.name).toBe('Full Moon'); // en fallback
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
