import { TOTAL_NAKSHATRAS } from '../utils/constants';
import {
  assertNakshatraIndex, assertTithiIndex, assertVaraIndex,
} from '../utils/validation';
import {
  AMRIT_SIDDHI_TABLE,
  SARVARTHA_SIDDHI_TABLE,
  PUSHKAR_BHADRA_TITHIS,
  PUSHKAR_VARAS,
  DWIPUSHKAR_NAKSHATRAS,
  TRIPUSHKAR_NAKSHATRAS,
  JWALAMUKHI_TABLE,
  AADAL_DISTANCES,
  VIDAAL_DISTANCES,
  RAVI_DISTANCES,
  to28,
} from './specialYogasData';
import type { SpecialYogaInfo } from '../types/elements';

/**
 * Detect special auspicious / inauspicious yogas active for a given
 * Vara + Tithi + Moon-nakshatra + Sun-nakshatra combination.
 *
 * @param varaIndex            0 = Sunday … 6 = Saturday
 * @param tithiIndex           0–29 (0 = Shukla Pratipada, 14 = Purnima, 29 = Amavasya)
 * @param nakshatraIndex       Moon's nakshatra: 0–26 (0 = Ashwini … 26 = Revati)
 * @param suryaNakshatraIndex  Sun's nakshatra: 0–26 (used by Aadal/Vidaal/Ravi)
 * @param nameResolver         Maps yoga type string → translated name
 *
 * @throws RangeError if any index is out of bounds.
 */
export function computeSpecialYogas(
  varaIndex: number,
  tithiIndex: number,
  nakshatraIndex: number,
  suryaNakshatraIndex: number,
  nameResolver: (type: string) => string,
): SpecialYogaInfo[] {
  assertVaraIndex(varaIndex);
  assertTithiIndex(tithiIndex);
  assertNakshatraIndex(nakshatraIndex);
  assertNakshatraIndex(suryaNakshatraIndex, 'suryaNakshatraIndex');

  const results: SpecialYogaInfo[] = [];

  // Tithi number within paksha: 1–15
  const tithiNumber = (tithiIndex % 15) + 1;

  if (AMRIT_SIDDHI_TABLE.get(varaIndex)?.has(tithiNumber)) {
    results.push({ name: nameResolver('amrit_siddhi'), type: 'amrit_siddhi' });
  }

  if (SARVARTHA_SIDDHI_TABLE.get(varaIndex)?.has(nakshatraIndex)) {
    results.push({ name: nameResolver('sarvartha_siddhi'), type: 'sarvartha_siddhi' });
  }

  // Ravi Pushya Yoga — Sunday + Pushya Nakshatra
  if (varaIndex === 0 && nakshatraIndex === 7) {
    results.push({ name: nameResolver('ravi_pushya'), type: 'ravi_pushya' });
  }

  // Guru Pushya Yoga — Thursday + Pushya Nakshatra
  if (varaIndex === 4 && nakshatraIndex === 7) {
    results.push({ name: nameResolver('guru_pushya'), type: 'guru_pushya' });
  }

  // Dwipushkar — Bhadra-tithi + Bhadra-vara + 2-pada nakshatra triplet
  if (
    PUSHKAR_VARAS.has(varaIndex) &&
    PUSHKAR_BHADRA_TITHIS.has(tithiNumber) &&
    DWIPUSHKAR_NAKSHATRAS.has(nakshatraIndex)
  ) {
    results.push({ name: nameResolver('dwipushkar'), type: 'dwipushkar' });
  }

  // Tripushkar — Bhadra-tithi + Bhadra-vara + 3-pada nakshatra sextet
  if (
    PUSHKAR_VARAS.has(varaIndex) &&
    PUSHKAR_BHADRA_TITHIS.has(tithiNumber) &&
    TRIPUSHKAR_NAKSHATRAS.has(nakshatraIndex)
  ) {
    results.push({ name: nameResolver('tripushkar'), type: 'tripushkar' });
  }

  // Jwalamukhi — fixed tithi-number × nakshatra-index pairs
  if (JWALAMUKHI_TABLE.get(tithiNumber)?.has(nakshatraIndex)) {
    results.push({ name: nameResolver('jwalamukhi'), type: 'jwalamukhi' });
  }

  // Aadal / Vidaal — Moon-from-Sun nakshatra distance in 28-scheme (with Abhijit)
  const moonNak28 = to28(nakshatraIndex);
  const sunNak28 = to28(suryaNakshatraIndex);
  const distance28 = ((moonNak28 - sunNak28 + 28) % 28) + 1;
  if (AADAL_DISTANCES.has(distance28)) {
    results.push({ name: nameResolver('aadal'), type: 'aadal' });
  }
  if (VIDAAL_DISTANCES.has(distance28)) {
    results.push({ name: nameResolver('vidaal'), type: 'vidaal' });
  }

  // Ravi — Moon-from-Sun nakshatra distance in 27-scheme (no Abhijit)
  const distance27 = ((nakshatraIndex - suryaNakshatraIndex + TOTAL_NAKSHATRAS) % TOTAL_NAKSHATRAS) + 1;
  if (RAVI_DISTANCES.has(distance27)) {
    results.push({ name: nameResolver('ravi'), type: 'ravi' });
  }

  return results;
}
