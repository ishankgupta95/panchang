import { assertNakshatraIndex } from '../utils/validation';
import type { TimePeriod } from '../types/elements';

/**
 * Abhijit Muhurta: the 8th muhurta when daytime is divided into 15 equal parts.
 * This is the most auspicious muhurta, centered around local noon.
 *
 * For a 12-hour day: each muhurta = 48 min. Abhijit = ~11:36 AM to 12:24 PM.
 *
 * **Wednesday exception.** Classical Smarta convention (followed by
 * DrikPanchang and most published almanacs) holds that Abhijit Muhurta is
 * not auspicious on Wednesday — Buddha's day already carries its own
 * benefic quality, so the noon Abhijit window is dropped from the day's
 * muhurta list. When `varaIndex === 3` (Wednesday) this function returns
 * `null` so callers can render the day's "Abhijit: —" cell consistently
 * with Drik. Pass no `varaIndex` (or any other value) to compute the
 * window unconditionally.
 *
 * @param sunrise   Sunrise UTC Date.
 * @param sunset    Sunset UTC Date.
 * @param varaIndex Optional weekday: 0 = Sunday … 6 = Saturday. When `3`
 *                  (Wednesday) the function returns `null`.
 * @returns         `{ start, end }` UTC Dates for Abhijit Muhurta, or
 *                  `null` on Wednesday when `varaIndex === 3`.
 *
 * @example
 * ```typescript
 * import { computeAbhijitMuhurta } from 'panchang-ts';
 * const am = computeAbhijitMuhurta(sunrise, sunset, vara.index);
 * if (am !== null) {
 *   // am.start ≈ 11:36, am.end ≈ 12:24 local clock
 * }
 * ```
 */
export function computeAbhijitMuhurta(
  sunrise: Date,
  sunset: Date,
  varaIndex?: number,
): TimePeriod | null {
  if (varaIndex === 3) return null;

  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;

  // 8th muhurta = index 7 (0-based)
  const start = new Date(sunrise.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);

  return { start, end };
}

/**
 * Brahma Muhurta: the two muhurtas immediately before sunrise.
 *
 * Muhurta length is proportional to the day: dayDuration / 30.
 * For a typical 12-hour day this equals ~24 min, making the window ~48–24 min before sunrise.
 *
 * Start: sunrise − 2 × muhurtaDuration
 * End:   sunrise − 1 × muhurtaDuration
 *
 * @param sunrise Sunrise UTC Date.
 * @param sunset  Sunset UTC Date (used to derive the muhurta length).
 * @returns       `{ start, end }` UTC Dates for Brahma Muhurta (pre-sunrise).
 *
 * @example
 * ```typescript
 * import { computeBrahmaMuhurta } from 'panchang-ts';
 * const bm = computeBrahmaMuhurta(sunrise, sunset);
 * // bm.end === sunrise − (dayDuration/30)
 * ```
 */
export function computeBrahmaMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 30;

  const end = new Date(sunrise.getTime() - muhurtaDurationMs);
  const start = new Date(end.getTime() - muhurtaDurationMs);

  return { start, end };
}

/**
 * Vijaya Muhurta: the 11th muhurta of the day (of 15 equal day-muhurtas),
 * classically cited as auspicious for beginning journeys and new ventures.
 *
 * For a 12-hour day each muhurta is 48 min; Vijaya spans ~14:00–14:48 local.
 *
 * @param sunrise Sunrise UTC Date.
 * @param sunset  Sunset UTC Date.
 */
export function computeVijayaMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;
  const start = new Date(sunrise.getTime() + 10 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);
  return { start, end };
}

/**
 * Godhuli Muhurta ("cow-dust hour"): the ~48-minute window centered on sunset,
 * considered auspicious for marriage muhurtas.
 *
 * Implemented as a fixed 48-minute span symmetric about sunset (sunset-24min
 * → sunset+24min). Some classical sources instead tie it to the last day-muhurta,
 * but the symmetric-around-sunset form is the common modern panchang convention.
 *
 * @param sunset Sunset UTC Date.
 */
export function computeGodhuliMuhurta(sunset: Date): TimePeriod {
  const halfMs = 24 * 60_000;
  return {
    start: new Date(sunset.getTime() - halfMs),
    end: new Date(sunset.getTime() + halfMs),
  };
}

/**
 * Nishita Muhurta: the midnight muhurta — centered on local midnight, which
 * is the midpoint of the sunset-to-nextSunrise night.
 *
 * In the 15-night-muhurta division this is muhurta #8 (index 7), whose window
 * contains local midnight for any night of reasonable length. Classical
 * observances like Krishna Janmashtami anchor to this kala.
 *
 * @param sunset       Sunset UTC Date.
 * @param nextSunrise  Next day's sunrise UTC Date.
 */
export function computeNishitaMuhurta(sunset: Date, nextSunrise: Date): TimePeriod {
  const nightDurationMs = nextSunrise.getTime() - sunset.getTime();
  const muhurtaDurationMs = nightDurationMs / 15;
  const start = new Date(sunset.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);
  return { start, end };
}

/**
 * Amrit Kala (Amrita Ghatika): a 4-ghatika (≈96 min) auspicious window keyed
 * to the nakshatra active at sunrise. The offset from sunrise in ghatikas is
 * classical (Muhurta Chintamani); ghatika length is 1/60 of the ahoratra
 * (sunrise-to-nextSunrise).
 *
 * Returns `null` when the computed window would extend past `nextSunrise`
 * (i.e., spills into tomorrow).
 *
 * @param sunrise          Sunrise UTC Date.
 * @param nextSunrise      Next day's sunrise UTC Date.
 * @param nakshatraAtSunrise  Nakshatra index (0–26) at sunrise.
 */
