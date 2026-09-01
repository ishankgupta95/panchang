import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Panchaka Rahita / Do Ghati wiring: fields present', () => {
  const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

  it('result is non-null and both fields exist', () => {
    expect(r).not.toBeNull();
    expect(Array.isArray(r.inauspicious.panchakaRahita)).toBe(true);
    expect(r.muhurtas.doGhati).toBeDefined();
    expect(Array.isArray(r.muhurtas.doGhati.day)).toBe(true);
    expect(Array.isArray(r.muhurtas.doGhati.night)).toBe(true);
  });

  it('Do Ghati has 15 day + 15 night slots', () => {
    expect(r.muhurtas.doGhati.day).toHaveLength(15);
    expect(r.muhurtas.doGhati.night).toHaveLength(15);
  });

  it('Panchaka Rahita slices are well-formed (start < end, within Hindu day)', () => {
    for (const tp of r.inauspicious.panchakaRahita) {
      expect(tp.start.getTime()).toBeLessThan(tp.end.getTime());
      expect(tp.start.getTime()).toBeGreaterThanOrEqual(r.sun.rise.getTime() - 1000);
      expect(tp.end.getTime()).toBeLessThanOrEqual(r.sun.nextRise.getTime() + 1000);
    }
  });
});

describe('Do Ghati wiring: slot durations sum to dayDuration / nightDuration', () => {
  const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

  it('day slot durations sum to dayDurationMs (within rounding)', () => {
    const dayMs = r.sun.set.getTime() - r.sun.rise.getTime();
    const sum = r.muhurtas.doGhati.day.reduce(
      (acc, s) => acc + (s.end.getTime() - s.start.getTime()),
      0,
    );
    expect(Math.abs(sum - dayMs)).toBeLessThan(15);
  });

  it('night slot durations sum to nightDurationMs (within rounding)', () => {
    const nightMs = r.sun.nextRise.getTime() - r.sun.set.getTime();
    const sum = r.muhurtas.doGhati.night.reduce(
      (acc, s) => acc + (s.end.getTime() - s.start.getTime()),
      0,
    );
    expect(Math.abs(sum - nightMs)).toBeLessThan(15);
  });

  it('day[0].start == sunrise and day[14].end == sunset', () => {
    expect(r.muhurtas.doGhati.day[0]!.start.getTime()).toBe(r.sun.rise.getTime());
    expect(r.muhurtas.doGhati.day[14]!.end.getTime()).toBe(r.sun.set.getTime());
  });

  it('night[0].start == sunset and night[14].end == nextSunrise', () => {
    expect(r.muhurtas.doGhati.night[0]!.start.getTime()).toBe(r.sun.set.getTime());
    expect(r.muhurtas.doGhati.night[14]!.end.getTime()).toBe(r.sun.nextRise.getTime());
  });
});

describe('Do Ghati wiring: reference-almanac cross-check', () => {
  it('Delhi 2025-01-14: Rudra 07:15-07:57, Mitra 08:39-09:21, Ishwara start 17:46', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 })!;

    const localHHMM = (local: string) => {
      const [h, m] = local.slice(11, 16).split(':').map(Number) as [number, number];
      return h * 60 + m;
    };
    const expectMinsClose = (actualLocal: string, expectedHM: [number, number]) => {
      const actualMin = localHHMM(actualLocal);
      const expectedMin = expectedHM[0] * 60 + expectedHM[1];
      expect(Math.abs(actualMin - expectedMin)).toBeLessThanOrEqual(2);
    };

    expectMinsClose(r.muhurtas.doGhati.day[0]!.startLocal, [7, 15]);
    expectMinsClose(r.muhurtas.doGhati.day[0]!.endLocal, [7, 57]);
    expectMinsClose(r.muhurtas.doGhati.day[2]!.startLocal, [8, 39]);
    expectMinsClose(r.muhurtas.doGhati.day[2]!.endLocal, [9, 21]);
    expectMinsClose(r.muhurtas.doGhati.night[0]!.startLocal, [17, 46]);
  });
});

describe('Do Ghati wiring: Hindi localization', () => {
  it('renders Devanagari muhurta names when language: "hi"', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, {
      timezone: 330,
      language: 'hi',
    })!;
    const devanagari = /[ऀ-ॿ]/;
    expect(r.muhurtas.doGhati.day[0]!.name).toMatch(devanagari);
    expect(r.muhurtas.doGhati.night[0]!.name).toMatch(devanagari);
    expect(r.muhurtas.doGhati.day[0]!.name).toBe('रुद्र');
    expect(r.muhurtas.doGhati.night[0]!.name).toBe('ईश्वर');
  });

  it('localizes quality name to Hindi (शुभ / अशुभ)', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, {
      timezone: 330,
      language: 'hi',
    })!;
    for (const slot of [...r.muhurtas.doGhati.day, ...r.muhurtas.doGhati.night]) {
      expect(['शुभ', 'अशुभ', 'सामान्य']).toContain(slot.qualityName);
    }
  });
});

describe('Panchaka Rahita / Do Ghati: multi-day Delhi sweep', () => {
  const cases: Array<{ panchakaRahitaCount: 0 | 1; transitionDay: boolean }> = [];

  for (let day = 0; day < 90; day++) {
    const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
    const r = getDailyPanchang(date, DELHI, { timezone: 330 });
    if (!r) continue;

    expect(r.muhurtas.doGhati.day).toHaveLength(15);
    expect(r.muhurtas.doGhati.night).toHaveLength(15);

    expect(r.inauspicious.panchakaRahita.length).toBeLessThanOrEqual(1);

    const slice = r.inauspicious.panchakaRahita[0];
    const isFullDay =
      slice !== undefined &&
      slice.start.getTime() === r.sun.rise.getTime() &&
      slice.end.getTime() === r.sun.nextRise.getTime();
    const transitionDay = slice !== undefined && !isFullDay;

    cases.push({ panchakaRahitaCount: r.inauspicious.panchakaRahita.length as 0 | 1, transitionDay });
  }

  it('a 90-day sweep includes both empty and non-empty Panchaka Rahita days', () => {
    const empty = cases.filter(c => c.panchakaRahitaCount === 0).length;
    const nonEmpty = cases.filter(c => c.panchakaRahitaCount === 1).length;
    expect(empty).toBeGreaterThan(5);
    expect(nonEmpty).toBeGreaterThan(60);
  });

  it('a 90-day sweep includes at least a few Panchaka transition days', () => {
    const transitions = cases.filter(c => c.transitionDay).length;
    expect(transitions).toBeGreaterThanOrEqual(4);
  });
});

describe('Panchaka Rahita: cross-check with `panchaka` boolean', () => {
  it('on a "Panchaka all day" candidate, panchakaRahita is [] iff panchaka is true at sunrise AND no transition', () => {
    for (let day = 0; day < 60; day++) {
      const date = new Date(Date.UTC(2025, 5, 1) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      if (r.inauspicious.panchakaRahita.length === 0) {
        expect(r.inauspicious.panchaka).toBe(true);
      }
    }
  });
});
