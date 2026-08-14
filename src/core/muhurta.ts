import { collectNakshatraOffsetWindows } from './varjyam';
import type { UtcWindow } from '../types/elements';

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
): UtcWindow | null {
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
export function computeBrahmaMuhurta(sunrise: Date, sunset: Date): UtcWindow {
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
export function computeVijayaMuhurta(sunrise: Date, sunset: Date): UtcWindow {
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
export function computeGodhuliMuhurta(sunset: Date): UtcWindow {
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
export function computeNishitaMuhurta(sunset: Date, nextSunrise: Date): UtcWindow {
  const nightDurationMs = nextSunrise.getTime() - sunset.getTime();
  const muhurtaDurationMs = nightDurationMs / 15;
  const start = new Date(sunset.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);
  return { start, end };
}

/**
 * Amrit Kala (Amrita Ghatika / drik's "Amrit Kalam") windows of a Hindu day,
 * in start order.
 *
 * Amrit Kala shares Varjyam's architecture exactly (2026-08-14 audit,
 * recovered from 54 drik windows across two cities covering all 27
 * nakshatras, offset spread ≤0.1 ghati): each window is anchored at its
 * nakshatra's OWN START, offset by {@link AMRIT_KALA_OFFSET_GHATIKAS}
 * elapsed ghatikas in the **nakshatra-elastic frame** (1 ghatika =
 * nakshatraDuration / 60), and spans exactly 4 such ghatikas (~84–108 min).
 * A window belongs to the Hindu day its START falls in — post-midnight
 * windows print on the prior day's page — giving 0..2 windows per day.
 *
 * An earlier revision anchored the window at sunrise with ahoratra-elastic
 * ghatikas keyed to the sunrise nakshatra and dropped windows crossing next
 * sunrise; that model disagreed with drik by up to ~16 h.
 *
 * @param sunriseUtc      UTC of local sunrise — start of the Hindu day.
 * @param nextSunriseUtc  UTC of the following day's local sunrise.
 * @param getMoon         Sidereal Moon longitude (degrees) at a UTC instant.
 */
export function computeAmritKalaWindows(
  sunriseUtc: Date,
  nextSunriseUtc: Date,
  getMoon: (d: Date) => number,
): UtcWindow[] {
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
export function computeMadhyahna(sunrise: Date, sunset: Date): UtcWindow {
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
): UtcWindow {
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
): UtcWindow {
  const widthMs = (nextSunrise.getTime() - sunset.getTime()) / 10;
  return {
    start: sunset,
    end: new Date(sunset.getTime() + widthMs),
  };
}

/**
 * Amrita Ghatika offsets — elapsed ghatikas from the NAKSHATRA'S START to
 * the beginning of its Amrit Kala window, in the nakshatra-elastic frame
 * (1 ghatika = nakshatraDuration / 60). Each window spans 4 such ghatikas.
 *
 * Recovered from the DrikPanchang engine (2026-08-14 audit): 54 printed
 * "Amrit Kalam" windows over 58 day-pages across Jaipur Feb-2027 and
 * Kolkata Nov-2026 cover all 27 nakshatras with a per-nakshatra spread of
 * ≤0.1 ghati against the located nakshatra boundaries. Single-corpus (drik
 * engine only) — no independently published Amrita-Ghati table with this
 * anchoring convention was found at fix time; drik is the project's parity
 * oracle, so the table ships with that caveat recorded in the CHANGELOG.
 *
 * Structurally this is `VARJYAM_OFFSET_GHATIKAS`' sibling — same anchoring,
 * same frame, same width, different offsets (auspicious rather than tyajya).
 * The tables agree at some indices by coincidence; the wholesale pin in
 * `tests/unit/varjyam.test.ts` keeps a stray cross-table copy from shipping.
 */
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
