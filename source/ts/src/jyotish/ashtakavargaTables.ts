import type { GrahaName } from '../types/jyotish';

export type AshtakavargaReceiver = Exclude<GrahaName, 'Rahu' | 'Ketu'>;

export type AshtakavargaContributor = AshtakavargaReceiver | 'Lagna';

export const ASHTAKAVARGA_CONTRIBUTORS: readonly AshtakavargaContributor[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Lagna',
] as const;

export const ASHTAKAVARGA_RECEIVERS: readonly AshtakavargaReceiver[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
] as const;

/**
 * `[receiver][contributor]` → 1-based offsets from the contributor's rashi at which
 * it donates a bindu (BPHS Ch. 66 Santhanam, Phaladeepika Ch. 31). Mars under Sun
 * includes the 9th, giving Sun 48 and the canonical 337 checksum; omit it and the
 * totals become 47/336.
 */
export const BENEFIC_OFFSETS: Readonly<Record<
  AshtakavargaReceiver,
  Readonly<Record<AshtakavargaContributor, readonly number[]>>
>> = Object.freeze({
  Sun: Object.freeze({
    Sun:     Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Moon:    Object.freeze([3, 6, 10, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Mercury: Object.freeze([3, 5, 6, 9, 10, 11, 12]),
    Jupiter: Object.freeze([5, 6, 9, 11]),
    Venus:   Object.freeze([6, 7, 12]),
    Saturn:  Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([3, 4, 6, 10, 11, 12]),
  }),
  Moon: Object.freeze({
    Sun:     Object.freeze([3, 6, 7, 8, 10, 11]),
    Moon:    Object.freeze([1, 3, 6, 7, 10, 11]),
    Mars:    Object.freeze([2, 3, 5, 6, 9, 10, 11]),
    Mercury: Object.freeze([1, 3, 4, 5, 7, 8, 10, 11]),
    Jupiter: Object.freeze([1, 4, 7, 8, 10, 11, 12]),
    Venus:   Object.freeze([3, 4, 5, 7, 9, 10, 11]),
    Saturn:  Object.freeze([3, 5, 6, 11]),
    Lagna:   Object.freeze([3, 6, 10, 11]),
  }),
  Mars: Object.freeze({
    Sun:     Object.freeze([3, 5, 6, 10, 11]),
    Moon:    Object.freeze([3, 6, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Mercury: Object.freeze([3, 5, 6, 11]),
    Jupiter: Object.freeze([6, 10, 11, 12]),
    Venus:   Object.freeze([6, 8, 11, 12]),
    Saturn:  Object.freeze([1, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 3, 6, 10, 11]),
  }),
  Mercury: Object.freeze({
    Sun:     Object.freeze([5, 6, 9, 11, 12]),
    Moon:    Object.freeze([2, 4, 6, 8, 10, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Mercury: Object.freeze([1, 3, 5, 6, 9, 10, 11, 12]),
    Jupiter: Object.freeze([6, 8, 11, 12]),
    Venus:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 11]),
    Saturn:  Object.freeze([1, 2, 4, 7, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 2, 4, 6, 8, 10, 11]),
  }),
  Jupiter: Object.freeze({
    Sun:     Object.freeze([1, 2, 3, 4, 7, 8, 9, 10, 11]),
    Moon:    Object.freeze([2, 5, 7, 9, 11]),
    Mars:    Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Mercury: Object.freeze([1, 2, 4, 5, 6, 9, 10, 11]),
    Jupiter: Object.freeze([1, 2, 3, 4, 7, 8, 10, 11]),
    Venus:   Object.freeze([2, 5, 6, 9, 10, 11]),
    Saturn:  Object.freeze([3, 5, 6, 12]),
    Lagna:   Object.freeze([1, 2, 4, 5, 6, 7, 9, 10, 11]),
  }),
  Venus: Object.freeze({
    Sun:     Object.freeze([8, 11, 12]),
    Moon:    Object.freeze([1, 2, 3, 4, 5, 8, 9, 11, 12]),
    Mars:    Object.freeze([3, 5, 6, 9, 11, 12]),
    Mercury: Object.freeze([3, 5, 6, 9, 11]),
    Jupiter: Object.freeze([5, 8, 9, 10, 11]),
    Venus:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 10, 11]),
    Saturn:  Object.freeze([3, 4, 5, 8, 9, 10, 11]),
    Lagna:   Object.freeze([1, 2, 3, 4, 5, 8, 9, 11]),
  }),
  Saturn: Object.freeze({
    Sun:     Object.freeze([1, 2, 4, 7, 8, 10, 11]),
    Moon:    Object.freeze([3, 6, 11]),
    Mars:    Object.freeze([3, 5, 6, 10, 11, 12]),
    Mercury: Object.freeze([6, 8, 9, 10, 11, 12]),
    Jupiter: Object.freeze([5, 6, 11, 12]),
    Venus:   Object.freeze([6, 11, 12]),
    Saturn:  Object.freeze([3, 5, 6, 11]),
    Lagna:   Object.freeze([1, 3, 4, 6, 10, 11]),
  }),
});

/** Grid totals: invariants of the table, whatever the placements. */
export const BHINNASHTAKA_TOTAL: Readonly<Record<AshtakavargaReceiver, number>> = Object.freeze({
  Sun: 48, Moon: 49, Mars: 39, Mercury: 54,
  Jupiter: 56, Venus: 52, Saturn: 39,
});

export const SARVASHTAKA_TOTAL = 337;

/** Rashi pairs sharing one ruler; Cancer and Leo are absent, their rulers own no second sign. */
export const EKADHIPATYA_PAIRS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([0, 7]) as readonly [number, number],
  Object.freeze([1, 6]) as readonly [number, number],
  Object.freeze([2, 5]) as readonly [number, number],
  Object.freeze([8, 11]) as readonly [number, number],
  Object.freeze([9, 10]) as readonly [number, number],
]);

export const TRIKONA_TRIADS: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([0, 4, 8]) as readonly [number, number, number],
  Object.freeze([1, 5, 9]) as readonly [number, number, number],
  Object.freeze([2, 6, 10]) as readonly [number, number, number],
  Object.freeze([3, 7, 11]) as readonly [number, number, number],
]);
