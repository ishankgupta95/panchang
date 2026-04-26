import { describe, it, expect } from 'vitest';
import {
  computeAbhijitMuhurta,
  computeVijayaMuhurta,
  computeGodhuliMuhurta,
  computeNishitaMuhurta,
  computeAmritKala,
  computeMadhyahna,
  computePratahSandhya,
  computeSayahnaSandhya,
} from '../../src/core/muhurta';

// Known 12-hour day: sunrise 06:00 UTC, sunset 18:00 UTC
// Each of 15 muhurtas = 12h/15 = 48 minutes
// Abhijit = 8th muhurta (index 7, 0-based):
//   start = 06:00 + 7 * 48min = 06:00 + 336min = 11:36
//   end   = 11:36 + 48min = 12:24
const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const DAY_MS = 12 * 3600_000;
const MUHURTA_MS = DAY_MS / 15; // 48 minutes

describe('computeAbhijitMuhurta', () => {
  it('starts at 11:36 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(36);
  });

  it('ends at 12:24 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.end.getUTCHours()).toBe(12);
    expect(abhijit.end.getUTCMinutes()).toBe(24);
  });

  it('duration is exactly 1/15 of daytime', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    const duration = abhijit.end.getTime() - abhijit.start.getTime();
    expect(duration).toBe(MUHURTA_MS);
  });

  it('is centered around local noon (within 1 minute)', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
    const centerMs = (abhijit.start.getTime() + abhijit.end.getTime()) / 2;
    expect(Math.abs(centerMs - noonMs)).toBeLessThan(60_000);
  });

  it('start is after sunrise', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.start.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it('end is before sunset', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    expect(abhijit.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('works for an asymmetric day (shorter winter day)', () => {
    // 9-hour day: sunrise 07:00, sunset 16:00
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const abhijit = computeAbhijitMuhurta(shortSunrise, shortSunset);

    // muhurta = 9h/15 = 36 min; start = 07:00 + 7*36min = 07:00 + 252min = 11:12
    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(12);
    // end = 11:12 + 36min = 11:48
    expect(abhijit.end.getUTCHours()).toBe(11);
    expect(abhijit.end.getUTCMinutes()).toBe(48);
  });
});

describe('computeVijayaMuhurta', () => {
  it('is the 11th muhurta (index 10) of a 12-hour day', () => {
    // sunrise 06:00, sunset 18:00. muhurta = 48 min. Vijaya = 06:00 + 10*48 = 14:00.
    const vijaya = computeVijayaMuhurta(sunrise, sunset);
    expect(vijaya.start.getUTCHours()).toBe(14);
    expect(vijaya.start.getUTCMinutes()).toBe(0);
    expect(vijaya.end.getUTCHours()).toBe(14);
    expect(vijaya.end.getUTCMinutes()).toBe(48);
  });

  it('duration is exactly 1/15 of daytime', () => {
    const vijaya = computeVijayaMuhurta(sunrise, sunset);
    expect(vijaya.end.getTime() - vijaya.start.getTime()).toBe(MUHURTA_MS);
  });

  it('falls after Abhijit and before sunset', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset);
    const vijaya = computeVijayaMuhurta(sunrise, sunset);
    expect(vijaya.start.getTime()).toBeGreaterThan(abhijit.end.getTime());
    expect(vijaya.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('scales for a shorter winter day (9h)', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const vijaya = computeVijayaMuhurta(shortSunrise, shortSunset);
    // muhurta = 36 min; start = 07:00 + 10*36min = 07:00 + 360min = 13:00
    expect(vijaya.start.getUTCHours()).toBe(13);
    expect(vijaya.start.getUTCMinutes()).toBe(0);
    expect(vijaya.end.getUTCHours()).toBe(13);
    expect(vijaya.end.getUTCMinutes()).toBe(36);
  });
});

describe('computeGodhuliMuhurta', () => {
  it('is a 48-minute window centered on sunset', () => {
    const god = computeGodhuliMuhurta(sunset);
    expect(god.start.getUTCHours()).toBe(17);
    expect(god.start.getUTCMinutes()).toBe(36);
    expect(god.end.getUTCHours()).toBe(18);
    expect(god.end.getUTCMinutes()).toBe(24);
  });

  it('center is exactly sunset', () => {
    const god = computeGodhuliMuhurta(sunset);
    const centerMs = (god.start.getTime() + god.end.getTime()) / 2;
    expect(centerMs).toBe(sunset.getTime());
  });

  it('is 48 minutes long regardless of day length', () => {
    const long = computeGodhuliMuhurta(new Date('2024-06-21T20:00:00Z'));
    const short = computeGodhuliMuhurta(new Date('2024-12-21T16:00:00Z'));
    expect(long.end.getTime() - long.start.getTime()).toBe(48 * 60_000);
    expect(short.end.getTime() - short.start.getTime()).toBe(48 * 60_000);
  });
});

describe('computeNishitaMuhurta', () => {
  // Symmetric 12-hour night: sunset 18:00 -> nextSunrise 06:00.
  // Each night-muhurta = 48 min. 8th night muhurta (index 7):
  //   start = 18:00 + 7*48min = 18:00 + 336min = 23:36
  //   end   = 23:36 + 48min   = 00:24 (next day)
  const nightSunset = new Date('2024-01-01T18:00:00Z');
  const nextSunrise = new Date('2024-01-02T06:00:00Z');

  it('contains local midnight for a symmetric 12-hour night', () => {
    const nishita = computeNishitaMuhurta(nightSunset, nextSunrise);
    const midnightMs = new Date('2024-01-02T00:00:00Z').getTime();
    expect(midnightMs).toBeGreaterThanOrEqual(nishita.start.getTime());
    expect(midnightMs).toBeLessThanOrEqual(nishita.end.getTime());
  });

  it('is the 8th night-muhurta of 15 (start at 23:36 for this symmetric case)', () => {
    const nishita = computeNishitaMuhurta(nightSunset, nextSunrise);
    expect(nishita.start.getUTCHours()).toBe(23);
    expect(nishita.start.getUTCMinutes()).toBe(36);
  });

  it('duration is exactly 1/15 of night length', () => {
    const nishita = computeNishitaMuhurta(nightSunset, nextSunrise);
    const nightMs = nextSunrise.getTime() - nightSunset.getTime();
    expect(nishita.end.getTime() - nishita.start.getTime()).toBe(nightMs / 15);
  });

  it('scales for a short summer night (8h)', () => {
    const summerSunset  = new Date('2024-06-21T20:00:00Z');
    const summerSunrise = new Date('2024-06-22T04:00:00Z');
    const nishita = computeNishitaMuhurta(summerSunset, summerSunrise);
    // 8h night, each muhurta 32 min. start = 20:00 + 7*32 = 20:00 + 224min = 23:44
    expect(nishita.start.getUTCHours()).toBe(23);
    expect(nishita.start.getUTCMinutes()).toBe(44);
  });
});

describe('computeAmritKala', () => {
  // Symmetric 24-hour ahoratra: ghatika = 24 min.
  const ahoSunrise = new Date('2024-01-01T06:00:00Z');
  const ahoNextSunrise = new Date('2024-01-02T06:00:00Z');

  it('returns a 4-ghatika (96 min) window when within the Hindu day', () => {
    // Pushya (index 7): offset 20 ghatikas = 480 min = 8h. start = 14:00, end = 15:36.
    const amrit = computeAmritKala(ahoSunrise, ahoNextSunrise, 7);
    expect(amrit).not.toBeNull();
    const width = amrit!.end.getTime() - amrit!.start.getTime();
    expect(width).toBe(96 * 60_000);
    expect(amrit!.start.getUTCHours()).toBe(14);
    expect(amrit!.start.getUTCMinutes()).toBe(0);
  });

  it('offset differs per nakshatra (Anuradha at 10 ghatikas)', () => {
    // Anuradha (16): offset 10 ghatikas = 240 min = 4h. start = 10:00.
    const amrit = computeAmritKala(ahoSunrise, ahoNextSunrise, 16);
    expect(amrit).not.toBeNull();
    expect(amrit!.start.getUTCHours()).toBe(10);
    expect(amrit!.start.getUTCMinutes()).toBe(0);
  });

  it('scales ghatika duration proportionally to ahoratra length', () => {
    // A 12h ahoratra: each ghatika = 12 min. Pushya offset 20 ghatikas = 240 min = 4h.
    const shortNext = new Date(ahoSunrise.getTime() + 12 * 3600_000);
    const amrit = computeAmritKala(ahoSunrise, shortNext, 7);
    expect(amrit).not.toBeNull();
    expect(amrit!.start.getUTCHours()).toBe(10); // 06:00 + 4h = 10:00
    // Window length = 4 ghatikas * 12 min = 48 min
    expect(amrit!.end.getTime() - amrit!.start.getTime()).toBe(48 * 60_000);
  });

  it('returns null for out-of-range nakshatra index', () => {
    expect(computeAmritKala(ahoSunrise, ahoNextSunrise, -1)).toBeNull();
    expect(computeAmritKala(ahoSunrise, ahoNextSunrise, 27)).toBeNull();
  });
});

describe('computeMadhyahna', () => {
  it('is centered exactly on the sunrise→sunset midpoint', () => {
    const m = computeMadhyahna(sunrise, sunset);
    const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
    const centerMs = (m.start.getTime() + m.end.getTime()) / 2;
    expect(centerMs).toBe(noonMs);
  });

  it('is 48 minutes wide (one classical muhurta)', () => {
    const m = computeMadhyahna(sunrise, sunset);
    expect(m.end.getTime() - m.start.getTime()).toBe(48 * 60_000);
  });

  it('starts at noon − 24min and ends at noon + 24min for a 12h day', () => {
    // noon = 12:00. window = 11:36 → 12:24.
    const m = computeMadhyahna(sunrise, sunset);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(36);
    expect(m.end.getUTCHours()).toBe(12);
    expect(m.end.getUTCMinutes()).toBe(24);
  });

  it('keeps a fixed 48-min width regardless of day length', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z'); // 9h day, noon = 11:30
    const m = computeMadhyahna(shortSunrise, shortSunset);
    expect(m.end.getTime() - m.start.getTime()).toBe(48 * 60_000);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(6);
    expect(m.end.getUTCHours()).toBe(11);
    expect(m.end.getUTCMinutes()).toBe(54);
  });
});

