import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import {
  computeAbhijitMuhurta,
  computeBrahmaMuhurta,
  brahmaMuhurtaForNight,
  computeVijayaMuhurta,
  computeGodhuliMuhurta,
  computeNishitaMuhurta,
  computeAmritKalaWindows,
  computeMadhyahna,
  computePratahSandhya,
  computeSayahnaSandhya,
} from '../../src/core/muhurta';

const sunrise = new Date('2024-01-01T06:00:00Z');
const sunset = new Date('2024-01-01T18:00:00Z');
const DAY_MS = 12 * 3600_000;
const MUHURTA_MS = DAY_MS / 15;

describe('computeAbhijitMuhurta', () => {
  it('starts at 11:36 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(36);
  });

  it('ends at 12:24 for a 12-hour day', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    expect(abhijit.end.getUTCHours()).toBe(12);
    expect(abhijit.end.getUTCMinutes()).toBe(24);
  });

  it('duration is exactly 1/15 of daytime', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    const duration = abhijit.end.getTime() - abhijit.start.getTime();
    expect(duration).toBe(MUHURTA_MS);
  });

  it('is centered around local noon (within 1 minute)', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
    const centerMs = (abhijit.start.getTime() + abhijit.end.getTime()) / 2;
    expect(Math.abs(centerMs - noonMs)).toBeLessThan(60_000);
  });

  it('start is after sunrise', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    expect(abhijit.start.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it('end is before sunset', () => {
    const abhijit = computeAbhijitMuhurta(sunrise, sunset)!;
    expect(abhijit.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('works for an asymmetric day (shorter winter day)', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const abhijit = computeAbhijitMuhurta(shortSunrise, shortSunset)!;

    expect(abhijit.start.getUTCHours()).toBe(11);
    expect(abhijit.start.getUTCMinutes()).toBe(12);
    expect(abhijit.end.getUTCHours()).toBe(11);
    expect(abhijit.end.getUTCMinutes()).toBe(48);
  });

  it('returns null on Wednesday (varaIndex === 3)', () => {
    expect(computeAbhijitMuhurta(sunrise, sunset, 3)).toBeNull();
  });

  it.each([0, 1, 2, 4, 5, 6])(
    'returns a window on non-Wednesday vara %i',
    (vara) => {
      expect(computeAbhijitMuhurta(sunrise, sunset, vara)).not.toBeNull();
    },
  );

  it('omitted varaIndex computes the window unconditionally', () => {
    expect(computeAbhijitMuhurta(sunrise, sunset)).not.toBeNull();
  });
});

describe('computeBrahmaMuhurta', () => {
  it('is the 14th night-muhurta: 96 to 48 min before sunrise for a 12-hour day', () => {
    const brahma = computeBrahmaMuhurta(sunrise, sunset);
    expect(sunrise.getTime() - brahma.start.getTime()).toBe(96 * 60_000);
    expect(sunrise.getTime() - brahma.end.getTime()).toBe(48 * 60_000);
  });

  it('takes the night as 24 h minus the daylight', () => {
    const winterRise = new Date('2024-12-21T07:00:00Z');
    const winterSet = new Date('2024-12-21T16:00:00Z');
    const brahma = computeBrahmaMuhurta(winterRise, winterSet);
    expect(winterRise.getTime() - brahma.end.getTime()).toBe((15 * 3600_000) / 15);
    expect(brahma.end.getTime() - brahma.start.getTime()).toBe((15 * 3600_000) / 15);
  });

  it('matches the hand-computed Delhi 2026-11-05 window (night = 24 h - day)', () => {
    const brahma = computeBrahmaMuhurta(new Date(1793840751816), new Date(1793880197794));
    expect(brahma.start.getTime()).toBe(1793834491278);
    expect(brahma.end.getTime()).toBe(1793837621547);
  });

  it('brahmaMuhurtaForNight uses the night it is given', () => {
    const brahma = brahmaMuhurtaForNight(sunrise, 15 * 3600_000);
    expect(sunrise.getTime() - brahma.start.getTime()).toBe(2 * 3600_000);
    expect(sunrise.getTime() - brahma.end.getTime()).toBe(3600_000);
  });

  it('the daily panchang measures the night (sunset to next sunrise) and nests Pratah Sandhya at its midpoint', () => {
    const r = getDailyPanchang(new Date('2026-11-05T06:30:00Z'), { latitude: 28.6139, longitude: 77.209 }, {
      timezone: 330,
    })!;
    const nightMs = r.sun.nextRise.getTime() - r.sun.set.getTime();
    const b = r.muhurtas.brahma;
    expect(Math.abs(r.sun.rise.getTime() - nightMs / 15 - b.end.getTime())).toBeLessThan(1);
    expect(Math.abs(b.end.getTime() - nightMs / 15 - b.start.getTime())).toBeLessThan(1);
    const mid = (b.start.getTime() + b.end.getTime()) / 2;
    expect(Math.abs(mid - r.muhurtas.pratahSandhya.start.getTime())).toBeLessThanOrEqual(1);
    expect(b.startLocal.slice(11, 19)).toBe('04:51:25');
    expect(b.endLocal.slice(11, 19)).toBe('05:43:38');
  });
});

describe('computeVijayaMuhurta', () => {
  it('is the 11th muhurta (index 10) of a 12-hour day', () => {
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
    expect(vijaya.start.getTime()).toBeGreaterThan(abhijit!.end.getTime());
    expect(vijaya.end.getTime()).toBeLessThan(sunset.getTime());
  });

  it('scales for a shorter winter day (9h)', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const vijaya = computeVijayaMuhurta(shortSunrise, shortSunset);
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
    expect(nishita.start.getUTCHours()).toBe(23);
    expect(nishita.start.getUTCMinutes()).toBe(44);
  });
});

describe('computeAmritKalaWindows', () => {
  const NAK_SPAN = 360 / 27;
  const epochMs = Date.parse('2024-01-01T00:00:00Z');
  const dayMs = 24 * 3600_000;
  const getMoon = (d: Date) => ((d.getTime() - epochMs) / dayMs) * NAK_SPAN;

  const sunrise = new Date('2024-01-01T06:00:00Z');
  const nextSunrise = new Date('2024-01-02T06:00:00Z');

  it('anchors at the nakshatra start with the tabulated offset, width 4 elastic ghatikas', () => {
    const windows = computeAmritKalaWindows(sunrise, nextSunrise, getMoon);
    expect(windows.length).toBeGreaterThanOrEqual(1);
    const w = windows[0]!;
    expect(w.start.toISOString()).toBe('2024-01-01T16:48:00.000Z');
    expect(w.end.getTime() - w.start.getTime()).toBe(4 * 24 * 60_000);
  });

  it('a window whose start falls before sunrise belongs to the previous day', () => {
    const windows = computeAmritKalaWindows(sunrise, nextSunrise, getMoon);
    expect(windows).toHaveLength(1);
  });

  it('windows are attributed to the day their START falls in (post-midnight case)', () => {
    const windows = computeAmritKalaWindows(
      new Date('2024-01-02T06:00:00Z'), new Date('2024-01-03T06:00:00Z'), getMoon,
    );
    expect(windows).toHaveLength(1);
    expect(windows[0]!.start.toISOString()).toBe('2024-01-02T19:12:00.000Z');
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
    const m = computeMadhyahna(sunrise, sunset);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(36);
    expect(m.end.getUTCHours()).toBe(12);
    expect(m.end.getUTCMinutes()).toBe(24);
  });

  it('keeps a fixed 48-min width regardless of day length', () => {
    const shortSunrise = new Date('2024-12-21T07:00:00Z');
    const shortSunset = new Date('2024-12-21T16:00:00Z');
    const m = computeMadhyahna(shortSunrise, shortSunset);
    expect(m.end.getTime() - m.start.getTime()).toBe(48 * 60_000);
    expect(m.start.getUTCHours()).toBe(11);
    expect(m.start.getUTCMinutes()).toBe(6);
    expect(m.end.getUTCHours()).toBe(11);
    expect(m.end.getUTCMinutes()).toBe(54);
  });
});

describe('computePratahSandhya', () => {
  const nextSunriseSym = new Date('2024-01-02T06:00:00Z');

  it('ends exactly at sunrise', () => {
    const p = computePratahSandhya(sunrise, sunset, nextSunriseSym);
    expect(p.end.getTime()).toBe(sunrise.getTime());
  });

  it('width = nightDuration / 10 (72 min for a 12h night)', () => {
    const p = computePratahSandhya(sunrise, sunset, nextSunriseSym);
    expect(p.end.getTime() - p.start.getTime()).toBe(72 * 60_000);
  });

  it('start is nightDuration/10 before sunrise', () => {
    const p = computePratahSandhya(sunrise, sunset, nextSunriseSym);
    expect(p.start.getUTCHours()).toBe(4);
    expect(p.start.getUTCMinutes()).toBe(48);
  });

  it('scales with night length (winter → longer night → wider sandhya)', () => {
    const sr = new Date('2026-01-15T01:45:00Z');
    const ss = new Date('2026-01-15T12:16:00Z');
    const nsr = new Date('2026-01-16T01:44:00Z');
    const p = computePratahSandhya(sr, ss, nsr);
    const widthMin = (p.end.getTime() - p.start.getTime()) / 60_000;
    const nightMin = (nsr.getTime() - ss.getTime()) / 60_000;
    expect(widthMin).toBeCloseTo(nightMin / 10, 4);
    expect(p.end.getTime()).toBe(sr.getTime());
  });
});

describe('computeSayahnaSandhya', () => {
  const nextSunriseSym = new Date('2024-01-02T06:00:00Z');

  it('starts exactly at sunset', () => {
    const s = computeSayahnaSandhya(sunset, nextSunriseSym);
    expect(s.start.getTime()).toBe(sunset.getTime());
  });

  it('width = nightDuration / 10 (72 min for a 12h night)', () => {
    const s = computeSayahnaSandhya(sunset, nextSunriseSym);
    expect(s.end.getTime() - s.start.getTime()).toBe(72 * 60_000);
  });

  it('end is nightDuration/10 after sunset', () => {
    const s = computeSayahnaSandhya(sunset, nextSunriseSym);
    expect(s.end.getUTCHours()).toBe(19);
    expect(s.end.getUTCMinutes()).toBe(12);
  });

  it('scales with night length and ends ~3 ghatikas after sunset', () => {
    const ss = new Date('2026-01-15T12:16:00Z');
    const nsr = new Date('2026-01-16T01:44:00Z');
    const s = computeSayahnaSandhya(ss, nsr);
    const widthMin = (s.end.getTime() - s.start.getTime()) / 60_000;
    const nightMin = (nsr.getTime() - ss.getTime()) / 60_000;
    expect(widthMin).toBeCloseTo(nightMin / 10, 4);
    expect(s.start.getTime()).toBe(ss.getTime());
  });
});
