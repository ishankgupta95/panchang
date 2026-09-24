export const TITHI_SPAN = 12;
export const NAKSHATRA_SPAN = 360 / 27;
export const NAKSHATRA_PADA_SPAN = NAKSHATRA_SPAN / 4;
export const YOGA_SPAN = 360 / 27;
export const KARANA_SPAN = 6;
export const RASHI_SPAN = 30;

/** Nakshatra index (0 = Ashwini … 26 = Revati). Expects a longitude in [0, 360). */
export function nakshatraOf(siderealLongitude: number): number {
  return Math.floor(siderealLongitude / NAKSHATRA_SPAN);
}

/** Rashi index (0 = Mesha … 11 = Meena) for a sidereal longitude in [0, 360). */
export function rashiOf(siderealLongitude: number): number {
  return Math.floor(siderealLongitude / RASHI_SPAN);
}

export const RAHU_KALAM_SLOTS = [7, 1, 6, 4, 5, 3, 2] as const;
export const YAMAGANDA_SLOTS = [4, 3, 2, 1, 0, 6, 5] as const;
export const GULIKA_SLOTS = [6, 5, 4, 3, 2, 1, 0] as const;

export const ENGLISH_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

export const TOTAL_TITHIS = 30;
export const TOTAL_NAKSHATRAS = 27;
export const TOTAL_YOGAS = 27;
export const TOTAL_KARANAS = 60;

export const MAX_DAILY_TITHIS = 3;
export const MAX_DAILY_NAKSHATRAS = 3;
export const MAX_DAILY_YOGAS = 3;
export const MAX_DAILY_KARANAS = 5;

export const TITHI_SEARCH_HOURS = 36;
export const NAKSHATRA_SEARCH_HOURS = 36;
export const YOGA_SEARCH_HOURS = 36;
export const KARANA_SEARCH_HOURS = 18;

export const VARJYAM_OFFSET_GHATIKAS: readonly number[] = [
  50, // 0  Ashwini
  24, // 1  Bharani
  30, // 2  Krittika
  40, // 3  Rohini
  14, // 4  Mrigashira
  21, // 5  Ardra
  30, // 6  Punarvasu
  20, // 7  Pushya
  32, // 8  Ashlesha
  30, // 9  Magha
  20, // 10 Purva Phalguni
  18, // 11 Uttara Phalguni
  21, // 12 Hasta
  20, // 13 Chitra
  14, // 14 Swati
  14, // 15 Vishakha
  10, // 16 Anuradha
  14, // 17 Jyeshtha
  56, // 18 Mula
  24, // 19 Purva Ashadha
  20, // 20 Uttara Ashadha
  10, // 21 Shravana
  10, // 22 Dhanishta
  18, // 23 Shatabhisha
  16, // 24 Purva Bhadrapada
  24, // 25 Uttara Bhadrapada
  30, // 26 Revati
];

export const VARJYAM_SECOND_OFFSET_GHATIKAS: Readonly<Record<number, number>> = {
  18: 20, // Mula
};

function buildAnandadiTable(): readonly (readonly number[])[] {
  const rows: number[][] = [];
  for (let v = 0; v < 7; v++) {
    const row: number[] = new Array(27);
    for (let n27 = 0; n27 < 27; n27++) {
      const n28 = n27 < 21 ? n27 : n27 + 1;
      row[n27] = (n28 - 4 * v + 28) % 28;
    }
    rows.push(row);
  }
  return rows;
}

export const ANANDADI_TABLE: readonly (readonly number[])[] = /* @__PURE__ */ buildAnandadiTable();

/** Quality per Anandadi yoga, 0..27 in canonical name order, following the reference almanac. */
export const ANANDADI_QUALITY: readonly ('auspicious' | 'inauspicious' | 'neutral')[] = [
  'auspicious',   //  0 Ananda
  'inauspicious', //  1 Kaladanda
  'inauspicious', //  2 Dhumra
  'auspicious',   //  3 Prajapati
  'auspicious',   //  4 Saumya
  'inauspicious', //  5 Dhwanksha
  'auspicious',   //  6 Dhwaja
  'auspicious',   //  7 Shrivatsa
  'inauspicious', //  8 Vajra
  'inauspicious', //  9 Mudgara
  'auspicious',   // 10 Chhatra
  'auspicious',   // 11 Maitra
  'auspicious',   // 12 Manasa
  'auspicious',   // 13 Padma
  'inauspicious', // 14 Lumba
  'inauspicious', // 15 Utpaata
  'inauspicious', // 16 Mrityu
  'inauspicious', // 17 Kana
  'auspicious',   // 18 Siddhi
  'auspicious',   // 19 Shubha
  'auspicious',   // 20 Amrita
  'inauspicious', // 21 Musala
  'inauspicious', // 22 Gada
  'auspicious',   // 23 Matanga
  'inauspicious', // 24 Raksha
  'auspicious',   // 25 Charma
  'auspicious',   // 26 Sthira
  'auspicious',   // 27 Vardhamana
];

export const TOTAL_ANANDADI_YOGAS = 28;
