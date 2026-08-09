/**
 * @tier 2  this repository — the shipped eclipse solver against its own frozen reference
 *
 * PLAN.md §36.0 H, step 5, for Phase 36.5. The shipped solver is fast because
 * of two search choices; this measures what each one costs by comparing it
 * against a solver that makes neither:
 *
 * | | shipped | reference |
 * |---|---|---|
 * | greatest eclipse | four parabolic fits, 60 min → 10 min → 1 min → 5 s | nested enumeration, 60 s → 1 s → 1 ms |
 * | contact times | chord-seeded bracket, then Illinois false position | 60-second scan, then bisection to 1 ms |
 *
 * Both sides read the same ephemeris and transcribe the shadow formulas
 * independently, so the *positions* cancel exactly — their accuracy is Tier 0's
 * question and is answered in `tier0-own-eclipses.test.ts` — and what is left
 * is the approximation the search chose to make.
 *
 * ## Why the seeded bracket needs checking at all
 *
 * The shipped contact solver estimates where the crossing is before it looks,
 * from `√(threshold² − least²) / rate`. That estimate is a right-triangle
 * approximation to a curve, so it is *wrong*, and deliberately so — it is used
 * to place a bracket, never to answer. The failure it could hide is a bracket
 * that closes on the wrong side of a shallow crossing, which is exactly what a
 * penumbral contact is: the Moon's limb grazes the penumbra's edge and
 * d(separation)/dt approaches zero there. So the eclipses below are chosen to
 * include marginal penumbrals, not only the photogenic totals.
 */
import { describe, it, expect } from 'vitest';
import { findLunarEclipse, findLocalSolarEclipse } from '../../src/astronomy/eclipseGeometry';
import { searchMoonPhase } from '../../src/astronomy/lunation';
import {
  lunarEclipseReference, localSolarEclipseReference,
} from '../reference/eclipse-reference';

const DAY_MS = 86_400_000;

/**
 * Twelve lunar eclipses spanning 1912–2088 and all three types, including two
 * that barely happen at all: 1998-08-08 and 2042-09-29 are shallow penumbrals
 * whose magnitude sits near 0.1, where the contact crossing is at its
 * shallowest and a seeded bracket has the least to work with.
 */
const LUNAR = [
  '1912-09-26', '1927-06-15', '1942-03-03', '1957-05-13', '1968-04-13',
  '1979-09-06', '1990-02-09', '1998-08-08', '2011-06-15', '2025-03-14',
  '2042-09-29', '2088-05-05',
];

/**
 * Solar eclipses paired with a site that sees them, spanning 1912–2088 and
 * covering partial, annular and total *as seen from that site* — which is the
 * distinction that matters here, since a total eclipse is partial almost
 * everywhere. 1995-10-24 at Varanasi is in the list for the same reason as the
 * shallow penumbrals above but from the other end: at magnitude 0.99 the site
 * sits just outside the umbra, so the inner contact does not exist and the
 * outer one is as deep as a partial can be.
 */
const SOLAR: readonly { date: string; name: string; latitude: number; longitude: number }[] = [
  { date: '1912-04-17', name: 'Paris', latitude: 48.86, longitude: 2.35 },
  { date: '1927-06-29', name: 'London', latitude: 51.51, longitude: -0.13 },
  { date: '1936-06-19', name: 'Athens', latitude: 37.98, longitude: 23.73 },
  { date: '1955-06-20', name: 'Bangkok', latitude: 13.75, longitude: 100.5 },
  { date: '1976-04-29', name: 'Varanasi', latitude: 25.32, longitude: 82.97 },
  { date: '1980-02-16', name: 'Nairobi', latitude: -1.29, longitude: 36.82 },
  { date: '1995-10-24', name: 'Varanasi', latitude: 25.32, longitude: 82.97 },
  { date: '2009-07-22', name: 'Varanasi', latitude: 25.32, longitude: 82.97 },
  { date: '2010-01-15', name: 'Nairobi', latitude: -1.29, longitude: 36.82 },
  { date: '2017-08-21', name: 'Casper', latitude: 42.87, longitude: -106.31 },
  { date: '2024-04-08', name: 'Dallas', latitude: 32.78, longitude: -96.8 },
  { date: '2027-08-02', name: 'Luxor', latitude: 25.69, longitude: 32.64 },
  { date: '2064-02-17', name: 'Varanasi', latitude: 25.32, longitude: 82.97 },
  { date: '2081-09-03', name: 'Paris', latitude: 48.86, longitude: 2.35 },
] as const;

/** Noon UTC on a `YYYY-MM-DD`. */
function noon(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day, 12);
}

