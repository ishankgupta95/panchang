import { solveAngleCrossing } from '../utils/search';
import { assertVaraIndex } from '../utils/validation';
import type { PanchakaType } from '../types/elements';

/**
 * Sidereal longitude at which Panchaka begins — Dhanishtha's 3rd pada.
 * `22 × (360/27) + (360/27)/2 = 300°` exactly.
 */
const PANCHAKA_START_DEG = 300;

/**
 * Panchaka Detection
 *
 * Panchaka is active when the Moon is in the last 5 nakshatras:
 * Dhanishtha (3rd–4th pada), Shatabhisha, Purva Bhadrapada,
 * Uttara Bhadrapada, and Revati.
 *
 * This corresponds to sidereal Moon longitude >= 300°
 * (= Dhanishtha 3rd pada start: 22 × (360/27) + (360/27)/2 ≈ 300°).
 */
export function computePanchaka(siderealMoon: number): boolean {
  return siderealMoon >= PANCHAKA_START_DEG;
}

/**
 * Which Panchaka a spell is, by the weekday it **began** on.
 *
 * Panchaka is not one undifferentiated dosha: the tradition names five, and
 * which one applies is fixed by the vara on which the Moon first entered the
 * Panchaka span — not by the vara of the day being examined. A spell that
 * begins on a Saturday stays Mrityu Panchaka for all four or five of its days.
 *
 * Wednesday and Thursday are the notable gap: no source consulted assigns a
 * named Panchaka to them, and the effects ascribed to the other five simply
 * do not attach. That case is reported as `'samanya'` ("ordinary") with
 * {@link isPanchakaDosha} false. Some almanacs use that name explicitly;
 * others just leave the two weekdays unlisted. The agreed, operative point is
 * the absence of a dosha, which is what this models.
 *
 * Sources (accessed 2026-08-08) — all agreeing on the five weekday pairings:
 *   - https://99pandit.com/blog/panchak-astrology-dates-timings-and-nakshatra-list/
 *   - https://www.anytimeastro.com/blog/astrology/what-is-panchak-calendar/
 *   - https://prayagpandits.com/what-is-panchak-dosha/
 *   - https://www.mpanchang.com/articles/astrology/adverse-effects-of-panchak/
 *
 * Note the five named types are themselves not equally severe — Raj Panchaka
 * (Monday) is repeatedly described as the most favourable of them, Mrityu
 * (Saturday) as the most feared. The sources do not agree on a rank order
 * beyond that, so none is imposed here; consumers get the type and judge.
 */
const PANCHAKA_TYPE_BY_ONSET_VARA: readonly PanchakaType[] = [
  'roga',     // 0 Sunday    — illness
  'raja',     // 1 Monday    — the most favourable of the five
  'agni',     // 2 Tuesday   — fire
  'samanya',  // 3 Wednesday — unnamed by the sources; no dosha
  'samanya',  // 4 Thursday  — unnamed by the sources; no dosha
  'chora',    // 5 Friday    — theft
  'mrityu',   // 6 Saturday  — the most feared
];

/**
 * Classify a Panchaka spell from the weekday it began on.
 *
 * @param onsetVaraIndex  Vara of the Hindu day the spell began (0 = Sunday).
 * @returns               The Panchaka type.
 */
export function classifyPanchaka(onsetVaraIndex: number): PanchakaType {
  assertVaraIndex(onsetVaraIndex, 'onsetVaraIndex');
  return PANCHAKA_TYPE_BY_ONSET_VARA[onsetVaraIndex]!;
}

/**
 * Whether a Panchaka type carries a dosha.
 *
 * False only for `'samanya'` — a spell begun on a Wednesday or Thursday, to
 * which the tradition attaches no named affliction.
 */
export function isPanchakaDosha(type: PanchakaType): boolean {
  return type !== 'samanya';
}

/**
 * The instant the current Panchaka spell began — the Moon's crossing of 300°.
 *
 * Only meaningful while Panchaka is active. The Moon covers the 60°-wide
 * Panchaka span in roughly 4.5 days at ~13.2°/day, so the crossing always lies
 * within the preceding week; the search window below is sized from that.
 *
 * The predicate is monotonic across that window, which is what makes a single
 * bisection valid: Panchaka runs from 300° up to the 360°/0° wrap, so at any
 * active instant the Moon sits in [300°, 360°), and one week earlier it sat
 * near 210°–300° — below the threshold throughout, with exactly one crossing
 * in between.
 *
 * @param referenceUtc  An instant at which Panchaka is active.
 * @param getMoon       Sidereal Moon longitude (degrees, [0, 360)) at a UTC instant.
 * @returns             UTC of the crossing, or `null` if none was bracketed
 *                      (which means Panchaka was not active at `referenceUtc`).
 */
export function findPanchakaOnset(
  referenceUtc: Date,
  getMoon: (d: Date) => number,
): Date | null {
  if (!computePanchaka(getMoon(referenceUtc))) return null;

  const hiMs = referenceUtc.getTime();
  // 7 days back is comfortably before onset even at the Moon's slowest.
  const loMs = hiMs - 7 * 86_400_000;
  if (computePanchaka(getMoon(new Date(loMs)))) return null;

  const ms = solveAngleCrossing(
    loMs, hiMs, PANCHAKA_START_DEG, getMoon,
    (m) => !computePanchaka(getMoon(new Date(m))),
  );
  return ms === null ? null : new Date(ms);
}
