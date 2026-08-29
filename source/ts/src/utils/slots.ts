/** The final slot's `end` anchors to `reference + durationMs`, leaving no float gap. */
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

/** First daytime Choghadiya/Hora slot by weekday: the weekday's lord, in Chaldean order. */
export const VARA_CHALDEAN_START = [0, 3, 6, 2, 5, 1, 4] as const;
