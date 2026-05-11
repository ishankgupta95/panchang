/**
 * Unit tests for the special lagnas added in Step 32-4 — Hora Lagna,
 * Ghati Lagna, Bhava Lagna, Sripati Lagna.
 *
 * Strategy:
 *   1. **Boundary case at sunrise** — at the exact sunrise instant, all
 *      three time-derived lagnas (Hora / Ghati / Bhava) collapse to the
 *      same value as the lagna at sunrise.
 *   2. **Rate verification** — 1 hour after sunrise, Hora Lagna advances
 *      30° (1 sign per hour), Ghati 75° (1 sign per ghatika = 24 min),
 *      Bhava 15° (1 sign per 2 hours). Pinned per the classical BPHS
 *      Ch. 4 / Phaladeepika Ch. 1 rates.
 *   3. **Periodicity** — Ghati Lagna returns every 4.8 hours; Hora
 *      Lagna every 12 hours; Bhava Lagna every 24 hours.
 *   4. **Hora ≢ Bhava** — Hora (30°/hr) and Bhava (15°/hr) advance at
 *      different rates and yield distinct longitudes after t > 0.
 *   5. **Sripati == natal lagna** — Sripati Lagna equals the natal
 *      ascendant in the cusp-form definition.
 *   6. **Output shape** — all four functions return a `LagnaInfo` with
 *      well-formed rashi / nakshatra / pada fields.
 *   7. **Sunrise lookup** — `_findSunriseBeforeForTest` correctly
 *      returns the sunrise on or before the given instant for various
 *      times of day.
 */

import { describe, it, expect } from 'vitest';
import {
  computeLagna, computeHoraLagna, computeGhatiLagna,
  computeBhavaLagna, computeSripatiLagna,
  _findSunriseBeforeForTest,
} from '../../src/jyotish/lagna';
import { computeBhava } from '../../src/jyotish/bhava';
import { computeSunrise } from '../../src/astronomy/sunrise';
import type { SripatiLagnaInfo } from '../../src/types/jyotish';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

// ── 1. Sunrise boundary ───────────────────────────────

describe('Special lagnas at sunrise — all collapse to natal asc', () => {
  it('Hora / Ghati / Bhava at exact sunrise == lagna at sunrise (within sub-arcsec)', () => {
    // Pick a date and compute its sunrise.
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl = computeHoraLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(sunrise, DELHI).siderealLongitude;
    const bl = computeBhavaLagna(sunrise, DELHI).siderealLongitude;

    // At t=sunrise, hoursSince = 0, so all three should equal ascAtSunrise
    // up to a few-arcsecond drift from `SearchRiseSet`'s internal precision.
    expect(Math.abs(hl - ascAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(gl - ascAtSunrise)).toBeLessThan(0.005);
    expect(Math.abs(bl - ascAtSunrise)).toBeLessThan(0.005);
  });
});

// ── 2. Rate verification — 1 hour after sunrise ──────

describe('Special lagnas — 1-hour advance rates', () => {
  it('Hora Lagna advances 30° in 1 hour (1 sign per hour, BPHS Ch. 4)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl1h = computeHoraLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = hl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 75° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl1h = computeGhatiLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = gl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 75)).toBeLessThan(0.01);
  });

  it('Bhava Lagna advances 15° in 1 hour', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneHourLater = new Date(sunrise.getTime() + 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const bl1h = computeBhavaLagna(oneHourLater, DELHI).siderealLongitude;
    let delta = bl1h - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 15)).toBeLessThan(0.01);
  });

  it('Ghati Lagna advances 30° in 1 ghatika (24 minutes)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const oneGhatika = new Date(sunrise.getTime() + 24 * 60 * 1000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(oneGhatika, DELHI).siderealLongitude;
    let delta = gl - ascAtSunrise;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta - 30)).toBeLessThan(0.01);
  });
});

// ── 3. 24-hour cycle / return ─────────────────────────

