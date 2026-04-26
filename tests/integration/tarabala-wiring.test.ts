/**
 * Integration tests — Tarabala wired into getDailyPanchang / getInstantPanchang
 * via the opt-in `janmaNakshatra` option.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NOON_2025_01_14 = new Date(Date.UTC(2025, 0, 14, 12, 0, 0, 0));

describe('Tarabala wiring — daily panchang', () => {
  it('omits tarabala when janmaNakshatra is not provided', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330 });
    expect(r!.tarabala).toBeUndefined();
  });

  it('includes tarabala when janmaNakshatra is provided', () => {
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaNakshatra: 0 });
    expect(r!.tarabala).toBeDefined();
    expect(r!.tarabala!.taraIndex).toBeGreaterThanOrEqual(0);
    expect(r!.tarabala!.taraIndex).toBeLessThanOrEqual(8);
    expect(['auspicious', 'inauspicious']).toContain(r!.tarabala!.quality);
  });

  it('tarabala taraIndex matches ((nakshatraAtSunrise - janmaNakshatra) mod 27) mod 9', () => {
    const janma = 5; // Ardra
    const r = getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaNakshatra: janma });
    const transitNakshatra = r!.nakshatras[0]!.index;
    const expected = ((transitNakshatra - janma + 27) % 27) % 9;
    expect(r!.tarabala!.taraIndex).toBe(expected);
  });

  it('localizes name when language is set to hi', () => {
    const r = getDailyPanchang(
      NOON_2025_01_14, DELHI,
      { timezone: 330, janmaNakshatra: 0, language: 'hi' },
    );
    // The hi name must be one of the nine Devanagari tara names.
    const HI_NAMES = ['जन्म', 'सम्पत्', 'विपत्', 'क्षेम', 'प्रत्यरि', 'साधक', 'वध', 'मित्र', 'अति-मित्र'];
    expect(HI_NAMES).toContain(r!.tarabala!.name);
  });

  it('Tarabala and ChandraBalam can coexist', () => {
    const r = getDailyPanchang(
      NOON_2025_01_14, DELHI,
      { timezone: 330, janmaRashi: 0, janmaNakshatra: 0 },
    );
    expect(r!.chandraBalam).toBeDefined();
    expect(r!.tarabala).toBeDefined();
  });

  it('propagates RangeError for invalid janmaNakshatra', () => {
    expect(() =>
      getDailyPanchang(NOON_2025_01_14, DELHI, { timezone: 330, janmaNakshatra: 27 }),
    ).toThrow(RangeError);
  });
});

describe('Tarabala wiring — instant panchang', () => {
  it('omits tarabala when janmaNakshatra is not provided', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI);
    expect(r!.tarabala).toBeUndefined();
  });

  it('includes tarabala when janmaNakshatra is provided', () => {
    const r = getInstantPanchang(NOON_2025_01_14, DELHI, { janmaNakshatra: 5 });
    expect(r!.tarabala).toBeDefined();
    expect(r!.tarabala!.englishName).toMatch(/^(Janma|Sampat|Vipat|Kshema|Pratyari|Sadhaka|Vadha|Mitra|Ati-Mitra)$/);
  });

  it('taraIndex matches offset from instant nakshatra', () => {
    const janma = 9; // Magha
    const r = getInstantPanchang(NOON_2025_01_14, DELHI, { janmaNakshatra: janma });
    const transitNakshatra = r!.nakshatra.index;
    const expected = ((transitNakshatra - janma + 27) % 27) % 9;
    expect(r!.tarabala!.taraIndex).toBe(expected);
  });
});
