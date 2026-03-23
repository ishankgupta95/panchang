import type { TimePeriod } from '../types/elements';
import { RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS } from '../utils/constants';

/**
 * Compute an inauspicious period by dividing daytime into 8 equal slots.
 *
 * @param sunrise   Sunrise UTC Date
 * @param sunset    Sunset UTC Date
 * @param varaIndex 0=Sunday, 6=Saturday
 * @param slotTable Which slot table to use (Rahu/Yamaganda/Gulika)
 */
export function computeInauspiciousPeriod(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
  slotTable: readonly number[],
): TimePeriod {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const slotDurationMs = dayDurationMs / 8;
  const slotIndex = slotTable[varaIndex]!;

  const start = new Date(sunrise.getTime() + slotIndex * slotDurationMs);
  const end = new Date(start.getTime() + slotDurationMs);

  return { start, end };
}

export function computeRahuKalam(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, RAHU_KALAM_SLOTS);
}

export function computeGulikaKalam(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, GULIKA_SLOTS);
}

export function computeYamaganda(sunrise: Date, sunset: Date, varaIndex: number): TimePeriod {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, YAMAGANDA_SLOTS);
}
