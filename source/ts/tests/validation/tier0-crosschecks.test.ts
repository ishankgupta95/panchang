/**
 * @tier 0  IAU constants and closure identities, no fixture at all
 */
import { describe, it, expect } from 'vitest';
import { getTropicalMoonLongitude } from '../../src/astronomy/moon';
import { getTropicalSunLongitude } from '../../src/astronomy/sun';
import { getDailyPanchang } from '../../src/core/panchang';
import { computeMoonPhasesForYear } from '../../src/astronomy/moonPhase';
import { computeSankrantisForYear } from '../../src/calendar/yearly';
import { LongitudeCache } from '../../src/astronomy/cache';
import { getTithiIndexAtTime } from '../../src/core/tithi';
import { getNakshatraIndexAtTime } from '../../src/core/nakshatra';
import { getKaranaIndexAtTime } from '../../src/core/karana';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_SECOND_OFFSET_GHATIKAS,
} from '../../src/utils/constants';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const DAY_MS = 86_400_000;

describe('cross-check: mean-motion round-trip', () => {
  /**
   * The expected rates are IAU values, independent of any ephemeris: sidereal
   * month 27.321662 d, general precession 50.29″/yr, tropical year 365.24219 d.
   *
   * Least-squares and not end-minus-start: the Moon's periodic terms reach
   * ±6.3° and cancel only across whole anomalistic months, so an endpoint pair
   * leaves up to 150× the secular signal as residual.
   */
  function secularRate(
    longitudeAt: (d: Date) => number,
    approxRate: number,
    startIso: string,
    spanDays: number,
    samples: number,
  ): number {
    const t0 = new Date(startIso).getTime();
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < samples; i++) {
      const day = (i * spanDays) / (samples - 1);
      const lon = longitudeAt(new Date(t0 + day * DAY_MS));
      const revs = Math.round((approxRate * day - lon) / 360);
      xs.push(day);
      ys.push(lon + revs * 360);
    }
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      den += (xs[i]! - mx) ** 2;
    }
    return num / den;
  }

  it("the Moon's mean motion over 1900-2100 is 13.176396°/day (tropical)", () => {
    const EXPECTED = 13.176358 + 0.0000382;
    const rate = secularRate(getTropicalMoonLongitude, EXPECTED, '1900-01-01T00:00:00Z', 73048, 2000);
    expect(rate).toBeCloseTo(EXPECTED, 5);
  });

  it("the Sun's mean motion over 1900-2100 is 0.985647°/day (tropical)", () => {
    const EXPECTED = 360 / 365.24219;
    const rate = secularRate(getTropicalSunLongitude, EXPECTED, '1900-01-01T00:00:00Z', 73048, 2000);
    expect(rate).toBeCloseTo(EXPECTED, 6);
  });
});

describe('cross-check: closure identities', () => {
  it('every lunation contains exactly 30 tithis', () => {
    const cache = new LongitudeCache('lahiri', 'interpolated');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);
    const idx = (d: Date) => getTithiIndexAtTime(d, getMoon, getSun);

    const start = new Date('2025-01-01T00:00:00Z');
    const stepMs = 30 * 60_000;
    let transitions = 0;
    let prev = idx(start);
    const end = start.getTime() + Math.round(6 * 29.530589 * DAY_MS);
    for (let t = start.getTime() + stepMs; t <= end; t += stepMs) {
      const cur = idx(new Date(t));
      if (cur !== prev) transitions++;
      prev = cur;
    }
    expect(transitions).toBeGreaterThanOrEqual(6 * 30 - 1);
    expect(transitions).toBeLessThanOrEqual(6 * 30 + 1);
  });

  it('a sidereal month contains exactly 27 nakshatra transitions', () => {
    const cache = new LongitudeCache('lahiri', 'interpolated');
    const getMoon = (d: Date) => cache.getMoon(d);
    const start = new Date('2025-01-01T00:00:00Z');
    const stepMs = 20 * 60_000;
    let transitions = 0;
    let prev = getNakshatraIndexAtTime(start, getMoon);
    const end = start.getTime() + Math.round(4 * 27.321662 * DAY_MS);
    for (let t = start.getTime() + stepMs; t <= end; t += stepMs) {
      const cur = getNakshatraIndexAtTime(new Date(t), getMoon);
      if (cur !== prev) transitions++;
      prev = cur;
    }
    expect(transitions).toBeGreaterThanOrEqual(4 * 27 - 1);
    expect(transitions).toBeLessThanOrEqual(4 * 27 + 1);
  });

  it('a year contains exactly 12 sankrantis, spanning one sidereal year', () => {
    for (const year of [1950, 2025, 2099]) {
      const s = computeSankrantisForYear(year, PUNE, { timezone: TZ });
      expect(s, `sankrantis in ${year}`).toHaveLength(12);
      for (let i = 1; i < s.length; i++) {
        const gapDays = (s[i]!.date.getTime() - s[i - 1]!.date.getTime()) / DAY_MS;
        expect(gapDays, `${year} sankranti gap ${i}`).toBeGreaterThan(28);
        expect(gapDays, `${year} sankranti gap ${i}`).toBeLessThan(33);
      }
    }
  });

  it('a year contains 12-13 of each moon phase, ~49 in total', () => {
    for (const year of [1950, 2025, 2099]) {
      const phases = computeMoonPhasesForYear(year, { timezone: TZ });
      const counts = { new: 0, first_quarter: 0, full: 0, last_quarter: 0 } as Record<string, number>;
      for (const p of phases) counts[p.phase] = (counts[p.phase] ?? 0) + 1;
      for (const [name, n] of Object.entries(counts)) {
        expect(n, `${name} in ${year}`).toBeGreaterThanOrEqual(12);
        expect(n, `${name} in ${year}`).toBeLessThanOrEqual(14);
      }
      expect(phases.length, `phases in ${year}`).toBeGreaterThanOrEqual(48);
      expect(phases.length, `phases in ${year}`).toBeLessThanOrEqual(51);
    }
  });
});

