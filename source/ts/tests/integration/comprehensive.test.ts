import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang } from '../../src/core/panchang';
import { computePlanetaryPositions } from '../../src/jyotish/planets';
import { computeVimshottariDasha } from '../../src/jyotish/dasha';

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

describe('getDailyPanchang: comprehensive field validation', () => {
  const r = getDailyPanchang(noonUtc('2025-04-12'), CHENNAI, { timezone: 330 })!;

  describe('sunrise / sunset / nextSunrise', () => {
    it('all are Date objects', () => {
      expect(r.sun.rise).toBeInstanceOf(Date);
      expect(r.sun.set).toBeInstanceOf(Date);
      expect(r.sun.nextRise).toBeInstanceOf(Date);
    });

    it('are in chronological order', () => {
      expect(r.sun.rise.getTime()).toBeLessThan(r.sun.set.getTime());
      expect(r.sun.set.getTime()).toBeLessThan(r.sun.nextRise.getTime());
    });

    it('day duration is reasonable (600-900 min for tropics)', () => {
      expect(r.sun.dayDurationMinutes).toBeGreaterThan(600);
      expect(r.sun.dayDurationMinutes).toBeLessThan(900);
    });

    it('night duration is reasonable', () => {
      expect(r.sun.nightDurationMinutes).toBeGreaterThan(500);
      expect(r.sun.nightDurationMinutes).toBeLessThan(900);
    });

    it('day + night ≈ 1440 min', () => {
      const total = r.sun.dayDurationMinutes + r.sun.nightDurationMinutes;
      expect(total).toBeGreaterThan(1420);
      expect(total).toBeLessThan(1460);
    });
  });

  describe('tithi array', () => {
    it('has 1-3 tithis', () => {
      expect(r.angas.tithis.length).toBeGreaterThanOrEqual(1);
      expect(r.angas.tithis.length).toBeLessThanOrEqual(3);
    });

    it('first tithi is active at sunrise', () => {
      expect(r.angas.tithis[0]!.isActiveAtSunrise).toBe(true);
    });

    for (const t of r.angas.tithis) {
      it(`tithi "${t.name}" has valid fields`, () => {
        expect(t.index).toBeGreaterThanOrEqual(0);
        expect(t.index).toBeLessThanOrEqual(29);
        expect(t.name.length).toBeGreaterThan(0);
        expect(t.paksha.length).toBeGreaterThan(0);
        expect(t.number).toBeGreaterThanOrEqual(1);
        expect(t.number).toBeLessThanOrEqual(15);
        expect(t.completionPercentage).toBeGreaterThanOrEqual(0);
        expect(t.completionPercentage).toBeLessThanOrEqual(100);
      });
    }

    it('subsequent tithis have startTime after sunrise', () => {
      for (let i = 1; i < r.angas.tithis.length; i++) {
        expect(r.angas.tithis[i]!.startTime).not.toBeNull();
        expect(r.angas.tithis[i]!.startTime!.getTime()).toBeGreaterThan(r.sun.rise.getTime());
      }
    });
  });

  describe('nakshatra array', () => {
    it('has 1-3 nakshatras', () => {
      expect(r.angas.nakshatras.length).toBeGreaterThanOrEqual(1);
      expect(r.angas.nakshatras.length).toBeLessThanOrEqual(3);
    });

    for (const n of r.angas.nakshatras) {
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
      expect(r.angas.yogas.length).toBeGreaterThanOrEqual(1);
      expect(r.angas.yogas.length).toBeLessThanOrEqual(3);
    });

    for (const y of r.angas.yogas) {
      it(`yoga "${y.name}" has valid index`, () => {
        expect(y.index).toBeGreaterThanOrEqual(0);
        expect(y.index).toBeLessThanOrEqual(26);
      });
    }
  });

  describe('karana array', () => {
    it('has 1-5 karanas (typically 2-4)', () => {
      expect(r.angas.karanas.length).toBeGreaterThanOrEqual(1);
      expect(r.angas.karanas.length).toBeLessThanOrEqual(5);
    });

    for (const k of r.angas.karanas) {
      it(`karana "${k.name}" has valid fields`, () => {
        expect(k.index).toBeGreaterThanOrEqual(0);
        expect(k.index).toBeLessThanOrEqual(59);
        expect(['fixed', 'movable']).toContain(k.type);
      });
    }
  });

  describe('vara', () => {
    it('has all required fields', () => {
      expect(r.angas.vara.index).toBeGreaterThanOrEqual(0);
      expect(r.angas.vara.index).toBeLessThanOrEqual(6);
      expect(r.angas.vara.name.length).toBeGreaterThan(0);
      expect(r.angas.vara.shortName.length).toBeGreaterThan(0);
      expect(r.angas.vara.englishName.length).toBeGreaterThan(0);
    });
  });

  describe('inauspicious periods', () => {
    for (const [label, period] of [
      ['rahuKalam', r.inauspicious.rahuKalam],
      ['gulikaKalam', r.inauspicious.gulikaKalam],
      ['yamaganda', r.inauspicious.yamaganda],
    ] as const) {
      it(`${label}: start < end`, () => {
        expect(period.start.getTime()).toBeLessThan(period.end.getTime());
      });

      it(`${label}: within daytime (sunrise to sunset)`, () => {
        expect(period.start.getTime()).toBeGreaterThanOrEqual(r.sun.rise.getTime());
        expect(period.end.getTime()).toBeLessThanOrEqual(r.sun.set.getTime());
      });

      it(`${label}: duration ≈ 1/8 of day`, () => {
        const periodMs = period.end.getTime() - period.start.getTime();
        const expectedMs = (r.sun.set.getTime() - r.sun.rise.getTime()) / 8;
        expect(Math.abs(periodMs - expectedMs)).toBeLessThan(60_000);
      });
    }
  });

  describe('muhurta periods', () => {
    // 2025-04-12 is a Saturday, so Abhijit is non-null.
    it('abhijitMuhurta is within daytime', () => {
      expect(r.muhurtas.abhijit).not.toBeNull();
      expect(r.muhurtas.abhijit!.start.getTime()).toBeGreaterThan(r.sun.rise.getTime());
      expect(r.muhurtas.abhijit!.end.getTime()).toBeLessThan(r.sun.set.getTime());
    });

    it('abhijitMuhurta is around noon', () => {
      expect(r.muhurtas.abhijit).not.toBeNull();
      const midDay = r.sun.rise.getTime() + (r.sun.set.getTime() - r.sun.rise.getTime()) / 2;
      const muhurtaMid = (r.muhurtas.abhijit!.start.getTime() + r.muhurtas.abhijit!.end.getTime()) / 2;
      expect(Math.abs(muhurtaMid - midDay)).toBeLessThan(3600_000);
    });

    it('brahmaMuhurta is before sunrise', () => {
      expect(r.muhurtas.brahma.end.getTime()).toBeLessThanOrEqual(r.sun.rise.getTime());
    });
  });

  describe('choghadiya', () => {
    it('has 8 day + 8 night slots', () => {
      expect(r.periods.choghadiya.day).toHaveLength(8);
      expect(r.periods.choghadiya.night).toHaveLength(8);
    });

    it('day slots span sunrise → sunset', () => {
      expect(r.periods.choghadiya.day[0]!.start.getTime()).toBe(r.sun.rise.getTime());
      expect(r.periods.choghadiya.day[7]!.end.getTime()).toBe(r.sun.set.getTime());
    });

    it('night slots span sunset → nextSunrise', () => {
      expect(r.periods.choghadiya.night[0]!.start.getTime()).toBe(r.sun.set.getTime());
      expect(r.periods.choghadiya.night[7]!.end.getTime()).toBe(r.sun.nextRise.getTime());
    });
  });

  describe('hora', () => {
    it('has 12 day + 12 night horas', () => {
      expect(r.periods.hora.day).toHaveLength(12);
      expect(r.periods.hora.night).toHaveLength(12);
    });
  });

  describe('gowriPanchangam', () => {
    it('has 8 day + 8 night slots', () => {
      expect(r.periods.gowri.day).toHaveLength(8);
      expect(r.periods.gowri.night).toHaveLength(8);
    });
  });

  describe('durMuhurta', () => {
    // Saturday takes classical durMuhurta ordinals [0, 1], both day windows.
    it('has exactly 2 periods on a Saturday', () => {
      expect(r.inauspicious.durMuhurta).toHaveLength(2);
    });

    it('both periods are ordered', () => {
      expect(r.inauspicious.durMuhurta[0]!.start.getTime()).toBeLessThan(r.inauspicious.durMuhurta[0]!.end.getTime());
      expect(r.inauspicious.durMuhurta[1]!.start.getTime()).toBeLessThan(r.inauspicious.durMuhurta[1]!.end.getTime());
    });

    it('day-segment periods are within daytime', () => {
      for (const dm of r.inauspicious.durMuhurta) {
        expect(dm.segment).toBe('day');
        expect(dm.start.getTime()).toBeGreaterThanOrEqual(r.sun.rise.getTime());
        expect(dm.end.getTime()).toBeLessThanOrEqual(r.sun.set.getTime());
      }
    });
  });

  describe('moonrise / moonset', () => {
    it('moonrise is Date or null', () => {
      if (r.moon.rise !== null) {
        expect(r.moon.rise).toBeInstanceOf(Date);
      }
    });

    it('moonset is Date or null', () => {
      if (r.moon.set !== null) {
        expect(r.moon.set).toBeInstanceOf(Date);
      }
    });
  });

  describe('calendar fields', () => {
    it('masa has valid index and name', () => {
      expect(r.calendar.masa.index).toBeGreaterThanOrEqual(0);
      expect(r.calendar.masa.index).toBeLessThanOrEqual(11);
      expect(r.calendar.masa.name.length).toBeGreaterThan(0);
    });

    it('chandramasa has valid fields', () => {
      expect(r.calendar.chandramasa.index).toBeGreaterThanOrEqual(0);
      expect(r.calendar.chandramasa.index).toBeLessThanOrEqual(11);
      expect(typeof r.calendar.chandramasa.isAdhika).toBe('boolean');
    });

    it('samvat has valid values', () => {
      expect(r.calendar.samvat.vikramSamvat).toBeGreaterThan(2080);
      expect(r.calendar.samvat.shakaSamvat).toBeGreaterThan(1945);
    });

    it('chandraRashi has valid index and name', () => {
      expect(r.moon.rashi.index).toBeGreaterThanOrEqual(0);
      expect(r.moon.rashi.index).toBeLessThanOrEqual(11);
    });

    it('suryaNakshatra has valid index and name', () => {
      expect(r.sun.nakshatra.index).toBeGreaterThanOrEqual(0);
      expect(r.sun.nakshatra.index).toBeLessThanOrEqual(26);
    });
  });

  describe('panchaka', () => {
    it('is a boolean', () => {
      expect(typeof r.inauspicious.panchaka).toBe('boolean');
    });
  });

  describe('specialYogas', () => {
    it('is an array', () => {
      expect(Array.isArray(r.specialYogas)).toBe(true);
    });

    for (const sy of r.specialYogas) {
      it(`special yoga "${sy.name}" has valid type`, () => {
        expect([
          'amrit_siddhi', 'sarvartha_siddhi', 'ravi_pushya', 'guru_pushya',
          'dwipushkar', 'tripushkar', 'jwalamukhi', 'aadal', 'vidaal', 'ravi',
        ]).toContain(sy.type);
      });
    }
  });

  describe('festivals', () => {
    it('is an array', () => {
      expect(Array.isArray(r.festivals)).toBe(true);
    });

    for (const f of r.festivals) {
      it(`festival "${f.name}" has valid type`, () => {
        expect(['major', 'minor', 'ekadashi', 'smarta_ekadashi', 'vaishnava_ekadashi', 'pradosha', 'sankranti']).toContain(f.type);
      });
    }
  });

  describe('ayanamsa and sidereal longitudes', () => {
    it('ayanamsa is in [24.0, 24.3]', () => {
      expect(r.ayanamsa).toBeGreaterThanOrEqual(24.0);
      expect(r.ayanamsa).toBeLessThanOrEqual(24.3);
    });

    it('siderealSunAtSunrise in [0, 360)', () => {
      expect(r.sun.siderealLongitude).toBeGreaterThanOrEqual(0);
      expect(r.sun.siderealLongitude).toBeLessThan(360);
    });

    it('siderealMoonAtSunrise in [0, 360)', () => {
      expect(r.moon.siderealLongitude).toBeGreaterThanOrEqual(0);
      expect(r.moon.siderealLongitude).toBeLessThan(360);
    });
  });
});

