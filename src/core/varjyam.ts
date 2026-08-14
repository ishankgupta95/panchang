import { getNakshatraIndexAtTime } from './nakshatra';
import { solveElementBoundary, type ElementAngle } from '../utils/search';
import {
  VARJYAM_OFFSET_GHATIKAS,
  VARJYAM_SECOND_OFFSET_GHATIKAS,
} from '../utils/constants';
import { assertNakshatraIndex } from '../utils/validation';
import type { UtcWindow } from '../types/elements';

/** Safety cap on nakshatras walked per Hindu day (matches MAX daily nakshatras). */
const MAX_VARJYAM_NAKSHATRAS = 3;

/**
 * Lookback / lookforward window for the bisections that locate the
 * boundaries of the active nakshatra. A nakshatra spans ~21–27 hours (Moon's
 * variable speed), so 30 h either side of any point inside the nakshatra
 * reliably sits in a *different* nakshatra — making the bisection valid.
 */
const NAKSHATRA_LOOKBACK_HOURS = 30;
const NAKSHATRA_LOOKFORWARD_HOURS = 30;

/**
 * How narrow the bracketing bisection has to get before the secant takes over.
 *
 * Two minutes, which is ~9 probes over a 30-hour window. The secant needs only
 * a bracket the residual is monotone across, and the Moon's longitude is
 * monotone over far more than two minutes — the tighter value is there so the
 * secant's first extrapolation starts close, not because it needs it.
 */
const BRACKET_MS = 120_000;
const MAX_BRACKET_ITERS = 30;

/**
 * Varjyam (Vishaghati / Nakshatra Thyajyam) — a forbidden ~1.5h window per
 * day, keyed to the day's nakshatra. Width is **elastic** — proportional
 * to the active nakshatra's duration — to match DrikPanchang's published
 * Varjyam.
 *
 * Algorithm (matches DrikPanchang)
 * --------------------------------
 * Each nakshatra has a tabulated "tyajya" offset measured in **ghatikas of
 * the nakshatra's own duration** (1 ghatika = `nakshatraDuration / 60`).
 * The Varjyam window spans 4 such ghatikas. Because the Moon's apparent
 * speed varies (~11–15°/day), nakshatra durations vary 21–27 h and the
 * Varjyam width therefore varies ~84–108 minutes day-to-day.
 *
 * The offsets in {@link VARJYAM_OFFSET_GHATIKAS} are 0-indexed elapsed
 * ghatikas (e.g. Ashwini 50 because DrikPanchang prints "Tyajya 51 to 54"
 * and `start_label - 1 = 50`). The same numerical table is used for both
 * fixed and elastic interpretations — the difference is the ghatika length.
 *
 *     varjyamStart = nakshatraStart + offsetGhatikas × (nakshatraDuration / 60)
 *     varjyamEnd   = varjyamStart + 4 × (nakshatraDuration / 60)
 *
 * The window is clamped to overlap with the Hindu day (sunrise →
 * nextSunrise); `null` is returned when there is no overlap or when the
 * nakshatra's boundaries cannot be located within
 * {@link NAKSHATRA_LOOKBACK_HOURS} / {@link NAKSHATRA_LOOKFORWARD_HOURS}.
 *
 * Dual-spell nakshatras
 * ---------------------
 * Mula carries TWO tyajya spells (elapsed ghatikas 20 and 56 — see
 * {@link VARJYAM_SECOND_OFFSET_GHATIKAS} for sourcing); every other
 * nakshatra has one. Where both of Mula's spells overlap the day this
 * single-window primitive reports the EARLIEST; use
 * {@link computeVarjyamWindows} for the full per-day list.
 *
 * Single-window primitive
 * -----------------------
 * This function evaluates ONE nakshatra — the one active at `sunriseUtc`.
 * Days on which a nakshatra transition occurs may host a second Varjyam
 * window from the incoming nakshatra; printed panchangs (drik included)
 * show both. Use {@link computeVarjyamWindows} for the full per-day list —
 * `getDailyPanchang` publishes that. This single-window form is kept as
 * the stable primitive.
 *
 * @param currentNakshatraIndex  Nakshatra index (0..26) active at `sunriseUtc`.
 * @param sunriseUtc             UTC of local sunrise — start of the Hindu day.
 * @param nextSunriseUtc         UTC of the following day's local sunrise.
 * @param getMoon                Sidereal Moon longitude (degrees) at a UTC instant.
 * @returns                      The earliest Varjyam `UtcWindow` overlapping the
 *                               Hindu day, or `null` when none overlaps or the
 *                               nakshatra's boundaries cannot be located.
 */
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

