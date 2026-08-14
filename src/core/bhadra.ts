import { solveElementBoundary, type ElementAngle } from '../utils/search';
import { getKaranaIndexAtTime } from './karana';
import { KARANA_SPAN } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import type { BhadraInfo, BhadraVasaSegment } from '../types/elements';

/** Karana indices per lunation: 360° of elongation at 6° each. */
const KARANA_CYCLE_LENGTH = 360 / KARANA_SPAN;

/**
 * Bhadra Kala (also called Vishti Karana in scripture) is an inauspicious
 * window that classically disqualifies certain observances — most notably
 * Raksha Bandhan. It coincides with the Vishti karana (the 7th movable
 * karana), which occurs 8 times per lunar month.
 *
 * Karana cycle (see [src/core/karana.ts](src/core/karana.ts)):
 *   - index 0:       Kimstughna (fixed, Shukla Pratipada 1st half)
 *   - index 1–56:    7-karana movable cycle (Bava→Vishti), repeating
 *   - index 57–59:   Shakuni, Chatushpada, Naga (fixed)
 *
 * Vishti is the 7th movable karana, so indices where `(index - 1) % 7 === 6`
 * are Vishti: {7, 14, 21, 28, 35, 42, 49, 56}.
 *
 * The 8 Vishti occurrences per lunar month (by half-tithi):
 *   - Karana 7:  Shukla Chaturthi, 2nd half
 *   - Karana 14: Shukla Ashtami,   1st half
 *   - Karana 21: Shukla Ekadashi,  2nd half
 *   - Karana 28: Shukla Purnima,   1st half
 *   - Karana 35: Krishna Tritiya,  2nd half
 *   - Karana 42: Krishna Saptami,  1st half
 *   - Karana 49: Krishna Dashami,  2nd half
 *   - Karana 56: Krishna Chaturdashi, 1st half
 */
// `BhadraInfo` is declared once, in `types/elements.ts`, and re-exported here
// for callers of this module. It previously had a second, independent
// declaration in this file; the two were identical when written but nothing
// kept them so, and adding `locationName` to the canonical one left this copy
// silently behind.
export type { BhadraInfo };

export function isVishtiKarana(karanaIndex: number): boolean {
  if (karanaIndex <= 0 || karanaIndex >= 57) return false;
  return (karanaIndex - 1) % 7 === 6;
}

/**
 * Classical Bhadra-vāsa (abode) mapping by the Moon's rashi during the
 * window (Muhurta Chintamani; matches the DrikPanchang engine — verified
 * against drik's printed vasa including a mid-window Moon transition on
 * Ujjain 2026-08-19). An earlier revision keyed this on the half-tithi the
 * Vishti karana falls in, which is not the classical basis and disagreed
 * with drik.
 *
 * - Earth (Bhū-loka): most inauspicious; all earthly rituals avoided.
 * - Paatal: less severe; affects only earth-level matters indirectly.
 * - Heaven (Svarga): benign for terrestrial observances.
 */
const VASA_BY_RASHI: readonly ('earth' | 'heaven' | 'paatal')[] = [
  'heaven', // 0  Mesha
  'heaven', // 1  Vrishabha
  'heaven', // 2  Mithuna
  'earth',  // 3  Karka
  'earth',  // 4  Simha
  'paatal', // 5  Kanya
  'paatal', // 6  Tula
  'heaven', // 7  Vrischika
  'paatal', // 8  Dhanu
  'paatal', // 9  Makara
  'earth',  // 10 Kumbha
  'earth',  // 11 Meena
];

/** Vasa for a sidereal Moon longitude. Exported for tests. */
export function bhadraVasaForRashi(rashiIndex: number): 'earth' | 'heaven' | 'paatal' {
  return VASA_BY_RASHI[((rashiIndex % 12) + 12) % 12]!;
}

const RASHI_SPAN = 30;

/**
 * Locate the Vishti (Bhadra) karana window overlapping the Hindu day.
 *
 * Returns `null` when no Vishti karana touches the sunrise-to-nextSunrise
 * window. When found, the returned `start`/`end` are the true Vishti karana
 * boundaries (±~30 s), which may extend before sunrise or after nextSunrise.
 *
 * Implementation: sample the karana index at sunrise plus hourly points
 * through the Hindu day. On the first Vishti hit, binary-search backward
 * and forward to pin the exact boundaries.
 */
