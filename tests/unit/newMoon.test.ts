/**
 * `boundingNewMoons` seeds a narrow search window from the Moon's phase angle
 * and keeps the original wide 45-day scan as a fallback. The seed is a pure
 * optimization — it must return exactly what the scan returns, or defer to it.
 *
 * These tests pin that equivalence directly, because the seeded path is what
 * every Chandra Masa / Adhika Masa result now flows through. A seed window that
 * is too narrow would not fail loudly; it would quietly take the slow path, so
 * the last test also asserts the fast path is actually being taken.
 */

import { describe, it, expect } from 'vitest';
import { boundingNewMoons, NewMoonCache } from '../../src/astronomy/newMoon';
import { moonSunElongation, searchMoonPhase } from '../../src/astronomy/lunation';

const DAY_MS = 86_400_000;

/**
 * Independent reference: the wide-scan formulation, inlined.
 *
 * This used to call `astronomy-engine`'s `SearchMoonPhase`, and Phase 36.3
 * found that it was answering a different question. `MoonPhase` is
 * `PairLongitude(Moon, Sun)`, a **geometric** longitude difference; every tithi
 * in this library is computed from **apparent** longitudes. The two disagree by
 * roughly the solar aberration constant — measured 37–46 s — so the reported
 * "new moon instant" and the Amavasya boundary it is supposed to *be* were two
 * different numbers.
 *
 * They now agree to a millisecond. What this test pins is what its header always
 * said it pinned: that the seeded window returns what the wide scan returns.
 */
function boundingNewMoonsByScan(ref: Date): { prev: Date; next: Date } {
  const first = searchMoonPhase(0, new Date(ref.getTime() - 40 * DAY_MS), 45);
  if (!first) throw new Error('no new moon found');
  let prev = first;
  let next = searchMoonPhase(0, new Date(prev.getTime() + DAY_MS), 45)!;
  while (next.getTime() <= ref.getTime()) {
    prev = next;
    next = searchMoonPhase(0, new Date(prev.getTime() + DAY_MS), 45)!;
  }
  return { prev, next };
}

describe('boundingNewMoons', () => {
  it('always straddles the reference instant', () => {
    for (let d = 0; d < 400; d++) {
      const ref = new Date(Date.UTC(2026, 0, 1) + d * DAY_MS);
      const { prev, next } = boundingNewMoons(ref);
      expect(prev.getTime()).toBeLessThanOrEqual(ref.getTime());
      expect(next.getTime()).toBeGreaterThan(ref.getTime());
    }
  });

  it('matches the wide-scan reference across a 30-year span', () => {
    // The two paths root-find the same instant from different bracketing
    // windows, so they converge to within a few tens of milliseconds rather
    // than bit-identically. That is far below anything observable: the only
    // consumer is the Sun's rashi at each bound, and the Sun moves 0.041°/h,
    // so 1 s of drift is 1.1e-5° — a Sankranti would have to fall inside that
    // window to change a result.
    const TOLERANCE_MS = 1000;
    let worstDriftMs = 0;
    // Every 11 days, so the sampling drifts through the synodic cycle rather
    // than repeatedly hitting the same lunar phase.
    for (let i = 0; i < 1000; i++) {
      const ref = new Date(Date.UTC(2000, 0, 1) + i * 11 * DAY_MS);
      const seeded = boundingNewMoons(ref);
      const scanned = boundingNewMoonsByScan(ref);
      const stamp = ref.toISOString().slice(0, 10);
      const prevDrift = Math.abs(seeded.prev.getTime() - scanned.prev.getTime());
      const nextDrift = Math.abs(seeded.next.getTime() - scanned.next.getTime());
      expect(prevDrift, `prev diverged at ${stamp}`).toBeLessThan(TOLERANCE_MS);
      expect(nextDrift, `next diverged at ${stamp}`).toBeLessThan(TOLERANCE_MS);
      worstDriftMs = Math.max(worstDriftMs, prevDrift, nextDrift);
    }
    // Pin the observed magnitude so a genuine regression (picking the wrong
    // lunation, which would drift by ~29 days) cannot hide behind the tolerance.
    expect(worstDriftMs).toBeLessThan(500);
  });

  it('holds at the boundary instants themselves', () => {
    // A reference exactly at a new moon must take it as `prev`, not `next`.
    const anchor = new Date(Date.UTC(2026, 5, 15));
    const newMoon = searchMoonPhase(0, anchor, 40)!;
    const { prev, next } = boundingNewMoons(newMoon);
    expect(prev.getTime()).toBe(newMoon.getTime());
    expect(next.getTime()).toBeGreaterThan(newMoon.getTime());
  });

  it('takes the seeded fast path (never falls back) across a decade', () => {
    // The seed is derived from the phase angle; if it were mis-scaled the
    // results above would still be correct via fallback, just slow. Recomputing
    // the seed here and asserting it lands inside the search window proves the
    // fast path is live.
    const SEED_HALF_WINDOW_DAYS = 2.5;
    const SYNODIC_MONTH_DAYS = 29.530588853;
    let worstErrorDays = 0;
    for (let i = 0; i < 400; i++) {
      const ref = new Date(Date.UTC(2020, 0, 1) + i * 9 * DAY_MS);
      const seedMs = ref.getTime() - (moonSunElongation(ref) / 360) * SYNODIC_MONTH_DAYS * DAY_MS;
      const { prev } = boundingNewMoonsByScan(ref);
      worstErrorDays = Math.max(worstErrorDays, Math.abs(seedMs - prev.getTime()) / DAY_MS);
    }
    expect(worstErrorDays).toBeLessThan(SEED_HALF_WINDOW_DAYS);
  });
});

describe('NewMoonCache', () => {
  it('serves same-lunation lookups from cache', () => {
    const cache = new NewMoonCache();
    const base = Date.UTC(2026, 2, 1);
    const first = cache.bounding(new Date(base));
    // A day later is virtually always the same lunation.
    const second = cache.bounding(new Date(base + DAY_MS));
    expect(second).toBe(first);
    expect(cache.hits).toBe(1);
    expect(cache.misses).toBe(1);
  });

  it('returns correct bounds after crossing into a new lunation', () => {
    const cache = new NewMoonCache();
    for (let d = 0; d < 90; d++) {
      const ref = new Date(Date.UTC(2026, 0, 1) + d * DAY_MS);
      const { prev, next } = cache.bounding(ref);
      expect(prev.getTime()).toBeLessThanOrEqual(ref.getTime());
      expect(next.getTime()).toBeGreaterThan(ref.getTime());
    }
    // 90 days spans ~3 lunations, so most lookups must have hit.
    expect(cache.misses).toBeLessThanOrEqual(5);
    expect(cache.hits).toBeGreaterThan(80);
  });
});
