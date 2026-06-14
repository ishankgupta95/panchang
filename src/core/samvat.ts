import type { SamvatInfo } from '../types/elements';
import { boundingNewMoons } from '../astronomy/newMoon';
import { getSiderealSunLongitude } from '../astronomy/sun';

const DAY_MS = 86_400_000;

/**
 * 60-year Jovian (Bārhaspatya / Samvatsara) cycle names, index 0 = Prabhava …
 * 59 = Akshaya. Spellings follow the common DrikPanchang transliteration.
 */
const SAMVATSARA_NAMES: readonly string[] = [
  'Prabhava', 'Vibhava', 'Shukla', 'Pramoda', 'Prajapati', 'Angirasa',
  'Shrimukha', 'Bhava', 'Yuva', 'Dhata', 'Ishvara', 'Bahudhanya',
  'Pramathi', 'Vikrama', 'Vrisha', 'Chitrabhanu', 'Svabhanu', 'Tarana',
  'Parthiva', 'Vyaya', 'Sarvajit', 'Sarvadhari', 'Virodhi', 'Vikriti',
  'Khara', 'Nandana', 'Vijaya', 'Jaya', 'Manmatha', 'Durmukhi',
  'Hevilambi', 'Vilambi', 'Vikari', 'Sharvari', 'Plava', 'Shubhakrit',
  'Shobhakrit', 'Krodhi', 'Vishvavasu', 'Parabhava', 'Plavanga', 'Kilaka',
  'Saumya', 'Sadharana', 'Virodhakrit', 'Paridhavi', 'Pramadi', 'Ananda',
  'Rakshasa', 'Nala', 'Pingala', 'Kalayukta', 'Siddharthi', 'Raudra',
  'Durmati', 'Dundubhi', 'Rudhirodgari', 'Raktakshi', 'Krodhana', 'Akshaya',
];

// Memoize the Chaitra new-moon instant per Gregorian year — getDailyPanchang
// calls computeSamvat once per request, and the new-moon search is the only
// non-trivial cost here.
const chaitraCache = new Map<number, number>();

/**
 * Instant of the Chaitra (amanta) new moon that begins the lunar year for the
 * given Gregorian year — i.e. the new moon that falls while the Sun is in Meena
 * (Pisces, sidereal 330–360°), the last new moon before Mesha Sankranti.
 * Chaitra Shukla Pratipada (the Vikram/Shaka new-year day) is the tithi
 * immediately after it; for era-numbering purposes the new-moon instant is an
 * accurate (<1 day) boundary and is location-independent.
 */
function chaitraNewMoon(gregYear: number): number {
  const cached = chaitraCache.get(gregYear);
  if (cached !== undefined) return cached;

  let ref = new Date(Date.UTC(gregYear, 0, 20)); // Jan 20
  let result = Date.UTC(gregYear, 2, 22); // fallback ≈ Mar 22 (should not be hit)
  for (let i = 0; i < 6; i++) {
    const { next } = boundingNewMoons(ref);
    const sun = getSiderealSunLongitude(next, 'lahiri');
    if (sun >= 330 && sun < 360) {
      result = next.getTime();
      break;
    }
    ref = new Date(next.getTime() + DAY_MS);
  }
  chaitraCache.set(gregYear, result);
  return result;
}

/**
 * Compute the Vikram Samvat and Shaka Samvat year (with their 60-year
 * Samvatsara names) for a given UTC date.
 *
 * Both eras share the same new-year point: Chaitra Shukla Pratipada (Gudi Padwa
 * / Ugadi), a lunar tithi that floats between roughly March 19 and April 14.
 * The crossing is derived from the actual Chaitra new moon (not a fixed April 1
 * heuristic), so the era number is correct right across the new-year boundary
 * and stays consistent with the library's own Chandra Masa.
 *
 * Offsets:
 *   Vikram Samvat = CE + 57 (after new year) / CE + 56 (before)
 *   Shaka Samvat  = CE − 78 (after new year) / CE − 79 (before)
 *   (VS − Shaka = 135 always)
 *
 * Samvatsara names use the luni-solar reckoning that matches DrikPanchang: the
 * northern (Vikram) and southern (Shaka) lists differ by 13 positions.
 *
 * @param date  Any UTC Date within the day being computed.
 */
export function computeSamvat(date: Date): SamvatInfo {
  const gregYear = date.getUTCFullYear();
  const pastNewYear = date.getTime() >= chaitraNewMoon(gregYear);

  const vikramSamvat = gregYear + (pastNewYear ? 57 : 56);
  const shakaSamvat = gregYear + (pastNewYear ? -78 : -79);

  return {
    vikramSamvat,
    shakaSamvat,
    vikramSamvatsara: SAMVATSARA_NAMES[(((vikramSamvat + 9) % 60) + 60) % 60]!,
    shakaSamvatsara: SAMVATSARA_NAMES[(((shakaSamvat + 11) % 60) + 60) % 60]!,
  };
}
