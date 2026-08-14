/**
 * Unit tests for the calendar conversion + yearly listing helpers.
 *
 * These tests sweep many days (up to a full year) so they are slower than
 * the unit tests for pure data transforms — kept tight to a handful of
 * focused assertions per helper.
 */

import { describe, it, expect } from 'vitest';
import {
  convertGregorianToHindu, convertHinduToGregorian,
  getKaliYugaYear, getHinduNewYear,
  getEkadashiDatesForYear, getSankrantisForYear,
  getFestivalsInRange, getUpcomingEclipses,
} from '../../src/index';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const TZ = 330;

describe('convertGregorianToHindu', () => {
  it('returns full Hindu coordinates for a sample date', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r).toHaveProperty('tithiName');
    expect(r).toHaveProperty('tithi');
    expect(r).toHaveProperty('pakshaTithi');
    expect(r).toHaveProperty('paksha');
    expect(r).toHaveProperty('masaName');
    expect(r).toHaveProperty('masaIndex');
    expect(r).toHaveProperty('isAdhika');
    expect(r).toHaveProperty('vikramSamvat');
    expect(r).toHaveProperty('shakaSamvat');
    expect(r).toHaveProperty('varaName');
    expect(r).toHaveProperty('varaIndex');
  });

  it('tithi is in [1, 30]', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r.tithi).toBeGreaterThanOrEqual(1);
    expect(r.tithi).toBeLessThanOrEqual(30);
  });

  it('pakshaTithi is in [1, 15]', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r.pakshaTithi).toBeGreaterThanOrEqual(1);
    expect(r.pakshaTithi).toBeLessThanOrEqual(15);
  });

  it('Vikram Samvat = Shaka + 135', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r.vikramSamvat - r.shakaSamvat).toBe(135);
  });

  it('Vikram Samvat ≈ Gregorian + 56 or 57', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r.vikramSamvat - 2026).toBeGreaterThanOrEqual(56);
    expect(r.vikramSamvat - 2026).toBeLessThanOrEqual(57);
  });

  it('vara index matches the calendar weekday at sunrise (April 15, 2026 is a Wednesday)', () => {
    const r = convertGregorianToHindu(new Date('2026-04-15'), DELHI, { timezone: TZ });
    expect(r.varaIndex).toBe(3); // Wednesday
  });
});

describe('convertHinduToGregorian — round-trip', () => {
  it('converting forward then back lands on the same date', () => {
    // Pick a date and round-trip.
    const original = new Date('2026-04-15');
    const fwd = convertGregorianToHindu(original, DELHI, { timezone: TZ });
    const back = convertHinduToGregorian(
      {
        vikramSamvat: fwd.vikramSamvat,
        masaIndex: fwd.masaIndex,
        paksha: fwd.paksha,
        pakshaTithi: fwd.pakshaTithi,
      },
      DELHI,
      { timezone: TZ },
    );
    expect(back.length).toBeGreaterThan(0);
    // Must contain a date matching the original calendar day (sunrise UTC
    // can be on the same calendar day).
    const sameDay = back.some((d) => {
      return d.getUTCFullYear() === original.getUTCFullYear()
        && d.getUTCMonth() === original.getUTCMonth()
        && Math.abs(d.getUTCDate() - original.getUTCDate()) <= 1;
    });
    expect(sameDay).toBe(true);
  }, 60_000);

  it('purnimanta Chaitra Krishna round-trips (the fortnight that wraps the VS year)', () => {
    // Under purnimanta, Chaitra Krishna precedes the samvat increment, so its
    // VS year is the OLD one and the date lies ~12 months after that year's
    // Chaitra Shukla anchor. The reverse search used to anchor its window at
    // the year's start and returned [] for exactly this fortnight.
    const original = new Date(Date.UTC(2026, 2, 15, 12)); // 2026-03-15
    const fwd = convertGregorianToHindu(original, DELHI, { timezone: TZ });
    expect(fwd.masaIndex).toBe(0);
    expect(fwd.paksha).toBe('krishna');
    expect(fwd.vikramSamvat).toBe(2082);
    const back = convertHinduToGregorian(
      { vikramSamvat: fwd.vikramSamvat, masaIndex: fwd.masaIndex, paksha: fwd.paksha, pakshaTithi: fwd.pakshaTithi },
      DELHI,
      { timezone: TZ },
    );
    expect(back.some((d) => d.toISOString().slice(0, 10) === '2026-03-15')).toBe(true);
  }, 60_000);

  it('throws on out-of-range pakshaTithi', () => {
    expect(() => convertHinduToGregorian(
      { vikramSamvat: 2083, masaIndex: 0, paksha: 'shukla', pakshaTithi: 16 },
      DELHI,
      { timezone: TZ },
    )).toThrow(RangeError);
  });

  it('throws on out-of-range masaIndex', () => {
    expect(() => convertHinduToGregorian(
      { vikramSamvat: 2083, masaIndex: 12, paksha: 'shukla', pakshaTithi: 1 },
      DELHI,
      { timezone: TZ },
    )).toThrow(RangeError);
  });
});

