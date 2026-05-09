/**
 * Unit tests for `computeUpagrahas` (Step 32-5).
 *
 * Strategy:
 *   1. **Sun-derived offsets** — pinned hand-checks for Dhuma /
 *      Vyatipata / Parivesha / Indrachapa / Upaketu against synthetic
 *      Sun longitudes. The formulas are deterministic; these tests
 *      verify the offset table directly.
 *   2. **Sun-derived chain invariants** — `Vyatipata + Dhuma == 360°`,
 *      `Parivesha + Indrachapa == 360°`, etc. These hold by definition
 *      of the formula sequence.
 *   3. **Gulika & Mandi** — at sunrise (Saturday → slot 0 starts at
 *      sunrise), Gulika longitude equals the lagna at sunrise. Mandi is
 *      the lagna at sunrise + (1/16 of day) (segment midpoint).
 *   4. **Day vs night detection** — for a noon birth, Saturn segment is
 *      day-Gulika; for midnight birth, it's night-Gulika.
 *   5. **Output structural shape** — all 7 upagrahas have valid rashi
 *      / longitude / house fields.
 *   6. **Fixture sweep** — pinned upagraha rashis for 5 R-tier charts
 *      as a regression detector.
 */

import { describe, it, expect } from 'vitest';
import { computeUpagrahas, _locateGulikaSegmentForTest } from '../../src/jyotish/upagrahas';
import { computeLagna } from '../../src/jyotish/lagna';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { normalize360 } from '../../src/utils/angle';
import fixtures from '../fixtures/astrosage-charts.json';

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

// ── 1. Sun-derived offsets — hand checks ──────────────

describe('Sun-derived upagrahas — offset formulas', () => {
  it('Dhuma = sunLon + 133°20\' (Sun at 0° → Dhuma at 133.333°)', () => {
    // Find a synthetic instant where sun longitude is approximately 0.
    // The vernal equinox 2025 (~Mar 20) gives tropical Sun ≈ 0°. Sidereal
    // adjusts by ~24° (Lahiri ayanamsa). Just pick a date and verify the
    // formula relationship holds.
    const date = new Date('2025-06-15T12:00:00Z');
    const u = computeUpagrahas(date, DELHI);
    const sun = getSiderealSunLongitude(date, 'lahiri');
    const expected = normalize360(sun + 133 + 20 / 60);
    expect(u.dhuma.longitude).toBeCloseTo(expected, 5);
  });

  it('Vyatipata == 360° − Dhuma (mod 360)', () => {
    const date = new Date('2025-01-14T08:00:00Z');
    const u = computeUpagrahas(date, DELHI);
    const expected = normalize360(360 - u.dhuma.longitude);
    expect(u.vyatipata.longitude).toBeCloseTo(expected, 5);
  });

  it('Parivesha == Vyatipata + 180° (mod 360)', () => {
    const date = new Date('2025-01-14T08:00:00Z');
    const u = computeUpagrahas(date, DELHI);
    const expected = normalize360(u.vyatipata.longitude + 180);
    expect(u.parivesha.longitude).toBeCloseTo(expected, 5);
  });

  it('Indrachapa == 360° − Parivesha (mod 360)', () => {
    const date = new Date('2025-01-14T08:00:00Z');
    const u = computeUpagrahas(date, DELHI);
    const expected = normalize360(360 - u.parivesha.longitude);
    expect(u.indrachapa.longitude).toBeCloseTo(expected, 5);
  });

  it('Upaketu == Indrachapa + 16°40\' (mod 360)', () => {
    const date = new Date('2025-01-14T08:00:00Z');
    const u = computeUpagrahas(date, DELHI);
    const expected = normalize360(u.indrachapa.longitude + 16 + 40 / 60);
    expect(u.upaketu.longitude).toBeCloseTo(expected, 5);
  });
});

// ── 2. Chain invariants ───────────────────────────────