describe('Special lagnas — periodicity', () => {
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

// ── 4. Hora ≢ Bhava (distinct rates per BPHS) ─────────

describe('Hora Lagna and Bhava Lagna — distinct rates', () => {
  it('Hora (30°/hr) and Bhava (15°/hr) diverge after t > 0', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    // After 1 hour, Hora has advanced 30° and Bhava 15° → Hora - Bhava = 15°.
    for (const hours of [1, 2.5, 6]) {
      const t = new Date(sunrise.getTime() + hours * 3600_000);
      const hl = computeHoraLagna(t, DELHI).siderealLongitude;
      const bl = computeBhavaLagna(t, DELHI).siderealLongitude;
      let delta = hl - bl;
      delta = ((delta + 540) % 360) - 180;
      // Hora advances 30°/hr, Bhava 15°/hr — difference grows at 15°/hr.
      const expected = 15 * hours;
      // Modulo 360 so very long t doesn't break the comparison.
      const expectedMod = ((expected + 540) % 360) - 180;
      expect(Math.abs(delta - expectedMod)).toBeLessThan(0.05);
    }
  });
});

// ── 5. Sripati == natal lagna ─────────────────────────

describe('Sripati Lagna — equals natal lagna', () => {
  it('matches computeLagna at the same instant', () => {
    const date = new Date('1995-08-15T05:30:00Z');
    const natal = computeLagna(date, DELHI);
    const sripati = computeSripatiLagna(date, DELHI);
    expect(sripati.siderealLongitude).toBeCloseTo(natal.siderealLongitude, 6);
    expect(sripati.rashi.index).toBe(natal.rashi.index);
    expect(sripati.nakshatra.index).toBe(natal.nakshatra.index);
  });
});

// ── 6. Output structural shape ────────────────────────

describe('Special lagnas — output structural shape', () => {
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
    // Hindi names are Devanagari; first char shouldn't be ASCII.
    const firstChar = r.rashi.name.charCodeAt(0);
    expect(firstChar).toBeGreaterThan(127);
  });
});

// ── 7. Sunrise lookup helper ──────────────────────────

describe('_findSunriseBeforeForTest', () => {
  it('returns sunrise on the same calendar day for noon birth', () => {
    const noon = new Date('2025-01-14T08:00:00Z'); // ~13:30 IST
    const sunrise = _findSunriseBeforeForTest(noon, DELHI);
    expect(sunrise.getTime()).toBeLessThan(noon.getTime());
    // Sunrise should be within 24h of noon.
    expect(noon.getTime() - sunrise.getTime()).toBeLessThan(24 * 3600_000);
  });

  it('returns prior-day sunrise for pre-sunrise birth', () => {
    // Pick a UTC instant that's before sunrise on its local day.
    const earlyMorning = new Date('2025-01-14T01:00:00Z'); // ~06:30 IST, before sunrise
    const sunrise = _findSunriseBeforeForTest(earlyMorning, DELHI);
    expect(sunrise.getTime()).toBeLessThan(earlyMorning.getTime());
  });

  it('idempotent: sunrise(t) where t is itself a sunrise', () => {
    const seed = new Date('2025-01-14T00:00:00Z');
    const sunrise = computeSunrise(seed, DELHI);
    // Calling _findSunriseBeforeForTest at the sunrise instant itself
    // should return that same sunrise (since it's <= the input).
    const result = _findSunriseBeforeForTest(sunrise, DELHI);
    expect(Math.abs(result.getTime() - sunrise.getTime())).toBeLessThan(60_000);
  });
});

// ── 8. Cross-sanity: 2 hours after sunrise ────────────

describe('Special lagnas — 2-hour cross-check', () => {
  it('Hora at +2h = sunrise asc + 60° (2 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const hl = computeHoraLagna(t, DELHI).siderealLongitude;
    const expected = (ascAtSunrise + 60) % 360;
    let delta = hl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });

  it('Ghati at +2h = sunrise asc + 150° (5 rashis)', () => {
    const sunrise = computeSunrise(new Date('2025-01-14T00:00:00Z'), DELHI);
    const t = new Date(sunrise.getTime() + 2 * 3600_000);

    const ascAtSunrise = computeLagna(sunrise, DELHI).siderealLongitude;
    const gl = computeGhatiLagna(t, DELHI).siderealLongitude;
    const expected = (ascAtSunrise + 150) % 360;
    let delta = gl - expected;
    delta = ((delta + 540) % 360) - 180;
    expect(Math.abs(delta)).toBeLessThan(0.05);
  });
});