describe('same date across Indian cities: tithi/nakshatra consistency', () => {
  const date = '2025-01-14';
  const cities = [
    { name: 'Pune', loc: PUNE },
    { name: 'Delhi', loc: DELHI },
    { name: 'Chennai', loc: CHENNAI },
  ];

  const results = cities.map((c) => ({
    city: c.name,
    r: getDailyPanchang(noonUtc(date), c.loc, { timezone: 330 })!,
  }));

  it('all cities have the same vara', () => {
    const varas = results.map((x) => x.r.angas.vara.englishName);
    expect(new Set(varas).size).toBe(1);
  });

  it('all cities have the same tithi at sunrise', () => {
    const tithis = results.map((x) => x.r.angas.tithis[0]!.name);
    expect(new Set(tithis).size).toBe(1);
  });

  it('all cities have the same nakshatra at sunrise', () => {
    const nakshatras = results.map((x) => x.r.angas.nakshatras[0]!.name);
    expect(new Set(nakshatras).size).toBe(1);
  });

  it('all cities have the same chandramasa', () => {
    const masas = results.map((x) => x.r.calendar.chandramasa.name);
    expect(new Set(masas).size).toBe(1);
  });

  it('sunrise times differ between cities (different longitudes)', () => {
    const times = results.map((x) => x.r.sun.rise.getTime());
    expect(new Set(times).size).toBe(cities.length);
  });
});

