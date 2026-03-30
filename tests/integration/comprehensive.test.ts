/**
 * Comprehensive integration tests for panchang-ts.
 *
 * Tests the full getDailyPanchang and getInstantPanchang output across
 * multiple dates, cities, and configurations. Verifies every returned
 * field for structural correctness and cross-consistency.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { computePlanetaryPositions } from '../../src/jyotish/planets';
import { computeVimshottariDasha } from '../../src/jyotish/dasha';

// ── Locations ────────────────────────────────────────────────────────────────

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
const NYC = { latitude: 40.7128, longitude: -74.006 };
const LONDON = { latitude: 51.5074, longitude: -0.1278 };
const TOKYO = { latitude: 35.6762, longitude: 139.6503 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

function noonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

// ── getDailyPanchang comprehensive tests ─────────────────────────────────────

describe('getDailyPanchang — comprehensive field validation', () => {
  const r = getDailyPanchang(noonUtc('2025-04-12'), CHENNAI, { timezone: 330 });

  describe('sunrise / sunset / nextSunrise', () => {
    it('all are Date objects', () => {
      expect(r.sunrise).toBeInstanceOf(Date);
      expect(r.sunset).toBeInstanceOf(Date);
      expect(r.nextSunrise).toBeInstanceOf(Date);
    });

    it('are in chronological order', () => {
      expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
      expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
    });

    it('day duration is reasonable (600-900 min for tropics)', () => {
      expect(r.dayDurationMinutes).toBeGreaterThan(600);
      expect(r.dayDurationMinutes).toBeLessThan(900);
    });

    it('night duration is reasonable', () => {
      expect(r.nightDurationMinutes).toBeGreaterThan(500);
      expect(r.nightDurationMinutes).toBeLessThan(900);
    });

    it('day + night ≈ 1440 min', () => {
      const total = r.dayDurationMinutes + r.nightDurationMinutes;
      expect(total).toBeGreaterThan(1420);
      expect(total).toBeLessThan(1460);
    });
  });

  describe('tithi array', () => {
    it('has 1-3 tithis', () => {
      expect(r.tithis.length).toBeGreaterThanOrEqual(1);
      expect(r.tithis.length).toBeLessThanOrEqual(3);
    });

    it('first tithi is active at sunrise', () => {
      expect(r.tithis[0]!.isActiveAtSunrise).toBe(true);
    });

    for (const t of r.tithis) {
      it(`tithi "${t.name}" has valid fields`, () => {
        expect(t.index).toBeGreaterThanOrEqual(0);
        expect(t.index).toBeLessThanOrEqual(29);
        expect(t.name.length).toBeGreaterThan(0);
        expect(['Shukla', 'Krishna']).toContain(t.paksha);
        expect(t.number).toBeGreaterThanOrEqual(1);
        expect(t.number).toBeLessThanOrEqual(15);
        expect(t.completionPercentage).toBeGreaterThanOrEqual(0);
        expect(t.completionPercentage).toBeLessThanOrEqual(100);
      });
    }

    it('subsequent tithis have startTime after sunrise', () => {
      for (let i = 1; i < r.tithis.length; i++) {
        expect(r.tithis[i]!.startTime).not.toBeNull();
        expect(r.tithis[i]!.startTime!.getTime()).toBeGreaterThan(r.sunrise.getTime());
      }
    });
  });

  describe('nakshatra array', () => {
    it('has 1-3 nakshatras', () => {
      expect(r.nakshatras.length).toBeGreaterThanOrEqual(1);
      expect(r.nakshatras.length).toBeLessThanOrEqual(3);
    });

    for (const n of r.nakshatras) {
      it(`nakshatra "${n.name}" has valid fields`, () => {
        expect(n.index).toBeGreaterThanOrEqual(0);
        expect(n.index).toBeLessThanOrEqual(26);
        expect(n.pada).toBeGreaterThanOrEqual(1);
        expect(n.pada).toBeLessThanOrEqual(4);
        expect(n.degreesInNakshatra).toBeGreaterThanOrEqual(0);
        expect(n.degreesInNakshatra).toBeLessThan(13.4);
      });
    }
  });

  describe('yoga array', () => {
    it('has 1-3 yogas', () => {
      expect(r.yogas.length).toBeGreaterThanOrEqual(1);
      expect(r.yogas.length).toBeLessThanOrEqual(3);
    });

    for (const y of r.yogas) {
      it(`yoga "${y.name}" has valid index`, () => {
        expect(y.index).toBeGreaterThanOrEqual(0);
        expect(y.index).toBeLessThanOrEqual(26);
      });
    }
  });

  describe('karana array', () => {
    it('has 1-5 karanas (typically 2-4)', () => {
      expect(r.karanas.length).toBeGreaterThanOrEqual(1);
      expect(r.karanas.length).toBeLessThanOrEqual(5);
    });

    for (const k of r.karanas) {
      it(`karana "${k.name}" has valid fields`, () => {
        expect(k.index).toBeGreaterThanOrEqual(0);
        expect(k.index).toBeLessThanOrEqual(59);
        expect(['fixed', 'movable']).toContain(k.type);
      });
    }
  });

  describe('vara', () => {
    it('has all required fields', () => {
      expect(r.vara.index).toBeGreaterThanOrEqual(0);
      expect(r.vara.index).toBeLessThanOrEqual(6);
      expect(r.vara.name.length).toBeGreaterThan(0);
      expect(r.vara.shortName.length).toBeGreaterThan(0);
      expect(r.vara.englishName.length).toBeGreaterThan(0);
    });
  });

  describe('inauspicious periods', () => {
    for (const [label, period] of [
      ['rahuKalam', r.rahuKalam],
      ['gulikaKalam', r.gulikaKalam],
      ['yamaganda', r.yamaganda],
    ] as const) {
      it(`${label}: start < end`, () => {
        expect(period.start.getTime()).toBeLessThan(period.end.getTime());
      });

      it(`${label}: within daytime (sunrise to sunset)`, () => {
        expect(period.start.getTime()).toBeGreaterThanOrEqual(r.sunrise.getTime());
        expect(period.end.getTime()).toBeLessThanOrEqual(r.sunset.getTime());
      });

      it(`${label}: duration ≈ 1/8 of day`, () => {
        const periodMs = period.end.getTime() - period.start.getTime();
        const expectedMs = (r.sunset.getTime() - r.sunrise.getTime()) / 8;
        expect(Math.abs(periodMs - expectedMs)).toBeLessThan(60_000); // within 1 min
      });
    }
  });

  describe('muhurta periods', () => {
    it('abhijitMuhurta is within daytime', () => {
      expect(r.abhijitMuhurta.start.getTime()).toBeGreaterThan(r.sunrise.getTime());
      expect(r.abhijitMuhurta.end.getTime()).toBeLessThan(r.sunset.getTime());
    });

    it('abhijitMuhurta is around noon', () => {
      const midDay = r.sunrise.getTime() + (r.sunset.getTime() - r.sunrise.getTime()) / 2;
      const muhurtaMid = (r.abhijitMuhurta.start.getTime() + r.abhijitMuhurta.end.getTime()) / 2;
      // Should be within 1 hour of midday
      expect(Math.abs(muhurtaMid - midDay)).toBeLessThan(3600_000);
    });

    it('brahmaMuhurta is before sunrise', () => {
      expect(r.brahmaMuhurta.end.getTime()).toBeLessThanOrEqual(r.sunrise.getTime());
    });
  });

  describe('choghadiya', () => {
    it('has 8 day + 8 night slots', () => {
      expect(r.choghadiya.day).toHaveLength(8);
      expect(r.choghadiya.night).toHaveLength(8);
    });

    it('day slots span sunrise → sunset', () => {
      expect(r.choghadiya.day[0]!.start.getTime()).toBe(r.sunrise.getTime());
      expect(r.choghadiya.day[7]!.end.getTime()).toBe(r.sunset.getTime());
    });

    it('night slots span sunset → nextSunrise', () => {
      expect(r.choghadiya.night[0]!.start.getTime()).toBe(r.sunset.getTime());
      expect(r.choghadiya.night[7]!.end.getTime()).toBe(r.nextSunrise.getTime());
    });
  });

  describe('hora', () => {
    it('has 12 day + 12 night horas', () => {
      expect(r.hora.day).toHaveLength(12);
      expect(r.hora.night).toHaveLength(12);
    });
  });

  describe('gowriPanchangam', () => {
    it('has 8 day + 8 night slots', () => {
      expect(r.gowriPanchangam.day).toHaveLength(8);
      expect(r.gowriPanchangam.night).toHaveLength(8);
    });
  });

  describe('durMuhurta', () => {
    it('has exactly 2 periods', () => {
      expect(r.durMuhurta).toHaveLength(2);
    });

    it('both periods are ordered', () => {
      expect(r.durMuhurta[0]!.start.getTime()).toBeLessThan(r.durMuhurta[0]!.end.getTime());
      expect(r.durMuhurta[1]!.start.getTime()).toBeLessThan(r.durMuhurta[1]!.end.getTime());
    });

    it('both periods are within daytime', () => {
      for (const dm of r.durMuhurta) {
        expect(dm.start.getTime()).toBeGreaterThanOrEqual(r.sunrise.getTime());
        expect(dm.end.getTime()).toBeLessThanOrEqual(r.sunset.getTime());
      }
    });
  });

  describe('moonrise / moonset', () => {
    it('moonrise is Date or null', () => {
      if (r.moonrise !== null) {
        expect(r.moonrise).toBeInstanceOf(Date);
      }
    });

    it('moonset is Date or null', () => {
      if (r.moonset !== null) {
        expect(r.moonset).toBeInstanceOf(Date);
      }
    });
  });

  describe('calendar fields', () => {
    it('masa has valid index and name', () => {
      expect(r.masa.index).toBeGreaterThanOrEqual(0);
      expect(r.masa.index).toBeLessThanOrEqual(11);
      expect(r.masa.name.length).toBeGreaterThan(0);
    });

    it('chandramasa has valid fields', () => {
      expect(r.chandramasa.index).toBeGreaterThanOrEqual(0);
      expect(r.chandramasa.index).toBeLessThanOrEqual(11);
      expect(typeof r.chandramasa.isAdhika).toBe('boolean');
    });

    it('samvat has valid values', () => {
      expect(r.samvat.vikramSamvat).toBeGreaterThan(2080);
      expect(r.samvat.shakaSamvat).toBeGreaterThan(1945);
    });

    it('chandraRashi has valid index and name', () => {
      expect(r.chandraRashi.index).toBeGreaterThanOrEqual(0);
      expect(r.chandraRashi.index).toBeLessThanOrEqual(11);
    });

    it('suryaNakshatra has valid index and name', () => {
      expect(r.suryaNakshatra.index).toBeGreaterThanOrEqual(0);
      expect(r.suryaNakshatra.index).toBeLessThanOrEqual(26);
    });
  });

  describe('panchaka', () => {
    it('is a boolean', () => {
      expect(typeof r.panchaka).toBe('boolean');
    });
  });

  describe('specialYogas', () => {
    it('is an array', () => {
      expect(Array.isArray(r.specialYogas)).toBe(true);
    });

    for (const sy of r.specialYogas) {
      it(`special yoga "${sy.name}" has valid type`, () => {
        expect(['amrit_siddhi', 'sarvartha_siddhi', 'ravi_pushya', 'guru_pushya']).toContain(sy.type);
      });
    }
  });

  describe('festivals', () => {
    it('is an array', () => {
      expect(Array.isArray(r.festivals)).toBe(true);
    });

    for (const f of r.festivals) {
      it(`festival "${f.name}" has valid type`, () => {
        expect(['major', 'minor', 'ekadashi', 'pradosha', 'sankranti']).toContain(f.type);
      });
    }
  });

  describe('ayanamsa and sidereal longitudes', () => {
    it('ayanamsa is in [24.0, 24.3]', () => {
      expect(r.ayanamsa).toBeGreaterThanOrEqual(24.0);
      expect(r.ayanamsa).toBeLessThanOrEqual(24.3);
    });

    it('siderealSunAtSunrise in [0, 360)', () => {
      expect(r.siderealSunAtSunrise).toBeGreaterThanOrEqual(0);
      expect(r.siderealSunAtSunrise).toBeLessThan(360);
    });

    it('siderealMoonAtSunrise in [0, 360)', () => {
      expect(r.siderealMoonAtSunrise).toBeGreaterThanOrEqual(0);
      expect(r.siderealMoonAtSunrise).toBeLessThan(360);
    });
  });
});

// ── Multi-city same-date consistency ─────────────────────────────────────────

describe('same date across Indian cities — tithi/nakshatra consistency', () => {
  const date = '2025-01-14';
  const cities = [
    { name: 'Pune', loc: PUNE },
    { name: 'Delhi', loc: DELHI },
    { name: 'Chennai', loc: CHENNAI },
  ];

  const results = cities.map((c) => ({
    city: c.name,
    r: getDailyPanchang(noonUtc(date), c.loc, { timezone: 330 }),
  }));

  it('all cities have the same vara', () => {
    const varas = results.map((x) => x.r.vara.englishName);
    expect(new Set(varas).size).toBe(1);
  });

  it('all cities have the same tithi at sunrise', () => {
    const tithis = results.map((x) => x.r.tithis[0]!.name);
    expect(new Set(tithis).size).toBe(1);
  });

  it('all cities have the same nakshatra at sunrise', () => {
    const nakshatras = results.map((x) => x.r.nakshatras[0]!.name);
    expect(new Set(nakshatras).size).toBe(1);
  });

  it('all cities have the same chandramasa', () => {
    const masas = results.map((x) => x.r.chandramasa.name);
    expect(new Set(masas).size).toBe(1);
  });

  it('sunrise times differ between cities (different longitudes)', () => {
    const times = results.map((x) => x.r.sunrise.getTime());
    expect(new Set(times).size).toBe(cities.length);
  });
});

// ── World cities ────────────────────────────────────────────────────────────

describe('getDailyPanchang — world cities', () => {
  const worldCases = [
    { name: 'New York', loc: NYC, tz: -300, date: '2025-07-04' },
    { name: 'London', loc: LONDON, tz: 60, date: '2025-06-21' },
    { name: 'Tokyo', loc: TOKYO, tz: 540, date: '2025-03-20' },
    { name: 'Sydney', loc: SYDNEY, tz: 660, date: '2025-12-25' },
  ];

  for (const { name, loc, tz, date } of worldCases) {
    it(`${name} (${date}): does not throw and has valid structure`, () => {
      const r = getDailyPanchang(noonUtc(date), loc, { timezone: tz });
      expect(r.sunrise).toBeInstanceOf(Date);
      expect(r.tithis.length).toBeGreaterThanOrEqual(1);
      expect(r.nakshatras.length).toBeGreaterThanOrEqual(1);
      expect(r.choghadiya.day).toHaveLength(8);
      expect(r.hora.day).toHaveLength(12);
    });
  }
});

// ── Language support ────────────────────────────────────────────────────────

describe('getDailyPanchang — language support', () => {
  for (const lang of ['en', 'sa', 'hi'] as const) {
    it(`language "${lang}" produces non-empty names`, () => {
      const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330, language: lang });
      expect(r.tithis[0]!.name.length).toBeGreaterThan(0);
      expect(r.nakshatras[0]!.name.length).toBeGreaterThan(0);
      expect(r.yogas[0]!.name.length).toBeGreaterThan(0);
      expect(r.karanas[0]!.name.length).toBeGreaterThan(0);
      expect(r.vara.name.length).toBeGreaterThan(0);
    });
  }

  it('Sanskrit names contain Devanagari characters', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330, language: 'sa' });
    // Devanagari Unicode range: \u0900-\u097F
    expect(r.tithis[0]!.name).toMatch(/[\u0900-\u097F]/);
    expect(r.vara.name).toMatch(/[\u0900-\u097F]/);
  });
});

// ── Ayanamsa options ────────────────────────────────────────────────────────

describe('getDailyPanchang — ayanamsa options', () => {
  for (const ayanamsa of ['lahiri', 'raman', 'krishnamurti'] as const) {
    it(`ayanamsa "${ayanamsa}" does not throw`, () => {
      expect(() =>
        getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330, ayanamsa }),
      ).not.toThrow();
    });
  }

  it('different ayanamsa systems produce different sidereal longitudes', () => {
    const lahiri = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
      timezone: 330, ayanamsa: 'lahiri',
    });
    const raman = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
      timezone: 330, ayanamsa: 'raman',
    });
    expect(lahiri.siderealSunAtSunrise).not.toBe(raman.siderealSunAtSunrise);
  });
});

// ── Precision options ───────────────────────────────────────────────────────

describe('getDailyPanchang — precision options', () => {
  it('standard precision produces valid results', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
      timezone: 330, precision: 'standard',
    });
    expect(r.tithis.length).toBeGreaterThanOrEqual(1);
  });

  it('high precision produces valid results', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
      timezone: 330, precision: 'high',
    });
    expect(r.tithis.length).toBeGreaterThanOrEqual(1);
  });
});

// ── computeEndTimes: false ──────────────────────────────────────────────────

describe('getDailyPanchang — computeEndTimes: false', () => {
  const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
    timezone: 330,
    computeEndTimes: false,
  });

  it('returns exactly 1 element per category', () => {
    expect(r.tithis).toHaveLength(1);
    expect(r.nakshatras).toHaveLength(1);
    expect(r.yogas).toHaveLength(1);
    expect(r.karanas).toHaveLength(1);
  });

  it('still computes all time-slot systems', () => {
    expect(r.choghadiya.day).toHaveLength(8);
    expect(r.hora.day).toHaveLength(12);
    expect(r.gowriPanchangam.day).toHaveLength(8);
  });
});

// ── getInstantPanchang comprehensive ─────────────────────────────────────────

describe('getInstantPanchang — comprehensive', () => {
  const moment = new Date('2025-04-12T06:00:00Z');
  const r = getInstantPanchang(moment, CHENNAI);

  it('returns all basic fields', () => {
    expect(r.timestamp).toEqual(moment);
    expect(r.location).toEqual(CHENNAI);
    expect(r.tithi).toBeDefined();
    expect(r.nakshatra).toBeDefined();
    expect(r.yoga).toBeDefined();
    expect(r.karana).toBeDefined();
    expect(r.vara).toBeDefined();
  });

  it('endTimes are computed by default', () => {
    expect(r.tithi.endTime).toBeInstanceOf(Date);
    expect(r.nakshatra.endTime).toBeInstanceOf(Date);
    expect(r.yoga.endTime).toBeInstanceOf(Date);
    expect(r.karana.endTime).toBeInstanceOf(Date);
  });

  it('endTimes can be disabled', () => {
    const r2 = getInstantPanchang(moment, CHENNAI, { computeEndTimes: false });
    expect(r2.tithi.endTime).toBeNull();
  });

  it('chandramasa, samvat, chandraRashi, suryaNakshatra are present', () => {
    expect(r.chandramasa).toBeDefined();
    expect(r.samvat).toBeDefined();
    expect(r.chandraRashi).toBeDefined();
    expect(r.suryaNakshatra).toBeDefined();
  });

  it('panchaka is boolean', () => {
    expect(typeof r.panchaka).toBe('boolean');
  });
});

// ── Jyotish integration ────────────────────────────────────────────────────

describe('Jyotish — planetary positions integration', () => {
  it('computePlanetaryPositions works with getDailyPanchang sunrise', () => {
    const dp = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330 });
    // Use sidereal longitudes from daily panchang to verify consistency
    expect(dp.siderealSunAtSunrise).toBeGreaterThanOrEqual(0);
    expect(dp.siderealSunAtSunrise).toBeLessThan(360);

    // Compute planetary positions at an equivalent time
    const pp = computePlanetaryPositions(new Date('2025-01-14T01:45:00Z'), 'lahiri');
    // Sun position from daily panchang and planets should be close
    expect(Math.abs(pp.sun.siderealLongitude - dp.siderealSunAtSunrise)).toBeLessThan(0.5);
  });
});

describe('Jyotish — Vimshottari Dasha integration', () => {
  it('computes dasha from instant panchang Moon position', () => {
    const moment = new Date('1990-05-15T10:30:00Z');
    const ip = getInstantPanchang(moment, PUNE);
    const dasha = computeVimshottariDasha(moment, ip.siderealMoon);

    expect(dasha.mahaDashas).toHaveLength(9);
    expect(dasha.mahaDashas[0]!.startDate.getTime()).toBe(moment.getTime());
  });
});

// ── IANA timezone strings ───────────────────────────────────────────────────

describe('getDailyPanchang — IANA timezone string support', () => {
  it('works with "Asia/Kolkata"', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 'Asia/Kolkata' });
    expect(r.vara.englishName).toBe('Tuesday');
  });

  it('works with "America/New_York"', () => {
    const r = getDailyPanchang(noonUtc('2025-07-04'), NYC, { timezone: 'America/New_York' });
    expect(r.vara.englishName).toBe('Friday');
  });

  it('works with numeric offset (330)', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330 });
    expect(r.vara.englishName).toBe('Tuesday');
  });
});
