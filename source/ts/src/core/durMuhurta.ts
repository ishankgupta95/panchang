import type { DurMuhurtaPeriod, Unlocalized } from '../types/elements';

export type DurMuhurtaWindow = Unlocalized<DurMuhurtaPeriod>;

/** Dur Muhurta ordinals per Vara, from the Muhurta-Chintamani table. */
const DUR_MUHURTA_ORDINALS: readonly (readonly {
  readonly ordinal: number;
  readonly segment: 'day' | 'night';
}[])[] = [
  [{ ordinal: 13, segment: 'day' }],
  [{ ordinal: 8, segment: 'day' }, { ordinal: 11, segment: 'day' }],
  [{ ordinal: 3, segment: 'day' }, { ordinal: 6, segment: 'night' }],
  [{ ordinal: 7, segment: 'day' }],
  [{ ordinal: 5, segment: 'day' }, { ordinal: 11, segment: 'day' }],
  [{ ordinal: 3, segment: 'day' }, { ordinal: 8, segment: 'day' }],
  [{ ordinal: 0, segment: 'day' }, { ordinal: 1, segment: 'day' }],
];

export function computeDurMuhurta(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
  varaIndex: number,
): DurMuhurtaWindow[] {
  const dayMuhurtaMs = (sunset.getTime() - sunrise.getTime()) / 15;
  const nightMuhurtaMs = (nextSunrise.getTime() - sunset.getTime()) / 15;

  return DUR_MUHURTA_ORDINALS[varaIndex]!.map(({ ordinal, segment }) => {
    const baseMs = segment === 'day' ? sunrise.getTime() : sunset.getTime();
    const muhurtaMs = segment === 'day' ? dayMuhurtaMs : nightMuhurtaMs;
    return {
      start: new Date(baseMs + ordinal * muhurtaMs),
      end: new Date(baseMs + (ordinal + 1) * muhurtaMs),
      segment,
    };
  });
}
