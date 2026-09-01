import { solveElementBoundary, type ElementAngle } from '../utils/search';
import { getKaranaIndexAtTime } from './karana';
import { KARANA_SPAN } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import type { BhadraInfo, BhadraVasaSegment } from '../types/elements';

const KARANA_CYCLE_LENGTH = 360 / KARANA_SPAN;

/** Karana indices: 0 = Kimstughna, 1-56 = the 7-karana movable cycle repeating, 57-59 = the fixed end karanas; Vishti is the 7th movable. */
export type { BhadraInfo };

export function isVishtiKarana(karanaIndex: number): boolean {
  if (karanaIndex <= 0 || karanaIndex >= 57) return false;
  return (karanaIndex - 1) % 7 === 6;
}

/** Bhadra-vāsa (abode) by the Moon's rashi during the window, per Muhurta Chintamani. */
const VASA_BY_RASHI: readonly ('earth' | 'heaven' | 'paatal')[] = [
  'heaven', // 0  Mesha
  'heaven', // 1  Vrishabha
  'heaven', // 2  Mithuna
  'earth',  // 3  Karka
  'earth',  // 4  Simha
  'paatal', // 5  Kanya
  'paatal', // 6  Tula
  'heaven', // 7  Vrischika
  'paatal', // 8  Dhanu
  'paatal', // 9  Makara
  'earth',  // 10 Kumbha
  'earth',  // 11 Meena
];

export function bhadraVasaForRashi(rashiIndex: number): 'earth' | 'heaven' | 'paatal' {
  return VASA_BY_RASHI[((rashiIndex % 12) + 12) % 12]!;
}

const RASHI_SPAN = 30;

/** `start`/`end` are the true karana boundaries, so they may fall outside the day. */
export function computeBhadraKaal(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
  getSun: (d: Date) => number,
  locationNameFn: (key: 'earth' | 'heaven' | 'paatal') => string = (k) => k,
): BhadraInfo | null {
  const karanaAt = (d: Date): number => getKaranaIndexAtTime(d, getMoon, getSun);
  const dayLengthMs = nextSunriseUtc.getTime() - sunriseUtc.getTime();

  const sunriseKarana = karanaAt(sunriseUtc);

  if (!isVishtiKarana(sunriseKarana)) {
    const nextSunriseKarana = karanaAt(nextSunriseUtc);
    let traversesVishti = false;
    let k = sunriseKarana;
    for (let step = 0; step < KARANA_CYCLE_LENGTH + 2; step++) {
      if (k === nextSunriseKarana) break;
      k = (k + 1) % KARANA_CYCLE_LENGTH;
      if (isVishtiKarana(k)) { traversesVishti = true; break; }
    }
    if (!traversesVishti) return null;
  }

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

  const BRACKET_MS = 120_000;
  const MAX_BRACKET_ITERS = 30;
  const angle: ElementAngle = {
    angleAt: (d: Date) => getMoon(d) - getSun(d),
    spanDeg: 360 / KARANA_CYCLE_LENGTH,
  };

  let startTime: Date;
  {
    const searchStart = new Date(vishtiSampleTime.getTime() - 18 * 3600_000);
    if (karanaAt(searchStart) === vishtiKaranaIndex) {
      startTime = searchStart;
    } else {
      let lo = searchStart.getTime();
      let hi = vishtiSampleTime.getTime();
      for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) hi = mid;
        else lo = mid;
      }
      const solved = solveElementBoundary(
        lo, hi, angle, (ms) => karanaAt(new Date(ms)) !== vishtiKaranaIndex,
      );
      startTime = new Date(solved ?? hi);
    }
  }

  let endTime: Date;
  {
    const searchEnd = new Date(vishtiSampleTime.getTime() + 18 * 3600_000);
    if (karanaAt(searchEnd) === vishtiKaranaIndex) {
      endTime = searchEnd;
    } else {
      let lo = vishtiSampleTime.getTime();
      let hi = searchEnd.getTime();
      for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
        const mid = (lo + hi) / 2;
        if (karanaAt(new Date(mid)) === vishtiKaranaIndex) lo = mid;
        else hi = mid;
      }
      const solved = solveElementBoundary(
        lo, hi, angle, (ms) => karanaAt(new Date(ms)) === vishtiKaranaIndex,
      );
      endTime = new Date(solved ?? hi);
    }
  }

  const rashiAt = (d: Date): number =>
    Math.floor(normalize360(getMoon(d)) / RASHI_SPAN) % 12;
  const rashiAngle: ElementAngle = { angleAt: getMoon, spanDeg: RASHI_SPAN };

  const vasa: BhadraVasaSegment[] = [];
  let segStartMs = startTime.getTime();
  let segRashi = rashiAt(startTime);
  const endMs = endTime.getTime();
  while (rashiAt(new Date(endMs)) !== segRashi) {
    let lo = segStartMs;
    let hi = endMs;
    for (let i = 0; i < MAX_BRACKET_ITERS && hi - lo > BRACKET_MS; i++) {
      const mid = (lo + hi) / 2;
      if (rashiAt(new Date(mid)) === segRashi) lo = mid;
      else hi = mid;
    }
    const solved = solveElementBoundary(
      lo, hi, rashiAngle, (ms) => rashiAt(new Date(ms)) === segRashi,
    );
    const crossMs = solved ?? hi;
    const segLocation = bhadraVasaForRashi(segRashi);
    vasa.push({
      start: new Date(segStartMs),
      end: new Date(crossMs),
      location: segLocation,
      locationName: locationNameFn(segLocation),
    });
    segStartMs = crossMs;
    segRashi = (segRashi + 1) % 12;
  }
  const lastLocation = bhadraVasaForRashi(segRashi);
  vasa.push({
    start: new Date(segStartMs),
    end: endTime,
    location: lastLocation,
    locationName: locationNameFn(lastLocation),
  });

  const location = vasa[0]!.location;
  return {
    start: startTime,
    end: endTime,
    location,
    locationName: locationNameFn(location),
    vasa,
    isActive: isVishtiKarana(sunriseKarana),
  };
}
