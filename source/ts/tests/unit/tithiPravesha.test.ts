// The PVR pravesha preserves the natal tithi and puts the sidereal Sun back in
// the natal rashi, so it can land a synodic month either side of the solar anniversary.

import { describe, it, expect } from 'vitest';
import {
  computeTithiPravesha,
  _computeNatalTithiIndexForTest,
} from '../../src/jyotish/tithiPravesha';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { getSiderealMoonLongitude } from '../../src/astronomy/moon';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

interface Fix {
  name: string;
  dateLocal: string;
  tzh: number;
  lat: number;
  lon: number;
}
const FIXTURE_CHARTS: Fix[] = (fixtures as { charts: Fix[] }).charts;

function localToUtc(dateLocal: string, tzh: number): Date {
  const [d, t] = dateLocal.split('T') as [string, string];
  const [y, mo, da] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm, ss] = t.split(':').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, mo - 1, da, hh, mm, ss) - Math.round(tzh * 3600_000));
}

function fixture(name: string): { utc: Date; loc: { latitude: number; longitude: number } } {
  const f = FIXTURE_CHARTS.find((c) => c.name === name);
  if (!f) throw new Error(`fixture not found: ${name}`);
  return {
    utc: localToUtc(f.dateLocal, f.tzh),
    loc: { latitude: f.lat, longitude: f.lon },
  };
}

const FIXTURE_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
  'Dhirubhai Ambani', 'Mukesh Ambani'] as const;

describe('computeTithiPravesha: tithi preservation', () => {
  it.each(FIXTURE_NAMES)('%s: praveshTithi === natalTithi (PVR redefinition holds)', (name) => {
    const { utc, loc } = fixture(name);
    const tp = computeTithiPravesha(utc, 30, loc);
    expect(tp.praveshTithi).toBe(tp.natalTithi);
  });

  it('age=1 also preserves tithi', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    const tp = computeTithiPravesha(utc, 1, loc);
    expect(tp.praveshTithi).toBe(tp.natalTithi);
  });

  it.each(FIXTURE_NAMES)('%s: ages 25/26/27 all preserve tithi', (name) => {
    const { utc, loc } = fixture(name);
    for (const age of [25, 26, 27]) {
      const tp = computeTithiPravesha(utc, age, loc);
      expect(tp.praveshTithi).toBe(tp.natalTithi);
    }
  });
});

describe('computeTithiPravesha: Sun in natal sidereal sign', () => {
  it.each(FIXTURE_NAMES)('%s: sidereal Sun at pravesha is in natal Sun rashi', (name) => {
    const { utc, loc } = fixture(name);
    const tp = computeTithiPravesha(utc, 30, loc);

    const natalSun = getSiderealSunLongitude(utc, 'lahiri');
    const natalSunRashi = Math.floor(natalSun / 30);

    const praveshSun = getSiderealSunLongitude(tp.praveshInstant, 'lahiri');
    const praveshSunRashi = Math.floor(praveshSun / 30);

    expect(praveshSunRashi).toBe(natalSunRashi);
  });
});

describe('computeTithiPravesha: Sun-Moon angular match', () => {
  it.each(FIXTURE_NAMES)('%s: (Moon − Sun) at pravesha == natal (Moon − Sun) to ≤ 0.005°', (name) => {
    const { utc, loc } = fixture(name);
    const tp = computeTithiPravesha(utc, 30, loc);

    const natalDelta =
      ((getSiderealMoonLongitude(utc, 'lahiri')
        - getSiderealSunLongitude(utc, 'lahiri')) % 360 + 360) % 360;
    const praveshDelta =
      ((getSiderealMoonLongitude(tp.praveshInstant, 'lahiri')
        - getSiderealSunLongitude(tp.praveshInstant, 'lahiri')) % 360 + 360) % 360;

    let diff = praveshDelta - natalDelta;
    diff = ((diff + 540) % 360) - 180;
    expect(Math.abs(diff)).toBeLessThan(0.005);
  });
});

describe('computeTithiPravesha: within ~1 month of solar anniversary', () => {
  it.each(FIXTURE_NAMES)(
    '%s: pravesha within ±30 days of natal-sun anniversary (one synodic period)',
    (name) => {
      const { utc, loc } = fixture(name);
      const age = 25;
      const tp = computeTithiPravesha(utc, age, loc);
      const calAnniv = utc.getTime() + age * 365.25636 * 86400_000;
      const drift = Math.abs(tp.praveshInstant.getTime() - calAnniv);
      expect(drift).toBeLessThan(31 * 86400_000);
    },
  );
});

describe('computeTithiPravesha: idempotency', () => {
  it('repeated calls give identical result', () => {
    const { utc, loc } = fixture('Narendra Modi');
    const a = computeTithiPravesha(utc, 30, loc);
    const b = computeTithiPravesha(utc, 30, loc);
    expect(a.praveshInstant.getTime()).toBe(b.praveshInstant.getTime());
    expect(a.varshaLagna.siderealLongitude).toBeCloseTo(b.varshaLagna.siderealLongitude, 6);
  });
});