describe('§36.0 H — the eclipse search against the direct one', () => {
  it('lunar: same type, same instants', () => {
    let worstPeakMs = 0;
    let worstPeakAt = '';
    let worstContactMs = 0;
    let worstContactAt = '';
    let worstMagnitude = 0;
    let checked = 0;

    for (const date of LUNAR) {
      const opposition = searchMoonPhase(180, new Date(noon(date) - 3 * DAY_MS), 8);
      expect(opposition, `no opposition near ${date}`).not.toBeNull();
      const mine = findLunarEclipse(opposition as Date);
      const truth = lunarEclipseReference((opposition as Date).getTime());
      expect(mine, `shipped solver found no eclipse on ${date}`).not.toBeNull();
      expect(truth, `reference solver found no eclipse on ${date}`).not.toBeNull();
      if (mine === null || truth === null) continue;
      checked++;

      // The **type** is an invariant. Two searches over identical geometry that
      // disagree about whether an eclipse is total have a defect, not a
      // tolerance.
      expect(mine.kind, `${date}: type`).toBe(truth.kind);

      const peakDelta = Math.abs(mine.peak.getTime() - truth.peakMs);
      if (peakDelta > worstPeakMs) { worstPeakMs = peakDelta; worstPeakAt = date; }

      const contacts: [Date | null, number | null][] = [
        [mine.penumbralBegin, truth.penumbralBeginMs],
        [mine.penumbralEnd, truth.penumbralEndMs],
        [mine.partialBegin, truth.partialBeginMs],
        [mine.partialEnd, truth.partialEndMs],
        [mine.totalBegin, truth.totalBeginMs],
        [mine.totalEnd, truth.totalEndMs],
      ];
      for (const [ours, theirs] of contacts) {
        // Whether a phase exists at all is decided by the magnitude, which both
        // sides compute the same way — so a null on one side and not the other
        // is a defect, and `toBe` says so rather than skipping.
        expect(ours === null, `${date}: phase presence`).toBe(theirs === null);
        if (ours === null || theirs === null) continue;
        const delta = Math.abs(ours.getTime() - theirs);
        if (delta > worstContactMs) { worstContactMs = delta; worstContactAt = date; }
      }

      worstMagnitude = Math.max(
        worstMagnitude,
        Math.abs(mine.penumbralMagnitude - truth.penumbralMagnitude),
        Math.abs(mine.umbralMagnitude - truth.umbralMagnitude),
      );
    }

    expect(checked).toBe(LUNAR.length);
    // Both sides converge to a millisecond, so the floor is the rounding of the
    // returned `Date`. Measured 2026-08-07: peak 1 ms, contacts 1 ms.
    expect(worstPeakMs, `worst greatest-eclipse Δ ${worstPeakMs} ms at ${worstPeakAt}`).toBeLessThan(50);
    expect(worstContactMs, `worst contact Δ ${worstContactMs} ms at ${worstContactAt}`).toBeLessThan(50);
    expect(worstMagnitude, `worst magnitude Δ ${worstMagnitude}`).toBeLessThan(1e-6);
  }, 300_000);

  it('solar: same type, same instants, at sites that see the eclipse', () => {
    let worstPeakMs = 0;
    let worstPeakAt = '';
    let worstContactMs = 0;
    let worstContactAt = '';
    let worstMagnitude = 0;
    let checked = 0;

    for (const site of SOLAR) {
      const conjunction = searchMoonPhase(0, new Date(noon(site.date) - 3 * DAY_MS), 8);
      expect(conjunction, `no conjunction near ${site.date}`).not.toBeNull();
      const location = { latitude: site.latitude, longitude: site.longitude };
      const mine = findLocalSolarEclipse(conjunction as Date, location);
      const truth = localSolarEclipseReference((conjunction as Date).getTime(), location);
      const where = `${site.date} ${site.name}`;
      expect(mine, `shipped solver found no eclipse at ${where}`).not.toBeNull();
      expect(truth, `reference solver found no eclipse at ${where}`).not.toBeNull();
      if (mine === null || truth === null) continue;
      checked++;

      expect(mine.kind, `${where}: type`).toBe(truth.kind);
      const peakDelta = Math.abs(mine.peak.getTime() - truth.peakMs);
      if (peakDelta > worstPeakMs) { worstPeakMs = peakDelta; worstPeakAt = where; }
      for (const [ours, theirs] of [
        [mine.partialBegin.getTime(), truth.partialBeginMs],
        [mine.partialEnd.getTime(), truth.partialEndMs],
      ] as const) {
        const delta = Math.abs(ours - theirs);
        if (delta > worstContactMs) { worstContactMs = delta; worstContactAt = where; }
      }
      worstMagnitude = Math.max(worstMagnitude, Math.abs(mine.magnitude - truth.magnitude));
    }

    expect(checked).toBe(SOLAR.length);
    expect(worstPeakMs, `worst maximum Δ ${worstPeakMs} ms at ${worstPeakAt}`).toBeLessThan(50);
    expect(worstContactMs, `worst contact Δ ${worstContactMs} ms at ${worstContactAt}`).toBeLessThan(50);
    expect(worstMagnitude, `worst magnitude Δ ${worstMagnitude}`).toBeLessThan(1e-6);
  }, 300_000);
});
