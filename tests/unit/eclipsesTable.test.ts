import { describe, it, expect } from 'vitest';
import {
  ECLIPSES_META,
  ECLIPSES_YEAR_RANGE,
  getEclipsesForYear,
  getEclipsesForDate,
} from '../../src/calendar/eclipsesTable';
import { buildEclipsesTable } from '../../src/calendar/buildEclipsesTable';
import { getEclipsesInRange } from '../../src/calendar/yearly';
import { isEclipseVisibleAnyPhase } from '../../src/astronomy/eclipse';

const VARANASI = { latitude: 25.3176, longitude: 82.9739 };
const IST_OFFSET = 330;

// The bundled window rolls (2 past / 5 future), and any given year may have
// zero India-visible eclipses, so tests resolve sample data dynamically from
// the table rather than hardcoding a year.
function allBundledEclipses() {
  const out: { date: string; eclipse: ReturnType<typeof getEclipsesForDate>[number] }[] = [];
  for (let y = ECLIPSES_YEAR_RANGE.start; y <= ECLIPSES_YEAR_RANGE.end; y++) {
    for (const day of getEclipsesForYear(y)!) {
      for (const e of day.eclipses) out.push({ date: day.date, eclipse: e });
    }
  }
  return out;
}

describe('static eclipse table', () => {
  describe('metadata', () => {
    it('declares Varanasi / IST / visible-only / en+hi', () => {
      expect(ECLIPSES_META.referenceLocation).toBe('Varanasi');
      expect(ECLIPSES_META.timezoneOffsetMinutes).toBe(330);
      expect(ECLIPSES_META.visibleOnly).toBe(true);
      expect([...ECLIPSES_META.languages]).toEqual(['en', 'hi']);
    });

    it('spans a rolling 2-past / 5-future window (8 years inclusive)', () => {
      expect(ECLIPSES_YEAR_RANGE.end - ECLIPSES_YEAR_RANGE.start).toBe(7);
    });
  });

  describe('getEclipsesForYear', () => {
    it('returns null outside the bundled range', () => {
      expect(getEclipsesForYear(ECLIPSES_YEAR_RANGE.start - 1)).toBeNull();
      expect(getEclipsesForYear(ECLIPSES_YEAR_RANGE.end + 1)).toBeNull();
    });

    it('returns a (possibly empty) sorted array for every in-range year', () => {
      for (let y = ECLIPSES_YEAR_RANGE.start; y <= ECLIPSES_YEAR_RANGE.end; y++) {
        const days = getEclipsesForYear(y);
        expect(days, `year ${y}`).not.toBeNull();
        const dates = days!.map(d => d.date);
        expect(dates).toEqual([...dates].sort());
        // Every emitted entry's peak local date sits in its own year.
        for (const d of days!) expect(d.date.slice(0, 4)).toBe(String(y));
      }
    });

    it('contains real eclipses across the window, including a total lunar', () => {
      const all = allBundledEclipses();
      expect(all.length).toBeGreaterThan(0);
      // Total lunar eclipses recur often enough that an 8-year India-visible
      // window always has at least one.
      const totalLunar = all.find(
        e => e.eclipse.kind === 'lunar' && e.eclipse.subtype === 'total',
      );
      expect(totalLunar, 'expected a total lunar eclipse in the window').toBeDefined();
      expect(totalLunar!.eclipse.name).toBe('Total Lunar Eclipse');
      expect(totalLunar!.eclipse.magnitude).toBeGreaterThan(0.9);
    });

    it('flattens to hi when requested', () => {
      const all = allBundledEclipses();
      const someYear = all[0]!.date.slice(0, 4);
      const hiDays = getEclipsesForYear(Number(someYear), 'hi')!;
      const names = hiDays.flatMap(d => d.eclipses.map(e => e.name));
      // Hindi names all contain ग्रहण ("grahan").
      expect(names.every(n => n.includes('ग्रहण'))).toBe(true);
    });
  });

  describe('sutak invariants (drik / pandit consensus)', () => {
    it('umbral lunar + all solar eclipses carry sutak; penumbral lunar do not', () => {
      for (const { eclipse } of allBundledEclipses()) {
        expect(eclipse.visibleFromLocation).toBe(true); // bundled table is visible-only (any phase)
        expect(typeof eclipse.visibleAtPeak).toBe('boolean');
        if (eclipse.kind === 'lunar' && eclipse.subtype === 'penumbral') {
          expect(eclipse.sutak, `penumbral on ${eclipse.peak}`).toBeUndefined();
        } else {
          expect(eclipse.sutak, `${eclipse.kind}/${eclipse.subtype} on ${eclipse.peak}`).toBeDefined();
          // Sutak ends at the eclipse end (moksha) and starts before it begins.
          expect(eclipse.sutak!.end).toBe(eclipse.end);
          expect(new Date(eclipse.sutak!.start).getTime())
            .toBeLessThan(new Date(eclipse.start).getTime());
        }
      }
    });

    it('orders each eclipse start ≤ peak ≤ end', () => {
      for (const { eclipse } of allBundledEclipses()) {
        const s = new Date(eclipse.start).getTime();
        const p = new Date(eclipse.peak).getTime();
        const e = new Date(eclipse.end).getTime();
        expect(s).toBeLessThanOrEqual(p);
        expect(p).toBeLessThanOrEqual(e);
      }
    });
  });

  describe('getEclipsesForDate', () => {
    const sample = allBundledEclipses()[0]!;

    it('accepts ISO YYYY-MM-DD strings', () => {
      const got = getEclipsesForDate(sample.date);
      expect(got.some(e => e.peak === sample.eclipse.peak)).toBe(true);
    });

    it('accepts Date objects and converts via the table timezone (IST)', () => {
      // Noon IST on the eclipse's local date — unambiguous in IST.
      const noonIst = new Date(`${sample.date}T06:30:00Z`);
      const got = getEclipsesForDate(noonIst);
      expect(got.some(e => e.peak === sample.eclipse.peak)).toBe(true);
    });

    it('returns hi names when lang=hi', () => {
      const got = getEclipsesForDate(sample.date, 'hi');
      expect(got.every(e => e.name.includes('ग्रहण'))).toBe(true);
    });

    it('returns [] for dates with no eclipse and out-of-range dates', () => {
      expect(getEclipsesForDate(`${ECLIPSES_YEAR_RANGE.start - 5}-01-01`)).toEqual([]);
      // A date guaranteed to have no eclipse (eclipses never fall on consecutive days).
      const dayAfter = new Date(`${sample.date}T00:00:00Z`);
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
      const key = dayAfter.toISOString().slice(0, 10);
      if (key.slice(0, 4) === sample.date.slice(0, 4)) {
        expect(getEclipsesForDate(key)).toEqual([]);
      }
    });
  });

  describe('parity with live getEclipsesInRange for Varanasi', () => {
    it('matches the live visible-only computation (kind/subtype per date)', () => {
      // Recompute a year that the bundled table shows has eclipses.
      const sampleYear = Number(allBundledEclipses()[0]!.date.slice(0, 4));
      const live = getEclipsesInRange(
        new Date(Date.UTC(sampleYear, 0, 1)),
        new Date(Date.UTC(sampleYear, 11, 31, 23, 59, 59, 999)),
        VARANASI,
      ).filter(e => isEclipseVisibleAnyPhase(e, VARANASI));

      const liveKeys = live.map(e => `${toIstKey(e.peak)}|${e.kind}|${e.subtype}`).sort();
      const tableKeys = getEclipsesForYear(sampleYear)!
        .flatMap(d => d.eclipses.map(e => `${d.date}|${e.kind}|${e.subtype}`))
        .sort();
      expect(tableKeys).toEqual(liveKeys);
    });
  });
});

