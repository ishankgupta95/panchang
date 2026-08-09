/**
 * @tier 0  US Naval Observatory (aa.usno.navy.mil)
 *
 * The gap this closes: **rise/set had no external validation at all.**
 * `differential-riseset.test.ts` measures the shipped solver against a frozen
 * reference that shares its ephemeris, which bounds the *interpolation* and
 * says nothing about whether the answer is right; `element-endtime-audit.ts`
 * covers the panchang elements but not the Sun's or Moon's horizon crossings.
 * So the most-read numbers this library publishes — sunrise and sunset — were
 * resting on the position tests one level up.
 *
 * ## Why USNO rather than DrikPanchang
 *
 * USNO defines the convention `riseSet.ts` implements: the geometric altitude
 * of the disc's centre, plus its apparent semidiameter, against 34′ of assumed
 * refraction. A disagreement is therefore an ephemeris or solver difference and
 * not a definitional one, which is exactly what makes it adjudicable and puts
 * it in Tier 0.
 *
 * Drik was checked too, and is *not* the right instrument here — for two
 * reasons that are recorded because they look like errors and are not:
 *
 *  1. **Drik's Moon uses a different horizon convention.** Its moonrise runs
 *     ~4 min late and its moonset ~4 min early against USNO, symmetrically —
 *     the signature of requiring the disc's *centre* rather than its upper limb.
 *     Its *Sun* agrees with USNO and with this library to the printed minute.
 *  2. **Drik attributes moonrise to the Hindu day** (sunrise to sunrise), so
 *     for 2025-06-21 at Pune it publishes the 02:44 event that falls on
 *     2025-06-22. This library attributes it to the civil day and reports
 *     01:55. Neither is wrong; they are different questions.
 *
 * Both differences are identical in 4.3.1 and 5.0.0 — they are conventions, not
 * regressions.
 *
 * ## The resolution floor
 *
 * USNO publishes to the minute and **rounds** rather than truncates. That was
 * determined from the data rather than assumed: a truncating source would put
 * our times uniformly 0–60 s *after* the printed minute (mean +30 s), and the
 * observed mean offset is −2.5 s. So the published value is the truth to within
 * ±30 s, and the bounds below cannot be tightened past that however good the
 * solver gets. Measured 2026-08-07: Sun max 29.7 s, Moon max 38.6 s — i.e. the
 * quantization, plus a little for the Moon, whose parallax makes its horizon
 * crossing the more delicate of the two.
 */
import { describe, it, expect } from 'vitest';
import { computeSunrise as getSunrise, computeSunset as getSunset } from '../../src/astronomy/sunrise';
import { getMoonrise, getMoonset } from '../../src/astronomy/moonrise';
import fixture from '../fixtures/usno-riseset.json';

const DAY_MS = 86_400_000;

interface Row {
  location: string; latitude: number; longitude: number; tz: number; date: string;
  sunrise: string | null; sunset: string | null;
  moonrise: string | null; moonset: string | null;
  sunFlags: string[]; moonFlags: string[];
}

const rows = (fixture as { rows: Row[] }).rows;

/**
 * The primitives search **forward** from the instant they are given, so the
 * anchor is the target local day's midnight as a UTC instant. An event landing
 * at or past the next local midnight is "no event on this day", which is how
 * USNO's "Object continuously above/below the Horizon" rows are matched.
 */
function localMidnightUtc(date: string, tzHours: number): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) - tzHours * 3600_000;
}

/**
 * Both bodies throw a typed error at polar latitudes rather than returning
 * null. That is the library saying "no such event", so it is scored as one —
 * and only for the four expected codes, so an unrelated failure still surfaces.
 */
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
  // The lunar primitives return null where the solar ones throw; both mean
  // "no such event", and both are scored the same way.
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

describe('Tier 0 — rise/set vs the US Naval Observatory', () => {
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
    // Nine sites from the equator to 82.5 °N and 77.9 °S, eight dates across
    // 1950/2025/2088. Guards against the fixture silently shrinking.
    expect(rows.length).toBeGreaterThanOrEqual(72);
    expect(new Set(rows.map((r) => r.location)).size).toBeGreaterThanOrEqual(9);
    expect(rows.some((r) => Math.abs(r.latitude) >= 80)).toBe(true);
    expect(deltas.length).toBeGreaterThanOrEqual(200);
  });

  /**
   * The invariant half. Whether an event *exists* on a given day is not a
   * tolerance question — at 82.5 °N it is the whole question, and a solver that
   * invents a sunrise during polar night, or misses one during the weeks either
   * side, is wrong rather than imprecise.
   */
  it('agrees with USNO on whether each event happens at all', () => {
    expect(presenceMismatches, presenceMismatches.slice(0, 5).join(' | ')).toEqual([]);
  });

  for (const body of ['sun', 'moon'] as const) {
    it(`${body}: every rise and set within USNO's published minute`, () => {
      const mine = deltas.filter((d) => d.body === body);
      const worst = mine.reduce((p, c) => (Math.abs(c.seconds) > Math.abs(p.seconds) ? c : p));
      const meanAbs = mine.reduce((s, d) => s + Math.abs(d.seconds), 0) / mine.length;
      const bias = mine.reduce((s, d) => s + d.seconds, 0) / mine.length;
      // 60 s, not 30: USNO rounds, so ±30 s is the floor, and the Moon adds a
      // little of its own. Measured 2026-08-07 — Sun 29.7 s, Moon 38.6 s, both
      // with a bias inside 3 s, which is the statement that matters: a real
      // ephemeris error would show as bias, not spread.
      expect(
        Math.abs(worst.seconds),
        `worst ${worst.seconds.toFixed(1)} s at ${worst.where}; mean |Δ| ${meanAbs.toFixed(1)} s, bias ${bias.toFixed(1)} s`,
      ).toBeLessThan(60);
      expect(Math.abs(bias), `bias ${bias.toFixed(1)} s`).toBeLessThan(10);
    });
  }
});
