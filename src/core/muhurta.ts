import type { TimePeriod } from '../types/elements';

/**
 * Abhijit Muhurta: the 8th muhurta when daytime is divided into 15 equal parts.
 * This is the most auspicious muhurta, centered around local noon.
 *
 * For a 12-hour day: each muhurta = 48 min. Abhijit = ~11:36 AM to 12:24 PM.
 *
 * @param sunrise Sunrise UTC Date
 * @param sunset  Sunset UTC Date
 */
export function computeAbhijitMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;

  // 8th muhurta = index 7 (0-based)
  const start = new Date(sunrise.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);

  return { start, end };
}

/**
 * Govardhan Muhurta: the 8th muhurta from sunrise (index 7, 0-based).
 *
 * One muhurta = (sunset − sunrise) / 15. Govardhan Muhurta falls at the same
 * solar position as Abhijit (centered near local noon) but is referenced in
 * South-Indian Panchang for Govardhan puja timing.
 *
 * @param sunrise Sunrise UTC Date
 * @param sunset  Sunset UTC Date
 */
export function computeGovardhanMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 15;

  // 8th muhurta = index 7 (0-based)
  const start = new Date(sunrise.getTime() + 7 * muhurtaDurationMs);
  const end = new Date(start.getTime() + muhurtaDurationMs);

  return { start, end };
}

/**
 * Brahma Muhurta: the auspicious 96-minute window ending 48 minutes before sunrise.
 *
 * Daytime is divided into 30 equal muhurtas (each ≈ 48 min for a 12-hour day).
 * Brahma Muhurta spans the 29th and 30th muhurtas of the *preceding* night,
 * i.e. the two muhurtas immediately before sunrise.
 *
 * Start: sunrise − 2 × muhurtaDuration
 * End:   sunrise − 1 × muhurtaDuration
 *
 * @param sunrise Sunrise UTC Date
 * @param sunset  Sunset UTC Date (used to derive the muhurta length)
 */
export function computeBrahmaMuhurta(sunrise: Date, sunset: Date): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const muhurtaDurationMs = dayDurationMs / 30;

  const end = new Date(sunrise.getTime() - muhurtaDurationMs);
  const start = new Date(end.getTime() - muhurtaDurationMs);

  return { start, end };
}