describe('getDailyPanchang: world cities', () => {
  const worldCases = [
    { name: 'New York', loc: NYC, tz: -300, date: '2025-07-04' },
    { name: 'London', loc: LONDON, tz: 60, date: '2025-06-21' },
    { name: 'Tokyo', loc: TOKYO, tz: 540, date: '2025-03-20' },
    { name: 'Sydney', loc: SYDNEY, tz: 660, date: '2025-12-25' },
  ];

  for (const { name, loc, tz, date } of worldCases) {
    it(`${name} (${date}): does not throw and has valid structure`, () => {
      const r = getDailyPanchang(noonUtc(date), loc, { timezone: tz })!;
      expect(r.sun.rise).toBeInstanceOf(Date);
      expect(r.angas.tithis.length).toBeGreaterThanOrEqual(1);
      expect(r.angas.nakshatras.length).toBeGreaterThanOrEqual(1);
      expect(r.periods.choghadiya.day).toHaveLength(8);
      expect(r.periods.hora.day).toHaveLength(12);
    });
  }
});

describe('getDailyPanchang: language support', () => {
  for (const lang of ['en', 'hi'] as const) {
    it(`language "${lang}" produces non-empty names`, () => {
      const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330, language: lang })!;
      expect(r.angas.tithis[0]!.name.length).toBeGreaterThan(0);
      expect(r.angas.nakshatras[0]!.name.length).toBeGreaterThan(0);
      expect(r.angas.yogas[0]!.name.length).toBeGreaterThan(0);
      expect(r.angas.karanas[0]!.name.length).toBeGreaterThan(0);
      expect(r.angas.vara.name.length).toBeGreaterThan(0);
    });
  }

  it('Hindi names contain Devanagari characters', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330, language: 'hi' })!;
    expect(r.angas.tithis[0]!.name).toMatch(/[\u0900-\u097F]/);
    expect(r.angas.vara.name).toMatch(/[\u0900-\u097F]/);
  });
});

