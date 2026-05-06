/**
 * Unit tests for `computeDivisionalChart` (D2 / D3 / D7 / D10 / D12 / D30)
 * and the per-divisional longitude transforms.
 *
 * Strategy: each divisional has a deterministic per-rashi-type rule. Pin
 * the rule at every parity / rashi-type boundary using the test-only
 * longitude helpers, then smoke-test the high-level `computeDivisionalChart`
 * for shape consistency, structural invariants, and Rahu/Ketu axiality.
 *
 * D9 is NOT re-tested here — it has its own coverage in
 * `tests/unit/charts.test.ts` (the unified API delegates to
 * `computeNavamsa`).
 *
 * BPHS Ch. 6 is the canonical source for every rule below.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDivisionalChart,
  _horaLongitudeForTest as horaLon,
  _drekkanaLongitudeForTest as drekLon,
  _saptamsaLongitudeForTest as saptLon,
  _dasamsaLongitudeForTest as dasaLon,
  _dwadasamsaLongitudeForTest as dwadLon,
  _trimsamsaLongitudeForTest as trimLon,
} from '../../src/jyotish/divisionals';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };
const SAMPLE = new Date('1995-08-15T05:30:00Z');

const rashiOf = (lon: number) => Math.floor(lon / 30);

// ── D2 Hora ────────────────────────────────────────────

describe('horaLongitude (D2)', () => {
  // Odd signs: 1st half → Leo (4), 2nd half → Cancer (3).
  it('Aries 0° → Leo (Sun hora)', () => {
    expect(rashiOf(horaLon(0))).toBe(4);
  });
  it('Aries 14.999° → still Leo', () => {
    expect(rashiOf(horaLon(14.999))).toBe(4);
  });
  it('Aries 15° → Cancer (Moon hora)', () => {
    expect(rashiOf(horaLon(15))).toBe(3);
  });
  it('Gemini 0° (odd) → Leo', () => {
    expect(rashiOf(horaLon(60))).toBe(4);
  });
  it('Sagittarius 20° (odd, 2nd half) → Cancer', () => {
    expect(rashiOf(horaLon(240 + 20))).toBe(3);
  });

  // Even signs: 1st half → Cancer (3), 2nd half → Leo (4).
  it('Taurus 0° (even) → Cancer (Moon hora)', () => {
    expect(rashiOf(horaLon(30))).toBe(3);
  });
  it('Taurus 15° (even, 2nd half) → Leo', () => {
    expect(rashiOf(horaLon(45))).toBe(4);
  });
  it('Pisces 5° (even) → Cancer', () => {
    expect(rashiOf(horaLon(330 + 5))).toBe(3);
  });
  it('Pisces 25° (even, 2nd half) → Leo', () => {
    expect(rashiOf(horaLon(330 + 25))).toBe(4);
  });

  it('every D2 result lands in Leo or Cancer', () => {
    for (let lon = 0; lon < 360; lon += 1.5) {
      const r = rashiOf(horaLon(lon));
      expect(r === 3 || r === 4).toBe(true);
    }
  });

  it('output is in [0, 360)', () => {
    for (let lon = 0; lon < 360; lon += 17.123) {
      const out = horaLon(lon);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThan(360);
    }
  });
});

// ── D3 Drekkana ────────────────────────────────────────

describe('drekkanaLongitude (D3)', () => {
  it('Aries 0° (1st drek) → Aries', () => {
    expect(rashiOf(drekLon(0))).toBe(0);
  });
  it('Aries 9.999° (still 1st drek) → Aries', () => {
    expect(rashiOf(drekLon(9.999))).toBe(0);
  });
  it('Aries 10° (2nd drek) → Leo (5th from Aries = +4)', () => {
    expect(rashiOf(drekLon(10))).toBe(4);
  });
  it('Aries 20° (3rd drek) → Sagittarius (9th from Aries = +8)', () => {
    expect(rashiOf(drekLon(20))).toBe(8);
  });
  it('Cancer 0° (1st) → Cancer', () => {
    expect(rashiOf(drekLon(90))).toBe(3);
  });
  it('Cancer 15° (2nd) → Scorpio (5th from Cancer)', () => {
    expect(rashiOf(drekLon(105))).toBe(7);
  });
  it('Cancer 25° (3rd) → Pisces (9th from Cancer)', () => {
    expect(rashiOf(drekLon(115))).toBe(11);
  });
  it('Pisces 25° (3rd) → Scorpio (9th from Pisces, wraps)', () => {
    expect(rashiOf(drekLon(330 + 25))).toBe((11 + 8) % 12); // 7
  });

  it('boundary at exactly 10° lands in 2nd drekkana', () => {
    expect(rashiOf(drekLon(10))).toBe(4);
    expect(rashiOf(drekLon(10 - 1e-9))).toBe(0);
  });
});

// ── D7 Saptamsa ────────────────────────────────────────

describe('saptamsaLongitude (D7)', () => {
  const SPAN = 30 / 7;

  it('Aries 0° (odd, 1st sapt) → Aries', () => {
    expect(rashiOf(saptLon(0))).toBe(0);
  });
  it('Aries 6×SPAN+ε (odd, 7th sapt) → Libra (Aries+6)', () => {
    expect(rashiOf(saptLon(SPAN * 6 + 0.01))).toBe(6);
  });
  it('Taurus 0° (even, 1st sapt) → Scorpio (7th from Taurus = +6)', () => {
    expect(rashiOf(saptLon(30))).toBe(7);
  });
  it('Taurus 6×SPAN+ε (even, 7th sapt) → Taurus (wraps full cycle)', () => {
    expect(rashiOf(saptLon(30 + SPAN * 6 + 0.01))).toBe(1);
  });
  it('Leo 0° (odd) → Leo', () => {
    expect(rashiOf(saptLon(120))).toBe(4);
  });
  it('Virgo 0° (even) → Pisces (7th from Virgo)', () => {
    expect(rashiOf(saptLon(150))).toBe(11);
  });

  it('every saptamsa segment of length 30/7 advances by exactly 1 rashi', () => {
    // Within a single source rashi, advancing by SPAN should advance the
    // target rashi by 1 every time (no parity inversion mid-rashi).
    const startLon = 0; // Aries
    const r0 = rashiOf(saptLon(startLon));
    const r1 = rashiOf(saptLon(startLon + SPAN + 0.001));
    const r2 = rashiOf(saptLon(startLon + 2 * SPAN + 0.001));
    expect(((r1 - r0 + 12) % 12)).toBe(1);
    expect(((r2 - r1 + 12) % 12)).toBe(1);
  });
});

// ── D10 Dasamsa ────────────────────────────────────────

describe('dasamsaLongitude (D10)', () => {
  it('Aries 0° (odd) → Aries (1st dasamsa starts at self)', () => {
    expect(rashiOf(dasaLon(0))).toBe(0);
  });
  it('Aries 27° (odd, 10th dasamsa) → Capricorn (Aries+9)', () => {
    expect(rashiOf(dasaLon(27))).toBe(9);
  });
  it('Taurus 0° (even) → Capricorn (9th from Taurus = +8)', () => {
    expect(rashiOf(dasaLon(30))).toBe(9);
  });
  it('Taurus 27° (even, 10th dasamsa) → Leo (Taurus+8+9 mod 12)', () => {
    expect(rashiOf(dasaLon(57))).toBe(((1 + 8 + 9) % 12)); // 6 = Libra
  });
  it('Leo 0° (odd) → Leo', () => {
    expect(rashiOf(dasaLon(120))).toBe(4);
  });
  it('Libra 0° (odd) → Libra', () => {
    expect(rashiOf(dasaLon(180))).toBe(6);
  });
  it('Capricorn 0° (even) → Virgo (9th from Capricorn = +8)', () => {
    expect(rashiOf(dasaLon(270))).toBe((9 + 8) % 12); // 5
  });

  it('boundary at exactly 3° lands in 2nd dasamsa', () => {
    expect(rashiOf(dasaLon(3))).toBe(1); // Aries → Taurus (next, since odd starts at self)
    expect(rashiOf(dasaLon(3 - 1e-9))).toBe(0); // still Aries
  });
});

// ── D12 Dwadasamsa ─────────────────────────────────────

describe('dwadasamsaLongitude (D12)', () => {
  const SPAN = 30 / 12;

  it('Aries 0° (1st) → Aries', () => {
    expect(rashiOf(dwadLon(0))).toBe(0);
  });
  it('Aries 2.5° (2nd) → Taurus', () => {
    expect(rashiOf(dwadLon(SPAN))).toBe(1);
  });
  it('Aries 27.5° (12th) → Pisces', () => {
    expect(rashiOf(dwadLon(SPAN * 11))).toBe(11);
  });
  it('Taurus 0° (1st) → Taurus (sequential ignores parity)', () => {
    expect(rashiOf(dwadLon(30))).toBe(1);
  });
  it('Taurus 2.5° (2nd) → Gemini', () => {
    expect(rashiOf(dwadLon(30 + SPAN))).toBe(2);
  });
  it('Pisces 27.5° (12th) → Aquarius (wraps)', () => {
    expect(rashiOf(dwadLon(330 + SPAN * 11))).toBe(((11 + 11) % 12)); // 10
  });

  it('every D12 segment advances target rashi by 1', () => {
    const start = 60; // Gemini 0°
    for (let i = 0; i < 12; i++) {
      const r = rashiOf(dwadLon(start + i * SPAN + 0.0001));
      expect(r).toBe((2 + i) % 12);
    }
  });
});

// ── D30 Trimsamsa ──────────────────────────────────────

describe('trimsamsaLongitude (D30)', () => {
  // Odd-sign expectations: Mars(Aries 0) → Saturn(Aquarius 10) → Jupiter
  // (Sagittarius 8) → Mercury(Gemini 2) → Venus(Libra 6).
  it('Aries 2° (odd, Mars segment) → Aries', () => {
    expect(rashiOf(trimLon(2))).toBe(0);
  });
  it('Aries 7° (odd, Saturn segment) → Aquarius', () => {
    expect(rashiOf(trimLon(7))).toBe(10);
  });
  it('Aries 12° (odd, Jupiter segment) → Sagittarius', () => {
    expect(rashiOf(trimLon(12))).toBe(8);
  });
  it('Aries 22° (odd, Mercury segment) → Gemini', () => {
    expect(rashiOf(trimLon(22))).toBe(2);
  });
  it('Aries 28° (odd, Venus segment) → Libra', () => {
    expect(rashiOf(trimLon(28))).toBe(6);
  });

  // Even-sign expectations: Venus(Taurus 1) → Mercury(Virgo 5) → Jupiter
  // (Pisces 11) → Saturn(Capricorn 9) → Mars(Scorpio 7).
  it('Taurus 2° (even, Venus segment) → Taurus', () => {
    expect(rashiOf(trimLon(30 + 2))).toBe(1);
  });
  it('Taurus 8° (even, Mercury segment) → Virgo', () => {
    expect(rashiOf(trimLon(30 + 8))).toBe(5);
  });
  it('Taurus 15° (even, Jupiter segment) → Pisces', () => {
    expect(rashiOf(trimLon(30 + 15))).toBe(11);
  });
  it('Taurus 22° (even, Saturn segment) → Capricorn', () => {
    expect(rashiOf(trimLon(30 + 22))).toBe(9);
  });
  it('Taurus 28° (even, Mars segment) → Scorpio', () => {
    expect(rashiOf(trimLon(30 + 28))).toBe(7);
  });

  // Boundary cases
  it('odd boundary 5° → Saturn segment (Aquarius)', () => {
    expect(rashiOf(trimLon(5))).toBe(10);
    expect(rashiOf(trimLon(5 - 1e-9))).toBe(0);
  });
  it('odd boundary 18° → Mercury segment (Gemini)', () => {
    expect(rashiOf(trimLon(18))).toBe(2);
    expect(rashiOf(trimLon(18 - 1e-9))).toBe(8);
  });
  it('even boundary 12° → Jupiter segment (Pisces)', () => {
    expect(rashiOf(trimLon(30 + 12))).toBe(11);
    expect(rashiOf(trimLon(30 + 12 - 1e-9))).toBe(5);
  });

  it('every D30 result avoids Sun (Leo=4) and Moon (Cancer=3) signs', () => {
    // Trimsamsa lords are Mars/Saturn/Jupiter/Mercury/Venus only; Sun and
    // Moon never appear, so the target rashi is never Cancer (3) or Leo (4).
    for (let lon = 0; lon < 360; lon += 0.7) {
      const r = rashiOf(trimLon(lon));
      expect(r === 3 || r === 4).toBe(false);
    }
  });

  it('output is in [0, 360)', () => {
    for (let lon = 0; lon < 360; lon += 1.3) {
      const out = trimLon(lon);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThan(360);
    }
  });
});

// ── computeDivisionalChart — high-level structural tests ──

describe('computeDivisionalChart — output structure', () => {
  const ALL: Array<'D2' | 'D3' | 'D7' | 'D9' | 'D10' | 'D12' | 'D30'> = [
    'D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D30',
  ];

  ALL.forEach((d) => {
    it(`${d}: returns 9 grahas in canonical order`, () => {
      const chart = computeDivisionalChart(SAMPLE, DELHI, d);
      expect(chart.divisional).toBe(d);
      expect(chart.planets).toHaveLength(9);
      expect(chart.planets.map((p) => p.planet)).toEqual([
        'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu',
      ]);
    });

    it(`${d}: rashi indices in [0, 12), houses in [1, 12]`, () => {
      const chart = computeDivisionalChart(SAMPLE, DELHI, d);
      expect(chart.lagnaRashi.index).toBeGreaterThanOrEqual(0);
      expect(chart.lagnaRashi.index).toBeLessThan(12);
      chart.planets.forEach((p) => {
        expect(p.rashi.index).toBeGreaterThanOrEqual(0);
        expect(p.rashi.index).toBeLessThan(12);
        expect(p.house).toBeGreaterThanOrEqual(1);
        expect(p.house).toBeLessThanOrEqual(12);
        expect(p.degreeInRashi).toBeGreaterThanOrEqual(0);
        expect(p.degreeInRashi).toBeLessThan(30);
      });
    });

    it(`${d}: house derivable from (rashi - lagnaRashi) for whole-sign anchoring`, () => {
      const chart = computeDivisionalChart(SAMPLE, DELHI, d);
      const lagnaIdx = chart.lagnaRashi.index;
      chart.planets.forEach((p) => {
        const expected = ((p.rashi.index - lagnaIdx + 12) % 12) + 1;
        expect(p.house).toBe(expected);
      });
    });

    if (d !== 'D2' && d !== 'D30') {
      // Rahu/Ketu (180° apart in D1) preserve 6-house opposition only in
      // divisionals where opposite source signs share the same per-rashi
      // offset rule — D3 / D7 / D9 / D10 / D12. D2 collapses everything to
      // Cancer/Leo (2 rashis); D30 to 5 non-luminary rashis. In both cases
      // Rahu and Ketu can — and routinely do — land in the same target rashi.
      it(`${d}: Rahu and Ketu remain 6 houses apart`, () => {
        const chart = computeDivisionalChart(SAMPLE, DELHI, d);
        const rahu = chart.planets.find((p) => p.planet === 'Rahu')!;
        const ketu = chart.planets.find((p) => p.planet === 'Ketu')!;
        expect(Math.abs(rahu.house - ketu.house)).toBe(6);
      });
    }

    it(`${d}: Sun and Moon never retrograde`, () => {
      const chart = computeDivisionalChart(SAMPLE, DELHI, d);
      const sun = chart.planets.find((p) => p.planet === 'Sun')!;
      const moon = chart.planets.find((p) => p.planet === 'Moon')!;
      expect(sun.isRetrograde).toBe(false);
      expect(moon.isRetrograde).toBe(false);
    });
  });

  it('D2: every planet lands in Cancer (3) or Leo (4)', () => {
    const d2 = computeDivisionalChart(SAMPLE, DELHI, 'D2');
    d2.planets.forEach((p) => {
      expect(p.rashi.index === 3 || p.rashi.index === 4).toBe(true);
    });
  });

  it('D30: no planet lands in Cancer (3) or Leo (4)', () => {
    const d30 = computeDivisionalChart(SAMPLE, DELHI, 'D30');
    d30.planets.forEach((p) => {
      expect(p.rashi.index === 3 || p.rashi.index === 4).toBe(false);
    });
  });

  it('D9 path through computeDivisionalChart matches computeNavamsa', async () => {
    const { computeNavamsa } = await import('../../src/jyotish/charts');
    const a = computeDivisionalChart(SAMPLE, DELHI, 'D9');
    const b = computeNavamsa(SAMPLE, DELHI);
    expect(a.lagnaRashi.index).toBe(b.lagnaRashi.index);
    for (let i = 0; i < 9; i++) {
      expect(a.planets[i]!.rashi.index).toBe(b.planets[i]!.rashi.index);
      expect(a.planets[i]!.house).toBe(b.planets[i]!.house);
    }
  });

  it('Hindi locale: rashi names render in Devanagari', () => {
    const en = computeDivisionalChart(SAMPLE, DELHI, 'D10', { language: 'en' });
    const hi = computeDivisionalChart(SAMPLE, DELHI, 'D10', { language: 'hi' });
    expect(hi.lagnaRashi.index).toBe(en.lagnaRashi.index);
    expect(hi.lagnaRashi.name).not.toBe(en.lagnaRashi.name);
  });

  it('respects ayanamsa option', () => {
    const lahiri = computeDivisionalChart(SAMPLE, DELHI, 'D10', { ayanamsa: 'lahiri' });
    const raman  = computeDivisionalChart(SAMPLE, DELHI, 'D10', { ayanamsa: 'raman' });
    // Sun longitude in D10 frame should differ when the source longitude
    // shifts between rashis under different ayanamsas. Even if it stays
    // in the same rashi, the degreeInRashi must differ.
    const sunLahiri = lahiri.planets[0]!;
    const sunRaman = raman.planets[0]!;
    const same = sunLahiri.rashi.index === sunRaman.rashi.index
              && Math.abs(sunLahiri.degreeInRashi - sunRaman.degreeInRashi) < 1e-9;
    expect(same).toBe(false);
  });
});
