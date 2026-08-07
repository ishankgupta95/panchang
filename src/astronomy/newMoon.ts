import { moonSunElongation, searchMoonPhase, PHASE_AGREEMENT_MS } from './lunation';

const DAY_MS = 86_400_000;

/** Mean synodic month (new moon → new moon), days. */
const SYNODIC_MONTH_DAYS = 29.530588853;

/**
 * Half-width of the seeded search window, in days. The phase-angle seed below
 * lands within 0.96 d of the true new moon anywhere in 1900–2100 (measured
 * across the full range at weekly resolution), so ±2.5 d leaves ~2.6× headroom.
 *
 * Two new moons can never both fall inside a 5-day window, so a hit is
 * unambiguous; a miss returns `null` and falls back to the scan.
 *
 * Note the saving here is *not* from the narrower window — `SearchMoonPhase`
 * costs about the same whether it brackets 5 days or 45. It comes from landing
 * on the right lunation immediately: the scan starts 40 d back and then walks
 * forward a lunation at a time, averaging ~2.75 searches, where the seeded path
 * always costs exactly 2.
 */
const SEED_HALF_WINDOW_DAYS = 2.5;

/**
 * Find the two New Moons (Amavasyas) that bound the lunar month containing
 * `ref`, such that `prev ≤ ref < next`.
 *
 * The Chandra Masa identity (which month, and whether it is Adhika) is a
 * property of the lunar month — fixed for every instant inside it. It must be
 * derived from the *actual* new-moon instants: mean-motion estimates of the
 * bounding new moons overshoot the solar-month (Sankranti) boundary by a few
 * tenths of a degree near aphelion (June/July), which is precisely when Adhika
 * Jyeshtha / Ashadha occur, producing day-to-day-flickering false negatives.
 *
 * Uses this library's own `searchMoonPhase(0, …)` from `lunation.ts` — the
 * moment Moon–Sun elongation reaches 0°, converged to a millisecond. The Moon's
 * current phase angle seeds a narrow search window, with the wide scan retained
 * as a fallback.
 *
 * The seed never changes *which* lunation is returned: measured against the
 * wide scan at 8 h steps across 1900–2100 (219,147 samples), the
 * `prev ≤ ref < next` bracket was identical every time. It can move the
 * returned instants by up to ~175 ms on ~6% of inputs, because
 * `searchMoonPhase` converges to a marginally different root when handed a
 * different bracket. That is far below any resolution this library publishes,
 * but it is not literally zero — don't rely on bit-identical instants across
 * the two paths.
 *
 * @param ref Reference instant (UTC). Both returned instants are UTC.
 */
export function boundingNewMoons(ref: Date): NewMoonBounds {
  // The phase angle is the fraction of the synodic cycle already elapsed, so
  // it places the preceding new moon directly — no scanning required.
  const elapsedFraction = moonSunElongation(ref) / 360;
  const seedMs = ref.getTime() - elapsedFraction * SYNODIC_MONTH_DAYS * DAY_MS;

  const found = newMoonNear(seedMs);
  // `found` may land a millisecond or two *after* `ref` when `ref` is itself a
  // new-moon instant that some other call to `searchMoonPhase` rounded the other
  // way — see PHASE_AGREEMENT_MS. An exact `<=` here rejected the fast path in
  // that case and the scan fallback then returned the *previous* lunation, so
  // the Chandra Masa of an instant sitting exactly on a new moon was a month
  // out. Two instants that agree to within the search's own convergence are the
  // same event; the pair is anchored at `ref` so `prev ≤ ref` still holds
  // exactly, which is the contract every caller reads.
  const prev = found !== null && found.getTime() > ref.getTime()
    && found.getTime() - ref.getTime() <= PHASE_AGREEMENT_MS
    ? new Date(ref.getTime())
    : found;
  if (prev !== null && prev.getTime() <= ref.getTime()) {
    const next = newMoonNear(prev.getTime() + SYNODIC_MONTH_DAYS * DAY_MS);
    if (next !== null && next.getTime() > ref.getTime()) return { prev, next };
  }

  return boundingNewMoonsByScan(ref);
}

/**
 * The new moon within ±{@link SEED_HALF_WINDOW_DAYS} of `estimateMs`, or
 * `null` when the estimate was too far off for the window to contain one.
 */
function newMoonNear(estimateMs: number): Date | null {
  const event = searchMoonPhase(
    0,
    new Date(estimateMs - SEED_HALF_WINDOW_DAYS * DAY_MS),
    SEED_HALF_WINDOW_DAYS * 2,
  );
  return event;
}

/**
 * Wide-scan formulation of {@link boundingNewMoons}. Correct for any input but
 * several times more expensive; retained as the fallback path.
 */
function boundingNewMoonsByScan(ref: Date): NewMoonBounds {
  // Step back > one synodic month (~29.53 d) so the first new moon found is at
  // or before `ref`; 45 d is a comfortable search window for one lunation.
  const first = searchMoonPhase(0, new Date(ref.getTime() - 40 * DAY_MS), 45);
  if (!first) {
    throw new Error('boundingNewMoons: no new moon found preceding reference instant');
  }
  let prev = first;
  let next = advanceToNextNewMoon(prev);

  // The first new moon after (ref − 40 d) can still precede `ref` by up to a
  // full lunation; advance until the pair straddles `ref`.
  while (next.getTime() <= ref.getTime()) {
    prev = next;
    next = advanceToNextNewMoon(prev);
  }
  return { prev, next };
}

function advanceToNextNewMoon(after: Date): Date {
  const event = searchMoonPhase(0, new Date(after.getTime() + DAY_MS), 45);
  if (!event) {
    throw new Error('boundingNewMoons: no subsequent new moon found');
  }
  return event;
}

/** Bounding new-moon pair for one lunar month: `prev ≤ ref < next`. */
export interface NewMoonBounds {
  prev: Date;
  next: Date;
}

/**
 * Memoizes {@link boundingNewMoons} across instants that share a lunar month.
 *
 * `boundingNewMoons` walks `searchMoonPhase` over a 45-day window, which is one
 * of the more expensive ephemeris operations in the library. A single
 * `getDailyPanchang` resolves the Chandra Masa for both today and the previous
 * day, and those fall in the same lunation on ~29 days out of 30 — so the
 * second lookup is almost always answerable from the first result.
 *
 * Lookup is a linear scan because the entry count per call is tiny (2–3);
 * a map keyed by lunation would need the lunation index, which is precisely
 * what the search computes.
 */
export class NewMoonCache {
  /** Retaining a handful of lunations is plenty for day/range-scale callers. */
  private static readonly MAX_ENTRIES = 4;
  private entries: NewMoonBounds[] = [];

  public hits = 0;
  public misses = 0;

  bounding(ref: Date): NewMoonBounds {
    const t = ref.getTime();
    for (const e of this.entries) {
      if (e.prev.getTime() <= t && t < e.next.getTime()) {
        this.hits++;
        return e;
      }
    }
    this.misses++;
    const bounds = boundingNewMoons(ref);
    this.entries.push(bounds);
    if (this.entries.length > NewMoonCache.MAX_ENTRIES) this.entries.shift();
    return bounds;
  }
}
