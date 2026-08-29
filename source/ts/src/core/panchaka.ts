import { solveAngleCrossing } from '../utils/search';
import { assertVaraIndex } from '../utils/validation';
import type { PanchakaType } from '../types/elements';

/** Panchaka begins at Dhanishtha's 3rd pada. */
const PANCHAKA_START_DEG = 300;

/** Panchaka: the Moon in the last five nakshatras, Dhanishtha's 3rd pada to the 360° wrap. */
export function computePanchaka(siderealMoon: number): boolean {
  return siderealMoon >= PANCHAKA_START_DEG;
}

/** No source names a Panchaka for Wednesday or Thursday, hence `'samanya'` there. */
const PANCHAKA_TYPE_BY_ONSET_VARA: readonly PanchakaType[] = [
  'roga',
  'raja',
  'agni',
  'samanya',
  'samanya',
  'chora',
  'mrityu',
];

/** Classify a Panchaka spell from the vara of the Hindu day it began on, 0 = Sunday. */
export function classifyPanchaka(onsetVaraIndex: number): PanchakaType {
  assertVaraIndex(onsetVaraIndex, 'onsetVaraIndex');
  return PANCHAKA_TYPE_BY_ONSET_VARA[onsetVaraIndex]!;
}

/** Whether a Panchaka type carries a dosha: false only for `'samanya'`. */
export function isPanchakaDosha(type: PanchakaType): boolean {
  return type !== 'samanya';
}

/** The instant the running Panchaka spell began; `null` when it was not active at `referenceUtc`. */
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
