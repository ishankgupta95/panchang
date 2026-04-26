/**
 * Integration tests — Varjyam wired into getDailyPanchang as a TimePeriod
 * field on DailyPanchangResult.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_DURATION_MINUTES,
  NAKSHATRA_SPAN,
} from '../../src/utils/constants';
import { LongitudeCache } from '../../src/astronomy/cache';
import { computeSunrise } from '../../src/astronomy/sunrise';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Varjyam wiring — daily panchang', () => {
  it('field is present (Date|null) on a normal Delhi day', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    expect(r).not.toBeNull();
    expect('varjyam' in r!).toBe(true);
    if (r!.varjyam) {
      expect(r!.varjyam.start).toBeInstanceOf(Date);
      expect(r!.varjyam.end).toBeInstanceOf(Date);
    }
  });

  it('window length is exactly 96 minutes when present', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    if (r!.varjyam) {
      const lengthMs = r!.varjyam.end.getTime() - r!.varjyam.start.getTime();
      expect(lengthMs).toBe(VARJYAM_DURATION_MINUTES * 60_000);
    }
  });

  it('start lies offsetGhatikas × 24min after the active nakshatra start (cross-checked via ephemeris)', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    if (!r!.varjyam) return; // contract test handled elsewhere

    const cache = new LongitudeCache('lahiri');
    const getMoon = (d: Date) => cache.getMoon(d);
    const sunriseUtc = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const nakIdx = Math.floor(getMoon(sunriseUtc) / NAKSHATRA_SPAN);

    // Local-display Date carries timezone-shifted UTC components; subtract the
    // timezone offset (330 min for IST) to recover the true UTC instant.
    const tzOffsetMs = 330 * 60_000;
    const startUtcMs = r!.varjyam.start.getTime() - tzOffsetMs;
    const nakshatraStartUtcMs = startUtcMs - VARJYAM_OFFSET_GHATIKAS[nakIdx]! * 24 * 60_000;

    // At nakshatraStartUtcMs ± 1 minute, the moon's nakshatra should be `nakIdx`,
    // and 1 minute earlier should be `nakIdx - 1`.
    const idxAt = (ms: number) => Math.floor(getMoon(new Date(ms)) / NAKSHATRA_SPAN);
    expect(idxAt(nakshatraStartUtcMs + 60_000)).toBe(nakIdx);
    expect(idxAt(nakshatraStartUtcMs - 60_000)).toBe((nakIdx - 1 + 27) % 27);
  });

  it('returned Date components are in the requested timezone (IST = +330)', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    if (!r!.varjyam) return;
    // Same offset shift applied to sunrise/nextSunrise — so their .getUTCDate()
    // values reflect IST calendar days, and varjyam should bracket within the
    // same local Hindu day window.
    const sunriseLocalMs = r!.sunrise.getTime();
    const nextSunriseLocalMs = r!.nextSunrise.getTime();
    expect(r!.varjyam.start.getTime()).toBeGreaterThanOrEqual(sunriseLocalMs - 60_000);
    expect(r!.varjyam.end.getTime()).toBeLessThanOrEqual(nextSunriseLocalMs + 60_000);
  });

  it('produces a non-null window on a meaningful share of days across a 30-day Delhi sweep', () => {
    // Single-nakshatra contract: when the sunrise-active nakshatra's varjyam
    // window has already passed (or hasn't yet begun), the field is null.
    // Empirically ~40–60% of days have a non-null window; assert only that
    // the wiring isn't silently broken.
    let nonNull = 0;
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (r?.varjyam) nonNull++;
    }
    expect(nonNull).toBeGreaterThan(8);
  });
});
