import type { VaraInfo } from '../types/elements';
import { ENGLISH_DAY_NAMES } from '../utils/constants';

/**
 * Hindu weekday. The Hindu day starts at SUNRISE, not midnight.
 * For any time between midnight and sunrise, the Vara is the previous calendar day.
 *
 * @param dateUtc    The moment to compute Vara for (UTC).
 * @param sunriseUtc Sunrise on this calendar day (UTC).
 * @param varaNames  Localized names from i18n.
 */
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
