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
 * Brahma Muhurta: the two muhurtas immediately before sunrise.
 *
 * Muhurta length is proportional to the day: dayDuration / 30.
 * For a typical 12-hour day this equals ~24 min, making the window ~48–24 min before sunrise.
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
