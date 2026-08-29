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

  const tithiNumber = (tithiIndex % 15) + 1;

  if (AMRIT_SIDDHI_TABLE.get(varaIndex) === nakshatraIndex) {
    results.push({ name: nameResolver('amrit_siddhi'), type: 'amrit_siddhi' });
  }

  if (SARVARTHA_SIDDHI_TABLE.get(varaIndex)?.has(nakshatraIndex)) {
    results.push({ name: nameResolver('sarvartha_siddhi'), type: 'sarvartha_siddhi' });
  }

  // Pushya is nakshatra index 7.
  if (varaIndex === 0 && nakshatraIndex === 7) {
    results.push({ name: nameResolver('ravi_pushya'), type: 'ravi_pushya' });
  }

  if (varaIndex === 4 && nakshatraIndex === 7) {
    results.push({ name: nameResolver('guru_pushya'), type: 'guru_pushya' });
  }

  if (
    PUSHKAR_VARAS.has(varaIndex) &&
    PUSHKAR_BHADRA_TITHIS.has(tithiNumber) &&
    DWIPUSHKAR_NAKSHATRAS.has(nakshatraIndex)
  ) {
    results.push({ name: nameResolver('dwipushkar'), type: 'dwipushkar' });
  }

  if (
    PUSHKAR_VARAS.has(varaIndex) &&
    PUSHKAR_BHADRA_TITHIS.has(tithiNumber) &&
    TRIPUSHKAR_NAKSHATRAS.has(nakshatraIndex)
  ) {
    results.push({ name: nameResolver('tripushkar'), type: 'tripushkar' });
  }

  if (JWALAMUKHI_TABLE.get(tithiNumber)?.has(nakshatraIndex)) {
    results.push({ name: nameResolver('jwalamukhi'), type: 'jwalamukhi' });
  }

  // Aadal / Vidaal count the Moon-from-Sun distance in the 28-nakshatra scheme
  // (Abhijit included); Ravi below counts it in the 27 without.
  const moonNak28 = to28(nakshatraIndex);
  const sunNak28 = to28(suryaNakshatraIndex);
  const distance28 = ((moonNak28 - sunNak28 + 28) % 28) + 1;
  if (AADAL_DISTANCES.has(distance28)) {
    results.push({ name: nameResolver('aadal'), type: 'aadal' });
  }
  if (VIDAAL_DISTANCES.has(distance28)) {
    results.push({ name: nameResolver('vidaal'), type: 'vidaal' });
  }

  const distance27 = ((nakshatraIndex - suryaNakshatraIndex + TOTAL_NAKSHATRAS) % TOTAL_NAKSHATRAS) + 1;
  if (RAVI_DISTANCES.has(distance27)) {
    results.push({ name: nameResolver('ravi'), type: 'ravi' });
  }

  return results;
}
