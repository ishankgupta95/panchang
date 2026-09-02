import type { VaraInfo } from '../types/elements';
import { ENGLISH_DAY_NAMES } from '../utils/constants';

/** The Hindu day starts at SUNRISE: an instant before it belongs to the previous day's Vara. */
export function computeVara(
  dateUtc: Date,
  sunriseUtc: Date,
  varaNames: readonly { name: string; short: string }[],
): VaraInfo {
  let d = new Date(dateUtc);
  if (dateUtc.getTime() < sunriseUtc.getTime()) {
    d = new Date(dateUtc.getTime() - 86_400_000);
  }
  const index = d.getUTCDay();
  return {
    index,
    name: varaNames[index]!.name,
    shortName: varaNames[index]!.short,
    englishName: ENGLISH_DAY_NAMES[index]!,
  };
}