describe('getDailyPanchang: ayanamsa options', () => {
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
    })!;
    const raman = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
      timezone: 330, ayanamsa: 'raman',
    })!;
    expect(lahiri.sun.siderealLongitude).not.toBe(raman.sun.siderealLongitude);
  });
});

describe('getDailyPanchang with computeEndTimes: false', () => {
  const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, {
    timezone: 330,
    computeEndTimes: false,
  })!;

  it('returns exactly 1 element per category', () => {
    expect(r.angas.tithis).toHaveLength(1);
    expect(r.angas.nakshatras).toHaveLength(1);
    expect(r.angas.yogas).toHaveLength(1);
    expect(r.angas.karanas).toHaveLength(1);
  });

  it('still computes all time-slot systems', () => {
    expect(r.periods.choghadiya.day).toHaveLength(8);
    expect(r.periods.hora.day).toHaveLength(12);
    expect(r.periods.gowri.day).toHaveLength(8);
  });
});

describe('getInstantPanchang: comprehensive', () => {
  const moment = new Date('2025-04-12T06:00:00Z');
  const r = getInstantPanchang(moment, CHENNAI)!;

  it('returns all basic fields', () => {
    expect(r.timestamp).toEqual(moment);
    expect(r.location).toEqual(CHENNAI);
    expect(r.angas.tithi).toBeDefined();
    expect(r.angas.nakshatra).toBeDefined();
    expect(r.angas.yoga).toBeDefined();
    expect(r.angas.karana).toBeDefined();
    expect(r.angas.vara).toBeDefined();
  });

  it('endTimes are computed by default', () => {
    expect(r.angas.tithi.endTime).toBeInstanceOf(Date);
    expect(r.angas.nakshatra.endTime).toBeInstanceOf(Date);
    expect(r.angas.yoga.endTime).toBeInstanceOf(Date);
    expect(r.angas.karana.endTime).toBeInstanceOf(Date);
  });

  it('endTimes can be disabled', () => {
    const r2 = getInstantPanchang(moment, CHENNAI, { computeEndTimes: false })!;
    expect(r2.angas.tithi.endTime).toBeNull();
  });

  it('chandramasa, samvat, chandraRashi, suryaNakshatra are present', () => {
    expect(r.calendar.chandramasa).toBeDefined();
    expect(r.calendar.samvat).toBeDefined();
    expect(r.moon.rashi).toBeDefined();
    expect(r.sun.nakshatra).toBeDefined();
  });

  it('panchaka is boolean', () => {
    expect(typeof r.inauspicious.panchaka).toBe('boolean');
  });
});