export function computeAmritKala(
  sunrise: Date,
  nextSunrise: Date,
  nakshatraAtSunrise: number,
): TimePeriod | null {
  assertNakshatraIndex(nakshatraAtSunrise, 'nakshatraAtSunrise');

  const offsetGhatikas = AMRIT_KALA_OFFSET_GHATIKAS[nakshatraAtSunrise]!;
  const ahoratraMs = nextSunrise.getTime() - sunrise.getTime();
  const ghatikaMs = ahoratraMs / 60;
  const startMs = sunrise.getTime() + offsetGhatikas * ghatikaMs;
  const endMs = startMs + 4 * ghatikaMs;

  if (endMs > nextSunrise.getTime()) return null;

  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Madhyahna: solar noon as a ±24-minute (one-muhurta) ritual window.
 *
 * Center = sunrise + (sunset − sunrise) / 2, the midpoint of the daytime arc.
 * Width = ±24 min, i.e. one classical muhurta = 48 min = 2 ghatikas. This
 * is the "madhyahna kala" used by Smarta-prayoga texts for noon-anchored
 * observances (Ganesh Chaturthi puja, etc.).
 *
 * @param sunrise Sunrise UTC Date.
 * @param sunset  Sunset UTC Date.
 * @returns       `{ start, end }` UTC Dates spanning solar noon ±24 min.
 */
export function computeMadhyahna(sunrise: Date, sunset: Date): TimePeriod {
  const halfMs = 24 * 60_000;
  const noonMs = (sunrise.getTime() + sunset.getTime()) / 2;
  return {
    start: new Date(noonMs - halfMs),
    end: new Date(noonMs + halfMs),
  };
}

/**
 * Pratah Sandhya: dawn-twilight ritual window — three nighttime ghatikas
 * ending at sunrise. Width = `nightDuration / 10` (where `nightDuration` is
 * sunset → nextSunrise, and one nighttime ghatika = `nightDuration / 30`).
 *
 * Matches DrikPanchang's published Pratah Sandhya. The window is asymmetric:
 * it begins ~3 ghatikas before sunrise and ends *at* sunrise — the classical
 * Smarta-prayoga sandhyavandanam convention as rendered by DrikPanchang.
 *
 * @param sunrise      Sunrise UTC Date.
 * @param sunset       Sunset UTC Date (used with `nextSunrise` to derive the
 *                     night length that scales the sandhya).
 * @param nextSunrise  Next day's sunrise UTC Date.
 * @returns            `{ start, end }` UTC Dates with `end === sunrise`.
 */
export function computePratahSandhya(
  sunrise: Date,
  sunset: Date,
  nextSunrise: Date,
): TimePeriod {
  const widthMs = (nextSunrise.getTime() - sunset.getTime()) / 10;
  return {
    start: new Date(sunrise.getTime() - widthMs),
    end: sunrise,
  };
}

/**
 * Sayahna Sandhya: dusk-twilight ritual window — three nighttime ghatikas
 * starting at sunset. Width = `nightDuration / 10`. Matches DrikPanchang's
 * published Sayahna Sandhya (asymmetric, begins *at* sunset).
 *
 * @param sunset       Sunset UTC Date.
 * @param nextSunrise  Next day's sunrise UTC Date.
 * @returns            `{ start, end }` UTC Dates with `start === sunset`.
 */
export function computeSayahnaSandhya(
  sunset: Date,
  nextSunrise: Date,
): TimePeriod {
  const widthMs = (nextSunrise.getTime() - sunset.getTime()) / 10;
  return {
    start: sunset,
    end: new Date(sunset.getTime() + widthMs),
  };
}

/**
 * Amrita Ghatika offsets (in ghatikas from sunrise) for each of 27 nakshatras,
 * drawn from Muhurta Chintamani. Each window is 4 ghatikas long.
 *
 * The "ghatika" here is elastic — `ahoratra / 60` — not the fixed 24-minute
 * Varjyam ghatika; see `computeAmritKala` above. Compared with
 * `VARJYAM_OFFSET_GHATIKAS` (offset from nakshatra start, fixed 24-min
 * ghatikas) the values disagree at indices 3 (Rohini), 18 (Mula), 26 (Revati).
 * The arrays are independently sourced — accidental cross-pollination is
 * caught by the regression test in `tests/unit/varjyam.test.ts`.
 */
export const AMRIT_KALA_OFFSET_GHATIKAS: readonly number[] = [
  50, // 0  Ashwini
  24, // 1  Bharani
  30, // 2  Krittika
  26, // 3  Rohini
  14, // 4  Mrigashira
  21, // 5  Ardra
  30, // 6  Punarvasu
  20, // 7  Pushya
  32, // 8  Ashlesha
  30, // 9  Magha
  20, // 10 Purva Phalguni
  18, // 11 Uttara Phalguni
  21, // 12 Hasta
  20, // 13 Chitra
  14, // 14 Swati
  14, // 15 Vishakha
  10, // 16 Anuradha
  14, // 17 Jyeshtha
  20, // 18 Mula
  24, // 19 Purva Ashadha
  20, // 20 Uttara Ashadha
  10, // 21 Shravana
  10, // 22 Dhanishtha
  18, // 23 Shatabhisha
  16, // 24 Purva Bhadrapada
  24, // 25 Uttara Bhadrapada
  20, // 26 Revati
];
