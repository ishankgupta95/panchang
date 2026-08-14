/**
 * @tier 2  this library's own output — a regression detector, not an authority
 *
 * # A sub-ten-second ephemeris pin at a former day-attribution knife edge
 *
 * `computeSankrantisForYear` publishes a **date** (and, since the SK-1 fix, the
 * transit `moment`). Through 5.1 the date was decided by which *Hindu day*
 * (sunrise → next sunrise) contained the transit, so the sign of
 * `transit − sunrise` alone separated "Oct 16" from "Oct 17" — and the Tula
 * Sankranti of 2025 at Reykjavik sat **1.4 s** on the Oct 16 side of that
 * edge, inside the release's own solar error bar (0.3233″ ≈ 7.8 s of
 * sankranti instant at 24 s per arcsecond).
 *
 * The 2026-08-14 audit (SK-1) replaced the attribution rule with drik's:
 * daylight transits carry their own civil day, and a transit between sunset
 * and the next sunrise files under the NEXT sunrise's day. Under that rule
 * this margin **no longer decides the date**: a hair before sunrise is a
 * night transit filed under Oct 17, and a hair after is a daylight transit
 * filed under Oct 17 too. The equivalent knife edge now lives at *sunset*
 * crossings, and this transit sits ~14 h from the nearest one.
 *
 * The file stays, for the part `notes/dump.sh` + `diff.mjs` still cannot see:
 * it pins the transit instant and the sunrise it used to race, to seconds.
 * A movement here is an ephemeris movement, full stop — explain it from the
 * Tier 0 delta (§36.0 E) before re-pinning, with predicted and observed
 * numbers recorded. The date assertions below are TIERS.md invariants: if
 * `Tula 2025 → Oct 17 (Reykjavik)` ever changes, the attribution rule
 * changed, and that needs drik evidence, not a re-pin.
 */
import { describe, it, expect } from 'vitest';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { computeSunrise } from '../../src/astronomy/sunrise';
import { computeSankrantisForYear } from '../../src/calendar/yearly';
import { getDailyPanchang } from '../../src/index';

/** 64.15 °N — far enough north that a mid-October sunrise moves ~3 min a day. */
const REYKJAVIK = { latitude: 64.1466, longitude: -21.9426 };
/** Iceland keeps UTC year-round, so the local date and the UTC date agree. */
const TIMEZONE = 0;

/**
 * The Sun's sidereal longitude crossing of `degrees`, to the millisecond.
 *
 * Bisected rather than read off `computeSankrantisForYear`, whose `moment`
 * stops at a 1 s bracket — the pins below are tighter than that.
 */
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

describe('Tier 2 — the Reykjavik Tula Sankranti ephemeris pin', () => {
  /** Tula begins at 180° of sidereal longitude. */
  const transit = transitInstant(180, Date.UTC(2025, 9, 15), Date.UTC(2025, 9, 19));
  /** Sunrise is canonical per location-day, so any instant on Oct 17 gives it. */
  const sunrise = computeSunrise(new Date('2025-10-17T00:00:00Z'), REYKJAVIK);
  const marginSeconds = (transit.getTime() - sunrise.getTime()) / 1000;

  it('the margin is 1.4 s before sunrise — an ephemeris pin, no longer a date decider', () => {
    // Was −7.126 s. Correcting ΔT across the measured era (Espenak–Meeus reads
    // ~5.7 s high in 2025) moved the transit later by exactly that amount while
    // barely touching sunrise:
    //
    //   transit  +5.741 s   (ΔT 74.925 → 69.184, predicted and observed equal)
    //   sunrise  −0.027 s
    //   margin   −7.126 → −1.358 s
    //
    // The ±2 s band straddling zero is retained as a drift alarm even though
    // the sign no longer selects the published day (see header).
    expect(marginSeconds).toBeGreaterThan(-3.4);
    expect(marginSeconds).toBeLessThan(0.7);
  });

  it('pins the transit instant itself, which `diff.mjs` cannot see', () => {
    // 2025-10-17T08:24:44.968Z, ±2 s — the old pin plus the 5.741 s ΔT shift.
    const pinned = Date.parse('2025-10-17T08:24:44.968Z');
    expect(Math.abs(transit.getTime() - pinned)).toBeLessThan(2000);
    // And the sunrise it used to race, to ±1 s: 2025-10-17T08:24:46.326Z.
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
    // Pre-SK-1 this filed under Oct 16 (the Hindu day containing the transit).
    // Under drik's rule a pre-sunrise transit belongs to the day that sunrise
    // begins — predicted before the fix ran, observed to match.
    const sankrantis = computeSankrantisForYear(2025, REYKJAVIK, { timezone: TIMEZONE });
    const tula = sankrantis.find(s => s.rashiName === 'Tula');
    expect(tula, 'Tula Sankranti must be in the 2025 list').toBeDefined();
    expect(tula!.date.toISOString().slice(0, 10)).toBe('2025-10-17');
    // Twelve transits to a sidereal year, whatever the margins do (TIERS.md).
    expect(sankrantis).toHaveLength(12);

    // `getDailyPanchang` returns null where there is no sunrise to anchor the
    // Hindu day to. Reykjavik has one in October — but this file is about
    // per-day attribution, so the null case is asserted away rather than
    // silenced with a `!`.
    const oct16 = getDailyPanchang(new Date('2025-10-16T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    const oct17 = getDailyPanchang(new Date('2025-10-17T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    expect(oct16, 'Reykjavik has a sunrise on 2025-10-16').not.toBeNull();
    expect(oct17, 'Reykjavik has a sunrise on 2025-10-17').not.toBeNull();
    const keysOn = (p: NonNullable<typeof oct16>): string[] => p.festivals.map(f => f.key);

    // The two entries derived from this transit follow the date.
    expect(keysOn(oct17!)).toContain('sankranti');
    expect(keysOn(oct17!)).toContain('kati_bihu');
    expect(keysOn(oct16!)).not.toContain('sankranti');
    expect(keysOn(oct16!)).not.toContain('kati_bihu');
  });
});