// ── 9. Sripati cusp 2–12 midpoints (Phase 34e item 1) ──
//
// Sripati Paddhati trisects each ASC → IC → DSC → MC → ASC ecliptic-arc
// quadrant to produce all 12 bhava-madhya cusps. Drik panchang publishes
// no Sripati cusp table on any of its 18 jyotish calculators; the formula
// is unanimous across surveyed secondary sources. The 5-chart prediction
// table below was hand-derived in `notes/phase34e-sripati-derive.mjs`
// from the library's already-verified ASC + MC (Meeus eq. 13.6 form),
// with the trisection implemented INLINE in the derive script, NOT in
// the library. The library implementation is checked AGAINST these
// pinned predictions — see notes/phase34e-sripati-research.md and
// memory/feedback_fixture_repinning.md for the anti-circular workflow.

function mod360(x: number): number { return ((x % 360) + 360) % 360; }
function angularDelta(a: number, b: number): number {
  return mod360(a - b + 540) - 180;
}

describe('Sripati Lagna — includeCusps option (Phase 34e item 1)', () => {
  it('default call (no options) still returns a plain LagnaInfo — no cusps field', () => {
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
    // cusp[0] is the lagna by construction.
    expect(r.cusps[0]).toBeCloseTo(r.siderealLongitude, 8);
  });
});