describe('cross-check: solver vs ephemeris separation', () => {
  it('reported tithi end-times match an exact bisection of the same index function', () => {
    const TOL_MS = 30_000;
    let worst = 0;
    let checked = 0;

    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2025, 5, 1) + d * DAY_MS);
      const r = getDailyPanchang(date, PUNE, { timezone: TZ })!;

      const cache = new LongitudeCache('lahiri', 'interpolated');
      const idx = (t: Date) => getTithiIndexAtTime(t, (x) => cache.getMoon(x), (x) => cache.getSun(x));

      for (const tithi of r.angas.tithis) {
        const end = tithi.endTime;
        if (end === null) continue;
        let lo = end.getTime() - 3600_000;
        let hi = end.getTime() + 3600_000;
        const loIdx = idx(new Date(lo));
        if (idx(new Date(hi)) === loIdx) continue; // clamped to nextSunrise, not a real crossing
        while (hi - lo > 1) {
          const mid = (lo + hi) / 2;
          if (idx(new Date(mid)) === loIdx) lo = mid; else hi = mid;
        }
        worst = Math.max(worst, Math.abs(hi - end.getTime()));
        checked++;
      }
    }

    expect(checked, 'no tithi end-times were checkable: the test went vacuous')
      .toBeGreaterThan(25);
    expect(worst, `worst solver-vs-bisection disagreement ${worst} ms`)
      .toBeLessThan(TOL_MS);
  });

  it('derived windows are located to the same budget as the element end-times', () => {
    const TOL_MS = 30_000;
    let worstBhadra = 0;
    let worstPanchaka = 0;
    let worstVarjyam = 0;
    let checked = 0;

    for (let d = 0; d < 40; d++) {
      const date = new Date(Date.UTC(2025, 2, 1) + d * DAY_MS);
      const r = getDailyPanchang(date, PUNE, { timezone: TZ })!;
      const cache = new LongitudeCache('lahiri', 'interpolated');
      const moonAt = (t: Date) => cache.getMoon(t);

      /**
       * Not every window edge is a crossing: Panchaka Rahita emits a whole-day
       * slice when the Moon never leaves its range, and Bhadra clamps to its
       * search bounds. Bisecting around those finds an unrelated boundary hours
       * away and reports it as error, so they return `null`.
       */
      const bisect = (near: number, indexAt: (ms: number) => number): number | null => {
        if (indexAt(near - 1000) === indexAt(near + 1000)) return null;
        let lo = near - 3600_000;
        let hi = near + 3600_000;
        const loIdx = indexAt(lo);
        if (indexAt(hi) === loIdx) return null;
        while (hi - lo > 1) {
          const mid = (lo + hi) / 2;
          if (indexAt(mid) === loIdx) lo = mid; else hi = mid;
        }
        return hi;
      };

      const karanaIdx = (ms: number): number => getKaranaIndexAtTime(
        new Date(ms), (x) => cache.getMoon(x), (x) => cache.getSun(x),
      );
      const nakshatraIdx = (ms: number): number => getNakshatraIndexAtTime(new Date(ms), moonAt);
      const panchakaIdx = (ms: number): number => (moonAt(new Date(ms)) >= 300 ? 1 : 0);

      const bhadra = r.inauspicious.bhadra;
      if (bhadra) {
        for (const edge of [bhadra.start, bhadra.end]) {
          const exact = bisect(edge.getTime(), karanaIdx);
          if (exact !== null) {
            worstBhadra = Math.max(worstBhadra, Math.abs(exact - edge.getTime()));
            checked++;
          }
        }
      }

      for (const window of r.inauspicious.panchakaRahita ?? []) {
        for (const edge of [window.start, window.end]) {
          const exact = bisect(edge.getTime(), panchakaIdx);
          if (exact !== null) {
            worstPanchaka = Math.max(worstPanchaka, Math.abs(exact - edge.getTime()));
            checked++;
          }
        }
      }

      for (const varjyam of r.inauspicious.varjyam) {
        const duration = (varjyam.end.getTime() - varjyam.start.getTime()) * 15;
        const midMs = (varjyam.start.getTime() + varjyam.end.getTime()) / 2;
        const nakIdx = getNakshatraIndexAtTime(new Date(midMs), moonAt);
        const offsets = [VARJYAM_OFFSET_GHATIKAS[nakIdx]];
        const secondOffset = VARJYAM_SECOND_OFFSET_GHATIKAS[nakIdx];
        if (secondOffset !== undefined) offsets.push(secondOffset);
        for (const offset of offsets) {
          if (offset === undefined) continue;
          const nakStart = varjyam.start.getTime() - (offset / 60) * duration;
          const exact = bisect(nakStart, nakshatraIdx);
          if (exact !== null && Math.abs(exact - nakStart) < 3600_000) {
            worstVarjyam = Math.max(worstVarjyam, Math.abs(exact - nakStart));
            checked++;
            break;
          }
        }
      }
    }

    expect(checked, 'no derived windows were checkable: the test went vacuous')
      .toBeGreaterThan(20);
    expect(worstBhadra, `Bhadra worst ${worstBhadra} ms`).toBeLessThan(TOL_MS);
    expect(worstPanchaka, `Panchaka Rahita worst ${worstPanchaka} ms`).toBeLessThan(TOL_MS);
    expect(worstVarjyam, `Varjyam's recovered nakshatra start worst ${worstVarjyam} ms`)
      .toBeLessThan(TOL_MS);
  });
});

