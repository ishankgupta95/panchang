/**
 * Every assertion here is a contract, not arithmetic: none of it may be re-pinned.
 */

import { describe, it, expect } from 'vitest';
import { getDailyPanchang, getInstantPanchang, formatInZone } from '../../src/index';
import { computeSunrise, computeSunset } from '../../src/astronomy/sunrise';
import { getLocalMidnightUtc } from '../../src/utils/timezone';

const DELHI = { latitude: 28.6139, longitude: 77.209 };
const NYC = { latitude: 40.7128, longitude: -74.006 };
const DAY = new Date('2025-01-14');

function daily(tz: number | string, loc = DELHI) {
  const r = getDailyPanchang(DAY, loc, { timezone: tz });
  if (r === null) throw new Error('no panchang');
  return r;
}

describe('`_debug` is gone', () => {
  it('is absent from the result, not merely undefined', () => {
    const r = daily(330);
    expect(Object.prototype.hasOwnProperty.call(r, '_debug')).toBe(false);
    expect(JSON.parse(JSON.stringify(r))).not.toHaveProperty('_debug');
  });
});

describe('suryaNakshatra carries a nakshatra index, and says so', () => {
  it('spans 0..26 across a year, which no rashi index can', () => {
    const seen = new Set<number>();
    for (let d = 0; d < 366; d += 5) {
      const r = getDailyPanchang(
        new Date(Date.UTC(2025, 0, 1) + d * 86_400_000), DELHI, { timezone: 330 },
      );
      if (r) seen.add(r.sun.nakshatra.index);
    }
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...seen)).toBeGreaterThan(11);
    expect(Math.max(...seen)).toBeLessThanOrEqual(26);
    expect(seen.size).toBe(27);
  });

  it('names a nakshatra, not a rashi', () => {
    const r = daily(330);
    expect(r.sun.nakshatra.name).not.toMatch(/^(Mesha|Vrishabha|Mithuna|Karka|Simha|Kanya|Tula|Vrischika|Dhanu|Makara|Kumbha|Meena)$/);
    expect(r.moon.rashi.index).toBeLessThanOrEqual(11);
  });

  it('the instant result agrees with the daily one at sunrise', () => {
    const r = daily(330);
    const inst = getInstantPanchang(r.sun.rise, DELHI);
    expect(inst!.sun.nakshatra.index).toBe(r.sun.nakshatra.index);
  });
});

describe('the alias pairs really are aliases', () => {
  it('dinamana/ratrimana are the same numbers as day/nightDurationMinutes', () => {
    for (const tz of [330, -300, 0, 600]) {
      const r = daily(tz, tz === -300 ? NYC : DELHI);
      expect(r.sun.dinamanaMinutes).toBe(r.sun.dayDurationMinutes);
      expect(r.sun.ratrimanaMinutes).toBe(r.sun.nightDurationMinutes);
    }
  });

  it('day and night durations sum to the Hindu day', () => {
    const r = daily(330);
    const spanMinutes = Math.round(
      (r.sun.nextRise.getTime() - r.sun.rise.getTime()) / 60_000,
    );
    // Each half is rounded independently, so allow the 1-minute rounding gap.
    expect(Math.abs(r.sun.dayDurationMinutes + r.sun.nightDurationMinutes - spanMinutes))
      .toBeLessThanOrEqual(1);
  });
});

describe('the resolved timezone is echoed back', () => {
  it('reports the offset for a numeric timezone, and names no zone', () => {
    const r = daily(330);
    expect(r.timezone.offsetMinutes).toBe(330);
    expect(r.timezone.zone).toBeUndefined();
  });

  it('reports the zone name when one was passed', () => {
    const r = daily('Asia/Kolkata');
    expect(r.timezone.offsetMinutes).toBe(330);
    expect(r.timezone.zone).toBe('Asia/Kolkata');
  });

  it('an IANA zone and its equivalent offset agree on everything else', () => {
    const iana = daily('America/New_York', NYC);
    const numeric = daily(iana.timezone.offsetMinutes, NYC);
    expect(iana.timezone.offsetMinutes).toBe(numeric.timezone.offsetMinutes);
    expect(iana.sun.rise.toISOString()).toBe(numeric.sun.rise.toISOString());
    expect(iana.angas.tithis.map(t => t.index)).toEqual(numeric.angas.tithis.map(t => t.index));
  });

  it('resolves DST from the requested day, not from "now"', () => {
    // 2025-06-21 is EDT (-240); 2025-01-14 is EST (-300). Same zone string.
    const summer = getDailyPanchang(new Date('2025-06-21'), NYC, { timezone: 'America/New_York' });
    const winter = getDailyPanchang(new Date('2025-01-14'), NYC, { timezone: 'America/New_York' });
    expect(summer!.timezone.offsetMinutes).toBe(-240);
    expect(winter!.timezone.offsetMinutes).toBe(-300);
    expect(summer!.timezone.zone).toBe('America/New_York');
  });

  it('survives JSON round-tripping, which a bare number also did', () => {
    const r = daily('Asia/Kolkata');
    const round = JSON.parse(JSON.stringify(r)) as typeof r;
    expect(round.timezone).toEqual({ offsetMinutes: 330, zone: 'Asia/Kolkata' });
  });
});

