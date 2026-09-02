import { describe, it, expect } from 'vitest';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { PanchangError } from '../../src/types/errors';

const PUNE = { latitude: 18.5204, longitude: 73.8567 };

const PUNE_JAN14_MIDNIGHT_UTC = new Date('2025-01-13T18:30:00Z');

const COMPUTED_SUNRISE_UTC = new Date('2025-01-14T01:39:44Z');

const COMPUTED_SUNSET_UTC = new Date('2025-01-14T12:47:39Z');

const ONE_MINUTE_MS = 60_000;

describe('computeSunrise', () => {
  it('Pune 2025-01-14 sunrise is within 1 minute of expected computed value', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    const diff = Math.abs(sunrise.getTime() - COMPUTED_SUNRISE_UTC.getTime());
    expect(diff).toBeLessThanOrEqual(ONE_MINUTE_MS);
  });

  it('returns a Date object', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    expect(sunrise).toBeInstanceOf(Date);
  });

  it('sunrise is after the search start (local midnight)', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    expect(sunrise.getTime()).toBeGreaterThan(PUNE_JAN14_MIDNIGHT_UTC.getTime());
  });

  it('sunrise is before local noon (sanity check)', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    const istNoon = new Date('2025-01-14T06:30:00Z');
    expect(sunrise.getTime()).toBeLessThan(istNoon.getTime());
  });

  it('throws NO_SUNRISE for polar night (Tromsø in December)', () => {
    const tromso = { latitude: 69.65, longitude: 18.95 };
    const dec = new Date('2025-12-21T00:00:00Z');
    let caught: unknown;
    try {
      computeSunrise(dec, tromso, 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PanchangError);
    expect((caught as PanchangError).code).toBe('NO_SUNRISE');
  });
});

describe('computeSunset', () => {
  it('Pune 2025-01-14 sunset is within 1 minute of expected computed value', () => {
    const afterSunrise = new Date('2025-01-14T02:00:00Z');
    const sunset = computeSunset(afterSunrise, PUNE);
    const diff = Math.abs(sunset.getTime() - COMPUTED_SUNSET_UTC.getTime());
    expect(diff).toBeLessThanOrEqual(ONE_MINUTE_MS);
  });

  it('sunset is after sunrise', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    const sunset = computeSunset(new Date(sunrise.getTime() + 60_000), PUNE);
    expect(sunset.getTime()).toBeGreaterThan(sunrise.getTime());
  });

  it('day length in January is ~11 hours for Pune (18°N)', () => {
    const sunrise = computeSunrise(PUNE_JAN14_MIDNIGHT_UTC, PUNE);
    const afterSunrise = new Date(sunrise.getTime() + 60_000);
    const sunset = computeSunset(afterSunrise, PUNE);
    const dayLengthHours = (sunset.getTime() - sunrise.getTime()) / 3_600_000;
    expect(dayLengthHours).toBeGreaterThan(10);
    expect(dayLengthHours).toBeLessThan(12);
  });

  it('throws NO_SUNSET for polar midnight sun (Tromsø in June)', () => {
    const tromso = { latitude: 69.65, longitude: 18.95 };
    const jun = new Date('2025-06-21T00:00:00Z');
    let caught: unknown;
    try {
      computeSunset(jun, tromso, 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(PanchangError);
    expect((caught as PanchangError).code).toBe('NO_SUNSET');
  });
});

/**
 * The almanac's rule is "upper edge of sun along with refraction", elevation
 * excluded by default: geometric solar centre at −0.8333° (−50′ = 34′ mean
 * refraction + 16′ semi-diameter). Only the threshold is pinned, never an
 * instant, published rise/set being minute-rounded.
 */
describe('sunrise definition', () => {
  it('fires when the geometric solar centre reaches −0.8333°', async () => {
    const ae = await import('astronomy-engine');
    const DELHI = { latitude: 28.6139, longitude: 77.209 };
    const observer = new ae.Observer(DELHI.latitude, DELHI.longitude, 0);

    for (const day of ['2025-01-14', '2025-08-15']) {
      const sunrise = computeSunrise(new Date(`${day}T00:00:00Z`), DELHI);
      const time = ae.MakeTime(sunrise);
      const eq = ae.Equator(ae.Body.Sun, time, observer, true, true);
      const geometricAltitude = ae.Horizon(time, observer, eq.ra, eq.dec, undefined).altitude;
      expect(
        geometricAltitude,
        `${day}: geometric solar altitude at sunrise was ${geometricAltitude.toFixed(4)}°`,
      ).toBeCloseTo(-0.8333, 2);
    }
  });
});
