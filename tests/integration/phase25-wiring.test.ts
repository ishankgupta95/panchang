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
  const r = getDailyPanchang(noonUtc('2025-04-12'), DELHI, { timezone: 330 })!;

  it('exposes vijayaMuhurta with ordered Date bounds', () => {
    expect(r.muhurtas.vijaya.start).toBeInstanceOf(Date);
    expect(r.muhurtas.vijaya.end).toBeInstanceOf(Date);
    expect(r.muhurtas.vijaya.start.getTime()).toBeLessThan(r.muhurtas.vijaya.end.getTime());
  });

  it('exposes godhuliMuhurta as a 48-minute window around sunset', () => {
    const width = r.muhurtas.godhuli.end.getTime() - r.muhurtas.godhuli.start.getTime();
    expect(width).toBe(48 * 60_000);
    const sunsetMs = r.sun.set.getTime();
    const centerMs = (r.muhurtas.godhuli.start.getTime() + r.muhurtas.godhuli.end.getTime()) / 2;
    // Within 1 minute (floating-point tolerance)
    expect(Math.abs(centerMs - sunsetMs)).toBeLessThan(60_000);
  });

  it('exposes nishitaMuhurta that contains local midnight', () => {
    // nishita is centered on local midnight (offset-adjusted). Since all Dates
    // v5: published Dates are true instants, so the local hour comes from the
    // offset-carrying `*Local` string rather than from getUTCHours().
    const startHour = Number(r.muhurtas.nishita.startLocal.slice(11, 13));
    const endHour = Number(r.muhurtas.nishita.endLocal.slice(11, 13));
    // Window straddles 0 (midnight) — start is 23:xx, end is 00:xx.
    expect(startHour === 23 || endHour === 0 || (startHour === 0 && endHour === 0)).toBe(true);
  });

  it('amritKala is either null or a valid window within the Hindu day', () => {
    if (r.muhurtas.amritKala) {
      expect(r.muhurtas.amritKala.start.getTime()).toBeLessThan(r.muhurtas.amritKala.end.getTime());
      expect(r.muhurtas.amritKala.start.getTime()).toBeGreaterThanOrEqual(r.sun.rise.getTime() - 1000);
      expect(r.muhurtas.amritKala.end.getTime()).toBeLessThanOrEqual(r.sun.nextRise.getTime() + 1000);
    }
  });
});

describe('Phase 25 — eclipse wiring in getDailyPanchang', () => {
  it('exposes eclipse field (null on a day without an eclipse)', () => {
    const r = getDailyPanchang(noonUtc('2025-04-12'), DELHI, { timezone: 330 })!;
    expect(r.eclipse).toBeNull();
  });

  it('surfaces the 2025-03-14 lunar eclipse as r.eclipse', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330 })!;
    expect(r.eclipse).not.toBeNull();
    expect(r.eclipse!.kind).toBe('lunar');
    expect(r.eclipse!.subtype).toMatch(/^(partial|total|penumbral)$/);
    // sutakEnd is the umbral (partial) last contact, which precedes the
    // penumbral eclipse end for a total/partial lunar eclipse.
    expect(r.eclipse!.sutakEnd).not.toBeNull();
    expect(r.eclipse!.sutakEnd!.getTime()).toBeLessThan(r.eclipse!.end.getTime());
  });

  it('emits the eclipse as a top-of-list festival entry', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330 })!;
    const ecl = r.festivals.find((f) => f.type === 'eclipse');
    expect(ecl).toBeDefined();
    expect(ecl!.name.toLowerCase()).toMatch(/grahan|eclipse/);
  });

  it('solar eclipse 2025-09-21 is not visible from Delhi', () => {
    const r = getDailyPanchang(noonUtc('2025-09-21'), DELHI, { timezone: 330 })!;
    if (r.eclipse && r.eclipse.kind === 'solar') {
      expect(r.eclipse.visibleFromLocation).toBe(false);
    }
  });

  it('Hindi eclipse name resolves correctly', () => {
    const r = getDailyPanchang(noonUtc('2025-03-14'), DELHI, { timezone: 330, language: 'hi' })!;
    const ecl = r.festivals.find((f) => f.type === 'eclipse');
    expect(ecl).toBeDefined();
    // "चंद्र ग्रहण" (Chandra Grahan) or "सूर्य ग्रहण" (Surya Grahan)
    expect(ecl!.name).toMatch(/ग्रहण/);
  });
});
