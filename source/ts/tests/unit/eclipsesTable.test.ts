import { describe, it, expect } from 'vitest';
import {
  getEclipsesYearRange,
  getEclipsesForYear,
  getEclipsesForDate,
} from '../../src/calendar/eclipsesTable';
import { buildEclipsesTable } from '../../src/calendar/buildEclipsesTable';
import { getEclipsesInRange } from '../../src/calendar/yearly';
import { isEclipseVisibleAnyPhase } from '../../src/astronomy/eclipse';

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const IST_OFFSET = 330;

// The library ships no table, so the suite builds the one it reads.
const START_YEAR = 2025;
const END_YEAR = 2027;

const table = buildEclipsesTable({
  location: VARANASI,
  timezoneOffsetMinutes: IST_OFFSET,
  startYear: START_YEAR,
  endYear: END_YEAR,
  languages: ['en', 'hi'],
  referenceLocation: 'Varanasi',
  note: 'test fixture',
});

function allEclipses() {
  const out: { date: string; eclipse: ReturnType<typeof getEclipsesForDate>[number] }[] = [];
  for (let y = START_YEAR; y <= END_YEAR; y++) {
    for (const day of getEclipsesForYear(table, y)!) {
      for (const e of day.eclipses) out.push({ date: day.date, eclipse: e });
    }
  }
  return out;
}

