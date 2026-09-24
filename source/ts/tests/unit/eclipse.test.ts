import { describe, it, expect } from 'vitest';
import {
  getUpcomingLunarEclipse,
  getUpcomingSolarEclipse,
  getEclipseDuringDay,
} from '../../src/astronomy/eclipse';
import { computeSunrise as getSunrise, computeSunset as getSunset } from '../../src/astronomy/sunrise';
import { solarViewAt } from '../../src/astronomy/eclipseGeometry';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const VARANASI = { latitude: 25.3176, longitude: 82.9739 };

describe('getUpcomingLunarEclipse', () => {
  it('finds the 2025-03-14 lunar eclipse when searching from early March 2025', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('lunar');
    const peakDay = new Date(info!.peak);
    expect(peakDay.getUTCFullYear()).toBe(2025);
    expect(peakDay.getUTCMonth()).toBe(2); // March
    expect(peakDay.getUTCDate()).toBeGreaterThanOrEqual(13);
    expect(peakDay.getUTCDate()).toBeLessThanOrEqual(15);
  });

  it('lunar sutak is anchored to the umbral (partial) phase, with a 9h lead', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.sutakStart).not.toBeNull();
    expect(info!.sutakEnd).not.toBeNull();
    const peak = info!.peak.getTime();
    const umbralLead = peak - info!.sutakStart!.getTime() - 9 * 3600_000;
    const umbralTrail = info!.sutakEnd!.getTime() - peak;
    expect(umbralLead).toBeGreaterThan(0);
    expect(umbralTrail).toBeGreaterThan(0);
    expect(Math.abs(umbralLead - umbralTrail)).toBeLessThan(30_000);
    expect(peak - umbralLead - info!.sutakStart!.getTime()).toBe(9 * 3600_000);
  });

  it('lunar sutakEnd (umbral last contact) precedes the penumbral eclipse end', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.sutakEnd).not.toBeNull();
    expect(info!.sutakEnd!.getTime()).toBeLessThan(info!.end.getTime());
    expect(info!.end.getTime() - info!.sutakEnd!.getTime()).toBeGreaterThan(30 * 60_000);
  });

  it('penumbral lunar eclipse carries no sutak (null window)', () => {
    const info = getUpcomingLunarEclipse(new Date('2027-02-01T00:00:00Z'), DELHI, 40);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('penumbral');
    expect(info!.sutakStart).toBeNull();
    expect(info!.sutakEnd).toBeNull();
  });

  it('returns null when no eclipse falls within the window', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-01-01T00:00:00Z'), DELHI, 20);
    expect(info).toBeNull();
  });

  it('obscuration is in [0, 1]; magnitude is the diameter fraction beside it', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('total');
    expect(info!.obscuration).toBeGreaterThanOrEqual(0);
    expect(info!.obscuration).toBeLessThanOrEqual(1);
    expect(info!.magnitude).toBeGreaterThan(1);
  });

  it('a penumbral lunar eclipse has zero obscuration and a negative magnitude', () => {
    const info = getUpcomingLunarEclipse(new Date('2027-02-01T00:00:00Z'), DELHI, 40);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('penumbral');
    expect(info!.obscuration).toBe(0);
    expect(info!.magnitude).toBeLessThan(0);
  });

  it('description mentions the subtype', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.description.toLowerCase()).toContain(info!.subtype);
  });
});

describe('getUpcomingSolarEclipse', () => {
  it('finds the 2025-09-21 solar eclipse from Sydney (visible partial)', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('solar');
    const peakDay = new Date(info!.peak);
    expect(peakDay.getUTCFullYear()).toBe(2025);
    expect(peakDay.getUTCMonth()).toBe(8); // September
    expect(peakDay.getUTCDate()).toBeGreaterThanOrEqual(20);
    expect(peakDay.getUTCDate()).toBeLessThanOrEqual(22);
  });

  it('2025-09-21 solar eclipse is NOT visible from Delhi', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), DELHI, 30);
    if (info) {
      expect(info.visibleFromLocation).toBe(false);
    }
  });

  it('sutakStart is 12 hours (4 prahara) before the partial start for solar', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    const gapMs = info!.start.getTime() - info!.sutakStart!.getTime();
    expect(gapMs).toBe(12 * 3600_000);
  });

  it('returns null when no solar eclipse occurs within the window', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-05-01T00:00:00Z'), DELHI, 15);
    expect(info).toBeNull();
  });

  it('obscuration is in [0, 1], and magnitude exceeds it for a partial', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    expect(info!.subtype).toBe('partial');
    expect(info!.obscuration).toBeGreaterThanOrEqual(0);
    expect(info!.obscuration).toBeLessThanOrEqual(1);
    expect(info!.magnitude).toBeGreaterThan(info!.obscuration);
    expect(info!.magnitude).toBeLessThanOrEqual(1);
  });

  it('never returns an eclipse that already ended, so a walk cannot stall on one', () => {
    let cursor = new Date('2000-01-01T00:00:00Z');
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      const info = getUpcomingSolarEclipse(cursor, VARANASI, 4000);
      if (info === null) break;
      expect(info.end.getTime()).toBeGreaterThan(cursor.getTime());
      seen.push(info.peak.toISOString().slice(0, 10));
      cursor = new Date(info.end.getTime() + 1000);
    }
    expect(seen.length).toBeGreaterThan(20);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain('2009-07-22');
  });
});

