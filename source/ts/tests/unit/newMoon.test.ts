
import { describe, it, expect } from 'vitest';
import { boundingNewMoons, NewMoonCache } from '../../src/astronomy/newMoon';
import { moonSunElongation, searchMoonPhase } from '../../src/astronomy/lunation';

const DAY_MS = 86_400_000;

/**
 * Do not swap this for `astronomy-engine`'s `SearchMoonPhase`: its `MoonPhase`
 * is a GEOMETRIC longitude difference, while every tithi here uses APPARENT
 * longitudes, and the two disagree by the solar aberration, 37-46 s.
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
    const TOLERANCE_MS = 1000;
    let worstDriftMs = 0;
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
    expect(worstDriftMs).toBeLessThan(500);
  });

  it('holds at the boundary instants themselves', () => {
    const anchor = new Date(Date.UTC(2026, 5, 15));
    const newMoon = searchMoonPhase(0, anchor, 40)!;
    const { prev, next } = boundingNewMoons(newMoon);
    expect(prev.getTime()).toBe(newMoon.getTime());
    expect(next.getTime()).toBeGreaterThan(newMoon.getTime());
  });

  it('takes the seeded fast path (never falls back) across a decade', () => {
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
    expect(cache.misses).toBeLessThanOrEqual(5);
    expect(cache.hits).toBeGreaterThan(80);
  });
});
