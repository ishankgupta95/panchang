import { describe, it, expect } from 'vitest';
import { computeUpagrahas, _locateGulikaSegmentForTest } from '../../src/jyotish/upagrahas';
import { getDailyPanchang } from '../../src/core/panchang';
import { computeLagna } from '../../src/jyotish/lagna';
import { getSiderealSunLongitude } from '../../src/astronomy/sun';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { normalize360 } from '../../src/utils/angle';
import { readTestData } from '../testdata';

const fixtures = readTestData('charts', 'astrosage-charts.json');

const DELHI = { latitude: 28.6139, longitude: 77.2090 };

describe('Sun-derived upagrahas: offset formulas', () => {
  it('Dhuma = sunLon + 133°20\' (Sun at 0° → Dhuma at 133.333°)', () => {
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

describe('Sun-derived upagrahas: chain invariants', () => {
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

describe('Gulika & Mandi: Saturn-segment timing', () => {
  it('Gulika and Mandi differ by ~1/16 day rate (segment midpoint vs start)', () => {
    const date = new Date('2025-01-14T08:00:00Z'); // daytime
    const u = computeUpagrahas(date, DELHI);
    let diff = u.mandi.longitude - u.gulika.longitude;
    diff = ((diff % 360) + 360) % 360;
    expect(diff).toBeGreaterThan(0);
    expect(diff).toBeLessThan(30);
  });

  it('Saturday daytime birth: Saturn slot 0 → Gulika segment starts at sunrise', () => {
    const date = new Date('2025-01-11T03:30:00Z');
    const seg = _locateGulikaSegmentForTest(date, DELHI);
    const sunrise = computeSunrise(new Date(date.getTime() - 30 * 3600_000), DELHI);
    let candidate = sunrise;
    for (let i = 0; i < 3; i++) {
      const next = computeSunrise(new Date(candidate.getTime() + 22 * 3600_000), DELHI);
      if (next.getTime() > date.getTime()) break;
      candidate = next;
    }
    expect(Math.abs(seg.start.getTime() - candidate.getTime())).toBeLessThan(60_000);
  });
});

describe('Gulika: day vs night branching', () => {
  it('Daytime birth uses day rotation; night birth uses night rotation', () => {
    const dayBirth = new Date('2025-01-11T06:30:00Z');
    const nightBirth = new Date('2025-01-11T18:30:00Z');

    const dayU = computeUpagrahas(dayBirth, DELHI);
    const nightU = computeUpagrahas(nightBirth, DELHI);

    expect(dayU.gulika.longitude).toBeGreaterThanOrEqual(0);
    expect(dayU.gulika.longitude).toBeLessThan(360);
    expect(nightU.gulika.longitude).toBeGreaterThanOrEqual(0);
    expect(nightU.gulika.longitude).toBeLessThan(360);
    expect(Math.abs(dayU.gulika.longitude - nightU.gulika.longitude)).toBeGreaterThan(1);
  });
});

describe('computeUpagrahas: output structural shape', () => {
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
    expect(en.dhuma.rashiName).not.toBe(hi.dhuma.rashiName);
  });

  it('respects ayanamsa option', () => {
    const lah = computeUpagrahas(date, DELHI, { ayanamsa: 'lahiri' });
    const ram = computeUpagrahas(date, DELHI, { ayanamsa: 'raman' });
    expect(Math.abs(lah.dhuma.longitude - ram.dhuma.longitude)).toBeGreaterThan(0.1);
    expect(Math.abs(lah.dhuma.longitude - ram.dhuma.longitude)).toBeLessThan(2.5);
  });
});

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

describe('Fixture sweep: Upagraha structural invariants', () => {
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

describe('Upagrahas: sanity vs Sun longitude', () => {
  it('Dhuma rashi ≈ Sun rashi shifted by ~4-5 rashis (133° ÷ 30 ≈ 4.4)', () => {
    const date = new Date('2025-06-21T06:00:00Z');
    const sun = getSiderealSunLongitude(date, 'lahiri');
    const u = computeUpagrahas(date, DELHI);
    const sunRashi = Math.floor(sun / 30);
    const dhumaRashi = u.dhuma.rashi;
    const shift = ((dhumaRashi - sunRashi) + 12) % 12;
    expect([4, 5]).toContain(shift);
  });
});

void computeSunset;
void computeLagna;

describe('Upagrahas: LMT weekday (eastern-longitude births)', () => {
  it('Bangkok Friday-noon birth uses the FRIDAY day slot (gulika ≈ 138.857°)', () => {
    const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };
    const u = computeUpagrahas(new Date('2026-08-14T05:00:00Z'), BANGKOK);
    expect(u.gulika.longitude).toBeCloseTo(138.857, 1);
  });

  it('segment weekday agrees with getDailyPanchang\'s vara at Delhi, Bangkok and Tokyo', () => {
    const DAY_SLOTS = [6, 5, 4, 3, 2, 1, 0]; // GULIKA_SLOTS (Sun..Sat)
    const cases = [
      { name: 'Delhi', loc: { latitude: 28.6139, longitude: 77.209 }, tz: 330 },
      { name: 'Bangkok', loc: { latitude: 13.7563, longitude: 100.5018 }, tz: 420 },
      { name: 'Tokyo', loc: { latitude: 35.6762, longitude: 139.6503 }, tz: 540 },
    ];
    for (const c of cases) {
      for (let d = 10; d <= 16; d++) {
        const birth = new Date(Date.UTC(2026, 7, d, 12) - c.tz * 60_000);
        const p = getDailyPanchang(birth, c.loc, { timezone: c.tz })!;
        const seg = _locateGulikaSegmentForTest(birth, c.loc);
        const segLen = (p.sun.set.getTime() - p.sun.rise.getTime()) / 8;
        const slot = Math.round((seg.start.getTime() - p.sun.rise.getTime()) / segLen);
        expect(slot, `${c.name} 2026-08-${d} (vara ${p.angas.vara.index})`)
          .toBe(DAY_SLOTS[p.angas.vara.index]);
      }
    }
  });
});
