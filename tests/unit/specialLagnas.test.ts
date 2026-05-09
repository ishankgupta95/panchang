/**
 * Unit tests for the special lagnas added in Step 32-4 — Hora Lagna,
 * Ghati Lagna, Bhava Lagna, Sripati Lagna.
 *
 * Strategy:
 *   1. **Boundary case at sunrise** — at the exact sunrise instant, all
 *      three time-derived lagnas (Hora / Ghati / Bhava) collapse to the
 *      same value as the lagna at sunrise.
 *   2. **Rate verification** — 1 hour after sunrise, Hora Lagna advances
 *      30° (1 sign per hour), Ghati 75° (1 sign per ghatika = 24 min),
 *      Bhava 15° (1 sign per 2 hours). Pinned per the classical BPHS
 *      Ch. 4 / Phaladeepika Ch. 1 rates.
 *   3. **Periodicity** — Ghati Lagna returns every 4.8 hours; Hora
 *      Lagna every 12 hours; Bhava Lagna every 24 hours.
 *   4. **Hora ≢ Bhava** — Hora (30°/hr) and Bhava (15°/hr) advance at
 *      different rates and yield distinct longitudes after t > 0.
 *   5. **Sripati == natal lagna** — Sripati Lagna equals the natal
 *      ascendant in the cusp-form definition.
 *   6. **Output shape** — all four functions return a `LagnaInfo` with
 *      well-formed rashi / nakshatra / pada fields.
 *   7. **Sunrise lookup** — `_findSunriseBeforeForTest` correctly
 *      returns the sunrise on or before the given instant for various
 *      times of day.
 */

import { describe, it, expect } from 'vitest';
import {
  computeLagna, computeHoraLagna, computeGhatiLagna,
  computeBhavaLagna, computeSripatiLagna,
  _findSunriseBeforeForTest,
} from '../../src/jyotish/lagna';
import { computeSunrise } from '../../src/astronomy/sunrise';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

// ── 1. Sunrise boundary ───────────────────────────────

describe('Special lagnas at sunrise — all collapse to natal asc', () => {
  it('Hora / Ghati / Bhava at exact sunrise == lagna at sunrise (within sub-arcsec)', () => {
    // Pick a date and compute its sunrise.
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl = computeHoraLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(sunrise, DELHI).siderealLongitude;
    const bl = computeBhavaLagna(sunrise, DELHI).siderealLongitude;

    // At t=sunrise, hoursSince = 0, so all three should equal ascAtSunrise
    // up to a few-arcsecond drift from `SearchRiseSet`'s internal precision.
    expect(Math.abs(hl - ascAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(gl - ascAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(bl - ascAtSunrise)).toBeLessThan(0.005);
  });
});

// ── 2. Rate verification — 1 hour after sunrise ──────

describe('Special lagnas — 1-hour advance rates', () => {
  it('Hora Lagna advances 30° in 1 hour (1 sign per hour, BPHS Ch. 4)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl1h = computeHoraLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = hl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 75° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl1h = computeGhatiLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = gl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 75)).toBeLessThan(0.01);
  });

  it('Bhava Lagna advances 15° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const bl1h = computeBhavaLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = bl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 15)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 30° in 1 ghatika (24 minutes)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneGhatika = new Date(sunrise.getTime() + 24 * 60 * 1000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(oneGhatika, DELHI).siderealLongitude;
    let delta = gl - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });
});

// ── 3. 24-hour cycle / return ─────────────────────────

describe('Special lagnas — periodicity', () => {
  it('Ghati Lagna returns to its starting value every 4.8 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const start = sunrise;
    const after = new Date(sunrise.getTime() + 4.8 * 3600_000);

    const glStart = computeGhatiLagna(start, DELHI).siderealLongitude;
    const glAfter = computeGhatiLagna(after, DELHI).siderealLongitude;
    let delta = glAfter - glStart;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.5);
  });

  it('Hora Lagna returns to its starting value every 12 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const after = new Date(sunrise.getTime() + 12 * 3600_000);

    const hlStart = computeHoraLagna(sunrise, DELHI).siderealLongitude;
    const hlAfter = computeHoraLagna(after, DELHI).siderealLongitude;
    let delta = hlAfter - hlStart;
    delta = ((delta + 540) % 360) - 180;
    // After 12h, sunrise has shifted by ~1 minute, so allow up to ~1° drift.
    expect(Math.abs(delta)).toBeLessThan(1.0);
  });

  it('Bhava Lagna returns to its starting value every 24 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const after = new Date(sunrise.getTime() + 24 * 3600_000);

    const blStart = computeBhavaLagna(sunrise, DELHI).siderealLongitude;
    const blAfter = computeBhavaLagna(after, DELHI).siderealLongitude;
    let delta = blAfter - blStart;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(1.5);
  });
});

// ── 4. Hora ≢ Bhava (distinct rates per BPHS) ─────────

