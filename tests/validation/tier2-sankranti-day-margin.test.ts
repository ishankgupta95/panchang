/**
 * @tier 2  this library's own output — a regression detector, not an authority
 *
 * # The one place a sub-ten-second ephemeris movement changes a published date
 *
 * `computeSankrantisForYear` publishes a **date**, never the transit instant.
 * The date is decided by which Hindu day contains the transit, and a Hindu day
 * starts at sunrise — so the only thing standing between "Oct 16" and "Oct 17"
 * is the sign of `transit − sunrise`. When that difference is seconds, a
 * movement far inside the release's own error bar flips a published calendar
 * date, and it flips *discontinuously*: there is no intermediate reading.
 *
 * The Tula Sankranti of 2025 at Reykjavik is that case. The transit sits about
 * **7.1 s before** that morning's sunrise, against a solar accuracy of 0.3233″
 * (`tier0-own-sun-moon.test.ts`) which is worth **~7.8 s** of sankranti instant
 * at 24 s per arcsecond. The margin is inside the error bar. It has held
 * through every value-moving change of Phase 36, but it holds by less than the
 * accuracy the release claims.
 *
 * ## Why this file has to exist
 *
 * `notes/dump.sh` + `diff.mjs` compare published output before and after a
 * change, and they cannot see this at all: the published leaf is the *date*,
 * so the harness reports nothing until the day has already flipped, at which
 * point it reports a moved festival date and no way to tell whether that was
 * the ephemeris improving or regressing. Nothing else pins the instant. This
 * file pins the instant **and the margin**, so the movement is visible while it
 * is still seconds away from mattering.
 *
 * ## What to do when this fails — the part that matters
 *
 * **Do not re-pin it to make it pass.** A failure here means the margin moved,
 * and the margin is the only warning that exists:
 *
 * 1. Read the reported margin. If it is still negative, the day did **not**
 *    flip — the sankranti list is unchanged and the only question is whether
 *    the movement is explained. Explain it from the Tier 0 delta (§36.0 E),
 *    then re-pin the band with the predicted and observed numbers recorded.
 * 2. If it has gone **positive**, the Tula Sankranti has moved to Oct 17 and
 *    `sankranti` and `kati_bihu` have moved with it. That is a published
 *    calendar date changing, which TIERS.md puts in the invariant half. Re-check
 *    the whole sankranti list by hand against DrikPanchang before touching a
 *    single number here, and record the decision — a date is not a tolerance.
 *
 * The tolerance below is ±2 s on a 7.1 s margin deliberately: a quarter of the
 * error bar, so this fails while there is still room to think, not at the
 * moment the date changes.
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
 * Bisected rather than read off `computeSankrantisForYear`, which stops at a
 * 1 s bracket and then publishes only the date — the instant this file exists
 * to watch is not reachable through the public API at all.
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

describe('Tier 2 — the Reykjavik Tula Sankranti sits inside its own error bar', () => {
  /** Tula begins at 180° of sidereal longitude. */
  const transit = transitInstant(180, Date.UTC(2025, 9, 15), Date.UTC(2025, 9, 19));
  /** Sunrise is canonical per location-day, so any instant on Oct 17 gives it. */
  const sunrise = computeSunrise(new Date('2025-10-17T00:00:00Z'), REYKJAVIK);
  const marginSeconds = (transit.getTime() - sunrise.getTime()) / 1000;

  it('the transit falls before that morning’s sunrise — which is what files it under Oct 16', () => {
    expect(
      marginSeconds,
      `Tula transit ${transit.toISOString()} vs Reykjavik sunrise ${sunrise.toISOString()}: `
      + `margin ${marginSeconds.toFixed(3)} s. A positive margin means the sankranti has moved `
      + 'to Oct 17 and taken two festival entries with it — read this file’s header before '
      + 'changing anything.',
    ).toBeLessThan(0);
  });

  it('the margin is 1.4 s, now well inside a solar error bar worth 7.8 s', () => {
    // Was −7.126 s. Correcting ΔT across the measured era (Espenak–Meeus reads
    // ~5.7 s high in 2025) moved the transit later by exactly that amount while
    // barely touching sunrise:
    //
    //   transit  +5.741 s   (ΔT 74.925 → 69.184, predicted and observed equal)
    //   sunrise  −0.027 s
    //   margin   −7.126 → −1.358 s
    //
    // Still negative, so the sankranti still files under Oct 16 and the two
    // festival entries stay put. But the margin is now *smaller* than it was
    // and far inside the 7.8 s solar error bar, so this case is genuinely
    // undecided on accuracy grounds — it lands on Oct 16 by 1.4 s of a quantity
    // we cannot resolve to better than ~8 s. The band below is the same ±2 s as
    // before; it now straddles zero, which is the honest statement.
    expect(marginSeconds).toBeGreaterThan(-3.4);
    expect(marginSeconds).toBeLessThan(0);
  });

  it('pins the transit instant itself, which no published field exposes', () => {
    // 2025-10-17T08:24:44.968Z, ±2 s — the old pin plus the 5.741 s ΔT shift.
    // This is the number `diff.mjs` cannot see.
    const pinned = Date.parse('2025-10-17T08:24:44.968Z');
    expect(Math.abs(transit.getTime() - pinned)).toBeLessThan(2000);
    // And the sunrise it is racing, to ±1 s: 2025-10-17T08:24:46.326Z.
    const pinnedSunrise = Date.parse('2025-10-17T08:24:46.326Z');
    expect(Math.abs(sunrise.getTime() - pinnedSunrise)).toBeLessThan(1000);
  });

  it('the published list files Tula under Oct 16, and the festivals follow it', () => {
    const sankrantis = computeSankrantisForYear(2025, REYKJAVIK, { timezone: TIMEZONE });
    const tula = sankrantis.find(s => s.rashiName === 'Tula');
    expect(tula, 'Tula Sankranti must be in the 2025 list').toBeDefined();
    expect(tula!.date.toISOString().slice(0, 10)).toBe('2025-10-16');
    // Twelve transits to a sidereal year, whatever the margins do (TIERS.md).
    expect(sankrantis).toHaveLength(12);

    // `getDailyPanchang` returns null where there is no sunrise to anchor the
    // Hindu day to. Reykjavik has one in October — but the whole subject of
    // this file is a margin against that sunrise, so the null case is asserted
    // away rather than silenced with a `!`.
    const oct16 = getDailyPanchang(new Date('2025-10-16T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    const oct17 = getDailyPanchang(new Date('2025-10-17T00:00:00Z'), REYKJAVIK, { timezone: TIMEZONE });
    expect(oct16, 'Reykjavik has a sunrise on 2025-10-16').not.toBeNull();
    expect(oct17, 'Reykjavik has a sunrise on 2025-10-17').not.toBeNull();
    const keysOn = (p: NonNullable<typeof oct16>): string[] => p.festivals.map(f => f.key);

    // The two entries derived from this transit. If they appear on Oct 17
    // instead, the margin above went positive and this is the consequence.
    expect(keysOn(oct16!)).toContain('sankranti');
    expect(keysOn(oct16!)).toContain('kati_bihu');
    expect(keysOn(oct17!)).not.toContain('sankranti');
    expect(keysOn(oct17!)).not.toContain('kati_bihu');
  });
});
