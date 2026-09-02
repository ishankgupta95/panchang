import type { SamvatInfo } from '../types/elements';
import { boundingNewMoons } from '../astronomy/newMoon';
import { getSiderealSunLongitude } from '../astronomy/sun';

const DAY_MS = 86_400_000;

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

const chaitraCache = new Map<number, number>();

/** The Chaitra new moon opening the lunar year: the last one before Mesha Sankranti. */
export function chaitraNewMoon(gregYear: number): number {
  const cached = chaitraCache.get(gregYear);
  if (cached !== undefined) return cached;

  let ref = new Date(Date.UTC(gregYear, 0, 20));
  let result = Date.UTC(gregYear, 2, 22); // fallback; should not be hit
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
 * Both eras turn over at Chaitra Shukla Pratipada; the +9 / +11 name offsets encode
 * the 13-position gap between the northern and southern samvatsara lists.
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
