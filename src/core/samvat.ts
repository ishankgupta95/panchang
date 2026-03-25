import type { SamvatInfo } from '../types/elements';

/**
 * Compute the Vikram Samvat and Shaka Samvat year for a given UTC date.
 *
 * Both eras share the same new-year point: Chaitra Shukla Pratipad, which
 * falls in late March or April each Gregorian year.
 *
 * Approximation used: months 1–3 (Jan–Mar) are before the new year;
 * months 4–12 (Apr–Dec) are after it.  This is accurate for ~99 % of dates
 * (edge cases are dates within a few days of the exact new-year tithi).
 *
 * Offsets:
 *   Vikram Samvat = CE + 57  (after new year)  / CE + 56  (before new year)
 *   Shaka Samvat  = CE − 78  (after new year)  / CE − 79  (before new year)
 *   (VS − Shaka = 135 always)
 *
 * @param date  Any UTC Date within the day being computed.
 */
export function computeSamvat(date: Date): SamvatInfo {
  const year = date.getUTCFullYear();
  // Chaitra new year is always in April (UTC month index 3 = April)
  const pastNewYear = date.getUTCMonth() >= 3; // 0-based: 3 = April
  return {
    vikramSamvat: year + (pastNewYear ? 57 : 56),
    shakaSamvat:  year + (pastNewYear ? -78 : -79),
  };
}
