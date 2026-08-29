import { describe, it, expect } from 'vitest';
import { computeLagna } from '../../src/jyotish/lagna';
import { computeAyanamsa } from '../../src/astronomy/ayanamsa';
import { normalize360 } from '../../src/utils/angle';
import { PanchangError } from '../../src/types/errors';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const QUITO = { latitude: -0.1807, longitude: -78.4678 };

describe('computeLagna: basic shape and output range', () => {
  it('returns a sidereal longitude in [0, 360) and consistent rashi/nakshatra/pada', () => {
    const lagna = computeLagna(new Date('2025-01-15T05:30:00Z'), DELHI);
    expect(lagna.siderealLongitude).toBeGreaterThanOrEqual(0);
    expect(lagna.siderealLongitude).toBeLessThan(360);

    expect(lagna.rashi.index).toBe(Math.floor(lagna.siderealLongitude / 30));
    expect(lagna.degreeInRashi).toBeGreaterThanOrEqual(0);
    expect(lagna.degreeInRashi).toBeLessThan(30);
    expect(lagna.rashi.index * 30 + lagna.degreeInRashi).toBeCloseTo(lagna.siderealLongitude, 9);

    expect(lagna.nakshatra.index).toBeGreaterThanOrEqual(0);
    expect(lagna.nakshatra.index).toBeLessThan(27);
    expect(lagna.pada).toBeGreaterThanOrEqual(1);
    expect(lagna.pada).toBeLessThanOrEqual(4);
  });

  it('localizes rashi and nakshatra names to Hindi when lang="hi"', () => {
    const enLagna = computeLagna(new Date('2025-01-15T05:30:00Z'), DELHI, 'lahiri', 'en');
    const hiLagna = computeLagna(new Date('2025-01-15T05:30:00Z'), DELHI, 'lahiri', 'hi');
    expect(enLagna.rashi.index).toBe(hiLagna.rashi.index);
    expect(enLagna.nakshatra.index).toBe(hiLagna.nakshatra.index);
    expect(hiLagna.rashi.name).not.toBe(enLagna.rashi.name);
    expect(hiLagna.nakshatra.name).not.toBe(enLagna.nakshatra.name);
  });
});

describe('computeLagna: diurnal motion (covers all 12 rashis in 24h)', () => {
  it('Delhi: every rashi appears at least once in a 24h sweep', () => {
    const seen = new Set<number>();
    const start = new Date('2025-03-21T00:00:00Z');
    for (let h = 0; h < 24; h++) {
      const date = new Date(start.getTime() + h * 3600_000);
      seen.add(computeLagna(date, DELHI).rashi.index);
    }
    expect(seen.size).toBe(12);
  });

  it('Sydney (southern hemisphere): every rashi appears at least once in a 24h sweep', () => {
    const seen = new Set<number>();
    const start = new Date('2025-06-21T00:00:00Z');
    for (let h = 0; h < 24; h++) {
      const date = new Date(start.getTime() + h * 3600_000);
      seen.add(computeLagna(date, SYDNEY).rashi.index);
    }
    expect(seen.size).toBe(12);
  });

  it('Equator (Quito): every rashi appears at least once in a 24h sweep', () => {
    const seen = new Set<number>();
    const start = new Date('2025-09-23T00:00:00Z');
    for (let h = 0; h < 24; h++) {
      const date = new Date(start.getTime() + h * 3600_000);
      seen.add(computeLagna(date, QUITO).rashi.index);
    }
    expect(seen.size).toBe(12);
  });

  it('mean rate over 24h ≈ 360° (one full revolution per sidereal day)', () => {
    const start = new Date('2025-04-10T00:00:00Z');
    let unwrapped = 0;
    let prev = computeLagna(start, DELHI).siderealLongitude;
    for (let m = 5; m <= 24 * 60; m += 5) {
      const date = new Date(start.getTime() + m * 60_000);
      const cur = computeLagna(date, DELHI).siderealLongitude;
      let delta = cur - prev;
      if (delta < -180) delta += 360;
      if (delta > 180) delta -= 360;
      unwrapped += delta;
      prev = cur;
    }
    expect(unwrapped).toBeGreaterThan(355);
    expect(unwrapped).toBeLessThan(365);
  });
});