describe('computeTithiPravesha: year-stride consistency', () => {
  it('praveshes for consecutive ages are within one synodic month of 365.25', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    const tp30 = computeTithiPravesha(utc, 30, loc);
    const tp31 = computeTithiPravesha(utc, 31, loc);
    const gap = (tp31.praveshInstant.getTime() - tp30.praveshInstant.getTime()) / 86400_000;
    expect(gap).toBeGreaterThan(335);
    expect(gap).toBeLessThan(395);
  });
});

describe('computeTithiPravesha: output structural shape', () => {
  it('returns all required fields', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    const tp = computeTithiPravesha(utc, 30, loc);

    expect(tp.praveshInstant).toBeInstanceOf(Date);
    expect(typeof tp.natalTithi).toBe('number');
    expect(typeof tp.praveshTithi).toBe('number');
    expect(tp.natalTithi).toBeGreaterThanOrEqual(0);
    expect(tp.natalTithi).toBeLessThan(30);
    expect(typeof tp.varshaLagna.siderealLongitude).toBe('number');
    expect(tp.planets).toHaveLength(9);
    expect(tp.bhava.houses).toHaveLength(12);
  });

  it('respects ayanamsa option (different ayanamsa → potentially different pravesha)', () => {
    const { utc, loc } = fixture('Narendra Modi');
    const tpLah = computeTithiPravesha(utc, 30, loc, { ayanamsa: 'lahiri' });
    const tpRam = computeTithiPravesha(utc, 30, loc, { ayanamsa: 'raman' });
    expect(tpLah.praveshInstant).toBeInstanceOf(Date);
    expect(tpRam.praveshInstant).toBeInstanceOf(Date);
    expect(tpLah.natalTithi).toBe(tpLah.praveshTithi);
    expect(tpRam.natalTithi).toBe(tpRam.praveshTithi);
  });

  it('respects houseSystem option', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    const tpWS = computeTithiPravesha(utc, 30, loc, { houseSystem: 'whole-sign' });
    const tpEq = computeTithiPravesha(utc, 30, loc, { houseSystem: 'equal' });
    expect(tpWS.bhava.system).toBe('whole-sign');
    expect(tpEq.bhava.system).toBe('equal');
  });

  it('rejects yearAge < 1', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    expect(() => computeTithiPravesha(utc, 0, loc)).toThrow(/positive integer/);
    expect(() => computeTithiPravesha(utc, -1, loc)).toThrow(/positive integer/);
    expect(() => computeTithiPravesha(utc, 1.5, loc)).toThrow(/positive integer/);
  });
});

describe('_computeNatalTithiIndexForTest: boundary cases', () => {
  it('Moon at Sun → tithi 0 (Pratipada start)', () => {
    expect(_computeNatalTithiIndexForTest(100, 100)).toBe(0);
    expect(_computeNatalTithiIndexForTest(100, 100.1)).toBe(0);
  });

  it('Moon 12° past Sun → tithi 1 (Dwitiya)', () => {
    expect(_computeNatalTithiIndexForTest(100, 112)).toBe(1);
  });

  it('Moon 180° past Sun → tithi 15 (Krishna Pratipada)', () => {
    expect(_computeNatalTithiIndexForTest(100, 280)).toBe(15);
  });

  it('Moon 348° past Sun → tithi 29 (Amavasya)', () => {
    expect(_computeNatalTithiIndexForTest(100, 100 + 348)).toBe(29);
  });

  it('handles wraparound: Moon 5°, Sun 350°', () => {
    expect(_computeNatalTithiIndexForTest(350, 5)).toBe(1);
  });
});

describe('Tithi Pravesha: hand pin on Sachin age 50', () => {
  it('all three primary invariants hold simultaneously', () => {
    const { utc, loc } = fixture('Sachin Tendulkar');
    const tp = computeTithiPravesha(utc, 50, loc);

    expect(tp.praveshTithi).toBe(tp.natalTithi);

    const natalSun = getSiderealSunLongitude(utc, 'lahiri');
    const praveshSun = getSiderealSunLongitude(tp.praveshInstant, 'lahiri');
    expect(Math.floor(praveshSun / 30)).toBe(Math.floor(natalSun / 30));

    const natalDelta =
      ((getSiderealMoonLongitude(utc, 'lahiri') - natalSun) % 360 + 360) % 360;
    const praveshDelta =
      ((getSiderealMoonLongitude(tp.praveshInstant, 'lahiri') - praveshSun) % 360 + 360) % 360;
    let diff = praveshDelta - natalDelta;
    diff = ((diff + 540) % 360) - 180;
    expect(Math.abs(diff)).toBeLessThan(0.01);
  });
});
