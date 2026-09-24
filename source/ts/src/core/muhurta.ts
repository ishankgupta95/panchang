import { collectNakshatraOffsetWindows } from './varjyam';
import type { UtcWindow } from '../types/elements';
import { validateDate } from '../utils/validation';

/** Abhijit Muhurta: the 8th of 15 equal day-muhurtas, centred on local noon; `null` on Wednesday (`varaIndex` 3, counting 0 = Sunday), held inauspicious. */
export function computeAbhijitMuhurta(
  sunrise: Date,
  sunset: Date,
  varaIndex?: number,
): UtcWindow | null {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  if (varaIndex === 3) return null;

  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;

  const start = new Date(sunrise.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);

  return { start, end };
}

/**
 * Brahma Muhurta: the 14th of the 15 night-muhurtas, from two night-muhurtas to one
 * before sunrise (about 96 to 48 min at an equinox). With only these two instants the
 * night is taken as 24 h minus the daylight (`sunset - sunrise`); `getDailyPanchang`
 * measures it from sunset to the next sunrise instead, the night Pratah Sandhya uses,
 * which moves the window by seconds and puts its midpoint exactly on Pratah Sandhya's start.
 */
export function computeBrahmaMuhurta(sunrise: Date, sunset: Date): UtcWindow {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  return brahmaMuhurtaForNight(sunrise, 86_400_000 - (sunset.getTime() - sunrise.getTime()));
}

/** Brahma Muhurta for a night of `nightDurationMs`: `[sunrise - 2N/15, sunrise - N/15]`. */
export function brahmaMuhurtaForNight(sunrise: Date, nightDurationMs: number): UtcWindow {
  const muhurtaDurationMs = nightDurationMs / 15;
  const end = new Date(sunrise.getTime() - muhurtaDurationMs);
  const start = new Date(end.getTime() - muhurtaDurationMs);
  return { start, end };
}

/** Vijaya Muhurta: the 11th of 15 equal day-muhurtas. */
export function computeVijayaMuhurta(sunrise: Date, sunset: Date): UtcWindow {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;
  const start = new Date(sunrise.getTime() + 10 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);
  return { start, end };
}

/** Godhuli Muhurta: a fixed 48 min symmetric about sunset, the modern panchang convention. */
export function computeGodhuliMuhurta(sunset: Date): UtcWindow {
  validateDate(sunset, 'any');
  const halfMs = 24 * 60_000;
  return {
    start: new Date(sunset.getTime() - halfMs),
    end: new Date(sunset.getTime() + halfMs),
  };
}

/** Nishita Muhurta: the 8th of 15 night-muhurtas; Janmashtami anchors here. */
export function computeNishitaMuhurta(sunset: Date, nextSunrise: Date): UtcWindow {
  validateDate(sunset, 'any');
  validateDate(nextSunrise, 'any');
  const nightDurationMs = nextSunrise.getTime() - sunset.getTime();
  const muhurtaDurationMs = nightDurationMs / 15;
  const start = new Date(sunset.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);
  return { start, end };
}

/**
 * Amrit Kala windows of a Hindu day, anchored at each nakshatra's OWN start and belonging to the day their START falls
 * in. `getMoon` returns degrees in [0, 360); a nakshatra read outside 0..26 from an unwrapped value contributes none.
 */
export function computeAmritKalaWindows(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
  validateDate(sunriseUtc, 'any');
  validateDate(nextSunriseUtc, 'any');
  return collectNakshatraOffsetWindows(
    sunriseUtc, nextSunriseUtc, getMoon,
    (nakshatraIndex, nakshatraStartUtc, nakshatraEndUtc) => {
      const ghatikaMs = (nakshatraEndUtc.getTime() - nakshatraStartUtc.getTime()) / 60;
      const startMs = nakshatraStartUtc.getTime()
        + AMRIT_KALA_OFFSET_GHATIKAS[nakshatraIndex]! * ghatikaMs;
      return [{ start: new Date(startMs), end: new Date(startMs + 4 * ghatikaMs) }];
    },
  );
}

/** Madhyahna: solar noon ±24 min (one muhurta); Ganesh Chaturthi anchors here. */
export function computeMadhyahna(sunrise: Date, sunset: Date): UtcWindow {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  const halfMs = 24 * 60_000;
  const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
  return {
    start: new Date(noonMs - halfMs),
    end: new Date(noonMs + halfMs),
  };
}

/** Pratah Sandhya: `nightDuration / 10` ending exactly at sunrise; asymmetric by convention. */
export function computePratahSandhya(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
): UtcWindow {
  validateDate(sunrise, 'any');
  validateDate(sunset, 'any');
  validateDate(nextSunrise, 'any');
  const widthMs = (nextSunrise.getTime() - sunset.getTime()) / 10;
  return {
    start: new Date(sunrise.getTime() - widthMs),
    end: sunrise,
  };
}

/** Sayahna Sandhya: `nightDuration / 10` starting exactly at sunset; asymmetric by convention. */
export function computeSayahnaSandhya(
  sunset: Date,
  nextSunrise: Date,
): UtcWindow {
  validateDate(sunset, 'any');
  validateDate(nextSunrise, 'any');
  const widthMs = (nextSunrise.getTime() - sunset.getTime()) / 10;
  return {
    start: sunset,
    end: new Date(sunset.getTime() + widthMs),
  };
}

/** Recovered from the reference almanac's corpus: no published Amrita-Ghati table uses this start-of-nakshatra anchoring. */
export const AMRIT_KALA_OFFSET_GHATIKAS: readonly number[] = [
  42, // 0  Ashwini
  48, // 1  Bharani
  54, // 2  Krittika
  52, // 3  Rohini
  38, // 4  Mrigashira
  35, // 5  Ardra
  54, // 6  Punarvasu
  44, // 7  Pushya
  56, // 8  Ashlesha
  54, // 9  Magha
  44, // 10 Purva Phalguni
  42, // 11 Uttara Phalguni
  45, // 12 Hasta
  44, // 13 Chitra
  38, // 14 Swati
  38, // 15 Vishakha
  34, // 16 Anuradha
  38, // 17 Jyeshtha
  44, // 18 Mula
  48, // 19 Purva Ashadha
  44, // 20 Uttara Ashadha
  34, // 21 Shravana
  34, // 22 Dhanishtha
  42, // 23 Shatabhisha
  40, // 24 Purva Bhadrapada
  48, // 25 Uttara Bhadrapada
  54, // 26 Revati
];
