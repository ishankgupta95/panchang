import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import indiaFixtures from '../fixtures/structural-india.json';
import worldFixtures from '../fixtures/structural-world.json';

type Fixture = {
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: number;
  expected: {
    varaEnglish: string;
    tithiCountAtLeast: number;
    nakshatraCountAtLeast: number;
  };
};

// Use noon UTC so getDate() returns the intended calendar day in any system timezone
function dateAtNoonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function runFixtureSuite(fixtures: Fixture[]) {
  for (const fixture of fixtures) {
    const { date, city, location, timezone, expected } = fixture;

    describe(`${date} / ${city}`, () => {
      // Compute once per fixture group
      const result = getDailyPanchang(
        dateAtNoonUtc(date),
        location,
        { timezone },
      );

      it('sunrise is a valid Date', () => {
        expect(result.sunrise).toBeInstanceOf(Date);
        expect(isNaN(result.sunrise.getTime())).toBe(false);
      });

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(result.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
      });

      it(`nakshatras.length >= ${expected.nakshatraCountAtLeast}`, () => {
        expect(result.nakshatras.length).toBeGreaterThanOrEqual(expected.nakshatraCountAtLeast);
      });

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(result.vara.englishName).toBe(expected.varaEnglish);
      });

      it('rahuKalam.start < rahuKalam.end', () => {
        expect(result.rahuKalam.start.getTime()).toBeLessThan(result.rahuKalam.end.getTime());
      });

      it('abhijitMuhurta.start < abhijitMuhurta.end', () => {
        expect(result.abhijitMuhurta.start.getTime()).toBeLessThan(result.abhijitMuhurta.end.getTime());
      });

      it('dayDurationMinutes is in (0, 1440)', () => {
        expect(result.dayDurationMinutes).toBeGreaterThan(0);
        expect(result.dayDurationMinutes).toBeLessThan(24 * 60);
      });

      it('gowriPanchangam has 8 day + 8 night slots', () => {
        expect(result.gowriPanchangam.day).toHaveLength(8);
        expect(result.gowriPanchangam.night).toHaveLength(8);
      });


    });
  }
}

describe('getDailyPanchang — India fixture regression', () => {
  runFixtureSuite(indiaFixtures as Fixture[]);
});

describe('getDailyPanchang — World fixture regression', () => {
  runFixtureSuite(worldFixtures as Fixture[]);
});

describe('getDailyPanchang — regional Sankranti (Phase 24-1)', () => {
  const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
  const makarDay = dateAtNoonUtc('2025-01-14'); // Makar Sankranti day

  it('region="all" emits pongal + makar_sankranti + bihu alongside canonical sankranti', () => {
    const r = getDailyPanchang(makarDay, CHENNAI, { timezone: 330 });
    const names = r.festivals.map(f => f.name);
    expect(names).toContain('Sankranti');
    expect(names).toContain('Pongal');
    expect(names).toContain('Makar Sankranti');
    expect(names).toContain('Magh Bihu');
    expect(names).toContain('Ayyappa Makara Jyothi');
  });

  it('region="tamil" scopes regional variants to Tamil + "all"', () => {
    const r = getDailyPanchang(makarDay, CHENNAI, { timezone: 330, region: 'tamil' });
    const names = r.festivals.map(f => f.name);
    expect(names).toContain('Pongal');
    expect(names).not.toContain('Makar Sankranti');
    expect(names).not.toContain('Ayyappa Makara Jyothi');
  });
});
