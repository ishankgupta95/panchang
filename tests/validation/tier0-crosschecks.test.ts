/**
 * @tier 0  IAU constants and closure identities — no fixture at all
 *
 * ## Fixture-free cross-checks (PLAN.md §36.0 G)
 *
 * Signals that catch whole classes of ephemeris error **without any pinned
 * value**. That is what makes them worth more than their line count: they
 * cannot be quietly re-pinned when they fail, because there is nothing to
 * re-pin. Each one either holds or has found a bug.
 *
 * They also survive the 36.2–36.5 rewrite untouched. Every assertion here is a
 * statement about the solar system, not about `astronomy-engine` — so an own
 * ephemeris that breaks one is wrong, full stop, no adjudication needed.
 *
 * Four families, per §36.0 G:
 *
 * | family | catches |
 * |---|---|
 * | solver vs ephemeris separation | a bad root-finder masquerading as a bad ephemeris |
 * | mean-motion round-trip | a series with the wrong secular rate — the error that grows without bound |
 * | closure identities | a theory that is wrong in a *structural* way (missed or duplicated events) |
 * | monotonicity / ordering | sign errors and frame mix-ups, which break order long before they break magnitude |
 *
 * ΔT — the fourth item in §36.0 G — is isolated in `tier0-deltat.test.ts`,
 * because it needs Tier 0 ground truth rather than an internal identity.
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
import { VARJYAM_OFFSET_GHATIKAS } from '../../src/utils/constants';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const TZ = 330;
const DAY_MS = 86_400_000;

// ── 1. Mean-motion round-trip ───────────────────────────────────────────────
//
// The derivative of a longitude series must reproduce the body's known mean
// motion. This is the check that catches a wrong secular term — the one class
// of error that is invisible near the fit epoch and unbounded away from it,
// and so exactly the class a spot-check against 2025 would miss.

describe('§36.0 G — mean-motion round-trip', () => {
  /**
   * Sidereal month 27.321662 d → 13.176358°/day sidereal; tropical motion adds
   * general precession (50.29″/yr = 0.0000382°/day). Tropical year 365.24219 d
   * → 0.985647°/day. Both are IAU values, independent of any ephemeris.
   *
   * ## Why this is a least-squares fit and not two endpoints
   *
   * The obvious version — longitude at the end minus longitude at the start,
   * over the span — does not work for the Moon, and failing to notice would
   * have produced a test that passes only by having a loose enough tolerance to
   * be worthless. The Moon's longitude carries periodic terms up to ±6.3°
   * (the equation of the centre), which cancel only across a whole number of
   * anomalistic months. Over an arbitrary 40-year baseline they leave up to
   * 12.6° of residual, i.e. 0.00086°/day — measured 0.00075, right in that
   * band, and 150× the secular signal a wrong rate would need to show.
   *
   * A least-squares slope over many samples averages the periodic terms away
   * instead: they are zero-mean, so the slope uncertainty falls as 1/√N. With
   * 2,000 samples over two centuries it is ~7 × 10⁻⁶ °/day, which is what makes
   * a 10⁻⁵ tolerance meaningful.
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
      // Unwrap onto a continuous curve using the approximate known rate. Safe
      // while the accumulated model error stays below half a revolution, which
      // it does by many orders of magnitude.
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

  it("the Moon's mean motion over 1900–2100 is 13.176396°/day (tropical)", () => {
    const EXPECTED = 13.176358 + 0.0000382;
    const rate = secularRate(getTropicalMoonLongitude, EXPECTED, '1900-01-01T00:00:00Z', 73048, 2000);
    expect(rate).toBeCloseTo(EXPECTED, 5);
  });

  it("the Sun's mean motion over 1900–2100 is 0.985647°/day (tropical)", () => {
    const EXPECTED = 360 / 365.24219;
    const rate = secularRate(getTropicalSunLongitude, EXPECTED, '1900-01-01T00:00:00Z', 73048, 2000);
    expect(rate).toBeCloseTo(EXPECTED, 6);
  });
});

// ── 2. Closure identities ───────────────────────────────────────────────────

describe('§36.0 G — closure identities', () => {
  /**
   * A lunation contains exactly 30 tithis, by definition: a tithi is 12° of
   * Moon − Sun elongation and a lunation is 360° of it. If the series is wrong
   * in a structural way — a term with the wrong sign, a frame mix-up — the
   * count breaks loudly, long before any individual time is checkable.
   */
  it('every lunation contains exactly 30 tithis', () => {
    const cache = new LongitudeCache('lahiri', 'interpolated');
    const getMoon = (d: Date) => cache.getMoon(d);
    const getSun = (d: Date) => cache.getSun(d);
    const idx = (d: Date) => getTithiIndexAtTime(d, getMoon, getSun);

    // Six consecutive lunations, sampled finely enough that no tithi (min ~19 h)
    // can be stepped over.
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
    // 6 lunations × 30 tithis, ±1 for the partial tithi at each end.
    expect(transitions).toBeGreaterThanOrEqual(6 * 30 - 1);
    expect(transitions).toBeLessThanOrEqual(6 * 30 + 1);
  });

  /**
   * 27 nakshatras per sidereal month. Unlike the tithi check this one carries
   * the ayanamsa (once), so it also catches a precession term with the wrong
   * rate — the count would drift over a long enough baseline.
   */
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
      // Consecutive sankrantis are 29–32 days apart (the Sun's speed varies
      // with Earth's orbital eccentricity); the twelve span a sidereal year.
      for (let i = 1; i < s.length; i++) {
        const gapDays = (s[i]!.date.getTime() - s[i - 1]!.date.getTime()) / DAY_MS;
        expect(gapDays, `${year} sankranti gap ${i}`).toBeGreaterThan(28);
        expect(gapDays, `${year} sankranti gap ${i}`).toBeLessThan(33);
      }
    }
  });

  it('a year contains 12–13 of each moon phase, ~49 in total', () => {
    for (const year of [1950, 2025, 2099]) {
      const phases = computeMoonPhasesForYear(year, { timezone: TZ });
      const counts = { new: 0, first_quarter: 0, full: 0, last_quarter: 0 } as Record<string, number>;
      for (const p of phases) counts[p.phase] = (counts[p.phase] ?? 0) + 1;
      for (const [name, n] of Object.entries(counts)) {
        expect(n, `${name} in ${year}`).toBeGreaterThanOrEqual(12);
        expect(n, `${name} in ${year}`).toBeLessThanOrEqual(14);
      }
      // 365.2422 / 29.530589 = 12.37 lunations, ×4 phases.
      expect(phases.length, `phases in ${year}`).toBeGreaterThanOrEqual(48);
      expect(phases.length, `phases in ${year}`).toBeLessThanOrEqual(51);
    }
  });
});

