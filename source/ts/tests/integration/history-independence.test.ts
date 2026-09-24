/**
 * The library keeps module-level memos (phase searches, eclipse finders, planet longitudes, rise
 * and set events, longitude blocks, zone formatters). Each is keyed on every input its value
 * depends on, so no result may depend on which calls ran before it. This runs a mixed set of
 * public calls alone in fresh module state, then in two different shuffled orders in warm state,
 * and requires every result to match to the bit.
 */
import { describe, it, expect, vi } from 'vitest';
import type * as Library from '../../src/index';

type Lib = typeof Library;

const PUNE = { latitude: 18.5204, longitude: 73.8567 };
const NY = { latitude: 40.7128, longitude: -74.006 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };
const TROMSO = { latitude: 69.6492, longitude: 18.9553 };
const BIRTH = new Date('1995-08-15T05:30:00Z');
const DELHI = { latitude: 28.6139, longitude: 77.209 };
const AS_OF = new Date('2026-01-01T00:00:00Z');

const day = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Every call reads a memo; the dates straddle the 2025-03-29 new moon and its solar eclipse. */
const CALLS: ReadonlyArray<readonly [string, (lib: Lib) => unknown]> = [
  ['daily Pune 03-28', (l) => l.getDailyPanchang(day('2025-03-28'), PUNE, { timezone: 330 })],
  ['daily Pune 03-29', (l) => l.getDailyPanchang(day('2025-03-29'), PUNE, { timezone: 330 })],
  ['daily Pune 03-30 hi', (l) => l.getDailyPanchang(day('2025-03-30'), PUNE, {
    timezone: 'Asia/Kolkata', language: 'hi', masaSystem: 'amanta',
  })],
  ['daily NY 03-29', (l) => l.getDailyPanchang(day('2025-03-29'), NY, { timezone: 'America/New_York' })],
  ['daily NY 03-30 narrow', (l) => l.getDailyPanchang(day('2025-03-30'), NY, {
    timezone: 'America/New_York', sections: ['festivals', 'eclipse'], computeEndTimes: false,
  })],
  ['daily Tromso 06-20', (l) => l.getDailyPanchang(day('2025-06-20'), TROMSO, { timezone: 'Europe/Oslo' })],
  ['instant before new moon', (l) => l.getInstantPanchang(new Date('2025-03-29T10:57:00Z'), PUNE)],
  ['instant after new moon', (l) => l.getInstantPanchang(new Date('2025-03-29T10:59:00Z'), PUNE)],
  ['instant noon', (l) => l.getInstantPanchang(new Date('2025-04-02T06:30:00Z'), DELHI, { masaSystem: 'amanta' })],
  ['festivals range', (l) => l.computeFestivalsInRange(day('2025-03-20'), day('2025-04-08'), DELHI, { timezone: 330 })],
  ['festivals range NY', (l) => l.computeFestivalsInRange(day('2025-03-25'), day('2025-04-02'), NY, {
    timezone: 'America/New_York',
  })],
  ['upcoming eclipses Pune', (l) => l.getUpcomingEclipses(day('2024-06-01'), PUNE, 5)],
  ['upcoming eclipses Sydney', (l) => l.getUpcomingEclipses(day('2025-02-15'), SYDNEY, 3)],
  ['eclipses in range NY', (l) => l.computeEclipsesInRange(day('2024-01-01'), day('2025-12-31'), NY)],
  ['eclipse during day', (l) => {
    const rise = l.getSunrise(day('2025-03-29'), NY);
    return l.getEclipseDuringDay(rise, l.getSunrise(new Date(rise.getTime() + 20 * 3600_000), NY), NY);
  }],
  ['gregorian to hindu', (l) => l.convertGregorianToHindu(day('2025-03-30'), PUNE, { timezone: 330 })],
  ['hindu to gregorian', (l) => l.convertHinduToGregorian({
    vikramSamvat: 2082, masaIndex: 0, paksha: 'shukla', pakshaTithi: 1,
  }, PUNE, { timezone: 330 })],
  ['hindu new year', (l) => l.getHinduNewYear(2025, 'all', NY, { timezone: 'America/New_York' })],
  ['hindu new year tamil', (l) => l.getHinduNewYear(2025, 'tamil-nadu', PUNE, { timezone: 330 })],
  ['muhurta table', (l) => l.buildMuhurtaTable({
    rule: l.vivahRule, location: PUNE, timezoneOffsetMinutes: 330, startYear: 2025, endYear: 2025,
    includeFailures: true,
  })],
  ['muhurta range', (l) => l.computeAuspiciousDatesInRange(
    l.grihaPraveshRule, day('2025-03-20'), day('2025-04-10'), PUNE, { timezone: 330, includeFailures: true },
  )],
  ['score muhurta', (l) => l.scoreMuhurta(day('2025-03-29'), PUNE, l.vivahRule, { timezone: 330 })],
  ['moon phases', (l) => l.computeMoonPhasesInRange(day('2025-03-01'), day('2025-05-01'))],
  // Seeds an hour and a minute apart reach the same syzygies; a memo that let one answer for the
  // other would move an instant by a millisecond.
  ['moon phases +1h', (l) => l.computeMoonPhasesInRange(new Date('2025-03-01T01:00:00Z'), day('2025-05-01'))],
  ['moon phases +1min', (l) => l.computeMoonPhasesInRange(new Date('2025-03-01T00:01:00Z'), day('2025-05-01'))],
  ['upcoming eclipses +1h', (l) => l.getUpcomingEclipses(new Date('2024-06-01T01:00:00Z'), PUNE, 5)],
  ['sade sati active', (l) => l.computeSadeSati(10, day('2025-03-01'))],
  ['sade sati inactive', (l) => l.computeSadeSati(4, day('2025-03-01'), 'raman')],
  ['narayan variable', (l) => l.computeNarayanDasha(BIRTH, DELHI, 'lahiri', { duration: 'variable', asOfDate: AS_OF })],
  ['bhava placidus', (l) => l.computeBhava(BIRTH, DELHI, { houseSystem: 'placidus-kp' })],
  ['kp cuspal sub lords', (l) => l.computeKpCuspalSubLords(BIRTH, DELHI)],
  ['rashi chart', (l) => l.computeRashiChart(BIRTH, DELHI, { houseSystem: 'equal' })],
  ['shadbala', (l) => l.computeShadbala(BIRTH, DELHI)],
  ['planetary positions', (l) => l.computePlanetaryPositions(BIRTH, 'krishnamurti')],
  ['format', (l) => l.formatInZone(new Date('2025-03-29T10:58:00.123Z'), -330)],
];