describe('computePratahSandhya', () => {
  it('is centered exactly on sunrise', () => {
    const p = computePratahSandhya(sunrise);
    const centerMs = (p.start.getTime() + p.end.getTime()) / 2;
    expect(centerMs).toBe(sunrise.getTime());
  });

  it('is 48 minutes wide (sunrise ±24 min)', () => {
    const p = computePratahSandhya(sunrise);
    expect(p.end.getTime() - p.start.getTime()).toBe(48 * 60_000);
  });

  it('start is 24 min before sunrise, end is 24 min after', () => {
    // sunrise = 06:00 → window 05:36 → 06:24
    const p = computePratahSandhya(sunrise);
    expect(p.start.getUTCHours()).toBe(5);
    expect(p.start.getUTCMinutes()).toBe(36);
    expect(p.end.getUTCHours()).toBe(6);
    expect(p.end.getUTCMinutes()).toBe(24);
  });

  it('window straddles sunrise', () => {
    const p = computePratahSandhya(sunrise);
    expect(p.start.getTime()).toBeLessThan(sunrise.getTime());
    expect(p.end.getTime()).toBeGreaterThan(sunrise.getTime());
  });
});

describe('computeSayahnaSandhya', () => {
  it('is centered exactly on sunset', () => {
    const s = computeSayahnaSandhya(sunset);
    const centerMs = (s.start.getTime() + s.end.getTime()) / 2;
    expect(centerMs).toBe(sunset.getTime());
  });

  it('is 48 minutes wide (sunset ±24 min)', () => {
    const s = computeSayahnaSandhya(sunset);
    expect(s.end.getTime() - s.start.getTime()).toBe(48 * 60_000);
  });

  it('start is 24 min before sunset, end is 24 min after', () => {
    // sunset = 18:00 → window 17:36 → 18:24
    const s = computeSayahnaSandhya(sunset);
    expect(s.start.getUTCHours()).toBe(17);
    expect(s.start.getUTCMinutes()).toBe(36);
    expect(s.end.getUTCHours()).toBe(18);
    expect(s.end.getUTCMinutes()).toBe(24);
  });

  it('window straddles sunset', () => {
    const s = computeSayahnaSandhya(sunset);
    expect(s.start.getTime()).toBeLessThan(sunset.getTime());
    expect(s.end.getTime()).toBeGreaterThan(sunset.getTime());
  });
});
