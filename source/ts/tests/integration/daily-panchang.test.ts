import { describe, it, expect, vi } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { __resetRegionAliasWarnings } from '../../src/core/regionAlias';
import { readTestData } from '../testdata';

const indiaFixtures = readTestData('structural', 'structural-india.json');
const worldFixtures = readTestData('structural', 'structural-world.json');

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
      const result = getDailyPanchang(
        dateAtNoonUtc(date),
        location,
        { timezone },
      )!;

      it('sunrise is a valid Date', () => {
        expect(result.sun.rise).toBeInstanceOf(Date);
        expect(isNaN(result.sun.rise.getTime())).toBe(false);
      });

      it(`tithis.length >= ${expected.tithiCountAtLeast}`, () => {
        expect(result.angas.tithis.length).toBeGreaterThanOrEqual(expected.tithiCountAtLeast);
      });

      it(`nakshatras.length >= ${expected.nakshatraCountAtLeast}`, () => {
        expect(result.angas.nakshatras.length).toBeGreaterThanOrEqual(expected.nakshatraCountAtLeast);
      });

      it(`vara.englishName === "${expected.varaEnglish}"`, () => {
        expect(result.angas.vara.englishName).toBe(expected.varaEnglish);
      });

      it('rahuKalam.start < rahuKalam.end', () => {
        expect(result.inauspicious.rahuKalam.start.getTime()).toBeLessThan(result.inauspicious.rahuKalam.end.getTime());
      });

      // Reference-almanac convention: Abhijit is dropped on Wednesday (Buddha-vara).
      it('abhijitMuhurta is null on Wednesday, ordered otherwise', () => {
        if (expected.varaEnglish === 'Wednesday') {
          expect(result.muhurtas.abhijit).toBeNull();
        } else {
          expect(result.muhurtas.abhijit).not.toBeNull();
          expect(result.muhurtas.abhijit!.start.getTime()).toBeLessThan(result.muhurtas.abhijit!.end.getTime());
        }
      });

      it('dayDurationMinutes is in (0, 1440)', () => {
        expect(result.sun.dayDurationMinutes).toBeGreaterThan(0);
        expect(result.sun.dayDurationMinutes).toBeLessThan(24 * 60);
      });

      it('gowriPanchangam has 8 day + 8 night slots', () => {
        expect(result.periods.gowri.day).toHaveLength(8);
        expect(result.periods.gowri.night).toHaveLength(8);
      });


    });
  }
}

describe('getDailyPanchang: India fixture regression', () => {
  runFixtureSuite(indiaFixtures as Fixture[]);
});

describe('getDailyPanchang: World fixture regression', () => {
  runFixtureSuite(worldFixtures as Fixture[]);
});

describe('getDailyPanchang: regional Sankranti (Phase 24-1)', () => {
  const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
  const makarDay = dateAtNoonUtc('2025-01-14'); // Makar Sankranti day

  it('region="all" emits pongal + makar_sankranti + bihu alongside canonical sankranti', () => {
    const r = getDailyPanchang(makarDay, CHENNAI, { timezone: 330 })!;
    const names = r.festivals.map(f => f.name);
    expect(names).toContain('Sankranti');
    expect(names).toContain('Pongal');
    expect(names).toContain('Makar Sankranti');
    expect(names).toContain('Magh Bihu');
    expect(names).toContain('Ayyappa Makara Jyothi');
  });

  it('region="tamil-nadu" scopes regional variants to Tamil Nadu + pan-Indian', () => {
    const r = getDailyPanchang(makarDay, CHENNAI, { timezone: 330, region: 'tamil-nadu' })!;
    const names = r.festivals.map(f => f.name);
    expect(names).toContain('Pongal');
    // Makar Sankranti is pan-Indian: it emits under every region.
    expect(names).toContain('Makar Sankranti');
    expect(names).not.toContain('Ayyappa Makara Jyothi');
    expect(names).not.toContain('Magh Bihu');
  });

  it('legacy region="tamil" is accepted via alias resolver and behaves like tamil-nadu', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    __resetRegionAliasWarnings();
    const r = getDailyPanchang(makarDay, CHENNAI, { timezone: 330, region: 'tamil' })!;
    const names = r.festivals.map(f => f.name);
    expect(names).toContain('Pongal');
    expect(names).not.toContain('Magh Bihu');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('getDailyPanchang: v2.1 Lohri (day before Makara Sankranti)', () => {
  const AMRITSAR = { latitude: 31.634, longitude: 74.872 };
  const lohriDay = dateAtNoonUtc('2025-01-13');
  const makarDayLocal = dateAtNoonUtc('2025-01-14');

  it('emits Lohri on 2025-01-13 under region="punjab"', () => {
    const r = getDailyPanchang(lohriDay, AMRITSAR, { timezone: 330, region: 'punjab' })!;
    expect(r.festivals.some(f => f.name === 'Lohri')).toBe(true);
  });

  it('emits Lohri under region="all" (default)', () => {
    const r = getDailyPanchang(lohriDay, AMRITSAR, { timezone: 330 })!;
    expect(r.festivals.some(f => f.name === 'Lohri')).toBe(true);
  });

  it('does NOT emit Lohri under region="tamil-nadu"', () => {
    const r = getDailyPanchang(lohriDay, AMRITSAR, { timezone: 330, region: 'tamil-nadu' })!;
    expect(r.festivals.some(f => f.name === 'Lohri')).toBe(false);
  });

  it('does NOT emit Lohri on the actual Makara Sankranti day', () => {
    const r = getDailyPanchang(makarDayLocal, AMRITSAR, { timezone: 330, region: 'punjab' })!;
    expect(r.festivals.some(f => f.name === 'Lohri')).toBe(false);
  });
});