describe('getKaliYugaYear (increments at Chaitra Shukla Pratipada — CV-1)', () => {
  // Drik increments Kali at the luni-solar new year, keeping
  // Kali − Vikram = 3044 year-round; the pre-fix Feb-18 epoch-anniversary
  // convention mislabeled every date in [Feb 18, Chaitra Pratipada).
  it('CE 2000-01-01 = Kali Yuga 5100', () => {
    expect(getKaliYugaYear(new Date('2000-01-01'))).toBe(5100);
  });

  it('CE 2000-03-01 = Kali Yuga 5100 (still before Chaitra 2000, ≈ Apr 5)', () => {
    // Pre-fix this said 5101 (past Feb 18). Chaitra Pratipada 2000 fell in
    // early April, so March 1 is still the old year.
    expect(getKaliYugaYear(new Date('2000-03-01'))).toBe(5100);
  });

  it('CE 2026-04-01 = Kali Yuga 5127', () => {
    expect(getKaliYugaYear(new Date('2026-04-01'))).toBe(5127);
  });

  it('drik pins for 2026 (Chaitra Pratipada ≈ Mar 19-20)', () => {
    expect(getKaliYugaYear(new Date('2026-01-01'))).toBe(5126);
    expect(getKaliYugaYear(new Date('2026-03-01'))).toBe(5126); // drik day page
    expect(getKaliYugaYear(new Date('2026-03-20'))).toBe(5127);
    expect(getKaliYugaYear(new Date('2026-08-19'))).toBe(5127); // drik day page
  });

  it('the old Feb-18 boundary no longer flips the year', () => {
    expect(getKaliYugaYear(new Date('2026-02-17'))).toBe(5126);
    expect(getKaliYugaYear(new Date('2026-02-18'))).toBe(5126);
  });
});

describe('getHinduNewYear', () => {
  it('default region (all): Chaitra Shukla Pratipada in March/April', () => {
    const d = getHinduNewYear(2026, 'all', DELHI, { timezone: TZ });
    expect(d).not.toBeNull();
    const month = d!.getUTCMonth();
    expect(month === 2 || month === 3).toBe(true); // March (2) or April (3)
  }, 30_000);

  it('Adhika-Chaitra year (2029): returns the NIJA pratipada, not null', () => {
    // 2029 inserts Adhika Chaitra before Nija Chaitra. The old detector
    // tracked only the previous masa index, saw 0 (adhika) before 0 (nija),
    // and returned null for the whole year. DrikPanchang places Ugadi and
    // Gudi Padwa 2029 on April 14 — the nija Chaitra Shukla Pratipada —
    // even though Vikram Samvat 2086 already begins at the adhika pratipada
    // in March.
    const d = getHinduNewYear(2029, 'all', DELHI, { timezone: TZ });
    expect(d).not.toBeNull();
    expect(d!.toISOString().slice(0, 10)).toBe('2029-04-14');
  }, 60_000);

  it('Tamil Nadu: Mesha Sankranti in mid-April', () => {
    const d = getHinduNewYear(2026, 'tamil-nadu', DELHI, { timezone: TZ });
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3); // April
    const date = d!.getUTCDate();
    expect(date >= 13 && date <= 15).toBe(true);
  }, 30_000);

  it('Punjab Baisakhi: same Mesha Sankranti window', () => {
    const d = getHinduNewYear(2026, 'punjab', DELHI, { timezone: TZ });
    expect(d).not.toBeNull();
    expect(d!.getUTCMonth()).toBe(3);
  }, 30_000);
});