export function computeBhadraKaal(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
  getSun: (d: Date) => number,
  locationNameFn: (key: 'earth' | 'heaven' | 'paatal') => string = (k) => k,
): BhadraInfo | null {
  const karanaAt = (d: Date): number => getKaranaIndexAtTime(d, getMoon, getSun);
  const dayLengthMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();

  const sunriseKarana = karanaAt(sunriseUtc);

  // Cheap exact gate before the 24-point scan below.
  //
  // The karana index is `floor(normalize360(moon − sun) / 6)`, so it advances
  // monotonically with elongation and a Hindu day spans only ~2 karanas (a
  // karana is 6° of elongation, i.e. 9–13.5 h). A Vishti karana can therefore
  // overlap the day only if its index lies in the range the day traverses —
  // which the indices at sunrise and next sunrise pin down exactly, at a cost
  // of one extra pair of longitude reads instead of twenty-four.
  //
  // This is an early-out only: when it passes, the original scan runs
  // unchanged, so the sample point (and every value derived from it) is
  // identical. Verified against the unguarded implementation over 3,650
  // location-days spanning 5 locations × 2 years — 3,650 agreements, zero
  // skipped Bhadras and zero cases where the gate admitted a day the scan
  // then found nothing. It fires on ~59.5% of days.
  if (!isVishtiKarana(sunriseKarana)) {
    const nextSunriseKarana = karanaAt(nextSunriseUtc);
    let traversesVishti = false;
    let k = sunriseKarana;
    for (let step = 0; step < KARANA_CYCLE_LENGTH + 2; step++) {
      if (k === nextSunriseKarana) break;
      k = (k + 1) % KARANA_CYCLE_LENGTH;
      if (isVishtiKarana(k)) { traversesVishti = true; break; }
    }
    if (!traversesVishti) return null;
  }

  let vishtiSampleTime: Date | null = null;
  let vishtiKaranaIndex = -1;

  if (isVishtiKarana(sunriseKarana)) {
    vishtiSampleTime = sunriseUtc;
    vishtiKaranaIndex = sunriseKarana;
  } else {
    const sampleCount = 24;
    for (let i = 1; i <= sampleCount; i++) {
      const t = new Date(sunriseUtc.getTime() + (dayLengthMs * i) / sampleCount);
      const k = karanaAt(t);
      if (isVishtiKarana(k)) {
        vishtiSampleTime = t;
        vishtiKaranaIndex = k;
        break;
      }
    }
  }

  if (vishtiSampleTime === null || vishtiKaranaIndex < 0) return null;

  /**
   * The bracketing bisection stops here and the secant takes over.
   *
   * This used to bisect all the way to a 30-second tolerance and return the
   * upper bracket, which put every published Bhadra window on a 30 s grid — so
   * it moved in whole 30 s steps whenever anything upstream moved at all,
   * against karana end-times that are accurate to 24 ms. Measured during Phase
   * 36.2: 15.8 s of Bhadra movement from a 6.8 s karana shift.
   */
  const BRACKET_MS = 120_000;
  const MAX_BRACKET_ITERS = 30;
  const angle: ElementAngle = {
    angleAt: (d: Date) => getMoon(d) - getSun(d),
    spanDeg: 360 / KARANA_CYCLE_LENGTH,
  };

  // Backward search for start
  let startTime: Date;
  {
    const searchStart = new Date(vishtiSampleTime.getTime() - 18 * 3600_000);
    if (karanaAt(searchStart) === vishtiKaranaIndex) {
      startTime = searchStart;
    } else {
      let lo = searchStart.getTime();
      let hi = vishtiSampleTime.getTime();
      for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) hi = mid;
        else lo = mid;
      }
      const solved = solveElementBoundary(
        lo, hi, angle, (ms) => karanaAt(new Date(ms)) !== vishtiKaranaIndex,
      );
      startTime = new Date(solved ?? hi);
    }
  }

  // Forward search for end
  let endTime: Date;
  {
    const searchEnd = new Date(vishtiSampleTime.getTime() + 18 * 3600_000);
    if (karanaAt(searchEnd) === vishtiKaranaIndex) {
      endTime = searchEnd;
    } else {
      let lo = vishtiSampleTime.getTime();
      let hi = searchEnd.getTime();
      for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) lo = mid;
        else hi = mid;
      }
      const solved = solveElementBoundary(
        lo, hi, angle, (ms) => karanaAt(new Date(ms)) === vishtiKaranaIndex,
      );
      endTime = new Date(solved ?? hi);
    }
  }

  // ── Piecewise vasa: one segment per Moon rashi the window spans ──
  //
  // Drik prints the vasa piecewise when the Moon changes rashi mid-window
  // ("Patala upto 02:30 AM, then Swarga"). The Moon needs ≥ ~2 days per
  // rashi and a Bhadra window spans ≤ ~17 h, so at most one boundary can
  // fall inside the window; the walk below nevertheless handles any number.
  const rashiAt = (d: Date): number =>
    Math.floor(normalize360(getMoon(d)) / RASHI_SPAN) % 12;
  const rashiAngle: ElementAngle = { angleAt: getMoon, spanDeg: RASHI_SPAN };

  const vasa: BhadraVasaSegment[] = [];
  let segStartMs = startTime.getTime();
  let segRashi = rashiAt(startTime);
  const endMs = endTime.getTime();
  while (rashiAt(new Date(endMs)) !== segRashi) {
    // First rashi boundary in (segStartMs, endMs]: the Moon's longitude is
    // monotonic, so bisection on "still in the segment's rashi" brackets it.
    let lo = segStartMs;
    let hi = endMs;
    for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
      const mid = (lo + hi) / 2;
      if (rashiAt(new Date(mid)) === segRashi) lo = mid;
      else hi = mid;
    }
    const solved = solveElementBoundary(
      lo, hi, rashiAngle, (ms) => rashiAt(new Date(ms)) === segRashi,
    );
    const crossMs = solved ?? hi;
    const segLocation = bhadraVasaForRashi(segRashi);
    vasa.push({
      start: new Date(segStartMs),
      end: new Date(crossMs),
      location: segLocation,
      locationName: locationNameFn(segLocation),
    });
    segStartMs = crossMs;
    segRashi = (segRashi + 1) % 12;
  }
  const lastLocation = bhadraVasaForRashi(segRashi);
  vasa.push({
    start: new Date(segStartMs),
    end: endTime,
    location: lastLocation,
    locationName: locationNameFn(lastLocation),
  });

  // Top-level location = vasa at the window's start, for compatibility.
  const location = vasa[0]!.location;
  return {
    start: startTime,
    end: endTime,
    location,
    locationName: locationNameFn(location),
    vasa,
    isActive: isVishtiKarana(sunriseKarana),
  };
}