describe('published Dates are real instants', () => {
  // Guards against a published `Date` being `trueInstant + offsetMinutes`.
  it('result.sunrise/sunset/nextSunrise equal the primitives that produced them', () => {
    for (const [tz, loc] of [[330, DELHI], [-300, NYC], [0, DELHI]] as const) {
      const r = getDailyPanchang(DAY, loc, { timezone: tz })!;
      const localMidnightUtc = getLocalMidnightUtc(DAY, tz);
      const sunrise = computeSunrise(localMidnightUtc, loc);
      const sunset = computeSunset(sunrise, loc);
      const nextSunrise = computeSunrise(sunset, loc);

      expect(r.sun.rise.getTime()).toBe(sunrise.getTime());
      expect(r.sun.set.getTime()).toBe(sunset.getTime());
      expect(r.sun.nextRise.getTime()).toBe(nextSunrise.getTime());
    }
  });

  it('JSON.stringify round-trips to the correct instant', () => {
    const r = daily(330);
    const round = JSON.parse(JSON.stringify(r)) as { sun: { rise: string } };
    expect(new Date(round.sun.rise).getTime()).toBe(r.sun.rise.getTime());
  });

  it('Intl with a timeZone renders the same wall clock as sunriseLocal', () => {
    const r = daily('Asia/Kolkata');
    const rendered = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(r.sun.rise);
    expect(rendered).toBe(r.sun.riseLocal.slice(11, 16));
  });

  it('comparisons against a real timestamp are meaningful', () => {
    const r = daily(330);
    expect(r.sun.rise.getTime()).toBeLessThan(r.sun.set.getTime());
    expect(r.sun.set.getTime()).toBeLessThan(r.sun.nextRise.getTime());
    const span = (r.sun.nextRise.getTime() - r.sun.rise.getTime()) / 3600_000;
    expect(span).toBeGreaterThan(23);
    expect(span).toBeLessThan(25);
  });

  it('every *Local string carries the resolved offset and matches its instant', () => {
    const r = daily('Asia/Kolkata');
    const pairs: [Date, string][] = [
      [r.sun.rise, r.sun.riseLocal], [r.sun.set, r.sun.setLocal],
      [r.sun.nextRise, r.sun.nextRiseLocal],
      [r.inauspicious.rahuKalam.start, r.inauspicious.rahuKalam.startLocal], [r.inauspicious.rahuKalam.end, r.inauspicious.rahuKalam.endLocal],
      [r.muhurtas.madhyahna.start, r.muhurtas.madhyahna.startLocal],
      [r.periods.choghadiya.day[0]!.start, r.periods.choghadiya.day[0]!.startLocal],
      [r.periods.hora.night[3]!.end, r.periods.hora.night[3]!.endLocal],
      [r.muhurtas.doGhati.day[7]!.start, r.muhurtas.doGhati.day[7]!.startLocal],
      [r.periods.gowri.night[2]!.end, r.periods.gowri.night[2]!.endLocal],
    ];
    for (const [instant, local] of pairs) {
      expect(local).toMatch(/\+05:30$/);
      expect(Date.parse(local)).toBe(instant.getTime());
    }
  });

  it('element start/end times carry their *Local companions', () => {
    const r = daily(330);
    for (const arr of [r.angas.tithis, r.angas.nakshatras, r.angas.yogas, r.angas.karanas]) {
      for (const e of arr) {
        expect(e.endTimeLocal === null).toBe(e.endTime === null);
        expect(e.startTimeLocal === null).toBe(e.startTime === null);
        if (e.endTime && e.endTimeLocal) {
          expect(Date.parse(e.endTimeLocal)).toBe(e.endTime.getTime());
        }
      }
    }
  });

  it('formatInZone renders any instant in any offset', () => {
    const t = new Date('2025-01-14T01:39:44.172Z');
    expect(formatInZone(t, 330)).toBe('2025-01-14T07:09:44.172+05:30');
    expect(formatInZone(t, 0)).toBe('2025-01-14T01:39:44.172+00:00');
    expect(formatInZone(t, -300)).toBe('2025-01-13T20:39:44.172-05:00');
    expect(formatInZone(t, -210)).toBe('2025-01-13T22:09:44.172-03:30');
    for (const off of [330, 0, -300, -210, 720, -720]) {
      expect(Date.parse(formatInZone(t, off))).toBe(t.getTime());
    }
  });
});
