/**
 * Phase 25 wiring: eclipse field, new muhurtas (Vijaya/Godhuli/Nishita/Amrit),
 * eclipse-as-festival-entry, and i18n for eclipse names.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

describe('Phase 25 — muhurta wiring in getDailyPanchang', () => {
  const r = getDailyPanchang(noonUtc('2025-04-12'), DELHI, { timezone: 330 });

  it('exposes vijayaMuhurta with ordered Date bounds', () => {
    expect(r.vijayaMuhurta.start).toBeInstanceOf(Date);
    expect(r.vijayaMuhurta.end).toBeInstanceOf(Date);
    expect(r.vijayaMuhurta.start.getTime()).toBeLessThan(r.vijayaMuhurta.end.getTime());
  });

  it('exposes godhuliMuhurta as a 48-minute window around sunset', () => {
    const width = r.godhuliMuhurta.end.getTime() - r.godhuliMuhurta.start.getTime();
    expect(width).toBe(48 * 60_000);
    const sunsetMs = r.sunset.getTime();
    const centerMs = (r.godhuliMuhurta.start.getTime() + r.godhuliMuhurta.end.getTime()) / 2;
    // Within 1 minute (floating-point tolerance)
    expect(Math.abs(centerMs - sunsetMs)).toBeLessThan(60_000);
  });

  it('exposes nishitaMuhurta that contains local midnight', () => {
    // nishita is centered on local midnight (offset-adjusted). Since all Dates
    // in the result are offset-adjusted, midnight-local is getUTCHours() === 0.
    const startHour = r.nishitaMuhurta.start.getUTCHours();
    const endHour = r.nishitaMuhurta.end.getUTCHours();
    // Window straddles 0 (midnight) — start is 23:xx, end is 00:xx.
    expect(startHour === 23 || endHour === 0 || (startHour === 0 && endHour === 0)).toBe(true);
  });

  it('amritKala is either null or a valid window within the Hindu day', () => {
    if (r.amritKala) {
      expect(r.amritKala.start.getTime()).toBeLessThan(r.amritKala.end.getTime());
      expect(r.amritKala.start.getTime()).toBeGreaterThanOrEqual(r.sunrise.getTime() - 1000);
      expect(r.amritKala.end.getTime()).toBeLessThanOrEqual(r.nextSunrise.getTime() + 1000);
    }
  });
});

describe('Phase 25 — eclipse wiring in getDailyPanchang', () => {
  it('exposes eclipse field (null on a day without an eclipse)', () => {
    const r = getDailyPanchang(noonUtc('2025-04-12'), DELHI, { timezone: 330 });
    expect(r.eclipse).toBeNull();
  });

  it('surfaces the 2025-03-14 lunar eclipse as r.eclipse', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330 });
    expect(r.eclipse).not.toBeNull();
    expect(r.eclipse!.kind).toBe('lunar');
    expect(r.eclipse!.subtype).toMatch(/^(partial|total|penumbral)$/);
    // sutakEnd is the umbral (partial) last contact, which precedes the
    // penumbral eclipse end for a total/partial lunar eclipse.
    expect(r.eclipse!.sutakEnd).not.toBeNull();
    expect(r.eclipse!.sutakEnd!.getTime()).toBeLessThan(r.eclipse!.end.getTime());
  });

  it('emits the eclipse as a top-of-list festival entry', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330 });
    const ecl = r.festivals.find((f) => f.type === 'eclipse');
    expect(ecl).toBeDefined();
    expect(ecl!.name.toLowerCase()).toMatch(/grahan|eclipse/);
  });

  it('solar eclipse 2025-09-21 is not visible from Delhi', () => {
    const r = getDailyPanchang(noonUtc('2025-09-21'), DELHI, { timezone: 330 });
    if (r.eclipse && r.eclipse.kind === 'solar') {
      expect(r.eclipse.visibleFromLocation).toBe(false);
    }
  });

  it('Hindi eclipse name resolves correctly', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330, language: 'hi' });
    const ecl = r.festivals.find((f) => f.type === 'eclipse');
    expect(ecl).toBeDefined();
    // "चंद्र ग्रहण" (Chandra Grahan) or "सूर्य ग्रहण" (Surya Grahan)
    expect(ecl!.name).toMatch(/ग्रहण/);
  });
});
