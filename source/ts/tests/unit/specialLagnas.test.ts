import { describe, it, expect } from 'vitest';
import {
  computeLagna, computeHoraLagna, computeGhatiLagna,
  computeBhavaLagna, computeSripatiLagna,
  _findSunriseBeforeForTest,
} from '../../src/jyotish/lagna';
import { computeBhava } from '../../src/jyotish/bhava';
import { computeSunrise } from '../../src/astronomy/sunrise';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import type { SripatiLagnaInfo } from '../../src/types/jyotish';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

describe('Special lagnas at sunrise: all collapse to the Sun at sunrise', () => {
  it('Hora / Ghati / Bhava at exact sunrise == Sun longitude at sunrise (within sub-arcsec)', () => {
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const hl = computeHoraLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(sunrise, DELHI).siderealLongitude;
    const bl = computeBhavaLagna(sunrise, DELHI).siderealLongitude;

    // Absorbs a few arcseconds of drift from the sunrise search's precision.
    expect(Math.abs(hl - sunAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(gl - sunAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(bl - sunAtSunrise)).toBeLessThan(0.005);
  });
});

describe('Special lagnas: 1-hour advance rates', () => {
  it('Hora Lagna advances 30° in 1 hour (1 sign per hour, BPHS Ch. 4)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const hl1h = computeHoraLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = hl1h - sunAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 75° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const gl1h = computeGhatiLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = gl1h - sunAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 75)).toBeLessThan(0.01);
  });

  it('Bhava Lagna advances 15° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const bl1h = computeBhavaLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = bl1h - sunAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 15)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 30° in 1 ghatika (24 minutes)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneGhatika = new Date(sunrise.getTime() + 24 * 60 * 1000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const gl = computeGhatiLagna(oneGhatika, DELHI).siderealLongitude;
    let delta = gl - sunAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });
});

describe('Special lagnas: periodicity', () => {
  it('Ghati Lagna returns to its starting value every 4.8 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const start = sunrise;
    const after = new Date(sunrise.getTime() + 4.8 * 3600_000);

    const glStart = computeGhatiLagna(start, DELHI).siderealLongitude;
    const glAfter = computeGhatiLagna(after, DELHI).siderealLongitude;
    let delta = glAfter - glStart;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.5);
  });

  it('Hora Lagna returns to its starting value every 12 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const after = new Date(sunrise.getTime() + 12 * 3600_000);

    const hlStart = computeHoraLagna(sunrise, DELHI).siderealLongitude;
    const hlAfter = computeHoraLagna(after, DELHI).siderealLongitude;
    let delta = hlAfter - hlStart;
    delta = ((delta + 540) % 360) - 180;
    // After 12h, sunrise has shifted by ~1 minute, so allow up to ~1° drift.
    expect(Math.abs(delta)).toBeLessThan(1.0);
  });

  it('Bhava Lagna returns to its starting value every 24 hours', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const after = new Date(sunrise.getTime() + 24 * 3600_000);

    const blStart = computeBhavaLagna(sunrise, DELHI).siderealLongitude;
    const blAfter = computeBhavaLagna(after, DELHI).siderealLongitude;
    let delta = blAfter - blStart;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(1.5);
  });
});

describe('Hora Lagna and Bhava Lagna: distinct rates', () => {
  it('Hora (30°/hr) and Bhava (15°/hr) diverge after t > 0', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    for (const hours of [1, 2.5, 6]) {
      const t = new Date(sunrise.getTime() + hours * 3600_000);
      const hl = computeHoraLagna(t, DELHI).siderealLongitude;
      const bl = computeBhavaLagna(t, DELHI).siderealLongitude;
      let delta = hl - bl;
      delta = ((delta + 540) % 360) - 180;
      const expected = 15 * hours;
      const expectedMod = ((expected + 540) % 360) - 180;
      expect(Math.abs(delta - expectedMod)).toBeLessThan(0.05);
    }
  });
});

describe('Sripati Lagna: equals natal lagna', () => {
  it('matches computeLagna at the same instant', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const natal = computeLagna(date, DELHI);
    const sripati = computeSripatiLagna(date, DELHI);
    expect(sripati.siderealLongitude).toBeCloseTo(natal.siderealLongitude, 6);
    expect(sripati.rashi.index).toBe(natal.rashi.index);
    expect(sripati.nakshatra.index).toBe(natal.nakshatra.index);
  });
});