/** Exact to the bit: -0 and NaN spelled out, a Date by its millisecond. */
function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  if (value instanceof Date) return `Date(${value.getTime()})`;
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return String(value);
}

function run(lib: Lib, call: (lib: Lib) => unknown): string {
  try {
    return canonical(call(lib));
  } catch (e: unknown) {
    const err = e as { name?: string; code?: string; message?: string };
    return `threw ${err.name} ${err.code ?? ''} ${err.message}`;
  }
}

async function freshLibrary(): Promise<Lib> {
  vi.resetModules();
  return await import('../../src/index');
}

/** Deterministic Fisher-Yates, so a failure names a reproducible order. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe('results do not depend on call history', () => {
  it('a call alone in fresh module state matches it after any other calls, in any order', async () => {
    const [a, b] = [await freshLibrary(), await freshLibrary()];
    expect(a.getDailyPanchang, 'each fresh library must be a new module instance').not.toBe(b.getDailyPanchang);

    const alone = new Map<string, string>();
    for (const [name, call] of CALLS) {
      alone.set(name, run(await freshLibrary(), call));
    }

    for (const seed of [20260924, 7]) {
      const warm = await freshLibrary();
      for (const [name, call] of shuffled(CALLS, seed)) {
        expect(run(warm, call), `${name} after the calls before it (order seed ${seed})`).toBe(alone.get(name));
      }
      for (const [name, call] of shuffled(CALLS, seed + 1)) {
        expect(run(warm, call), `${name} repeated in warm state (order seed ${seed + 1})`).toBe(alone.get(name));
      }
    }
  }, 300_000);

  it('a returned eclipse cannot reach the memo that produced it', async () => {
    const lib = await freshLibrary();
    const first = lib.getUpcomingEclipses(day('2025-03-01'), PUNE, 2);
    const expected = canonical(first);
    for (const e of first) {
      e.start.setTime(0);
      e.peak.setTime(0);
      e.end.setTime(0);
      e.sutakEnd?.setTime(0);
    }
    expect(canonical(lib.getUpcomingEclipses(day('2025-03-01'), PUNE, 2))).toBe(expected);
  });
});