describe('buildEclipsesTable (location-specific, runtime)', () => {
  // 2025–2027 against Varanasi: a fixed span (independent of the rolling
  // bundled window) known to hold both a total lunar (2025, with sutak) and
  // penumbral lunars (2027, no sutak). en only — keeps this fast.
  const built = buildEclipsesTable({
    location: VARANASI,
    timezoneOffsetMinutes: IST_OFFSET,
    startYear: 2025,
    endYear: 2027,
    languages: ['en'],
    referenceLocation: 'Varanasi',
    note: 'test',
  });

  it('stamps the requested location / timezone / visibleOnly default into _meta', () => {
    expect(built._meta.referenceLocation).toBe('Varanasi');
    expect(built._meta.timezoneOffsetMinutes).toBe(IST_OFFSET);
    expect(built._meta.visibleOnly).toBe(true);
    expect(built._meta.startYear).toBe(2025);
    expect(built._meta.endYear).toBe(2027);
  });

  it('produces the 2025-09-07 total lunar eclipse with a sutak window', () => {
    const days = getEclipsesForYear(2025, 'en', built);
    expect(days).not.toBeNull();
    const total = days!.flatMap(d => d.eclipses).find(e => e.subtype === 'total');
    expect(total).toBeDefined();
    expect(total!.kind).toBe('lunar');
    expect(total!.peak.slice(0, 10)).toBe('2025-09-07');
    expect(total!.sutak).toBeDefined();
  });

  it('emits penumbral lunar eclipses (2027) without sutak', () => {
    const penumbral = getEclipsesForYear(2027, 'en', built)!
      .flatMap(d => d.eclipses)
      .filter(e => e.subtype === 'penumbral');
    expect(penumbral.length).toBeGreaterThan(0);
    expect(penumbral.every(e => e.sutak === undefined)).toBe(true);
  });

  it('includes the 2026-03-03 total lunar via the any-phase rule (peak below horizon)', () => {
    // From Varanasi the Moon rises already eclipsed: greatest eclipse is below
    // the horizon, but the closing phases are visible — so it is listed, with
    // visibleAtPeak=false, and (being umbral) still carries sutak.
    const e2026 = getEclipsesForYear(2026, 'en', built)!
      .flatMap(d => d.eclipses)
      .find(e => e.peak.slice(0, 10) === '2026-03-03');
    expect(e2026).toBeDefined();
    expect(e2026!.kind).toBe('lunar');
    expect(e2026!.visibleFromLocation).toBe(true); // any phase visible
    expect(e2026!.visibleAtPeak).toBe(false);      // peak below horizon
    expect(e2026!.sutak).toBeDefined();            // umbral → sutak applies
  });

  it('matches live getEclipsesInRange for the same location/span', () => {
    const live = getEclipsesInRange(
      new Date(Date.UTC(2025, 0, 1)),
      new Date(Date.UTC(2027, 11, 31, 23, 59, 59, 999)),
      VARANASI,
    ).filter(e => isEclipseVisibleAnyPhase(e, VARANASI));
    const liveKeys = live.map(e => `${toIstKey(e.peak)}|${e.kind}|${e.subtype}`).sort();
    const tableKeys: string[] = [];
    for (let y = 2025; y <= 2027; y++) {
      for (const d of getEclipsesForYear(y, 'en', built)!) {
        for (const e of d.eclipses) tableKeys.push(`${d.date}|${e.kind}|${e.subtype}`);
      }
    }
    expect(tableKeys.sort()).toEqual(liveKeys);
  });

  it('visibleOnly:false includes at least as many eclipses as the default', () => {
    const all = buildEclipsesTable({
      location: VARANASI,
      timezoneOffsetMinutes: IST_OFFSET,
      startYear: 2025,
      endYear: 2027,
      languages: ['en'],
      visibleOnly: false,
    });
    const count = (f: typeof built) =>
      Object.values(f.years).reduce((s, d) => s + d.reduce((s2, x) => s2 + x.eclipses.length, 0), 0);
    expect(built._meta.visibleOnly).toBe(true);
    expect(all._meta.visibleOnly).toBe(false);
    expect(count(all)).toBeGreaterThanOrEqual(count(built));
  });

  it('falls back gracefully when a missing locale is requested', () => {
    // built only has 'en'; asking for 'hi' should yield the en string.
    const days = getEclipsesForYear(2025, 'hi', built)!;
    const total = days.flatMap(d => d.eclipses).find(e => e.subtype === 'total');
    expect(total).toBeDefined();
    expect(total!.name).toBe('Total Lunar Eclipse'); // en fallback
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
