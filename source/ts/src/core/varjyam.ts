import { getNakshatraIndexAtTime } from './nakshatra';
import { solveElementBoundary, type ElementAngle } from '../utils/search';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_SECOND_OFFSET_GHATIKAS,
} from '../utils/constants';
import { assertNakshatraIndex } from '../utils/validation';
import type { UtcWindow } from '../types/elements';

const MAX_VARJYAM_NAKSHATRAS = 3;

/** A nakshatra spans ~21-27 h, so 30 h either side is reliably outside it. */
const NAKSHATRA_LOOKBACK_HOURS = 30;
const NAKSHATRA_LOOKFORWARD_HOURS = 30;

const BRACKET_MS = 120_000;
const MAX_BRACKET_ITERS = 30;

/** Varjyam (Nakshatra Thyajyam): the earliest forbidden window overlapping the Hindu day, 4 ghatikas of the nakshatra active at sunrise (index 0..26). */
export function computeVarjyam(
  currentNakshatraIndex: number,
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow | null {
  assertNakshatraIndex(currentNakshatraIndex, 'currentNakshatraIndex');
  const overlapping = varjyamSpellsForNakshatra(currentNakshatraIndex, sunriseUtc, getMoon)
    .filter((w) =>
      w.end.getTime() > sunriseUtc.getTime() &&
      w.start.getTime() < nextSunriseUtc.getTime());
  return overlapping[0] ?? null;
}

/** All Varjyam windows whose START falls in the Hindu day, in start order; ends are unclamped. */
export function computeVarjyamWindows(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  return collectNakshatraOffsetWindows(sunriseUtc, nextSunriseUtc, getMoon, spellsFromBoundaries);
}

export function collectNakshatraOffsetWindows(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
  spellsOf: (nakshatraIndex: number, nakshatraStartUtc: Date, nakshatraEndUtc: Date) => UtcWindow[],
): UtcWindow[] {
  const getIndex = (d: Date) => getNakshatraIndexAtTime(d, getMoon);
  const angle: ElementAngle = { angleAt: getMoon, spanDeg: 360 / 27 };

  const out: UtcWindow[] = [];
  let referenceUtc = sunriseUtc;
  let knownStartUtc: Date | null = null;
  for (let i = 0; i < MAX_VARJYAM_NAKSHATRAS; i++) {
    const nakIdx = getIndex(referenceUtc);
    const startUtc = knownStartUtc
      ?? findNakshatraStart(referenceUtc, nakIdx, getIndex, angle);
    const endUtc = findNakshatraEnd(referenceUtc, nakIdx, getIndex, angle);
    if (startUtc === null || endUtc === null) break;

    for (const w of spellsOf(nakIdx, startUtc, endUtc)) {
      if (
        w.start.getTime() >= sunriseUtc.getTime() &&
        w.start.getTime() < nextSunriseUtc.getTime()
      ) {
        out.push(w);
      }
    }

    const nextRef = new Date(endUtc.getTime() + 60_000);
    if (nextRef.getTime() >= nextSunriseUtc.getTime()) break;
    referenceUtc = nextRef;
    knownStartUtc = endUtc;
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

function varjyamSpellsForNakshatra(
  nakshatraIndex: number,
  referenceUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  const getIndex = (d: Date) => getNakshatraIndexAtTime(d, getMoon);
  const angle: ElementAngle = { angleAt: getMoon, spanDeg: 360 / 27 };

  const nakshatraStartUtc = findNakshatraStart(referenceUtc, nakshatraIndex, getIndex, angle);
  if (nakshatraStartUtc === null) return [];

  const nakshatraEndUtc = findNakshatraEnd(referenceUtc, nakshatraIndex, getIndex, angle);
  if (nakshatraEndUtc === null) return [];

  return spellsFromBoundaries(nakshatraIndex, nakshatraStartUtc, nakshatraEndUtc);
}

/** One spell, or two for Mula. */
function spellsFromBoundaries(
  nakshatraIndex: number,
  nakshatraStartUtc: Date,
  nakshatraEndUtc: Date,
): UtcWindow[] {
  const nakshatraDurationMs = nakshatraEndUtc.getTime() - nakshatraStartUtc.getTime();
  const ghatikaMs = nakshatraDurationMs / 60;

  const offsets = [VARJYAM_OFFSET_GHATIKAS[nakshatraIndex]!];
  const second = VARJYAM_SECOND_OFFSET_GHATIKAS[nakshatraIndex];
  if (second !== undefined) offsets.push(second);
  offsets.sort((a, b) => a - b);

  return offsets.map((offsetGhatikas) => {
    const varjyamStart = new Date(nakshatraStartUtc.getTime() + offsetGhatikas * ghatikaMs);
    return { start: varjyamStart, end: new Date(varjyamStart.getTime() + 4 * ghatikaMs) };
  });
}

/** Solved exactly after bracketing: the bisection tolerance alone would dominate this module's error. */
function findNakshatraStart(
  sunriseUtc: Date,
  currentIndex: number,
  getIndexAt: (d: Date) => number,
  angle: ElementAngle,
): Date | null {
  const lookbackMs = NAKSHATRA_LOOKBACK_HOURS * 3600_000;
  let lo = sunriseUtc.getTime() - lookbackMs;
  let hi = sunriseUtc.getTime();

  if (getIndexAt(new Date(lo)) === currentIndex) return null;

  for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (getIndexAt(new Date(mid)) === currentIndex) hi = mid;
    else lo = mid;
  }
  const solved = solveElementBoundary(lo, hi, angle, (ms) => getIndexAt(new Date(ms)) !== currentIndex);
  return new Date(solved ?? hi);
}

function findNakshatraEnd(
  sunriseUtc: Date,
  currentIndex: number,
  getIndexAt: (d: Date) => number,
  angle: ElementAngle,
): Date | null {
  const lookforwardMs = NAKSHATRA_LOOKFORWARD_HOURS * 3600_000;
  let lo = sunriseUtc.getTime();
  let hi = sunriseUtc.getTime() + lookforwardMs;

  if (getIndexAt(new Date(hi)) === currentIndex) return null;

  for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    if (getIndexAt(new Date(mid)) === currentIndex) lo = mid;
    else hi = mid;
  }
  const solved = solveElementBoundary(lo, hi, angle, (ms) => getIndexAt(new Date(ms)) === currentIndex);
  return new Date(solved ?? hi);
}