describe('computeLagna: sidereal-day periodicity', () => {
  it('reproduces itself within ~0.5° one sidereal day later (Delhi)', () => {
    const t0 = new Date('2025-05-15T08:00:00Z');
    const t1 = new Date(t0.getTime() + (23 * 3600 + 56 * 60 + 4.0905) * 1000);
    const a = computeLagna(t0, DELHI);
    const b = computeLagna(t1, DELHI);
    let diff = Math.abs(b.siderealLongitude - a.siderealLongitude);
    if (diff > 180) diff = 360 - diff;
    expect(diff).toBeLessThan(0.5);
  });
});

describe('computeLagna: sidereal/tropical/ayanamsa relationship', () => {
  it('lahiri lagna at a given instant differs from raman lagna by exactly the ayanamsa difference', () => {
    const date = new Date('2025-07-04T12:34:56Z');
    const lahiri = computeLagna(date, DELHI, 'lahiri').siderealLongitude;
    const raman = computeLagna(date, DELHI, 'raman').siderealLongitude;
    const expectedDiff = computeAyanamsa(date, 'raman') - computeAyanamsa(date, 'lahiri');
    let actualDiff = lahiri - raman;
    actualDiff = normalize360(actualDiff + 360);
    if (actualDiff > 180) actualDiff -= 360;
    expect(actualDiff).toBeCloseTo(expectedDiff, 6);
  });

  it('krishnamurti vs lahiri: difference matches ayanamsa difference', () => {
    const date = new Date('2025-11-22T03:45:00Z');
    const lahiri = computeLagna(date, DELHI, 'lahiri').siderealLongitude;
    const kp = computeLagna(date, DELHI, 'krishnamurti').siderealLongitude;
    const expectedDiff = computeAyanamsa(date, 'lahiri') - computeAyanamsa(date, 'krishnamurti');
    let actualDiff = kp - lahiri;
    if (actualDiff > 180) actualDiff -= 360;
    if (actualDiff < -180) actualDiff += 360;
    expect(actualDiff).toBeCloseTo(expectedDiff, 6);
  });
});

describe('computeLagna: input validation', () => {
  it('throws on an out-of-range date (year < 1900)', () => {
    expect(() => computeLagna(new Date('1869-10-02T01:33:00Z'), DELHI))
      .toThrow(PanchangError);
  });

  it('throws on an out-of-range date (year > 2100)', () => {
    expect(() => computeLagna(new Date('2150-01-01T00:00:00Z'), DELHI))
      .toThrow(PanchangError);
  });

  it('throws on an invalid latitude', () => {
    expect(() => computeLagna(new Date('2025-01-01T00:00:00Z'), { latitude: 91, longitude: 0 }))
      .toThrow(PanchangError);
  });

  it('throws on an invalid longitude', () => {
    expect(() => computeLagna(new Date('2025-01-01T00:00:00Z'), { latitude: 0, longitude: 181 }))
      .toThrow(PanchangError);
  });

  it('throws on an invalid Date', () => {
    expect(() => computeLagna(new Date('not-a-date'), DELHI)).toThrow(PanchangError);
  });
});

describe('computeLagna: known reference values (locked-in regression checks)', () => {
  it('PM Modi birth: 17 Sep 1950 11:00 IST, Vadnagar, Vrischika lagna', () => {
    const lagna = computeLagna(
      new Date('1950-09-17T05:30:00Z'),
      { latitude: 23.78, longitude: 72.63 },
      'lahiri',
    );
    // Published charts give Modi's lagna as Vrischika.
    expect(lagna.rashi.index).toBe(7);
  });

  it('repeated calls are deterministic', () => {
    const date = new Date('2025-03-15T10:00:00Z');
    const a = computeLagna(date, DELHI);
    const b = computeLagna(date, DELHI);
    expect(a.siderealLongitude).toBe(b.siderealLongitude);
    expect(a.nakshatra.index).toBe(b.nakshatra.index);
    expect(a.pada).toBe(b.pada);
  });
});
