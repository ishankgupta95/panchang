/**
 * Integration tests — Ganda Mula wired into getDailyPanchang and
 * getInstantPanchang as the non-optional `gandaMula: GandaMulaInfo` field.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));
const ROOT_SET = new Set([0, 8, 9, 17, 18, 26]);
const SEVERE_SET = new Set([17, 18]);

describe('Ganda Mula wiring — daily panchang', () => {
  it('field is always present and consistent with sunrise nakshatra', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    expect(r).not.toBeNull();
    expect(r!.gandaMula).toBeDefined();
    expect(typeof r!.gandaMula.active).toBe('boolean');

    const sunriseNak = r!.nakshatras[0]!.index;
    if (ROOT_SET.has(sunriseNak)) {
      expect(r!.gandaMula.active).toBe(true);
      expect(r!.gandaMula.nakshatraName).toBeTruthy();
      expect(r!.gandaMula.severity).toBe(SEVERE_SET.has(sunriseNak) ? 'severe' : 'mild');
    } else {
      expect(r!.gandaMula.active).toBe(false);
      expect(r!.gandaMula.nakshatraName).toBeUndefined();
      expect(r!.gandaMula.severity).toBeUndefined();
    }
  });

  it('finds at least one severe and one mild day in a 30-day Delhi sweep', () => {
    let severeDays = 0;
    let mildDays = 0;
    let inactiveDays = 0;
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330 });
      if (!r) continue;
      if (r.gandaMula.severity === 'severe') severeDays++;
      else if (r.gandaMula.severity === 'mild') mildDays++;
      else inactiveDays++;
    }
    // Moon visits each nakshatra ~1 day per 27-day cycle, so a 30-day sweep
    // should hit roughly: severe 2-3 days, mild 4-5 days, inactive ~22 days.
    expect(severeDays).toBeGreaterThanOrEqual(1);
    expect(mildDays).toBeGreaterThanOrEqual(1);
    expect(inactiveDays).toBeGreaterThanOrEqual(15);
  });

  it('localizes nakshatraName when language is hi and Ganda Mula is active', () => {
    // Sweep until we land on a Ganda Mula day, then check the hi name.
    const HI_ROOT_NAMES = new Set(['अश्विनी', 'आश्लेषा', 'मघा', 'ज्येष्ठा', 'मूल', 'रेवती']);
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330, language: 'hi' });
      if (r?.gandaMula.active) {
        expect(HI_ROOT_NAMES.has(r.gandaMula.nakshatraName!)).toBe(true);
        return;
      }
    }
    throw new Error('expected at least one Ganda Mula day in the 30-day sweep');
  });
});

describe('Ganda Mula wiring — instant panchang', () => {
  it('field is always present and consistent with instant nakshatra', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI);
    expect(r).not.toBeNull();
    expect(r!.gandaMula).toBeDefined();
    expect(typeof r!.gandaMula.active).toBe('boolean');

    const nak = r!.nakshatra.index;
    if (ROOT_SET.has(nak)) {
      expect(r!.gandaMula.active).toBe(true);
      expect(r!.gandaMula.nakshatraName).toBeTruthy();
      expect(r!.gandaMula.severity).toBe(SEVERE_SET.has(nak) ? 'severe' : 'mild');
    } else {
      expect(r!.gandaMula.active).toBe(false);
      expect(r!.gandaMula.nakshatraName).toBeUndefined();
      expect(r!.gandaMula.severity).toBeUndefined();
    }
  });

  it('localized nakshatraName matches lang option when active', () => {
    // Sweep daily instants until we hit a Ganda Mula moment.
    const HI_ROOT_NAMES = new Set(['अश्विनी', 'आश्लेषा', 'मघा', 'ज्येष्ठा', 'मूल', 'रेवती']);
    for (let day = 0; day < 30; day++) {
      const date = new Date(NOON_2025_01_14.getTime() + day * 86_400_000);
      const r = getInstantPanchang(date, DELHI, { language: 'hi' });
      if (r?.gandaMula.active) {
        expect(HI_ROOT_NAMES.has(r.gandaMula.nakshatraName!)).toBe(true);
        return;
      }
    }
    throw new Error('expected at least one Ganda Mula instant in the 30-day sweep');
  });
});
