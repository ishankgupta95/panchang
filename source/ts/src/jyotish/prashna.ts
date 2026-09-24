import { computeRashiChart } from './charts';
import type { BirthChartOptions } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { BirthChart } from '../types/jyotish';

/** Prashna (horary) chart for the moment a question is asked, with KP defaults (`'placidus-kp'` houses, `'krishnamurti'` ayanamsa) that `options` can override. */
export function computePrashnaChart(
  questionMoment: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BirthChart {
  const prashnaOptions: BirthChartOptions = {
    ...options,
    houseSystem: options.houseSystem ?? 'placidus-kp',
    ayanamsa: options.ayanamsa ?? 'krishnamurti',
  };
  return computeRashiChart(questionMoment, location, prashnaOptions);
}