/**
 * All Varjyam windows of a Hindu day, in start order.
 *
 * Walks every nakshatra touching `[sunriseUtc, nextSunriseUtc)` — the one
 * active at sunrise, then each successor as it begins — and evaluates the
 * Varjyam slice of each. Most days yield one entry; days with a nakshatra
 * transition often yield two (the incoming nakshatra's slice can begin
 * before the following sunrise), matching the two-row Varjyam listings drik
 * prints on such days. The pre-existing single-window API reported at most
 * one and silently dropped the second.
 *
 * Attribution rule (drik parity, verified against 6 drik day-panchang pages
 * Aug 2026 Ujjain): a window belongs to the Hindu day its START falls in —
 * `sunriseUtc <= start < nextSunriseUtc`. A window that begins before
 * today's sunrise and runs past it is yesterday's (drik prints it only on
 * yesterday's page), so publishing on any-overlap would double-print every
 * sunrise-straddling window on two consecutive days. Windows themselves are
 * true instants — the end may exceed `nextSunriseUtc` and is not clamped.
 *
 * @param sunriseUtc      UTC of local sunrise — start of the Hindu day.
 * @param nextSunriseUtc  UTC of the following day's local sunrise.
 * @param getMoon         Sidereal Moon longitude (degrees) at a UTC instant.
 */
export function computeVarjyamWindows(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  return collectNakshatraOffsetWindows(sunriseUtc, nextSunriseUtc, getMoon, spellsFromBoundaries);
}

/**
 * Walk every nakshatra touching `[sunriseUtc, nextSunriseUtc)` and collect
 * the windows `spellsOf` derives from each one's located boundaries, keeping
 * those whose START falls inside the Hindu day — the drik attribution rule
 * shared by Varjyam and Amrit Kala (both are nakshatra-anchored offset
 * windows in the nakshatra-elastic ghatika frame; only the offset tables and
 * auspicious/inauspicious polarity differ).
 */
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
  // Boundaries are threaded through the walk: each nakshatra's end doubles
  // as the next one's start, so the first nakshatra costs two boundary
  // searches and each successor only one.
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

    // Advance to the next nakshatra's opening moments; stop once it begins
    // at or beyond the day's end.
    const nextRef = new Date(endUtc.getTime() + 60_000);
    if (nextRef.getTime() >= nextSunriseUtc.getTime()) break;
    referenceUtc = nextRef;
    knownStartUtc = endUtc;
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

/**
 * Every Varjyam spell of the nakshatra active at `referenceUtc`, as true
 * (unclamped) instants in start order — one window for most nakshatras, two
 * for Mula. The reference instant anchors the boundary searches; callers
 * apply their own day-window gate. Empty when the nakshatra's boundaries
 * cannot be located (inconsistent upstream longitude data).
 */
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

/**
 * The tyajya spell windows of a nakshatra given its located boundaries —
 * pure arithmetic, no searches. One window for most nakshatras; two for
 * Mula ({@link VARJYAM_SECOND_OFFSET_GHATIKAS}), in start order.
 */
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

/**
 * Locate the leftmost UTC moment the Moon was already inside `currentIndex`.
 *
 * Brackets "Moon-index === currentIndex" over
 * `[sunrise − NAKSHATRA_LOOKBACK_HOURS, sunrise]` by bisection, then solves the
 * bracket exactly with {@link solveElementBoundary}.
 *
 * The bisection used to *be* the answer, at a 30-second tolerance, and that was
 * the dominant error in every Varjyam window this module publishes — the
 * boundary was quantised onto a 30 s grid while the nakshatra end-times it
 * should have matched were accurate to 24 ms. Bisection now only has to narrow
 * the bracket enough for the secant to take over, which is {@link BRACKET_MS}.
 *
 * Returns `null` when the Moon is still in `currentIndex` at the lookback
 * boundary — astronomically impossible, so this branch indicates inconsistent
 * upstream longitude data and the caller surfaces it as the `null` branch
 * of the Varjyam contract.
 */
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

/**
 * Locate the leftmost UTC moment the Moon has *exited* `currentIndex`,
 * searching forward from `sunriseUtc`. This is the start instant of the
 * next nakshatra; equivalently, the end of the active nakshatra.
 *
 * Brackets on `getIndexAt(d) !== currentIndex` over
 * `[sunrise, sunrise + NAKSHATRA_LOOKFORWARD_HOURS]`, then solves — see
 * {@link findNakshatraStart} for why the bisection stops being the answer.
 *
 * Returns `null` when the Moon is still in `currentIndex` at the lookforward
 * boundary — astronomically impossible, so this branch likewise indicates
 * inconsistent upstream longitude data.
 */
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
