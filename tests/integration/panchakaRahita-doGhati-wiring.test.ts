/**
 * Integration tests — Panchaka Rahita Muhurta + Do Ghati Muhurta wired into
 * getDailyPanchang as `panchakaRahita: TimePeriod[]` and
 * `doGhatiMuhurta: DoGhatiInfo` (Step 28-7).
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Panchaka Rahita / Do Ghati wiring — fields present', () => {
  const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

  it('result is non-null and both fields exist', () => {
    expect(r).not.toBeNull();
    expect(Array.isArray(r.panchakaRahita)).toBe(true);
    expect(r.doGhatiMuhurta).toBeDefined();
    expect(Array.isArray(r.doGhatiMuhurta.day)).toBe(true);
    expect(Array.isArray(r.doGhatiMuhurta.night)).toBe(true);
  });

  it('Do Ghati has 15 day + 15 night slots', () => {
    expect(r.doGhatiMuhurta.day).toHaveLength(15);
    expect(r.doGhatiMuhurta.night).toHaveLength(15);
  });

  it('Panchaka Rahita slices are well-formed (start < end, within Hindu day)', () => {
    for (const tp of r.panchakaRahita) {
      expect(tp.start.getTime()).toBeLessThan(tp.end.getTime());
      expect(tp.start.getTime()).toBeGreaterThanOrEqual(r.sunrise.getTime() - 1000);
      expect(tp.end.getTime()).toBeLessThanOrEqual(r.nextSunrise.getTime() + 1000);
    }
  });
});

describe('Do Ghati wiring — slot durations sum to dayDuration / nightDuration', () => {
  const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

  it('day slot durations sum to dayDurationMs (within rounding)', () => {
    const dayMs = r.sunset.getTime() - r.sunrise.getTime();
    const sum = r.doGhatiMuhurta.day.reduce(
      (acc, s) => acc + (s.end.getTime() - s.start.getTime()),
      0,
    );
    expect(Math.abs(sum - dayMs)).toBeLessThan(15); // ≤ 15 ms float rounding across 15 slots
  });

  it('night slot durations sum to nightDurationMs (within rounding)', () => {
    const nightMs = r.nextSunrise.getTime() - r.sunset.getTime();
    const sum = r.doGhatiMuhurta.night.reduce(
      (acc, s) => acc + (s.end.getTime() - s.start.getTime()),
      0,
    );
    expect(Math.abs(sum - nightMs)).toBeLessThan(15);
  });

  it('day[0].start == sunrise and day[14].end == sunset', () => {
    expect(r.doGhatiMuhurta.day[0]!.start.getTime()).toBe(r.sunrise.getTime());
    expect(r.doGhatiMuhurta.day[14]!.end.getTime()).toBe(r.sunset.getTime());
  });

  it('night[0].start == sunset and night[14].end == nextSunrise', () => {
    expect(r.doGhatiMuhurta.night[0]!.start.getTime()).toBe(r.sunset.getTime());
    expect(r.doGhatiMuhurta.night[14]!.end.getTime()).toBe(r.nextSunrise.getTime());
  });
});

describe('Do Ghati wiring — DrikPanchang cross-check', () => {
  // Reference values from drikpanchang.com/muhurat/daily/do-ghati-muhurat.html
  // for January 14, 2025 (Delhi). Tolerance ±2 min absorbs sunrise model
  // differences (DP rounds to whole minute; we compute true sub-minute).
  it('Delhi 2025-01-14: Rudra 07:15–07:57, Mitra 08:39–09:21, Ishwara start 17:46', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

    const localHHMM = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
    const expectMinsClose = (actualMs: number, expectedHM: [number, number]) => {
      const actualMin = localHHMM(new Date(actualMs));
      const expectedMin = expectedHM[0] * 60 + expectedHM[1];
      expect(Math.abs(actualMin - expectedMin)).toBeLessThanOrEqual(2);
    };

    expectMinsClose(r.doGhatiMuhurta.day[0]!.start.getTime(), [7, 15]);
    expectMinsClose(r.doGhatiMuhurta.day[0]!.end.getTime(), [7, 57]);
    expectMinsClose(r.doGhatiMuhurta.day[2]!.start.getTime(), [8, 39]);
    expectMinsClose(r.doGhatiMuhurta.day[2]!.end.getTime(), [9, 21]);
    expectMinsClose(r.doGhatiMuhurta.night[0]!.start.getTime(), [17, 46]);
  });
});

describe('Do Ghati wiring — Hindi localization', () => {
  it('renders Devanagari muhurta names when language: "hi"', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, {
      timezone: 330,
      language: 'hi',
    })!;
    // Devanagari range: U+0900–U+097F.
    const devanagari = /[ऀ-ॿ]/;
    expect(r.doGhatiMuhurta.day[0]!.name).toMatch(devanagari);
    expect(r.doGhatiMuhurta.night[0]!.name).toMatch(devanagari);
    // Specific check: Rudra → रुद्र.
    expect(r.doGhatiMuhurta.day[0]!.name).toBe('रुद्र');
    expect(r.doGhatiMuhurta.night[0]!.name).toBe('ईश्वर');
  });

  it('localizes quality name to Hindi (शुभ / अशुभ)', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, {
      timezone: 330,
      language: 'hi',
    })!;
    for (const slot of [...r.doGhatiMuhurta.day, ...r.doGhatiMuhurta.night]) {
      expect(['शुभ', 'अशुभ', 'सामान्य']).toContain(slot.qualityName);
    }
  });
});

describe('Panchaka Rahita / Do Ghati — multi-day Delhi sweep', () => {
  // Run a 90-day sweep to exercise: (1) all branches of Panchaka Rahita
  // (full-day-free, full-day-Panchaka, mid-day transition); (2) every Do
  // Ghati path stays well-formed.
  const cases: Array<{ panchakaRahitaCount: 0 | 1; transitionDay: boolean }> = [];

  for (let day = 0; day < 90; day++) {
    const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
    const r = getDailyPanchang(date, DELHI, { timezone: 330 });
    if (!r) continue;

    // Always 15 + 15 slots.
    expect(r.doGhatiMuhurta.day).toHaveLength(15);
    expect(r.doGhatiMuhurta.night).toHaveLength(15);

    // Panchaka Rahita is at most 1 slice per day (proved in unit tests).
    expect(r.panchakaRahita.length).toBeLessThanOrEqual(1);

    const slice = r.panchakaRahita[0];
    const isFullDay =
      slice !== undefined &&
      slice.start.getTime() === r.sunrise.getTime() &&
      slice.end.getTime() === r.nextSunrise.getTime();
    const transitionDay = slice !== undefined && !isFullDay;

    cases.push({ panchakaRahitaCount: r.panchakaRahita.length as 0 | 1, transitionDay });
  }

  it('a 90-day sweep includes both empty and non-empty Panchaka Rahita days', () => {
    const empty = cases.filter(c => c.panchakaRahitaCount === 0).length;
    const nonEmpty = cases.filter(c => c.panchakaRahitaCount === 1).length;
    // Panchaka spans ~5 of every ~28 days, so a 90-day window has roughly
    // 16 Panchaka days and 74 free days. Assert non-trivial floors only.
    expect(empty).toBeGreaterThan(5);
    expect(nonEmpty).toBeGreaterThan(60);
  });

  it('a 90-day sweep includes at least a few Panchaka transition days', () => {
    // Two transitions per ~28-day cycle → ≥ 4 transition days in 90 days.
    const transitions = cases.filter(c => c.transitionDay).length;
    expect(transitions).toBeGreaterThanOrEqual(4);
  });
});

describe('Panchaka Rahita — cross-check with `panchaka` boolean', () => {
  it('on a "Panchaka all day" candidate, panchakaRahita is [] iff panchaka is true at sunrise AND no transition', () => {
    // Panchaka boolean is sampled at sunrise. When Panchaka covers the
    // entire 24h Hindu day with no boundary crossing, panchakaRahita is
    // empty. We check the implication on the empty days only — non-empty
    // days don't constrain the sunrise boolean (a transition can flip it).
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2025, 5, 1) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      if (r.panchakaRahita.length === 0) {
        expect(r.panchaka).toBe(true);
      }
    }
  });
});
