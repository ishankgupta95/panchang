import type { SpecialYogaInfo } from '../types/elements';

/**
 * Amrit Siddhi Yoga — auspicious Vara × Tithi combinations.
 *
 * Lookup: vara index → set of tithi numbers within paksha (1-based, 1–15).
 * Applies to both Shukla and Krishna pakshas.
 *
 * Source: traditional Muhurta Chintamani / Drik Panchang tables.
 */
const AMRIT_SIDDHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [0, new Set([1, 4, 6, 9, 14])],      // Sunday
  [1, new Set([2, 7, 12])],             // Monday
  [2, new Set([3, 8, 13])],             // Tuesday
  [3, new Set([5, 10, 15])],            // Wednesday
  [4, new Set([6, 11])],                // Thursday
  [5, new Set([2, 7, 12])],             // Friday
  [6, new Set([3, 8, 13])],             // Saturday
]);

/**
 * Sarvartha Siddhi Yoga — auspicious Vara × Nakshatra combinations.
 *
 * Lookup: vara index → set of nakshatra indices (0-based, 0–26).
 *
 * Source: traditional Muhurta Chintamani / Drik Panchang tables.
 */
const SARVARTHA_SIDDHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [0, new Set([7, 11, 12, 20, 21, 25])],  // Sunday:    Pushya, UPhalguni, Hasta, UAshadha, Shravana, UBhadrapada
  [1, new Set([3, 4, 7, 12, 16, 21])],    // Monday:    Rohini, Mrigashira, Pushya, Hasta, Anuradha, Shravana
  [2, new Set([0, 2, 11, 20, 25])],       // Tuesday:   Ashwini, Krittika, UPhalguni, UAshadha, UBhadrapada
  [3, new Set([1, 3, 4, 12, 16])],        // Wednesday: Bharani, Rohini, Mrigashira, Hasta, Anuradha
  [4, new Set([0, 6, 7, 14, 16, 26])],    // Thursday:  Ashwini, Punarvasu, Pushya, Swati, Anuradha, Revati
  [5, new Set([0, 1, 6, 13, 21, 26])],    // Friday:    Ashwini, Bharani, Punarvasu, Chitra, Shravana, Revati
  [6, new Set([3, 14, 21, 26])],           // Saturday:  Rohini, Swati, Shravana, Revati
]);

/**
 * Detect special auspicious yogas active for a given Vara + Tithi + Nakshatra.
 *
 * @param varaIndex      0 = Sunday … 6 = Saturday
 * @param tithiIndex     0–29 (0 = Shukla Pratipada, 14 = Purnima, 29 = Amavasya)
 * @param nakshatraIndex 0–26 (0 = Ashwini … 26 = Revati)
 * @param nameResolver   Maps yoga type string → translated name
 */
export function computeSpecialYogas(
  varaIndex: number,
  tithiIndex: number,
  nakshatraIndex: number,
  nameResolver: (type: string) => string,
): SpecialYogaInfo[] {
  const results: SpecialYogaInfo[] = [];

  // Tithi number within paksha: 1–15
  const tithiNumber = (tithiIndex % 15) + 1;

  // Amrit Siddhi Yoga
  if (AMRIT_SIDDHI_TABLE.get(varaIndex)?.has(tithiNumber)) {
    results.push({ name: nameResolver('amrit_siddhi'), type: 'amrit_siddhi' });
  }

  // Sarvartha Siddhi Yoga
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

  return results;
}
