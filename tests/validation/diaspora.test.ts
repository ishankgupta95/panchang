import { describe, it, expect } from 'vitest';
import { getDailyPanchang } from '../../src/core/panchang';
import { resolveUtcOffset } from '../../src/utils/timezone';
import diasporaData from '../fixtures/drikpanchang-diaspora.json';

type DiasporaFixture = {
  date: string;
  city: string;
  location: { latitude: number; longitude: number };
  timezone: string;
  expectedOffsetMinutes: number;
  expected: {
    varaEnglish: string;
    tithiAtSunrise: string;
    nakshatraAtSunrise: string;
    sunriseLocal: string;
    sunsetLocal: string;
  };
};

const fixtures = (diasporaData as { fixtures: DiasporaFixture[] }).fixtures;

function ymdNoonUtc(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function localHhMm(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

describe('Phase 26-1 — diaspora cross-verification (IANA timezone strings)', () => {
  for (const fx of fixtures) {
    const { date, city, location, timezone, expected, expectedOffsetMinutes } = fx;

    describe(`${date} / ${city}`, () => {
      const result = getDailyPanchang(ymdNoonUtc(date), location, { timezone });

      it(`IANA zone "${timezone}" resolves to offset ${expectedOffsetMinutes} min`, () => {
        expect(result.timezone).toBe(expectedOffsetMinutes);
      });

      it(`vara === "${expected.varaEnglish}"`, () => {
        expect(result.vara.englishName).toBe(expected.varaEnglish);
      });

      it(`tithi at sunrise === "${expected.tithiAtSunrise}"`, () => {
        expect(result.tithis[0]!.name).toBe(expected.tithiAtSunrise);
      });

      it(`nakshatra at sunrise === "${expected.nakshatraAtSunrise}"`, () => {
        expect(result.nakshatras[0]!.name).toBe(expected.nakshatraAtSunrise);
      });

      it(`sunrise local ≈ ${expected.sunriseLocal} (±2 min)`, () => {
        const actual = localHhMm(result.sunrise);
        const toMin = (s: string) => {
          const [h, m] = s.split(':').map(Number) as [number, number];
          return h * 60 + m;
        };
        expect(Math.abs(toMin(actual) - toMin(expected.sunriseLocal))).toBeLessThanOrEqual(2);
      });

      it(`sunset local ≈ ${expected.sunsetLocal} (±2 min)`, () => {
        const actual = localHhMm(result.sunset);
        const toMin = (s: string) => {
          const [h, m] = s.split(':').map(Number) as [number, number];
          return h * 60 + m;
        };
        expect(Math.abs(toMin(actual) - toMin(expected.sunsetLocal))).toBeLessThanOrEqual(2);
      });

      it('sunrise < sunset < nextSunrise (Hindu-day invariant)', () => {
        expect(result.sunrise.getTime()).toBeLessThan(result.sunset.getTime());
        expect(result.sunset.getTime()).toBeLessThan(result.nextSunrise.getTime());
      });
    });
  }
});

describe('Phase 26-1 — DST transition edge cases (America/New_York)', () => {
  const NYC = { latitude: 40.7128, longitude: -74.006 };
  const springForward = ymdNoonUtc('2025-03-09'); // DST begins at 02:00 EST → 03:00 EDT
  const fallBack = ymdNoonUtc('2025-11-02');      // DST ends at 02:00 EDT → 01:00 EST
  const dayBeforeSpring = ymdNoonUtc('2025-03-08');
  const dayAfterSpring = ymdNoonUtc('2025-03-10');
  const dayBeforeFall = ymdNoonUtc('2025-11-01');
  const dayAfterFall = ymdNoonUtc('2025-11-03');

  it('spring-forward day resolves EDT (-240) via IANA zone', () => {
    const r = getDailyPanchang(springForward, NYC, { timezone: 'America/New_York' });
    expect(r.timezone).toBe(-240);
  });

  it('fall-back day resolves EST (-300) via IANA zone', () => {
    const r = getDailyPanchang(fallBack, NYC, { timezone: 'America/New_York' });
    expect(r.timezone).toBe(-300);
  });

  it('offset flips EST→EDT across spring-forward boundary', () => {
    const before = getDailyPanchang(dayBeforeSpring, NYC, { timezone: 'America/New_York' });
    const after = getDailyPanchang(dayAfterSpring, NYC, { timezone: 'America/New_York' });
    expect(before.timezone).toBe(-300);
    expect(after.timezone).toBe(-240);
  });

  it('offset flips EDT→EST across fall-back boundary', () => {
    const before = getDailyPanchang(dayBeforeFall, NYC, { timezone: 'America/New_York' });
    const after = getDailyPanchang(dayAfterFall, NYC, { timezone: 'America/New_York' });
    expect(before.timezone).toBe(-240);
    expect(after.timezone).toBe(-300);
  });

  it('Hindu-day invariant holds across spring-forward (sunrise < sunset < nextSunrise)', () => {
    const r = getDailyPanchang(springForward, NYC, { timezone: 'America/New_York' });
    expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
    expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
  });

  it('Hindu-day invariant holds across fall-back (sunrise < sunset < nextSunrise)', () => {
    const r = getDailyPanchang(fallBack, NYC, { timezone: 'America/New_York' });
    expect(r.sunrise.getTime()).toBeLessThan(r.sunset.getTime());
    expect(r.sunset.getTime()).toBeLessThan(r.nextSunrise.getTime());
  });

  it('numeric vs IANA timezone produce identical results on standard-time days', () => {
    const iana = getDailyPanchang(dayBeforeSpring, NYC, { timezone: 'America/New_York' });
    const numeric = getDailyPanchang(dayBeforeSpring, NYC, { timezone: -300 });
    expect(iana.timezone).toBe(numeric.timezone);
    expect(iana.sunrise.getTime()).toBe(numeric.sunrise.getTime());
    expect(iana.tithis[0]!.name).toBe(numeric.tithis[0]!.name);
  });

  it('resolveUtcOffset returns the active offset for the given reference date', () => {
    expect(resolveUtcOffset('America/New_York', dayBeforeSpring)).toBe(-300);
    expect(resolveUtcOffset('America/New_York', dayAfterSpring)).toBe(-240);
    expect(resolveUtcOffset('America/New_York', dayBeforeFall)).toBe(-240);
    expect(resolveUtcOffset('America/New_York', dayAfterFall)).toBe(-300);
  });
});

describe('Phase 26-1 — high-latitude diaspora locations', () => {
  // London at 51.5°N — long winter nights, short winter days. Ensures the
  // sunrise search converges and the Hindu-day window stays sane.
  it('London winter solstice produces a valid short day (~8 h)', () => {
    const r = getDailyPanchang(
      ymdNoonUtc('2025-12-21'),
      { latitude: 51.5074, longitude: -0.1278 },
      { timezone: 'Europe/London' },
    );
    expect(r.dayDurationMinutes).toBeGreaterThan(6 * 60);
    expect(r.dayDurationMinutes).toBeLessThan(10 * 60);
  });

  it('Sydney summer solstice produces a valid long day (~14 h)', () => {
    const r = getDailyPanchang(
      ymdNoonUtc('2025-12-21'),
      { latitude: -33.8688, longitude: 151.2093 },
      { timezone: 'Australia/Sydney' },
    );
    expect(r.dayDurationMinutes).toBeGreaterThan(13 * 60);
    expect(r.dayDurationMinutes).toBeLessThan(15 * 60);
  });
});