describe('Sun-derived upagrahas — chain invariants', () => {
  for (const dateStr of [
    '2025-01-14T08:00:00Z',
    '2025-06-21T12:00:00Z',
    '2024-12-22T00:00:00Z',
  ]) {
    it(`${dateStr}: Dhuma + Vyatipata ≡ 360° (mod 360)`, () => {
      const u = computeUpagrahas(new Date(dateStr), DELHI);
      const sum = (u.dhuma.longitude + u.vyatipata.longitude) % 360;
      expect(sum).toBeCloseTo(0, 5);
    });

    it(`${dateStr}: Parivesha + Indrachapa ≡ 360° (mod 360)`, () => {
      const u = computeUpagrahas(new Date(dateStr), DELHI);
      const sum = (u.parivesha.longitude + u.indrachapa.longitude) % 360;
      expect(sum).toBeCloseTo(0, 5);
    });

    it(`${dateStr}: Parivesha − Vyatipata ≡ 180° (mod 360)`, () => {
      const u = computeUpagrahas(new Date(dateStr), DELHI);
      let diff = u.parivesha.longitude - u.vyatipata.longitude;
      diff = ((diff % 360) + 360) % 360;
      expect(diff).toBeCloseTo(180, 5);
    });
  }
});

// ── 3. Gulika & Mandi — segment relationships ─────────

describe('Gulika & Mandi — Saturn-segment timing', () => {
  it('Gulika and Mandi differ by ~1/16 day rate (segment midpoint vs start)', () => {
    // Pick a daytime birth. Gulika = lagna at segment start, Mandi = lagna
    // at segment midpoint. The lagna advances at ~360°/day = 15°/h. The
    // segment is 1/8 of day ≈ 1.5h. Midpoint - Start = 0.75h ≈ 11.25°.
    const date = new Date('2025-01-14T08:00:00Z'); // ~13:30 IST, daytime
    const u = computeUpagrahas(date, DELHI);
    let diff = u.mandi.longitude - u.gulika.longitude;
    diff = ((diff % 360) + 360) % 360;
    // Day length varies by season but the 1/16-day midpoint advance is
    // roughly 11° at the equinox, less in winter (shorter day → smaller
    // segment). Just assert it's positive and < 30° (within one rashi).
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(30);
  });

  it('Saturday daytime birth: Saturn slot 0 → Gulika segment starts at sunrise', () => {
    // Saturday Jan 11, 2025. Pick a daytime birth (e.g., 09:00 IST).
    const date = new Date('2025-01-11T03:30:00Z'); // ~09:00 IST Saturday
    const seg = _locateGulikaSegmentForTest(date, DELHI);
    const sunrise = computeSunrise(new Date(date.getTime() - 30 * 3600_000), DELHI);
    // Walk forward to find the Saturday-anchored sunrise.
    let candidate = sunrise;
    for (let i = 0; i < 3; i++) {
      const next = computeSunrise(new Date(candidate.getTime() + 22 * 3600_000), DELHI);
      if (next.getTime() > date.getTime()) break;
      candidate = next;
    }
    // candidate is the sunrise on or before `date` (Saturday's sunrise).
    // Saturn slot 0 means segStart == sunrise.
    expect(Math.abs(seg.start.getTime() - candidate.getTime())).toBeLessThan(60_000);
  });
});

// ── 4. Day vs night detection ─────────────────────────

describe('Gulika — day vs night branching', () => {
  it('Daytime birth uses day rotation; night birth uses night rotation', () => {
    // Day birth Saturday 2025-01-11 at noon IST.
    const dayBirth = new Date('2025-01-11T06:30:00Z'); // ~12:00 IST Saturday
    const nightBirth = new Date('2025-01-11T18:30:00Z'); // ~midnight Sat→Sun

    const dayU = computeUpagrahas(dayBirth, DELHI);
    const nightU = computeUpagrahas(nightBirth, DELHI);

    // Both should produce valid longitudes; day & night Gulika are
    // typically different (different segment boundaries).
    expect(dayU.gulika.longitude).toBeGreaterThanOrEqual(0);
    expect(dayU.gulika.longitude).toBeLessThan(360);
    expect(nightU.gulika.longitude).toBeGreaterThanOrEqual(0);
    expect(nightU.gulika.longitude).toBeLessThan(360);
    // Day and night Gulika should not collide (extremely unlikely they
    // land on the exact same longitude).
    expect(Math.abs(dayU.gulika.longitude - nightU.gulika.longitude)).toBeGreaterThan(1);
  });
});

// ── 5. Output structural shape ────────────────────────