describe('Sripati cusps — antipodal + quadrant-sum invariants', () => {
  // BPHS Ch.5 invariant: opposite cusps differ by exactly 180°
  // (since cusp_4 = cusp_10+180 and cusp_7 = cusp_1+180 by construction,
  // and the trisected intermediates inherit the antipodal symmetry).
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
        const delta = angularDelta(cusps[i + 6], cusps[i]);
        expect(Math.abs(Math.abs(delta) - 180)).toBeLessThan(1e-9);
      }
    });

    it(`${name}: quadrant arcs sum to 360°`, () => {
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      const arcQ1 = mod360(cusps[3]  - cusps[0]);
      const arcQ2 = mod360(cusps[6]  - cusps[3]);
      const arcQ3 = mod360(cusps[9]  - cusps[6]);
      const arcQ4 = mod360(cusps[0]  + 360 - cusps[9]);
      expect(arcQ1 + arcQ2 + arcQ3 + arcQ4).toBeCloseTo(360, 9);
      // Sripati symmetry: q1 == q3 and q2 == q4 (mod 360).
      expect(angularDelta(arcQ1, arcQ3)).toBeCloseTo(0, 9);
      expect(angularDelta(arcQ2, arcQ4)).toBeCloseTo(0, 9);
    });

    it(`${name}: each non-angular cusp lies at the predicted trisection point`, () => {
      // Re-derive arc trisection: cusp_2 should be cusp_1 + arc_q1/3 etc.
      // This re-derives the formula from first principles inside the test
      // and pins the implementation to it — the implementation is allowed
      // to compute arc_q1 however it likes (e.g. internally), but the
      // *result* must match the trisection prediction.
      const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                            { includeCusps: true });
      const arcQ1 = mod360(cusps[3]  - cusps[0]);
      const arcQ2 = mod360(cusps[6]  - cusps[3]);
      const arcQ3 = mod360(cusps[9]  - cusps[6]);
      const arcQ4 = mod360(cusps[0]  + 360 - cusps[9]);
      expect(angularDelta(cusps[1],  mod360(cusps[0] + arcQ1 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[2],  mod360(cusps[0] + 2 * arcQ1 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[4],  mod360(cusps[3] + arcQ2 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[5],  mod360(cusps[3] + 2 * arcQ2 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[7],  mod360(cusps[6] + arcQ3 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[8],  mod360(cusps[6] + 2 * arcQ3 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[10], mod360(cusps[9] + arcQ4 / 3))).toBeCloseTo(0, 9);
      expect(angularDelta(cusps[11], mod360(cusps[9] + 2 * arcQ4 / 3))).toBeCloseTo(0, 9);
    });
  }
});

describe('Sripati cusps — angular cusps match computeBhava ASC / MC', () => {
  // Structural cross-check: cusps[0] = lagna, cusps[9] = sidereal MC,
  // both already exposed by computeBhava on every BhavaChart.
  it('cusps[0] equals BhavaChart.ascendantLongitude and cusps[9] equals BhavaChart.mcLongitude', () => {
    const date = new Date('1984-05-14T05:00:00Z'); // Zuckerberg-natal (mid latitude)
    const loc = { latitude: 40.70, longitude: -74.00 };
    const bhava = computeBhava(date, loc, { houseSystem: 'whole-sign' });
    const { cusps } = computeSripatiLagna(date, loc, 'lahiri', 'en',
                                          { includeCusps: true });
    expect(angularDelta(cusps[0], bhava.ascendantLongitude)).toBeCloseTo(0, 8);
    expect(angularDelta(cusps[9], bhava.mcLongitude)).toBeCloseTo(0, 8);
    // cusp[3] (IC) = MC + 180; cusp[6] (DSC) = ASC + 180.
    expect(angularDelta(cusps[3], mod360(bhava.mcLongitude + 180))).toBeCloseTo(0, 8);
    expect(angularDelta(cusps[6], mod360(bhava.ascendantLongitude + 180))).toBeCloseTo(0, 8);
  });
});

describe('Sripati cusps — fixture pin sweep (hand-derived predictions)', () => {
  // Hand-derived in notes/phase34e-sripati-derive.mjs. The implementation
  // is verified against these pins; the pins are NOT regenerated from
  // implementation output. Tolerance 1e-4° absorbs any float-equality
  // wobble in the ASC/MC inputs.
  const TOL = 1e-4;

  type Pin = { name: string; utc: string; lat: number; lon: number; cusps: number[] };
  const PINS: Pin[] = [
    {
      name: 'Narendra Modi',
      utc: '1950-09-17T05:30:00.000Z',
      lat: 23.78, lon: 72.63,
      cusps: [
        211.249651, 242.632157, 274.014663, 305.397169,
        334.014663,   2.632157,  31.249651,  62.632157,
         94.014663, 125.397169, 154.014663, 182.632157,
      ],
    },
    {
      name: 'Sachin Tendulkar',
      utc: '1973-04-24T08:55:00.000Z',
      lat: 18.966, lon: 72.833,
      cusps: [
        127.204619, 157.300056, 187.395492, 217.490929,
        247.395492, 277.300056, 307.204619, 337.300056,
          7.395492,  37.490929,  67.395492,  97.300056,
      ],
    },
    {
      name: 'Mark Zuckerberg',
      utc: '1984-05-14T05:00:00.000Z',
      lat: 40.70, lon: -74.00,
      cusps: [
        279.500257, 316.942082, 354.383907,  31.825732,
         54.383907,  76.942082,  99.500257, 136.942082,
        174.383907, 211.825732, 234.383907, 256.942082,
      ],
    },
    {
      name: 'Bill Gates',
      utc: '1955-10-29T04:58:00.000Z',
      lat: 47.60, lon: -122.333,
      cusps: [
         81.572615, 102.620934, 123.669252, 144.717571,
        183.669252, 222.620934, 261.572615, 282.620934,
        303.669252, 324.717571,   3.669252,  42.620934,
      ],
    },
    {
      name: 'Sri Sri Ravi Shankar',
      utc: '1956-05-12T18:30:00.000Z',
      lat: 8.767, lon: 77.383,
      cusps: [
        286.866209, 319.444550, 352.022892,  24.601233,
         52.022892,  79.444550, 106.866209, 139.444550,
        172.022892, 204.601233, 232.022892, 259.444550,
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
        const delta = Math.abs(angularDelta(cusps[i], pin.cusps[i]));
        expect(delta).toBeLessThan(TOL);
      }
    });
  }
});

describe('Sripati cusps — equator (φ=0) regression', () => {
  // At φ=0 the ASC and MC are 90° apart in *right ascension* (always),
  // but their *ecliptic longitude* separation varies with LST because
  // the ecliptic is tilted ε ≈ 23.4° from the equator. So Sripati does
  // NOT degenerate to Equal House at the equator — that earlier claim
  // in this test was incorrect. The actual invariant at every latitude
  // (including φ=0) is the antipodal + quadrant-sum symmetry, which is
  // already covered by the fixture-sweep tests above. This test just
  // pins that the implementation returns well-formed cusps at φ=0
  // without any special-casing or numerical blow-up.
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
    // Antipodal symmetry survives at φ=0.
    for (let i = 0; i < 6; i++) {
      const delta = angularDelta(cusps[i + 6], cusps[i]);
      expect(Math.abs(Math.abs(delta) - 180)).toBeLessThan(1e-9);
    }
  });
});