describe('eclipse table reader', () => {
  describe('metadata', () => {
    it('stamps location / timezone / visibleOnly / locales', () => {
      expect(table._meta.referenceLocation).toBe('Varanasi');
      expect(table._meta.timezoneOffsetMinutes).toBe(330);
      expect(table._meta.visibleOnly).toBe(true);
      expect([...table._meta.languages]).toEqual(['en', 'hi']);
    });

    it('reports its own year range', () => {
      expect(getEclipsesYearRange(table)).toEqual({ start: START_YEAR, end: END_YEAR });
    });
  });

  describe('getEclipsesForYear', () => {
    it('returns null outside the table range', () => {
      expect(getEclipsesForYear(table, START_YEAR - 1)).toBeNull();
      expect(getEclipsesForYear(table, END_YEAR + 1)).toBeNull();
    });

    it('returns a (possibly empty) sorted array for every in-range year', () => {
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        const days = getEclipsesForYear(table, y);
        expect(days, `year ${y}`).not.toBeNull();
        const dates = days!.map(d => d.date);
        expect(dates).toEqual([...dates].sort());
        for (const d of days!) expect(d.date.slice(0, 4)).toBe(String(y));
      }
    });

    it('contains real eclipses across the window, including a total lunar', () => {
      const all = allEclipses();
      expect(all.length).toBeGreaterThan(0);
      const totalLunar = all.find(
        e => e.eclipse.kind === 'lunar' && e.eclipse.subtype === 'total',
      );
      expect(totalLunar, 'expected a total lunar eclipse in the window').toBeDefined();
      expect(totalLunar!.eclipse.name).toBe('Total Lunar Eclipse');
      // A total eclipse saturates obscuration at 1 while magnitude runs past it.
      expect(totalLunar!.eclipse.obscuration).toBeGreaterThan(0.9);
      expect(totalLunar!.eclipse.magnitude).toBeGreaterThan(1);
    });

    it('flattens to hi when requested', () => {
      const someYear = Number(allEclipses()[0]!.date.slice(0, 4));
      const hiDays = getEclipsesForYear(table, someYear, 'hi')!;
      const names = hiDays.flatMap(d => d.eclipses.map(e => e.name));
      expect(names.every(n => n.includes('ग्रहण'))).toBe(true);
    });

    it('survives a JSON round trip, both numeric fields included', () => {
      const revived = JSON.parse(JSON.stringify(table)) as typeof table;
      const before = allEclipses();
      const after: typeof before = [];
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        for (const day of getEclipsesForYear(revived, y)!) {
          for (const e of day.eclipses) after.push({ date: day.date, eclipse: e });
        }
      }
      expect(after).toEqual(before);
      expect(after.length).toBeGreaterThan(0);
      for (const { eclipse } of after) {
        expect(typeof eclipse.obscuration, `obscuration on ${eclipse.peak}`).toBe('number');
        expect(typeof eclipse.magnitude, `magnitude on ${eclipse.peak}`).toBe('number');
        expect(eclipse.obscuration).toBeGreaterThanOrEqual(0);
        expect(eclipse.obscuration).toBeLessThanOrEqual(1);
        // No umbral contact: zero area covered, negative magnitude by convention.
        if (eclipse.kind === 'lunar' && eclipse.subtype === 'penumbral') {
          expect(eclipse.obscuration).toBe(0);
          expect(eclipse.magnitude).toBeLessThan(0);
        }
      }
    });
  });

  describe('sutak invariants (almanac / pandit consensus)', () => {
    it('umbral lunar + all solar eclipses carry sutak; penumbral lunar do not', () => {
      for (const { eclipse } of allEclipses()) {
        expect(eclipse.visibleFromLocation).toBe(true);
        expect(typeof eclipse.visibleAtPeak).toBe('boolean');
        if (eclipse.kind === 'lunar' && eclipse.subtype === 'penumbral') {
          expect(eclipse.sutak, `penumbral on ${eclipse.peak}`).toBeUndefined();
        } else {
          expect(eclipse.sutak, `${eclipse.kind}/${eclipse.subtype} on ${eclipse.peak}`).toBeDefined();
          // Sutak ends at moksha, the umbral last contact, at or before the
          // penumbral end.
          expect(new Date(eclipse.sutak!.end).getTime())
            .toBeLessThanOrEqual(new Date(eclipse.end).getTime());
          expect(new Date(eclipse.sutak!.start).getTime())
            .toBeLessThan(new Date(eclipse.start).getTime());
        }
      }
    });

    it('orders each eclipse start ≤ peak ≤ end', () => {
      for (const { eclipse } of allEclipses()) {
        const s = new Date(eclipse.start).getTime();
        const p = new Date(eclipse.peak).getTime();
        const e = new Date(eclipse.end).getTime();
        expect(s).toBeLessThanOrEqual(p);
        expect(p).toBeLessThanOrEqual(e);
      }
    });
  });

  describe('getEclipsesForDate', () => {
    const sample = allEclipses()[0]!;

    it('accepts ISO YYYY-MM-DD strings', () => {
      const got = getEclipsesForDate(table, sample.date);
      expect(got.some(e => e.peak === sample.eclipse.peak)).toBe(true);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      // Noon IST on the eclipse's local date.
      const noonIst = new Date(`${sample.date}T06:30:00Z`);
      const got = getEclipsesForDate(table, noonIst);
      expect(got.some(e => e.peak === sample.eclipse.peak)).toBe(true);
    });

    it('returns hi names when lang=hi', () => {
      const got = getEclipsesForDate(table, sample.date, 'hi');
      expect(got.every(e => e.name.includes('ग्रहण'))).toBe(true);
    });

    it('returns [] for dates with no eclipse and out-of-range dates', () => {
      expect(getEclipsesForDate(table, `${START_YEAR - 5}-01-01`)).toEqual([]);
      // Eclipses never fall on consecutive days, so the next day has none.
      const dayAfter = new Date(`${sample.date}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      const key = dayAfter.toISOString().slice(0, 10);
      if (key.slice(0, 4) === sample.date.slice(0, 4)) {
        expect(getEclipsesForDate(table, key)).toEqual([]);
      }
    });
  });

  describe('known eclipses in the built window', () => {
    it('produces the 2025-09-07 total lunar eclipse with a sutak window', () => {
      const days = getEclipsesForYear(table, 2025);
      expect(days).not.toBeNull();
      const total = days!.flatMap(d => d.eclipses).find(e => e.subtype === 'total');
      expect(total).toBeDefined();
      expect(total!.kind).toBe('lunar');
      expect(total!.peak.slice(0, 10)).toBe('2025-09-07');
      expect(total!.sutak).toBeDefined();
    });

    it('emits penumbral lunar eclipses (2027) without sutak', () => {
      const penumbral = getEclipsesForYear(table, 2027)!
        .flatMap(d => d.eclipses)
        .filter(e => e.subtype === 'penumbral');
      expect(penumbral.length).toBeGreaterThan(0);
      expect(penumbral.every(e => e.sutak === undefined)).toBe(true);
    });

    it('includes the 2026-03-03 total lunar via the any-phase rule (peak below horizon)', () => {
      // At Varanasi the Moon rises already eclipsed: only closing phases show.
      const e2026 = getEclipsesForYear(table, 2026)!
        .flatMap(d => d.eclipses)
        .find(e => e.peak.slice(0, 10) === '2026-03-03');
      expect(e2026).toBeDefined();
      expect(e2026!.kind).toBe('lunar');
      expect(e2026!.visibleFromLocation).toBe(true);
      expect(e2026!.visibleAtPeak).toBe(false);
      expect(e2026!.sutak).toBeDefined();
    });
  });

  describe('parity with live getEclipsesInRange for Varanasi', () => {
    it('matches the live visible-only computation over the whole span', () => {
      const live = getEclipsesInRange(
        new Date(Date.UTC(START_YEAR, 0, 1)),
        new Date(Date.UTC(END_YEAR, 11, 31, 23, 59, 59, 999)),
        VARANASI,
      ).filter(e => isEclipseVisibleAnyPhase(e, VARANASI));
      const liveKeys = live.map(e => `${toIstKey(e.peak)}|${e.kind}|${e.subtype}`).sort();
      const tableKeys: string[] = [];
      for (let y = START_YEAR; y <= END_YEAR; y++) {
        for (const d of getEclipsesForYear(table, y)!) {
          for (const e of d.eclipses) tableKeys.push(`${d.date}|${e.kind}|${e.subtype}`);
        }
      }
      expect(tableKeys.sort()).toEqual(liveKeys);
    });
  });
});

describe('buildEclipsesTable options', () => {
  it('visibleOnly:false includes at least as many eclipses as the default', () => {
    const all = buildEclipsesTable({
      location: VARANASI,
      timezoneOffsetMinutes: IST_OFFSET,
      startYear: START_YEAR,
      endYear: END_YEAR,
      languages: ['en'],
      visibleOnly: false,
    });
    const count = (f: typeof table) =>
      Object.values(f.years).reduce((s, d) => s + d.reduce((s2, x) => s2 + x.eclipses.length, 0), 0);
    expect(table._meta.visibleOnly).toBe(true);
    expect(all._meta.visibleOnly).toBe(false);
    expect(count(all)).toBeGreaterThanOrEqual(count(table));
  });

  it('falls back gracefully when a missing locale is requested', () => {
    const enOnly = buildEclipsesTable({
      location: VARANASI,
      timezoneOffsetMinutes: IST_OFFSET,
      startYear: 2025,
      endYear: 2025,
      languages: ['en'],
    });
    const days = getEclipsesForYear(enOnly, 2025, 'hi')!;
    const total = days.flatMap(d => d.eclipses).find(e => e.subtype === 'total');
    expect(total).toBeDefined();
    expect(total!.name).toBe('Total Lunar Eclipse');
  });

  it('rejects an inverted year range', () => {
    expect(() => buildEclipsesTable({
      location: VARANASI, timezoneOffsetMinutes: IST_OFFSET,
      startYear: 2030, endYear: 2029,
    })).toThrow(/must be ≤/);
  });
});

function toIstKey(d: Date): string {
  const shifted = new Date(d.getTime() + IST_OFFSET * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
