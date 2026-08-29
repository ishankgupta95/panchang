import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));
const ROOT_SET = new Set([0, 8, 9, 17, 18, 26]);
const SEVERE_SET = new Set([17, 18]);

describe('Ganda Mula wiring: daily panchang', () => {
  it('field is always present and consistent with sunrise nakshatra', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    expect(r).not.toBeNull();
    expect(r!.inauspicious.gandaMula).toBeDefined();
    expect(typeof r!.inauspicious.gandaMula.active).toBe('boolean');

    const sunriseNak = r!.angas.nakshatras[0]!.index;
    if (ROOT_SET.has(sunriseNak)) {
      const gm = r!.inauspicious.gandaMula;
      if (!gm.active) throw new Error(`expected Ganda Mula active for nakshatra ${sunriseNak}`);
      expect(gm.nakshatraName).toBeTruthy();
      expect(gm.severity).toBe(SEVERE_SET.has(sunriseNak) ? 'severe' : 'mild');
    } else {
      expect(r!.inauspicious.gandaMula.active).toBe(false);
      expect(Object.keys(r!.inauspicious.gandaMula).sort()).toEqual(['active']);
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
      if (r.inauspicious.gandaMula.active && r.inauspicious.gandaMula.severity === 'severe') severeDays++;
      else if (r.inauspicious.gandaMula.active && r.inauspicious.gandaMula.severity === 'mild') mildDays++;
      else inactiveDays++;
    }
    expect(severeDays).toBeGreaterThanOrEqual(1);
    expect(mildDays).toBeGreaterThanOrEqual(1);
    expect(inactiveDays).toBeGreaterThanOrEqual(15);
  });

  it('localizes nakshatraName when language is hi and Ganda Mula is active', () => {
    const HI_ROOT_NAMES = new Set(['अश्विनी', 'आश्लेषा', 'मघा', 'ज्येष्ठा', 'मूल', 'रेवती']);
    for (let day = 0; day < 30; day++) {
      const date = new Date(Date.UTC(2025, 0, 14) + day * 86_400_000);
      const r = getDailyPanchang(date, DELHI, { timezone: 330, language: 'hi' });
      if (r?.inauspicious.gandaMula.active) {
        expect(HI_ROOT_NAMES.has(r.inauspicious.gandaMula.nakshatraName!)).toBe(true);
        return;
      }
    }
    throw new Error('expected at least one Ganda Mula day in the 30-day sweep');
  });
});

describe('Ganda Mula wiring: instant panchang', () => {
  it('field is always present and consistent with instant nakshatra', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI);
    expect(r).not.toBeNull();
    expect(r!.inauspicious.gandaMula).toBeDefined();
    expect(typeof r!.inauspicious.gandaMula.active).toBe('boolean');

    const nak = r!.angas.nakshatra.index;
    if (ROOT_SET.has(nak)) {
      const gm = r!.inauspicious.gandaMula;
      if (!gm.active) throw new Error(`expected Ganda Mula active for nakshatra ${nak}`);
      expect(gm.nakshatraName).toBeTruthy();
      expect(gm.severity).toBe(SEVERE_SET.has(nak) ? 'severe' : 'mild');
    } else {
      expect(r!.inauspicious.gandaMula.active).toBe(false);
      expect(Object.keys(r!.inauspicious.gandaMula).sort()).toEqual(['active']);
    }
  });

  it('localized nakshatraName matches lang option when active', () => {
    const HI_ROOT_NAMES = new Set(['अश्विनी', 'आश्लेषा', 'मघा', 'ज्येष्ठा', 'मूल', 'रेवती']);
    for (let day = 0; day < 30; day++) {
      const date = new Date(NOON_2025_01_14.getTime() + day * 86_400_000);
      const r = getInstantPanchang(date, DELHI, { language: 'hi' });
      if (r?.inauspicious.gandaMula.active) {
        expect(HI_ROOT_NAMES.has(r.inauspicious.gandaMula.nakshatraName!)).toBe(true);
        return;
      }
    }
    throw new Error('expected at least one Ganda Mula instant in the 30-day sweep');
  });
});