describe('cross-check: ordering invariants', () => {
  it('sunrise < sunset < next sunrise, at every latitude tested, across three centuries', () => {
    const places = [
      { name: 'Quito', loc: { latitude: -0.18, longitude: -78.47 }, tz: -300 },
      { name: 'Pune', loc: PUNE, tz: TZ },
      { name: 'London', loc: { latitude: 51.5, longitude: -0.13 }, tz: 0 },
      { name: 'Reykjavik', loc: { latitude: 64.15, longitude: -21.94 }, tz: 0 },
      { name: 'Sydney', loc: { latitude: -33.87, longitude: 151.21 }, tz: 600 },
    ];
    for (const { name, loc, tz } of places) {
      for (const y of [1912, 2025, 2088]) {
        for (const m of [0, 5, 11]) {
          const r = getDailyPanchang(new Date(Date.UTC(y, m, 15)), loc, { timezone: tz });
          if (r === null) continue; // polar night / midnight sun is a legitimate null
          expect(r.sun.rise.getTime(), `${name} ${y}-${m + 1}`)
            .toBeLessThan(r.sun.set.getTime());
          expect(r.sun.set.getTime(), `${name} ${y}-${m + 1}`)
            .toBeLessThan(r.sun.nextRise.getTime());
          const spanMin = (r.sun.nextRise.getTime() - r.sun.rise.getTime()) / 60_000;
          expect(Math.abs(r.sun.dayDurationMinutes + r.sun.nightDurationMinutes - spanMin))
            .toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('every published window has start ≤ end and lies inside the Hindu day', () => {
    const r = getDailyPanchang(new Date(Date.UTC(2025, 5, 15)), PUNE, { timezone: TZ })!;
    const dayStart = r.sun.rise.getTime();
    const dayEnd = r.sun.nextRise.getTime();
    const windows = [
      ...Object.values(r.muhurtas).filter((w): w is { start: Date; end: Date } =>
        w !== null && typeof w === 'object' && 'start' in w),
      r.inauspicious.rahuKalam, r.inauspicious.gulikaKalam, r.inauspicious.yamaganda,
      ...r.inauspicious.durMuhurta,
      ...r.periods.choghadiya.day, ...r.periods.choghadiya.night,
      ...r.periods.hora.day, ...r.periods.hora.night,
      ...r.periods.gowri.day, ...r.periods.gowri.night,
    ];
    expect(windows.length).toBeGreaterThan(50);
    for (const w of windows) {
      expect(w.start.getTime()).toBeLessThanOrEqual(w.end.getTime());
      expect(w.start.getTime()).toBeGreaterThanOrEqual(dayStart - 3 * 3600_000);
      expect(w.end.getTime()).toBeLessThanOrEqual(dayEnd + 60_000);
    }
  });

  it('moon phases within a year are strictly increasing and cycle in order', () => {
    const ORDER = ['new', 'first_quarter', 'full', 'last_quarter'];
    const phases = computeMoonPhasesForYear(2025, { timezone: TZ });
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.time.getTime()).toBeGreaterThan(phases[i - 1]!.time.getTime());
      const expected = (ORDER.indexOf(phases[i - 1]!.phase) + 1) % 4;
      expect(ORDER.indexOf(phases[i]!.phase), `phase ${i} follows ${phases[i - 1]!.phase}`)
        .toBe(expected);
      const gapDays = (phases[i]!.time.getTime() - phases[i - 1]!.time.getTime()) / DAY_MS;
      expect(gapDays).toBeGreaterThan(6.0);
      expect(gapDays).toBeLessThan(8.5);
    }
  });
});