describe('Special lagnas: output structural shape', () => {
  const date = new Date('2025-01-14T08:00:00Z');

  it('every special lagna returns a well-formed LagnaInfo', () => {
    for (const fn of [computeHoraLagna, computeGhatiLagna, computeBhavaLagna, computeSripatiLagna]) {
      const r = fn(date, DELHI);
      expect(r.siderealLongitude).toBeGreaterThanOrEqual(0);
      expect(r.siderealLongitude).toBeLessThan(360);
      expect(r.rashi.index).toBeGreaterThanOrEqual(0);
      expect(r.rashi.index).toBeLessThan(12);
      expect(r.degreeInRashi).toBeGreaterThanOrEqual(0);
      expect(r.degreeInRashi).toBeLessThan(30);
      expect(r.nakshatra.index).toBeGreaterThanOrEqual(0);
      expect(r.nakshatra.index).toBeLessThan(27);
      expect(r.pada).toBeGreaterThanOrEqual(1);
      expect(r.pada).toBeLessThanOrEqual(4);
      expect(typeof r.rashi.name).toBe('string');
      expect(typeof r.nakshatra.name).toBe('string');
    }
  });

  it("respects 'hi' locale for rashi/nakshatra names", () => {
    const r = computeHoraLagna(date, DELHI, 'lahiri', 'hi');
    expect(r.rashi.name.length).toBeGreaterThan(0);
    // Devanagari, so the first char is above ASCII.
    const firstChar = r.rashi.name.charCodeAt(0);
    expect(firstChar).toBeGreaterThan(127);
  });
});

describe('_findSunriseBeforeForTest', () => {
  it('returns sunrise on the same calendar day for noon birth', () => {
    const noon = new Date('2025-01-14T08:00:00Z');
    const sunrise = _findSunriseBeforeForTest(noon, DELHI);
    expect(sunrise.getTime()).toBeLessThan(noon.getTime());
    expect(noon.getTime() - sunrise.getTime()).toBeLessThan(24 * 3600_000);
  });

  it('returns prior-day sunrise for pre-sunrise birth', () => {
    const earlyMorning = new Date('2025-01-14T01:00:00Z');
    const sunrise = _findSunriseBeforeForTest(earlyMorning, DELHI);
    expect(sunrise.getTime()).toBeLessThan(earlyMorning.getTime());
  });

  it('idempotent: sunrise(t) where t is itself a sunrise', () => {
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);
    const result = _findSunriseBeforeForTest(sunrise, DELHI);
    expect(Math.abs(result.getTime() - sunrise.getTime())).toBeLessThan(60_000);
  });
});

describe('Special lagnas: 2-hour cross-check', () => {
  it('Hora at +2h = sunrise asc + 60° (2 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const hl = computeHoraLagna(t, DELHI).siderealLongitude;
    const expected = (sunAtSunrise + 60) % 360;
    let delta = hl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });

  it('Ghati at +2h = sunrise asc + 150° (5 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const sunAtSunrise = getSiderealSunLongitude(sunrise, 'lahiri');
    const gl = computeGhatiLagna(t, DELHI).siderealLongitude;
    const expected = (sunAtSunrise + 150) % 360;
    let delta = gl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });
});

// Sripati Paddhati trisects each ASC to IC to DSC to MC quadrant into the 12
// bhava-madhya cusps. No almanac publishes a Sripati cusp table, so the pins
// below were hand-derived from the verified ASC + MC (Meeus eq. 13.6).

function mod360(x: number): number { return ((x % 360) + 360) % 360; }
function angularDelta(a: number, b: number): number {
  return mod360(a - b + 540) - 180;
}

