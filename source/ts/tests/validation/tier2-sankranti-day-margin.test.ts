/**
 * @tier 2  this library's own output: a regression detector, not an authority
 *
 * The 2025 Reykjavik Tula Sankranti falls 1.4 s before sunrise, well inside the
 * solar error bar (0.3233″ is ~7.8 s of sankranti instant), so a movement here is
 * an ephemeris movement to explain from the Tier 0 delta, not to re-pin. A night
 * transit files under the next sunrise's day, so a change in the published
 * `Tula 2025 -> Oct 17 (Reykjavik)` means the attribution rule changed.
 */
import { describe, it, expect } from 'vitest';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { computeSunrise } from '../../src/astronomy/sunrise';
import { computeSankrantisForYear } from '../../src/calendar/yearly';
import { getDailyPanchang } from '../../src/index';

const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
/** Iceland keeps UTC year-round, so the local and UTC dates agree. */
const TIMEZONE = 0;

function transitInstant(degrees: number, afterUtc: number, beforeUtc: number): Date {
  let lo = afterUtc;
  let hi = beforeUtc;
  const lonAt = (ms: number): number => getSiderealSunLongitude(new Date(ms), 'lahiri');
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (lonAt(mid) < degrees) lo = mid; else hi = mid;
  }
  return new Date(hi);
}

describe('Tier 2: the Reykjavik Tula Sankranti ephemeris pin', () => {
  /** Tula begins at 180° of sidereal longitude. */
  const transit = transitInstant(180, Date.UTC(2025, 9, 15), Date.UTC(2025, 9, 19));
  const sunrise = computeSunrise(new Date('2025-10-17T00:00:00Z'), REYKJAVIK);
  const marginSeconds = (transit.getTime() - sunrise.getTime()) / 1000;

  it('the margin is 1.4 s before sunrise: an ephemeris pin, no longer a date decider', () => {
    expect(marginSeconds).toBeGreaterThan(-3.4);
    expect(marginSeconds).toBeLessThan(0.7);
  });

  it('pins the transit instant itself, which `diff.mjs` cannot see', () => {
    const pinned = Date.parse('2025-10-17T08:24:44.968Z');
    expect(Math.abs(transit.getTime() - pinned)).toBeLessThan(2000);
    const pinnedSunrise = Date.parse('2025-10-17T08:24:46.326Z');
    expect(Math.abs(sunrise.getTime() - pinnedSunrise)).toBeLessThan(1000);
  });

  it('the published `moment` agrees with the bisected instant to its 1 s bracket', () => {
    const sankrantis = computeSankrantisForYear(2025, REYKJAVIK, { timezone: TIMEZONE });
    const tula = sankrantis.find(s => s.rashiName === 'Tula');
    expect(tula).toBeDefined();
    expect(Math.abs(tula!.moment.getTime() - transit.getTime())).toBeLessThan(1500);
  });

  it('the published list files Tula under Oct 17 (night transit → next sunrise\'s day)', () => {
    const sankrantis = computeSankrantisForYear(2025, REYKJAVIK, { timezone: TIMEZONE });
    const tula = sankrantis.find(s => s.rashiName === 'Tula');
    expect(tula, 'Tula Sankranti must be in the 2025 list').toBeDefined();
    expect(tula!.date.toISOString().slice(0, 10)).toBe('2025-10-17');
    expect(sankrantis).toHaveLength(12);

    const oct16 = getDailyPanchang(new Date('2025-10-16T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    const oct17 = getDailyPanchang(new Date('2025-10-17T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    expect(oct16, 'Reykjavik has a sunrise on 2025-10-16').not.toBeNull();
    expect(oct17, 'Reykjavik has a sunrise on 2025-10-17').not.toBeNull();
    const keysOn = (p: NonNullable<typeof oct16>): string[] => p.festivals.map(f => f.key);

    expect(keysOn(oct17!)).toContain('sankranti');
    expect(keysOn(oct17!)).toContain('kati_bihu');
    expect(keysOn(oct16!)).not.toContain('sankranti');
    expect(keysOn(oct16!)).not.toContain('kati_bihu');
  });
});