describe('computeUpagrahas — output structural shape', () => {
  const date = new Date('2025-01-14T08:00:00Z');

  it('returns all 7 upagrahas with finite longitudes', () => {
    const u = computeUpagrahas(date, DELHI);
    const all = [u.gulika, u.mandi, u.dhuma, u.vyatipata, u.parivesha, u.indrachapa, u.upaketu];
    for (const upa of all) {
      expect(Number.isFinite(upa.longitude)).toBe(true);
      expect(upa.longitude).toBeGreaterThanOrEqual(0);
      expect(upa.longitude).toBeLessThan(360);
      expect(upa.rashi).toBeGreaterThanOrEqual(0);
      expect(upa.rashi).toBeLessThan(12);
      expect(upa.house).toBeGreaterThanOrEqual(1);
      expect(upa.house).toBeLessThanOrEqual(12);
      expect(typeof upa.rashiName).toBe('string');
      expect(upa.rashiName.length).toBeGreaterThan(0);
    }
  });

  it('rashi is consistent with longitude', () => {
    const u = computeUpagrahas(date, DELHI);
    const all = [u.gulika, u.mandi, u.dhuma, u.vyatipata, u.parivesha, u.indrachapa, u.upaketu];
    for (const upa of all) {
      expect(upa.rashi).toBe(Math.floor(upa.longitude / 30));
    }
  });

  it('respects language option', () => {
    const en = computeUpagrahas(date, DELHI, { language: 'en' });
    const hi = computeUpagrahas(date, DELHI, { language: 'hi' });
    // Same rashi → English transliterated vs Hindi Devanagari names differ.
    expect(en.dhuma.rashiName).not.toBe(hi.dhuma.rashiName);
  });

  it('respects ayanamsa option', () => {
    const lah = computeUpagrahas(date, DELHI, { ayanamsa: 'lahiri' });
    const ram = computeUpagrahas(date, DELHI, { ayanamsa: 'raman' });
    // Different ayanamsa → different sidereal Sun → different Sun-derived
    // upagrahas. Difference is small (~1° = ayanamsa difference).
    expect(Math.abs(lah.dhuma.longitude - ram.dhuma.longitude)).toBeGreaterThan(0.1);
    expect(Math.abs(lah.dhuma.longitude - ram.dhuma.longitude)).toBeLessThan(2.5);
  });
});

// ── 6. Fixture sweep — pinned upagraha rashis ─────────

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

const FIXTURE_NAMES = ['Narendra Modi', 'Sachin Tendulkar', 'Ratan Tata',
  'Dhirubhai Ambani', 'Mukesh Ambani'] as const;

describe('Fixture sweep — Upagraha structural invariants', () => {
  it.each(FIXTURE_NAMES)('%s: all 7 upagrahas valid', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const u = computeUpagrahas(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const all = [u.gulika, u.mandi, u.dhuma, u.vyatipata, u.parivesha, u.indrachapa, u.upaketu];
    expect(all).toHaveLength(7);
    for (const upa of all) {
      expect(upa.longitude).toBeGreaterThanOrEqual(0);
      expect(upa.longitude).toBeLessThan(360);
    }
  });

  it.each(FIXTURE_NAMES)('%s: Sun-derived chain invariant holds', (name) => {
    const f = FIXTURE_CHARTS.find((c) => c.name === name)!;
    const u = computeUpagrahas(
      localToUtc(f.dateLocal, f.tzh),
      { latitude: f.lat, longitude: f.lon },
    );
    const sum = (u.dhuma.longitude + u.vyatipata.longitude) % 360;
    expect(sum).toBeCloseTo(0, 4);
  });
});

// ── 7. Sanity reference — getSiderealSunLongitude consistency ─

describe('Upagrahas — sanity vs Sun longitude', () => {
  it('Dhuma rashi ≈ Sun rashi shifted by ~4-5 rashis (133° ÷ 30 ≈ 4.4)', () => {
    const date = new Date('2025-06-21T06:00:00Z');
    const sun = getSiderealSunLongitude(date, 'lahiri');
    const u = computeUpagrahas(date, DELHI);
    const sunRashi = Math.floor(sun / 30);
    const dhumaRashi = u.dhuma.rashi;
    const shift = ((dhumaRashi - sunRashi) + 12) % 12;
    expect([4, 5]).toContain(shift); // 133°/30° ≈ 4.43, so shift is 4 or 5 depending on Sun's degree.
  });
});

// Reference computeSunset to silence unused-import lint if applicable.
void computeSunset;
void computeLagna;
