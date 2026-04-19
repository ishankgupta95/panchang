import { getKaranaIndexAtTime } from './karana';

/**
 * Bhadra Kala (also called Vishti Karana in scripture) is an inauspicious
 * window that classically disqualifies certain observances — most notably
 * Raksha Bandhan. It coincides with the Vishti karana (the 7th movable
 * karana), which occurs 8 times per lunar month.
 *
 * Karana cycle (see [src/core/karana.ts](src/core/karana.ts)):
 *   - index 0:       Kimstughna (fixed, Shukla Pratipada 1st half)
 *   - index 1–56:    7-karana movable cycle (Bava→Vishti), repeating
 *   - index 57–59:   Shakuni, Chatushpada, Naga (fixed)
 *
 * Vishti is the 7th movable karana, so indices where `(index - 1) % 7 === 6`
 * are Vishti: {7, 14, 21, 28, 35, 42, 49, 56}.
 *
 * The 8 Vishti occurrences per lunar month (by half-tithi):
 *   - Karana 7:  Shukla Chaturthi, 2nd half
 *   - Karana 14: Shukla Ashtami,   1st half
 *   - Karana 21: Shukla Ekadashi,  2nd half
 *   - Karana 28: Shukla Purnima,   1st half
 *   - Karana 35: Krishna Tritiya,  2nd half
 *   - Karana 42: Krishna Saptami,  1st half
 *   - Karana 49: Krishna Dashami,  2nd half
 *   - Karana 56: Krishna Chaturdashi, 1st half
 */
export interface BhadraInfo {
  /** UTC start of the Vishti karana window (may precede sunrise). */
  start: Date;
  /** UTC end of the Vishti karana window (may exceed nextSunrise). */
  end: Date;
  /** Classical "abode" of Bhadra: determines which portion is inauspicious. */
  location: 'earth' | 'heaven' | 'paatal';
  /** True when Bhadra is currently active at local sunrise. */
  isActive: boolean;
}

export function isVishtiKarana(karanaIndex: number): boolean {
  if (karanaIndex <= 0 || karanaIndex >= 57) return false;
  return (karanaIndex - 1) % 7 === 6;
}

/**
 * Classical Bhadra-vāsa (abode) mapping by half-tithi position.
 * - Earth (Bhū-loka): most inauspicious; all earthly rituals avoided.
 * - Paatal: less severe; affects only earth-level matters indirectly.
 * - Heaven (Svarga): benign for terrestrial observances.
 *
 * Common mapping used in printed panchangs:
 *   Earth:   Shukla Chaturthi, Shukla Ekadashi, Krishna Tritiya, Krishna Dashami
 *   Paatal:  Shukla Ashtami,   Shukla Purnima,  Krishna Saptami, Krishna Chaturdashi
 */
function bhadraLocation(vishtiKaranaIndex: number): 'earth' | 'heaven' | 'paatal' {
  const vishtiPositions = [7, 14, 21, 28, 35, 42, 49, 56];
  const position = vishtiPositions.indexOf(vishtiKaranaIndex);
  if (position < 0) return 'heaven';
  const earthIndices = new Set([0, 2, 4, 6]);
  return earthIndices.has(position) ? 'earth' : 'paatal';
}

/**
 * Locate the Vishti (Bhadra) karana window overlapping the Hindu day.
 *
 * Returns `null` when no Vishti karana touches the sunrise-to-nextSunrise
 * window. When found, the returned `start`/`end` are the true Vishti karana
 * boundaries (±~30 s), which may extend before sunrise or after nextSunrise.
 *
 * Implementation: sample the karana index at sunrise plus hourly points
 * through the Hindu day. On the first Vishti hit, binary-search backward
 * and forward to pin the exact boundaries.
 */
export function computeBhadraKaal(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
  getSun: (d: Date) => number,
): BhadraInfo | null {
  const karanaAt = (d: Date): number => getKaranaIndexAtTime(d, getMoon, getSun);
  const dayLengthMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();

  const sunriseKarana = karanaAt(sunriseUtc);

  let vishtiSampleTime: Date | null = null;
  let vishtiKaranaIndex = -1;

  if (isVishtiKarana(sunriseKarana)) {
    vishtiSampleTime = sunriseUtc;
    vishtiKaranaIndex = sunriseKarana;
  } else {
    const sampleCount = 24;
    for (let i = 1; i <= sampleCount; i++) {
      const t = new Date(sunriseUtc.getTime() + (dayLengthMs * i) / sampleCount);
      const k = karanaAt(t);
      if (isVishtiKarana(k)) {
        vishtiSampleTime = t;
        vishtiKaranaIndex = k;
        break;
      }
    }
  }

  if (vishtiSampleTime === null || vishtiKaranaIndex < 0) return null;

  const TOL_MS = 30_000;
  const MAX_ITERS = 30;

  // Backward search for start
  let startTime: Date;
  {
    const searchStart = new Date(vishtiSampleTime.getTime() - 18 * 3600_000);
    if (karanaAt(searchStart) === vishtiKaranaIndex) {
      startTime = searchStart;
    } else {
      let lo = searchStart.getTime();
      let hi = vishtiSampleTime.getTime();
      for (let i = 0; i < MAX_ITERS && hi - lo > TOL_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) hi = mid;
        else lo = mid;
      }
      startTime = new Date(hi);
    }
  }

  // Forward search for end
  let endTime: Date;
  {
    const searchEnd = new Date(vishtiSampleTime.getTime() + 18 * 3600_000);
    if (karanaAt(searchEnd) === vishtiKaranaIndex) {
      endTime = searchEnd;
    } else {
      let lo = vishtiSampleTime.getTime();
      let hi = searchEnd.getTime();
      for (let i = 0; i < MAX_ITERS && hi - lo > TOL_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) lo = mid;
        else hi = mid;
      }
      endTime = new Date(hi);
    }
  }

  return {
    start: startTime,
    end: endTime,
    location: bhadraLocation(vishtiKaranaIndex),
    isActive: isVishtiKarana(sunriseKarana),
  };
}