describe('Sripati Lagna: includeCusps option', () => {
  it('default call (no options) still returns a plain LagnaInfo, no cusps field', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const result = computeSripatiLagna(date, DELHI);
    expect(result.siderealLongitude).toBeCloseTo(
      computeLagna(date, DELHI).siderealLongitude, 6,
    );
    expect((result as Partial<SripatiLagnaInfo>).cusps).toBeUndefined();
  });

  it('explicit { includeCusps: false } is identical to the default', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const a = computeSripatiLagna(date, DELHI);
    const b = computeSripatiLagna(date, DELHI, 'lahiri', 'en',
                                  { includeCusps: false });
    expect(a).toEqual(b);
    expect((b as Partial<SripatiLagnaInfo>).cusps).toBeUndefined();
  });

  it('{ includeCusps: true } returns 12 finite cusps in [0, 360)', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const r = computeSripatiLagna(date, DELHI, 'lahiri', 'en',
                                  { includeCusps: true });
    expect(r.cusps).toHaveLength(12);
    for (const c of r.cusps) {
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(360);
    }
    expect(r.cusps[0]!).toBeCloseTo(r.siderealLongitude, 8);
  });
});

describe('Sripati cusps: antipodal + quadrant-sum invariants', () => {
  // BPHS Ch.5: opposite cusps differ by exactly 180°.
  const CHARTS: Array<[string, Date, { latitude: number; longitude: number }]> = [
    ['Modi-natal',         new Date('1950-09-17T05:30:00Z'), { latitude:  23.78,  longitude:  72.63   }],
    ['Sachin-natal',       new Date('1973-04-24T08:55:00Z'), { latitude:  18.966, longitude:  72.833  }],
    ['Zuckerberg-natal',   new Date('1984-05-14T05:00:00Z'), { latitude:  40.70,  longitude: -74.00   }],
    ['Gates-natal',        new Date('1955-10-29T04:58:00Z'), { latitude:  47.60,  longitude: -122.333 }],
    ['SriSriRaviShankar',  new Date('1956-05-12T18:30:00Z'), { latitude:   8.767, longitude:  77.383  }],
  ];

  for (const [name, date, loc] of CHARTS) {
    it(`${name}: opposite cusps differ by exactly 180°`, () => {
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      for (let i = 0; i < 6; i++) {
        const delta = angularDelta(cusps[i + 6]!, cusps[i]!);
        expect(Math.abs(Math.abs(delta) - 180)).toBeLessThan(1e-9);
      }
    });

    it(`${name}: quadrant arcs sum to 360°`, () => {
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      const arcQ1 = mod360(cusps[3]!  - cusps[0]!);
      const arcQ2 = mod360(cusps[6]!  - cusps[3]!);
      const arcQ3 = mod360(cusps[9]!  - cusps[6]!);
      const arcQ4 = mod360(cusps[0]!  + 360 - cusps[9]!);
      expect(arcQ1 + arcQ2 + arcQ3 + arcQ4).toBeCloseTo(360, 9);
      expect(angularDelta(arcQ1, arcQ3)).toBeCloseTo(0, 9);
      expect(angularDelta(arcQ2, arcQ4)).toBeCloseTo(0, 9);
    });

    it(`${name}: each non-angular cusp lies at the predicted trisection point`, () => {
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      const arcQ1 = mod360(cusps[3]!  - cusps[0]!);
      const arcQ2 = mod360(cusps[6]!  - cusps[3]!);
      const arcQ3 = mod360(cusps[9]!  - cusps[6]!);
      const arcQ4 = mod360(cusps[0]!  + 360 - cusps[9]!);
      expect(angularDelta(cusps[1]!,  mod360(cusps[0]! + arcQ1 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[2]!,  mod360(cusps[0]! + 2 * arcQ1 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[4]!,  mod360(cusps[3]! + arcQ2 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[5]!,  mod360(cusps[3]! + 2 * arcQ2 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[7]!,  mod360(cusps[6]! + arcQ3 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[8]!,  mod360(cusps[6]! + 2 * arcQ3 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[10]!, mod360(cusps[9]! + arcQ4 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[11]!, mod360(cusps[9]! + 2 * arcQ4 / 3))).toBeCloseTo(0, 9);
    });
  }
});

describe('Sripati cusps: angular cusps match computeBhava ASC / MC', () => {
  it('cusps[0]! equals BhavaChart.ascendantLongitude and cusps[9]! equals BhavaChart.mcLongitude', () => {
    const date = new Date('1984-05-14T05:00:00Z'); // Zuckerberg natal, mid latitude.
    const loc = { latitude: 40.70, longitude: -74.00 };
    const bhava = computeBhava(date, loc, { houseSystem: 'whole-sign' });
    const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                          { includeCusps: true });
    expect(angularDelta(cusps[0]!, bhava.ascendantLongitude)).toBeCloseTo(0, 8);
    expect(angularDelta(cusps[9]!, bhava.mcLongitude)).toBeCloseTo(0, 8);
    expect(angularDelta(cusps[3]!, mod360(bhava.mcLongitude + 180))).toBeCloseTo(0, 8);
    expect(angularDelta(cusps[6]!, mod360(bhava.ascendantLongitude + 180))).toBeCloseTo(0, 8);
  });
});

describe('Sripati cusps: fixture pin sweep (hand-derived predictions)', () => {
  // Hand-derived pins, never regenerated from implementation output. The 1e-4°
  // tolerance absorbs float-equality wobble in the ASC/MC inputs.
  const TOL = 1e-4;

  type Pin = { name: string; utc: string; lat: number; lon: number; cusps: number[] };
  const PINS: Pin[] = [
    {
      name: 'Narendra Modi',
      utc: '1950-09-17T05:30:00.000Z',
      lat: 23.78, lon: 72.63,
      cusps: [
        211.239061, 242.621567, 274.004073, 305.386579,
        334.004073,   2.621567,  31.239061,  62.621567,
         94.004073, 125.386579, 154.004073, 182.621567,
      ],
    },
    {
      name: 'Sachin Tendulkar',
      utc: '1973-04-24T08:55:00.000Z',
      lat: 18.966, lon: 72.833,
      cusps: [
        127.194029, 157.289466, 187.384902, 217.480339,
        247.384902, 277.289466, 307.194029, 337.289466,
          7.384902,  37.480339,  67.384902,  97.289466,
      ],
    },
    {
      name: 'Mark Zuckerberg',
      utc: '1984-05-14T05:00:00.000Z',
      lat: 40.70, lon: -74.00,
      cusps: [
        279.489667, 316.931492, 354.373317,  31.815142,
         54.373317,  76.931492,  99.489667, 136.931492,
        174.373317, 211.815142, 234.373317, 256.931492,
      ],
    },
    {
      name: 'Bill Gates',
      utc: '1955-10-29T04:58:00.000Z',
      lat: 47.60, lon: -122.333,
      cusps: [
         81.562025, 102.610344, 123.658662, 144.706981,
        183.658662, 222.610344, 261.562025, 282.610344,
        303.658662, 324.706981,   3.658662,  42.610344,
      ],
    },
    {
      name: 'Sri Sri Ravi Shankar',
      utc: '1956-05-12T18:30:00.000Z',
      lat: 8.767, lon: 77.383,
      cusps: [
        286.855619, 319.433960, 352.012302,  24.590643,
         52.012302,  79.433960, 106.855619, 139.433960,
        172.012302, 204.590643, 232.012302, 259.433960,
      ],
    },
  ];

  for (const pin of PINS) {
    it(`${pin.name}: 12 cusps match hand-derived predictions to within ${TOL}°`, () => {
      const date = new Date(pin.utc);
      const loc = { latitude: pin.lat, longitude: pin.lon };
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      for (let i = 0; i < 12; i++) {
        const delta = Math.abs(angularDelta(cusps[i]!, pin.cusps[i]!));
        expect(delta).toBeLessThan(TOL);
      }
    });
  }
});

describe('Sripati cusps: equator (φ=0) regression', () => {
  // At φ=0 the ASC and MC are 90° apart in right ascension, but their ecliptic
  // separation still varies with LST because the ecliptic is tilted ε ≈ 23.4°,
  // so Sripati does NOT degenerate to Equal House at the equator.
  it('returns 12 well-formed cusps at the equator (no special-case path)', () => {
    const date = new Date('2025-03-21T12:00:00Z');
    const loc = { latitude: 0, longitude: 0 };
    const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                          { includeCusps: true });
    expect(cusps).toHaveLength(12);
    for (const c of cusps) {
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(360);
    }
    for (let i = 0; i < 6; i++) {
      const delta = angularDelta(cusps[i + 6]!, cusps[i]!);
      expect(Math.abs(Math.abs(delta) - 180)).toBeLessThan(1e-9);
    }
  });
});
