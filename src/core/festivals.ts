import type { FestivalInfo } from '../types/elements';

/**
 * Festival rule: a fixed Chandra Masa + Tithi combination.
 */
interface FestivalRule {
  key: string;
  masa: number;
  tithi: number;
  type: 'major' | 'minor';
}

/**
 * Registry of major pan-Indian Hindu festivals.
 *
 * Chandra Masa indices (Amanta): 0=Chaitra … 11=Phalguna.
 * Tithi indices: 0=Shukla Pratipad … 14=Purnima … 29=Amavasya.
 */
const FESTIVAL_REGISTRY: readonly FestivalRule[] = [
  // Chaitra (0)
  { key: 'ugadi',              masa: 0,  tithi: 0,  type: 'major' },
  { key: 'rama_navami',        masa: 0,  tithi: 8,  type: 'major' },
  { key: 'hanuman_jayanti',    masa: 0,  tithi: 14, type: 'major' },
  // Vaishakha (1)
  { key: 'akshaya_tritiya',    masa: 1,  tithi: 2,  type: 'major' },
  // Ashadha (3)
  { key: 'guru_purnima',       masa: 3,  tithi: 14, type: 'major' },
  // Shravana (4)
  { key: 'nag_panchami',       masa: 4,  tithi: 4,  type: 'minor' },
  { key: 'raksha_bandhan',     masa: 4,  tithi: 14, type: 'major' },
  { key: 'krishna_janmashtami', masa: 4, tithi: 22, type: 'major' },
  // Bhadrapada (5)
  { key: 'ganesh_chaturthi',   masa: 5,  tithi: 3,  type: 'major' },
  { key: 'anant_chaturdashi',  masa: 5,  tithi: 13, type: 'major' },
  // Ashwin (6)
  { key: 'navaratri',          masa: 6,  tithi: 0,  type: 'major' },
  { key: 'durga_ashtami',      masa: 6,  tithi: 7,  type: 'major' },
  { key: 'maha_navami',        masa: 6,  tithi: 8,  type: 'major' },
  { key: 'dussehra',           masa: 6,  tithi: 9,  type: 'major' },
  { key: 'sharad_purnima',     masa: 6,  tithi: 14, type: 'major' },
  // Ashwin (6) — Krishna Paksha festivals (Amanta: Ashwin; Purnimanta calls these "Kartika")
  { key: 'karva_chauth',       masa: 6,  tithi: 18, type: 'major' },
  { key: 'dhanteras',          masa: 6,  tithi: 27, type: 'major' },
  { key: 'narak_chaturdashi',  masa: 6,  tithi: 28, type: 'major' },
  { key: 'diwali',             masa: 6,  tithi: 29, type: 'major' },
  // Kartika (7) — Shukla Paksha
  { key: 'kartika_purnima',    masa: 7,  tithi: 14, type: 'minor' },
  // Magha (10)
  { key: 'vasant_panchami',    masa: 10, tithi: 4,  type: 'major' },
  { key: 'maha_shivaratri',    masa: 10, tithi: 28, type: 'major' },
  // Phalguna (11)
  { key: 'holi',               masa: 11, tithi: 14, type: 'major' },
  // Bhadrapada (5) — end of Pitru Paksha
  { key: 'mahalaya_amavasya',  masa: 5,  tithi: 29, type: 'major' },
];

/**
 * Detect festivals for a given panchang date.
 *
 * Checks fixed masa+tithi rules, recurring Ekadashi/Pradosha,
 * and Sankranti (Sun entering a new rashi).
 *
 * Festivals during Adhika (leap) months are skipped.
 *
 * @param tithiIndex        0–29
 * @param nakshatraIndex    0–26 (unused currently, reserved for nakshatra-based festivals)
 * @param chandraMasaIndex  0–11 (Amanta)
 * @param isAdhika          True if the current month is an Adhika (leap) month
 * @param varaIndex         0–6 (unused currently, reserved)
 * @param siderealSun       Sidereal Sun longitude in degrees
 * @param nameResolver      Maps festival key → translated name
 */
export function computeFestivals(
  tithiIndex: number,
  _nakshatraIndex: number,
  chandraMasaIndex: number,
  isAdhika: boolean,
  _varaIndex: number,
  siderealSun: number,
  nameResolver: (key: string) => string,
): FestivalInfo[] {
  const results: FestivalInfo[] = [];

  // ── Fixed masa+tithi festivals (skip during Adhika months) ──
  if (!isAdhika) {
    for (const rule of FESTIVAL_REGISTRY) {
      if (rule.masa === chandraMasaIndex && rule.tithi === tithiIndex) {
        results.push({
          name: nameResolver(rule.key),
          type: rule.type,
        });
      }
    }
  }

  // ── Ekadashi (every month, both pakshas) ────────────────────
  if (tithiIndex === 10 || tithiIndex === 25) {
    results.push({
      name: nameResolver('ekadashi'),
      type: 'ekadashi',
    });
  }

  // ── Pradosha Vrata — Krishna Trayodashi ─────────────────────
  if (tithiIndex === 27) {
    results.push({
      name: nameResolver('pradosha'),
      type: 'pradosha',
    });
  }

  // ── Sankranti — Sun enters a new rashi (~1°/day) ───────────
  // Detect if the Sun is within ~1° past a rashi boundary.
  const degInRashi = siderealSun % 30;
  if (degInRashi < 1.0) {
    const rashiIndex = Math.floor(siderealSun / 30) % 12;
    results.push({
      name: nameResolver('sankranti'),
      type: 'sankranti',
      description: `Rashi ${rashiIndex}`,
    });
  }

  return results;
}
