/**
 * Divide a span into `count` equal, contiguous slots.
 *
 * Four systems in this library — Choghadiya (8+8), Hora (12+12), Gowri (8+8)
 * and Do Ghati (15+15) — all work the same way: take the sunrise→sunset and
 * sunset→nextSunrise spans, cut each into N equal pieces, and label each piece
 * from a cycle whose starting offset depends on the weekday. Each had written
 * out its own copy of the arithmetic, and two of them even declared the same
 * vara-keyed start table (`[0, 3, 6, 2, 5, 1, 4]`) independently.
 *
 * Only the time arithmetic is shared here; `make` builds whatever slot shape
 * the caller needs, so the differing payloads (quality labels, planet indices)
 * stay with the system that owns them.
 *
 * The final slot's `end` is anchored to `reference + durationMs` exactly rather
 * than accumulated from `i * slotMs`, so the slots tile the span with no
 * floating-point gap at the end.
 *
 * @param reference   Span start (UTC).
 * @param durationMs  Span length in milliseconds.
 * @param count       Number of slots to produce.
 * @param make        Builds one slot from its ordinal and computed bounds.
 */
export function buildEqualSlots<T>(
  reference: Date,
  durationMs: number,
  count: number,
  make: (ordinal: number, start: Date, end: Date) => T,
): T[] {
  const refMs = reference.getTime();
  const slotMs = durationMs / count;
  const slots: T[] = [];
  for (let i = 0; i < count; i++) {
    const startMs = refMs + i * slotMs;
    const endMs = i === count - 1 ? refMs + durationMs : refMs + (i + 1) * slotMs;
    slots.push(make(i, new Date(startMs), new Date(endMs)));
  }
  return slots;
}

/**
 * Index of the first daytime slot by weekday (Sun=0 … Sat=6) for the systems
 * that advance one step per slot through a 7-name cycle.
 *
 * Choghadiya and Hora share this table: the first daytime Choghadiya and the
 * first daytime Hora are both governed by the weekday's lord, in Chaldean
 * order. It was previously declared once in each module.
 */
export const VARA_CHALDEAN_START = [0, 3, 6, 2, 5, 1, 4] as const;
