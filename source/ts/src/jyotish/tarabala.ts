import { getTranslations } from '../i18n/resolver';
import { TOTAL_NAKSHATRAS } from '../utils/constants';
import { assertNakshatraIndex } from '../utils/validation';
import type { Language } from '../types/options';
import type { TarabalaInfo } from '../types/jyotish';

const TARA_ENGLISH_NAMES = [
  'Janma',
  'Sampat',
  'Vipat',
  'Kshema',
  'Pratyari',
  'Sadhaka',
  'Vadha',
  'Mitra',
  'Ati-Mitra',
] as const;

/** Vipat, Pratyari and Vadha: the inauspicious taras of the Smarta listing. */
const INAUSPICIOUS_TARAS: ReadonlySet<number> = new Set([2, 4, 6]);

const TARA_KEYS = [
  'janma', 'sampat', 'vipat', 'kshema', 'pratyari',
  'sadhaka', 'vadha', 'mitra', 'ati_mitra',
] as const;

/**
 * The transit Moon's tara relative to the native's janma nakshatra.
 * @param janmaNakshatraIndex 0 = Ashwini … 26 = Revati; likewise for transit.
 */
export function computeTarabala(
  janmaNakshatraIndex: number,
  transitNakshatraIndex: number,
  lang: Language = 'en',
): TarabalaInfo {
  assertNakshatraIndex(janmaNakshatraIndex, 'janmaNakshatraIndex');
  assertNakshatraIndex(transitNakshatraIndex, 'transitNakshatraIndex');

  const taraIndex = (transitNakshatraIndex - janmaNakshatraIndex + TOTAL_NAKSHATRAS) % 9;
  const englishName = TARA_ENGLISH_NAMES[taraIndex]!;
  const quality: TarabalaInfo['quality'] = INAUSPICIOUS_TARAS.has(taraIndex) ? 'inauspicious' : 'auspicious';
  const t = getTranslations(lang);
  const name = t.tarabalaNames[TARA_KEYS[taraIndex]!];

  return { taraIndex, englishName, name, quality };
}
