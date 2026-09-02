import { moonSunElongation, searchMoonPhase, PHASE_AGREEMENT_MS } from './lunation';

const DAY_MS = 86_400_000;

const SYNODIC_MONTH_DAYS = 29.530588853;

/** No two new moons fit inside 5 days, so a hit in the window is unambiguous. */
const SEED_HALF_WINDOW_DAYS = 2.5;

/** `prev ≤ ref < next`. Never mean motion: it overshoots the Sankranti boundary near
 * aphelion, exactly when Adhika Jyeshtha / Ashadha fall. */
export function boundingNewMoons(ref: Date): NewMoonBounds {
  const elapsedFraction = moonSunElongation(ref) / 360;
  const seedMs = ref.getTime() - elapsedFraction * SYNODIC_MONTH_DAYS * DAY_MS;

  const found = newMoonNear(seedMs);
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

function newMoonNear(estimateMs: number): Date | null {
  const event = searchMoonPhase(
    0,
    new Date(estimateMs - SEED_HALF_WINDOW_DAYS * DAY_MS),
    SEED_HALF_WINDOW_DAYS * 2,
  );
  return event;
}

function boundingNewMoonsByScan(ref: Date): NewMoonBounds {
  const first = searchMoonPhase(0, new Date(ref.getTime() - 40 * DAY_MS), 45);
  if (!first) {
    throw new Error('boundingNewMoons: no new moon found preceding reference instant');
  }
  let prev = first;
  let next = advanceToNextNewMoon(prev);

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

export interface NewMoonBounds {
  prev: Date;
  next: Date;
}

/** The containment scan must stay guarded by {@link PHASE_AGREEMENT_MS}: unguarded, an
 * instant on a syzygy gets the lunation *starting* there from the cache and the one
 * *ending* there from a fresh call, order-dependent by a whole month. */
export class NewMoonCache {
  private static readonly MAX_ENTRIES = 4;
  private entries: NewMoonBounds[] = [];

  public hits = 0;
  public misses = 0;

  bounding(ref: Date): NewMoonBounds {
    const t = ref.getTime();
    for (const e of this.entries) {
      const prevMs = e.prev.getTime();
      const nextMs = e.next.getTime();
      if (prevMs > t || t >= nextMs) continue;
      if (t - prevMs <= PHASE_AGREEMENT_MS || nextMs - t <= PHASE_AGREEMENT_MS) break;
      this.hits++;
      return e;
    }
    this.misses++;
    const bounds = boundingNewMoons(ref);
    this.entries.push(bounds);
    if (this.entries.length > NewMoonCache.MAX_ENTRIES) this.entries.shift();
    return bounds;
  }
}