describe('getEclipseDuringDay', () => {
  it('surfaces the 2025-03-14 lunar eclipse on the matching Hindu day', () => {
    const sunrise = new Date('2025-03-14T00:35:00Z');
    const nextSunrise = new Date('2025-03-15T00:34:00Z');
    const info = getEclipseDuringDay(sunrise, nextSunrise, DELHI);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('lunar');
  });

  it('returns null when no eclipse falls within the Hindu day', () => {
    const sunrise = new Date('2025-04-10T00:30:00Z');
    const nextSunrise = new Date('2025-04-11T00:29:00Z');
    const info = getEclipseDuringDay(sunrise, nextSunrise, DELHI);
    expect(info).toBeNull();
  });

  const hinduDaysCarrying = (
    location: typeof DELHI, fromIso: string, days: number, kind: 'solar' | 'lunar',
  ): string[] => {
    const out: string[] = [];
    let sunrise = getSunrise(new Date(fromIso), location);
    for (let i = 0; i < days; i++) {
      const nextSunrise = getSunrise(getSunset(sunrise, location), location);
      const info = getEclipseDuringDay(sunrise, nextSunrise, location);
      if (info?.kind === kind) out.push(sunrise.toISOString().slice(0, 16));
      sunrise = nextSunrise;
    }
    return out;
  };

  it('a solar eclipse in progress at sunrise belongs to that sunrise only (Delhi 2016-03-09)', () => {
    // Peak 00:42Z below the horizon, sunrise 01:07Z, conjunction 01:54Z: it used to land on 03-08 as well.
    expect(hinduDaysCarrying(DELHI, '2016-03-06T18:30:00Z', 5, 'solar')).toEqual(['2016-03-09T01:07']);
  });

  it('a lunar eclipse whose opposition precedes sunrise but whose peak follows it is kept (Chennai 2057-12-11)', () => {
    const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
    // Opposition 00:46:04Z, sunrise 00:50:59Z, peak 00:51:54Z: it used to land on no day at all.
    expect(hinduDaysCarrying(CHENNAI, '2057-12-08T18:30:00Z', 5, 'lunar')).toEqual(['2057-12-11T00:50']);
  });

  it('a lunar eclipse peaking just before sunrise stays on the previous Hindu day (Sydney 2004-05-05)', () => {
    // Peak 20:30Z, the next sunrise 20:32Z, opposition after it: it used to land on both days.
    expect(hinduDaysCarrying(SYDNEY, '2004-05-02T14:00:00Z', 5, 'lunar')).toEqual(['2004-05-03T20:31']);
  });
});

/**
 * The syzygy guard inside `getEclipseDuringDay` skips the search on days that
 * can hold neither a new nor a full moon: an optimization that must never
 * change an answer, so a guard that is too narrow would drop a real eclipse.
 */
describe('getEclipseDuringDay: syzygy guard is answer-preserving', () => {
  function unguarded(sunriseUtc: Date, nextSunriseUtc: Date, location: typeof DELHI) {
    const sunriseMs = sunriseUtc.getTime();
    const nextSunriseMs = nextSunriseUtc.getTime();
    const windowDays = Math.ceil((nextSunriseMs - sunriseMs) / (24 * 3600_000)) + 1;
    const inDay = (ms: number) => ms >= sunriseMs && ms < nextSunriseMs;
    const cursors = [sunriseUtc, new Date(sunriseMs - 12 * 3600_000)];
    for (const from of cursors) {
      const solar = getUpcomingSolarEclipse(from, location, windowDays);
      if (solar === null) continue;
      const seenMs = solar.visibleFromLocation ? solar.peak.getTime()
        : solarViewAt(solar.start, location).sunAltitude > 0 ? solar.start.getTime()
          : solar.end.getTime();
      if (inDay(seenMs)) return solar;
    }
    for (const from of cursors) {
      const lunar = getUpcomingLunarEclipse(from, location, windowDays);
      if (lunar && inDay(lunar.peak.getTime())) return lunar;
    }
    return null;
  }
  const identity = (e: ReturnType<typeof unguarded>) =>
    e === null
      ? 'null'
      : `${e.kind}/${e.subtype}/${e.peak.toISOString()}/${e.obscuration}/${e.magnitude}`;

  for (const [name, loc] of [
    ['Delhi', DELHI],
    ['Sydney', SYDNEY],
  ] as const) {
    it(`matches the unguarded result on every day of 2025 (${name})`, () => {
      let eclipseDays = 0;
      for (let d = 0; d < 365; d++) {
        const anchor = new Date(Date.UTC(2025, 0, 1) + d * 86_400_000);
        const sunrise = getSunrise(anchor, loc);
        const nextSunrise = getSunrise(getSunset(sunrise, loc), loc);
        const expected = unguarded(sunrise, nextSunrise, loc);
        if (expected !== null) eclipseDays++;
        expect(
          identity(getEclipseDuringDay(sunrise, nextSunrise, loc)),
          `guard diverged on ${anchor.toISOString().slice(0, 10)}`,
        ).toBe(identity(expected));
      }
      expect(eclipseDays).toBeGreaterThan(0);
    }, 30_000);
  }
});