// ── 3. Solver vs ephemeris separation ───────────────────────────────────────

describe('§36.0 G — solver vs ephemeris separation', () => {
  /**
   * Bounds the *solver's* contribution independently of the ephemeris, so that
   * when a published time moves it is known which half moved.
   *
   * Each reported tithi end-time is re-derived by exact bisection of the very
   * same index function the panchang searched. Any disagreement is the secant
   * solver's error alone — the ephemeris cancels, because both sides read it.
   */
  it('reported tithi end-times match an exact bisection of the same index function', () => {
    const TOL_MS = 30_000;
    let worst = 0;
    let checked = 0;

    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2025, 5, 1) + d * DAY_MS);
      const r = getDailyPanchang(date, PUNE, { timezone: TZ })!;

      // A fresh cache, so the bisection is not reading the panchang's memo.
      const cache = new LongitudeCache('lahiri', 'interpolated');
      const idx = (t: Date) => getTithiIndexAtTime(t, (x) => cache.getMoon(x), (x) => cache.getSun(x));

      for (const tithi of r.angas.tithis) {
        const end = tithi.endTime;
        if (end === null) continue;
        // The transition must lie in (end − 1 h, end + 1 h); bisect it there.
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

    expect(checked, 'no tithi end-times were checkable — the test went vacuous')
      .toBeGreaterThan(25);
    // Measured 2026-08-06: worst 24 ms across this sweep. The bound is the
    // solver's budget, not the observation — it exists so a solver regression
    // is attributed to the solver rather than blamed on a new ephemeris.
    expect(worst, `worst solver-vs-bisection disagreement ${worst} ms`)
      .toBeLessThan(TOL_MS);
  });

  /**
   * The same separation, for the three derived windows that used to have their
   * own answer to it.
   *
   * Varjyam, Bhadra and Panchaka Rahita each carried a private bisection that
   * stopped at a **30-second** tolerance and returned the upper bracket, so
   * every window they published sat on a 30 s grid — 1,200× coarser than the
   * element end-times above, in the same result object. Phase 36.2 measured the
   * consequence: those windows moved 15.8–26.4 s whenever the ephemeris moved
   * 6.4 s, and all of the amplification was the tolerance.
   *
   * They now route through `solveElementBoundary` / `solveAngleCrossing`, which
   * is the same secant the tithi check above measures. This holds them to the
   * same budget, so the two can never drift apart again without a failure.
   *
   * Bhadra's boundaries are karana boundaries and Panchaka Rahita's are the Moon
   * reaching 300° or 360°, so both are bisectable directly. Varjyam's are not —
   * its window is an interpolated *fraction* of the active nakshatra — so the
   * nakshatra it was built from is recovered arithmetically first: the window is
   * 4 ghatikas wide out of 60, so the nakshatra's duration is exactly fifteen
   * times the window's.
   */
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
       * Exact bisection of an index function around `near`.
       *
       * Returns `null` unless `near` is genuinely a crossing. Not every edge of
       * these windows is one: Panchaka Rahita emits a whole-day slice running
       * sunrise → nextSunrise when the Moon never leaves its range, and Bhadra
       * clamps to its search bounds in the degenerate branch. Bisecting around
       * those finds some *other* boundary hours away and reports it as error —
       * which is what a first draft of this test did, at 741 s.
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

      const varjyam = r.inauspicious.varjyam;
      if (varjyam) {
        // Window = 4 of the nakshatra's 60 ghatikas, so duration = 15 × width.
        const duration = (varjyam.end.getTime() - varjyam.start.getTime()) * 15;
        const offset = VARJYAM_OFFSET_GHATIKAS[
          getNakshatraIndexAtTime(r.sun.rise, moonAt)
        ];
        if (offset !== undefined) {
          const nakStart = varjyam.start.getTime() - (offset / 60) * duration;
          const exact = bisect(nakStart, nakshatraIdx);
          if (exact !== null && Math.abs(exact - nakStart) < 3600_000) {
            worstVarjyam = Math.max(worstVarjyam, Math.abs(exact - nakStart));
            checked++;
          }
        }
      }
    }

    expect(checked, 'no derived windows were checkable — the test went vacuous')
      .toBeGreaterThan(20);
    expect(worstBhadra, `Bhadra worst ${worstBhadra} ms`).toBeLessThan(TOL_MS);
    expect(worstPanchaka, `Panchaka Rahita worst ${worstPanchaka} ms`).toBeLessThan(TOL_MS);
    expect(worstVarjyam, `Varjyam's recovered nakshatra start worst ${worstVarjyam} ms`)
      .toBeLessThan(TOL_MS);
  });
});

// ── 4. Ordering and monotonicity ────────────────────────────────────────────

describe('§36.0 G — ordering invariants', () => {
  /**
   * Sign errors and frame mix-ups break *order* long before they break
   * magnitude by enough to trip a tolerance. These hold at every latitude and
   * every epoch, and none of them contains a number that came out of this
   * library.
   */
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
          // Day + night must reconstruct the Hindu day. Each is independently
          // rounded to whole minutes, so the sum can sit up to 1 minute off the
          // exact span — a 0.5 tolerance here fails legitimately, at 1441 vs
          // 1440.212.
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
      // Brahma Muhurta and Pratah Sandhya legitimately begin before sunrise.
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
      // Quarter-to-quarter is a quarter lunation: 6.1–8.4 days.
      const gapDays = (phases[i]!.time.getTime() - phases[i - 1]!.time.getTime()) / DAY_MS;
      expect(gapDays).toBeGreaterThan(6.0);
      expect(gapDays).toBeLessThan(8.5);
    }
  });
});
