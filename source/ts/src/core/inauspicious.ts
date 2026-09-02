import type { UtcWindow } from '../types/elements';
import { RAHU_KALAM_SLOTS, YAMAGANDA_SLOTS, GULIKA_SLOTS } from '../utils/constants';

export function computeInauspiciousPeriod(
  sunrise: Date,
  sunset: Date,
  varaIndex: number,
  slotTable: readonly number[],
): UtcWindow {
  const dayDurationMs = sunset.getTime() - sunrise.getTime();
  const slotDurationMs = dayDurationMs / 8;
  const slotIndex = slotTable[varaIndex]!;

  const start = new Date(sunrise.getTime() + slotIndex * slotDurationMs);
  const end = new Date(start.getTime() + slotDurationMs);

  return { start, end };
}

/** Rahu Kalam: one of the 8 equal daytime slots, chosen by weekday (`varaIndex` 0 = Sunday … 6 = Saturday). */
export function computeRahuKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, RAHU_KALAM_SLOTS);
}

/** Gulika Kalam: the inauspicious period ruled by Saturn's son Gulika (`varaIndex` 0 = Sunday … 6 = Saturday). */
export function computeGulikaKalam(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, GULIKA_SLOTS);
}

/** Yamaganda: the inauspicious period associated with Yama (`varaIndex` 0 = Sunday … 6 = Saturday). */
export function computeYamaganda(sunrise: Date, sunset: Date, varaIndex: number): UtcWindow {
  return computeInauspiciousPeriod(sunrise, sunset, varaIndex, YAMAGANDA_SLOTS);
}
