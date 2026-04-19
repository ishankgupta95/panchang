import { describe, it, expect } from 'vitest';
import {
  getUpcomingLunarEclipse,
  getUpcomingSolarEclipse,
  getEclipseDuringDay,
} from '../../src/astronomy/eclipse';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

describe('getUpcomingLunarEclipse', () => {
  it('finds the 2025-03-14 lunar eclipse when searching from early March 2025', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.kind).toBe('lunar');
    // Peak was around 2025-03-14 06:58 UTC
    const peakDay = new Date(info!.peak);
    expect(peakDay.getUTCFullYear()).toBe(2025);
    expect(peakDay.getUTCMonth()).toBe(2); // March
    expect(peakDay.getUTCDate()).toBeGreaterThanOrEqual(13);
    expect(peakDay.getUTCDate()).toBeLessThanOrEqual(15);
  });

  it('sutakStart is 9 hours (3 prahara) before the penumbral start for lunar', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    const gapMs = info!.start.getTime() - info!.sutakStart.getTime();
    expect(gapMs).toBe(9 * 3600_000);
  });

  it('sutakEnd equals eclipse end', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.sutakEnd.getTime()).toBe(info!.end.getTime());
  });

  it('returns null when no eclipse falls within the window', () => {
    // A deliberately short window where no eclipse occurs (2025-01-01 + 20 days)
    const info = getUpcomingLunarEclipse(new Date('2025-01-01T00:00:00Z'), DELHI, 20);
    expect(info).toBeNull();
  });

  it('magnitude (obscuration) is in [0, 1]', () => {
    const info = getUpcomingLunarEclipse(new Date('2025-03-01T00:00:00Z'), DELHI, 30);
    expect(info).not.toBeNull();
    expect(info!.magnitude).toBeGreaterThanOrEqual(0);
    expect(info!.magnitude).toBeLessThanOrEqual(1);
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
    // Delhi may or may not see the local eclipse; check visibility flag is false
    // either because no partial_begin occurs locally or sun is below horizon.
    if (info) {
      expect(info.visibleFromLocation).toBe(false);
    }
  });

  it('sutakStart is 12 hours (4 prahara) before the partial start for solar', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    const gapMs = info!.start.getTime() - info!.sutakStart.getTime();
    expect(gapMs).toBe(12 * 3600_000);
  });

  it('returns null when no solar eclipse occurs within the window', () => {
    // A tight window in a stretch without any eclipse
    const info = getUpcomingSolarEclipse(new Date('2025-05-01T00:00:00Z'), DELHI, 15);
    expect(info).toBeNull();
  });

  it('magnitude is in [0, 1]', () => {
    const info = getUpcomingSolarEclipse(new Date('2025-09-01T00:00:00Z'), SYDNEY, 30);
    expect(info).not.toBeNull();
    expect(info!.magnitude).toBeGreaterThanOrEqual(0);
    expect(info!.magnitude).toBeLessThanOrEqual(1);
  });
});

describe('getEclipseDuringDay', () => {
  it('surfaces the 2025-03-14 lunar eclipse on the matching Hindu day', () => {
    // Delhi sunrise on 2025-03-14 ≈ 00:35 UTC (~06:05 IST), nextSunrise ≈ 00:34 UTC next day.
    // Lunar eclipse peak at 06:58 UTC falls within this window.
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
});
