import { SearchMoonPhase } from 'astronomy-engine';

const DAY_MS = 86_400_000;

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
 * Uses astronomy-engine's `SearchMoonPhase(0, …)` — the moment Moon–Sun
 * elongation reaches 0° — which is accurate to seconds.
 *
 * @param ref Reference instant (UTC). Both returned instants are UTC.
 */
export function boundingNewMoons(ref: Date): { prev: Date; next: Date } {
  // Step back > one synodic month (~29.53 d) so the first new moon found is at
  // or before `ref`; 45 d is a comfortable search window for one lunation.
  const first = SearchMoonPhase(0, new Date(ref.getTime() - 40 * DAY_MS), 45);
  if (!first) {
    throw new Error('boundingNewMoons: no new moon found preceding reference instant');
  }
  let prev = first.date;
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
  const event = SearchMoonPhase(0, new Date(after.getTime() + DAY_MS), 45);
  if (!event) {
    throw new Error('boundingNewMoons: no subsequent new moon found');
  }
  return event.date;
}
