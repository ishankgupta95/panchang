/**
 * @tier 0  US Naval Observatory (aa.usno.navy.mil)
 *
 * USNO shares the convention `riseSet.ts` implements (disc centre plus
 * semidiameter, against 34′ of assumed refraction) and rounds to the printed
 * minute, so its value is truth only to ±30 s and the bounds below cannot be
 * tightened past that. The reference almanac is not usable here: its Moon uses
 * a centre-of-disc horizon and it dates moonrise to the sunrise-to-sunrise day.
 */
import { describe, it, expect } from 'vitest';
import { computeSunrise as getSunrise, computeSunset as getSunset } from '../../src/astronomy/sunrise';
import { getMoonrise, getMoonset } from '../../src/astronomy/moonrise';
import { readTestData } from '../testdata';

const fixture = readTestData('reference', 'usno-riseset.json');

const DAY_MS = 86_400_000;

interface Row {
  location: string; latitude: number; longitude: number; tz: number; date: string;
  sunrise: string | null; sunset: string | null;
  moonrise: string | null; moonset: string | null;
  sunFlags: string[]; moonFlags: string[];
}

const rows = (fixture as { rows: Row[] }).rows;

// The primitives search forward, so an event at or past the next local midnight
// is "no event on this day", matching USNO's continuously above/below rows.
function localMidnightUtc(date: string, tzHours: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) - tzHours * 3600_000;
}

// The solar primitives throw a typed error where the lunar ones return null;
// only the four NO_* codes count as "no such event".
function eventWithin(
  fn: (at: Date, loc: { latitude: number; longitude: number }) => Date | null,
  start: number, loc: { latitude: number; longitude: number },
): number | null {
  let got: Date | null;
  try {
    got = fn(new Date(start), loc);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (/^NO_(SUNRISE|SUNSET|MOONRISE|MOONSET)$/.test(code)) return null;
    throw e;
  }
  if (got === null) return null;
  const t = got.getTime();
  return t >= start && t < start + DAY_MS ? t : null;
}

const KINDS = [
  { key: 'sunrise', fn: getSunrise, body: 'sun' },
  { key: 'sunset', fn: getSunset, body: 'sun' },
  { key: 'moonrise', fn: getMoonrise, body: 'moon' },
  { key: 'moonset', fn: getMoonset, body: 'moon' },
] as const;

describe('Tier 0: rise/set vs the US Naval Observatory', () => {
  const deltas: { body: string; seconds: number; where: string }[] = [];
  const presenceMismatches: string[] = [];

  for (const row of rows) {
    const start = localMidnightUtc(row.date, row.tz);
    const loc = { latitude: row.latitude, longitude: row.longitude };
    for (const { key, fn, body } of KINDS) {
      const published = row[key];
      const mine = eventWithin(fn, start, loc);
      if (published === null && mine === null) continue;
      if (published === null || mine === null) {
        presenceMismatches.push(
          `${row.location} ${row.date} ${key}: USNO ${published ?? 'none'}, ours ${mine === null ? 'none' : new Date(mine).toISOString()}`,
        );
        continue;
      }
      const [hh, mm] = published.split(':').map(Number) as [number, number];
      const truth = start + (hh * 3600 + mm * 60) * 1000;
      deltas.push({ body, seconds: (mine - truth) / 1000, where: `${row.location} ${row.date} ${key}` });
    }
  }

  it('has a fixture wide enough to be worth asserting against', () => {
    expect(rows.length).toBeGreaterThanOrEqual(72);
    expect(new Set(rows.map((r) => r.location)).size).toBeGreaterThanOrEqual(9);
    expect(rows.some((r) => Math.abs(r.latitude) >= 80)).toBe(true);
    expect(deltas.length).toBeGreaterThanOrEqual(200);
  });

  it('agrees with USNO on whether each event happens at all', () => {
    expect(presenceMismatches, presenceMismatches.slice(0, 5).join(' | ')).toEqual([]);
  });

  for (const body of ['sun', 'moon'] as const) {
    it(`${body}: every rise and set within USNO's published minute`, () => {
      const mine = deltas.filter((d) => d.body === body);
      const worst = mine.reduce((p, c) => (Math.abs(c.seconds) > Math.abs(p.seconds) ? c : p));
      const meanAbs = mine.reduce((s, d) => s + Math.abs(d.seconds), 0) / mine.length;
      const bias = mine.reduce((s, d) => s + d.seconds, 0) / mine.length;
      // 60 s, not 30: USNO's rounding puts a ±30 s floor under any solver.
      expect(
        Math.abs(worst.seconds),
        `worst ${worst.seconds.toFixed(1)} s at ${worst.where}; mean |Δ| ${meanAbs.toFixed(1)} s, bias ${bias.toFixed(1)} s`,
      ).toBeLessThan(60);
      expect(Math.abs(bias), `bias ${bias.toFixed(1)} s`).toBeLessThan(10);
    });
  }
});