describe('Jyotish: planetary positions integration', () => {
  it('computePlanetaryPositions works with getDailyPanchang sunrise', () => {
    const dp = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330 })!;
    expect(dp.sun.siderealLongitude).toBeGreaterThanOrEqual(0);
    expect(dp.sun.siderealLongitude).toBeLessThan(360);

    const pp = computePlanetaryPositions(new Date('2025-01-14T01:45:00Z'), 'lahiri');
    expect(Math.abs(pp.sun.siderealLongitude - dp.sun.siderealLongitude)).toBeLessThan(0.5);
  });
});

describe('Jyotish: Vimshottari Dasha integration', () => {
  it('computes dasha from instant panchang Moon position', () => {
    const moment = new Date('1990-05-15T10:30:00Z');
    const ip = getInstantPanchang(moment, PUNE)!;
    const dasha = computeVimshottariDasha(moment, ip.moon.siderealLongitude);

    expect(dasha.mahaDashas).toHaveLength(9);
    expect(dasha.mahaDashas[0]!.startDate.getTime()).toBe(moment.getTime());
  });
});

describe('getDailyPanchang: IANA timezone string support', () => {
  it('works with "Asia/Kolkata"', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 'Asia/Kolkata' })!;
    expect(r.angas.vara.englishName).toBe('Tuesday');
  });

  it('works with "America/New_York"', () => {
    const r = getDailyPanchang(noonUtc('2025-07-04'), NYC, { timezone: 'America/New_York' })!;
    expect(r.angas.vara.englishName).toBe('Friday');
  });

  it('works with numeric offset (330)', () => {
    const r = getDailyPanchang(noonUtc('2025-01-14'), PUNE, { timezone: 330 })!;
    expect(r.angas.vara.englishName).toBe('Tuesday');
  });
});