describe('Hora Lagna and Bhava Lagna — distinct rates', () => {
  it('Hora (30°/hr) and Bhava (15°/hr) diverge after t > 0', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    // After 1 hour, Hora has advanced 30° and Bhava 15° → Hora - Bhava = 15°.
    for (const hours of [1, 2.5, 6]) {
      const t = new Date(sunrise.getTime() + hours * 3600_000);
      const hl = computeHoraLagna(t, DELHI).siderealLongitude;
      const bl = computeBhavaLagna(t, DELHI).siderealLongitude;
      let delta = hl - bl;
      delta = ((delta + 540) % 360) - 180;
      // Hora advances 30°/hr, Bhava 15°/hr — difference grows at 15°/hr.
      const expected = 15 * hours;
      // Modulo 360 so very long t doesn't break the comparison.
      const expectedMod = ((expected + 540) % 360) - 180;
      expect(Math.abs(delta - expectedMod)).toBeLessThan(0.05);
    }
  });
});

// ── 5. Sripati == natal lagna ─────────────────────────

describe('Sripati Lagna — equals natal lagna', () => {
  it('matches computeLagna at the same instant', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const natal = computeLagna(date, DELHI);
    const sripati = computeSripatiLagna(date, DELHI);
    expect(sripati.siderealLongitude).toBeCloseTo(natal.siderealLongitude, 6);
    expect(sripati.rashi.index).toBe(natal.rashi.index);
    expect(sripati.nakshatra.index).toBe(natal.nakshatra.index);
  });
});

// ── 6. Output structural shape ────────────────────────

describe('Special lagnas — output structural shape', () => {
  const date = new Date('2025-01-14T08:00:00Z');

  it('every special lagna returns a well-formed LagnaInfo', () => {
    for (const fn of [computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna]) {
      const r = fn(date, DELHI);
      expect(r.siderealLongitude).toBeGreaterThanOrEqual(0);
      expect(r.siderealLongitude).toBeLessThan(360);
      expect(r.rashi.index).toBeGreaterThanOrEqual(0);
      expect(r.rashi.index).toBeLessThan(12);
      expect(r.degreeInRashi).toBeGreaterThanOrEqual(0);
      expect(r.degreeInRashi).toBeLessThan(30);
      expect(r.nakshatra.index).toBeGreaterThanOrEqual(0);
      expect(r.nakshatra.index).toBeLessThan(27);
      expect(r.pada).toBeGreaterThanOrEqual(1);
      expect(r.pada).toBeLessThanOrEqual(4);
      expect(typeof r.rashi.name).toBe('string');
      expect(typeof r.nakshatra.name).toBe('string');
    }
  });

  it("respects 'hi' locale for rashi/nakshatra names", () => {
    const r = computeHoraLagna(date, DELHI, 'lahiri', 'hi');
    expect(r.rashi.name.length).toBeGreaterThan(0);
    // Hindi names are Devanagari; first char shouldn't be ASCII.
    const firstChar = r.rashi.name.charCodeAt(0);
    expect(firstChar).toBeGreaterThan(127);
  });
});

// ── 7. Sunrise lookup helper ──────────────────────────

describe('_findSunriseBeforeForTest', () => {
  it('returns sunrise on the same calendar day for noon birth', () => {
    const noon = new Date('2025-01-14T08:00:00Z'); // ~13:30 IST
    const sunrise = _findSunriseBeforeForTest(noon, DELHI);
    expect(sunrise.getTime()).toBeLessThan(noon.getTime());
    // Sunrise should be within 24h of noon.
    expect(noon.getTime() - sunrise.getTime()).toBeLessThan(24 * 3600_000);
  });

  it('returns prior-day sunrise for pre-sunrise birth', () => {
    // Pick a UTC instant that's before sunrise on its local day.
    const earlyMorning = new Date('2025-01-14T01:00:00Z'); // ~06:30 IST, before sunrise
    const sunrise = _findSunriseBeforeForTest(earlyMorning, DELHI);
    expect(sunrise.getTime()).toBeLessThan(earlyMorning.getTime());
  });

  it('idempotent: sunrise(t) where t is itself a sunrise', () => {
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);
    // Calling _findSunriseBeforeForTest at the sunrise instant itself
    // should return that same sunrise (since it's <= the input).
    const result = _findSunriseBeforeForTest(sunrise, DELHI);
    expect(Math.abs(result.getTime() - sunrise.getTime())).toBeLessThan(60_000);
  });
});

// ── 8. Cross-sanity: 2 hours after sunrise ────────────

describe('Special lagnas — 2-hour cross-check', () => {
  it('Hora at +2h = sunrise asc + 60° (2 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl = computeHoraLagna(t, DELHI).siderealLongitude;
    const expected = (ascAtSunrise + 60) % 360;
    let delta = hl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });

  it('Ghati at +2h = sunrise asc + 150° (5 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(t, DELHI).siderealLongitude;
    const expected = (ascAtSunrise + 150) % 360;
    let delta = gl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });
});