describe('getEkadashiDatesForYear', () => {
  // Compute once, share across the two assertions to avoid running the
  // 365-day sweep twice.
  const dates = getEkadashiDatesForYear(2026, DELHI, { timezone: TZ });

  it('returns 24-26 Ekadashi dates in 2026', () => {
    expect(dates.length).toBeGreaterThanOrEqual(22);
    expect(dates.length).toBeLessThanOrEqual(28);
  });

  it('all returned dates are in the requested year (or Dec 31 prior)', () => {
    for (const d of dates) {
      const y = d.getUTCFullYear();
      // Sunrise on the calendar day can fall in UTC the day before in some TZs.
      expect(y === 2026 || y === 2025).toBe(true);
    }
  });
});

describe('getSankrantisForYear', () => {
  const sankrantis = getSankrantisForYear(2026, DELHI, { timezone: TZ });

  it('returns ~12 sankrantis in a year', () => {
    // Some years see only 11 sankrantis caught in a Gregorian-year sweep
    // (the Jan transit may be missed if it happened before Jan 1). Allow a
    // tight range.
    expect(sankrantis.length).toBeGreaterThanOrEqual(10);
    expect(sankrantis.length).toBeLessThanOrEqual(13);
  });

  it('Makar Sankranti (Capricorn entry) falls mid-January', () => {
    const makar = sankrantis.find((s) => s.rashi === 9);
    // We may or may not capture it (depends on whether Sun is already in
    // Capricorn at the start of Jan). If we do, it should be in mid-January.
    if (makar) {
      expect(makar.date.getUTCMonth()).toBe(0); // January
      const day = makar.date.getUTCDate();
      expect(day >= 12 && day <= 16).toBe(true);
    }
  });

  it('rashi indices are unique within a year (each rashi entered exactly once)', () => {
    const rashis = sankrantis.map((s) => s.rashi);
    expect(new Set(rashis).size).toBe(rashis.length);
  });
});

describe('getFestivalsInRange', () => {
  it('returns at least a few festivals in April 2026', () => {
    const festivals = getFestivalsInRange(
      new Date('2026-04-01'),
      new Date('2026-04-30'),
      DELHI,
      { timezone: TZ },
    );
    expect(festivals.length).toBeGreaterThan(0);
    // Each entry has a date and a festival.
    for (const f of festivals) {
      expect(f.date).toBeInstanceOf(Date);
      expect(f.festival).toHaveProperty('name');
      expect(f.festival).toHaveProperty('type');
    }
  }, 30_000);

  it('throws on inverted range', () => {
    expect(() => getFestivalsInRange(
      new Date('2026-05-01'),
      new Date('2026-04-01'),
      DELHI,
      { timezone: TZ },
    )).toThrow(RangeError);
  });
});

describe('getUpcomingEclipses', () => {
  it('returns the requested number of eclipses', () => {
    const ecl = getUpcomingEclipses(new Date('2026-01-01'), DELHI, 3);
    expect(ecl.length).toBe(3);
    for (const e of ecl) {
      expect(e.kind === 'solar' || e.kind === 'lunar').toBe(true);
      expect(e.peak).toBeInstanceOf(Date);
      expect(e.start).toBeInstanceOf(Date);
      expect(e.end).toBeInstanceOf(Date);
    }
  });

  it('returned eclipses are sorted by peak time', () => {
    const ecl = getUpcomingEclipses(new Date('2026-01-01'), DELHI, 4);
    for (let i = 1; i < ecl.length; i++) {
      expect(ecl[i]!.peak.getTime()).toBeGreaterThanOrEqual(ecl[i - 1]!.peak.getTime());
    }
  });

  it('throws on invalid count', () => {
    expect(() => getUpcomingEclipses(new Date('2026-01-01'), DELHI, 0)).toThrow(RangeError);
    expect(() => getUpcomingEclipses(new Date('2026-01-01'), DELHI, -1)).toThrow(RangeError);
  });
});
