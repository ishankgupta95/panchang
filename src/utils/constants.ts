// ── Span values (degrees) ─────────────────────────────
export const TITHI_SPAN = 12;
export const NAKSHATRA_SPAN = 360 / 27; // 13.3333...
export const NAKSHATRA_PADA_SPAN = NAKSHATRA_SPAN / 4; // 3.3333...
export const YOGA_SPAN = 360 / 27; // 13.3333...
export const KARANA_SPAN = 6;
export const RASHI_SPAN = 30;

/**
 * Nakshatra index (0 = Ashwini … 26 = Revati) for a sidereal longitude.
 *
 * `Math.floor(lon / NAKSHATRA_SPAN)` appeared ~24 times across the codebase and
 * `Math.floor(lon / 30)` ~35 times; naming them keeps the intent legible at the
 * call site and gives the conversion a single home.
 *
 * Expects `lon` already normalized to [0, 360).
 */
export function nakshatraOf(siderealLongitude: number): number {
  return Math.floor(siderealLongitude / NAKSHATRA_SPAN);
}

/** Rashi index (0 = Mesha … 11 = Meena) for a sidereal longitude in [0, 360). */
export function rashiOf(siderealLongitude: number): number {
  return Math.floor(siderealLongitude / RASHI_SPAN);
}

// ── Inauspicious period slot assignments (0-indexed from sunrise) ──
// Index = day of week (0=Sunday, 6=Saturday)
export const RAHU_KALAM_SLOTS = [7, 1, 6, 4, 5, 3, 2] as const;
export const YAMAGANDA_SLOTS = [4, 3, 2, 1, 0, 6, 5] as const;
export const GULIKA_SLOTS = [6, 5, 4, 3, 2, 1, 0] as const;

// ── English day names ─────────────────────────────────
export const ENGLISH_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const;

// ── Element cycle sizes ───────────────────────────────
export const TOTAL_TITHIS = 30;
export const TOTAL_NAKSHATRAS = 27;
export const TOTAL_YOGAS = 27;
export const TOTAL_KARANAS = 60;

// ── Max elements per day (safety caps) ────────────────
export const MAX_DAILY_TITHIS = 3;
export const MAX_DAILY_NAKSHATRAS = 3;
export const MAX_DAILY_YOGAS = 3;
export const MAX_DAILY_KARANAS = 5;

// ── Binary search window sizes (hours) ────────────────
export const TITHI_SEARCH_HOURS = 36;
export const NAKSHATRA_SEARCH_HOURS = 36;
export const YOGA_SEARCH_HOURS = 36;
export const KARANA_SEARCH_HOURS = 18;

// ── Varjyam (Vishaghati / Nakshatra Thyajyam) offsets ─
//
// Classical 27-entry table indexed 0 = Ashwini … 26 = Revati. Each value is
// the offset, in **elastic ghatikas of the nakshatra's own duration**
// (1 ghatika = nakshatraDuration / 60), from the nakshatra's START to the
// BEGINNING of its Varjyam window. The Varjyam window itself spans 4
// elastic ghatikas — therefore ~84–108 min depending on the nakshatra's
// real duration that day. See `src/core/varjyam.ts`.
//
// Source: DrikPanchang (https://www.drikpanchang.com/tutorials/panchang-utilities/nakshatra-thyajyam.html)
// — the project's parity oracle for Phase 28 (Dainika Parity). Their printed
// "Tyajya Ghatis" column gives the START..END ghati labels (e.g. Ashwini
// "51 to 54"); offset elapsed = (start_label − 1), so Ashwini = 50 ghatikas.
// The same numerical labels are reproduced in regional Telugu/Tamil panchanga
// guides that derive from Muhurta-chintamani Ch. 4 and BPHS Ch. 71.
//
// NOTE — the Amrit-Kala offset table in `src/core/muhurta.ts`
// (`AMRIT_KALA_OFFSET_GHATIKAS`) shares this table's architecture exactly
// (offset from the nakshatra's start, nakshatra-elastic ghatikas, 4-ghatika
// width — established by the 2026-08-14 audit) but carries independent
// drik-derived offsets for the auspicious Amrita window. The wholesale pin
// in `tests/unit/varjyam.test.ts` keeps a stray cross-table copy from
// shipping.
export const VARJYAM_OFFSET_GHATIKAS: readonly number[] = [
  50, // 0  Ashwini           — Tyajya 51–54
  24, // 1  Bharani           — Tyajya 25–28
  30, // 2  Krittika          — Tyajya 31–34
  40, // 3  Rohini            — Tyajya 41–44
  14, // 4  Mrigashira        — Tyajya 15–18
  21, // 5  Ardra             — Tyajya 22–25
  30, // 6  Punarvasu         — Tyajya 31–34
  20, // 7  Pushya            — Tyajya 21–24
  32, // 8  Ashlesha          — Tyajya 33–36
  30, // 9  Magha             — Tyajya 31–34
  20, // 10 Purva Phalguni    — Tyajya 21–24
  18, // 11 Uttara Phalguni   — Tyajya 19–22
  21, // 12 Hasta             — Tyajya 22–25
  20, // 13 Chitra            — Tyajya 21–24
  14, // 14 Swati             — Tyajya 15–18
  14, // 15 Vishakha          — Tyajya 15–18
  10, // 16 Anuradha          — Tyajya 11–14
  14, // 17 Jyeshtha          — Tyajya 15–18
  56, // 18 Mula              — Tyajya 57–60
  24, // 19 Purva Ashadha     — Tyajya 25–28
  20, // 20 Uttara Ashadha    — Tyajya 21–24
  10, // 21 Shravana          — Tyajya 11–14
  10, // 22 Dhanishta         — Tyajya 11–14
  18, // 23 Shatabhisha       — Tyajya 19–22
  16, // 24 Purva Bhadrapada  — Tyajya 17–20
  24, // 25 Uttara Bhadrapada — Tyajya 25–28
  30, // 26 Revati            — Tyajya 31–34
];

// Second tyajya spell for the nakshatras that carry TWO Varjyam windows.
//
// Only Mula. Empirically mapped from DrikPanchang's daily engine over two
// full nakshatra cycles (Aug 1 – Sep 30 2026, Ujjain): every drik-printed
// Varjyam window attributes to its nakshatra's single tabulated offset above
// EXCEPT Mula, which drik prints at BOTH 20 and 56 elapsed ghatikas (on
// 2026-09-19 both spells land in one Hindu day and drik prints the pair).
// ProKerala's Telugu panchangam independently prints the same two windows
// for that day. The two values are each classically attested: B.V. Raman's
// "Muhurta" tyajya list gives Moola = 20; the 57–60 (= 56 elapsed) spell is
// the one in the main table above (drik tutorial + Telugu/Tamil tables).
export const VARJYAM_SECOND_OFFSET_GHATIKAS: Readonly<Record<number, number>> = {
  18: 20, // Mula — first spell 21–24, second 57–60 (main table)
};

// ── Anandadi Yoga (Vara × Nakshatra) ────────────────────
//
// Anandadi Yoga is a 28-name cycle formed by the day-of-week × nakshatra
// combination. Each pair maps to one of 28 named yogas with a classical
// auspicious / inauspicious quality. Canonical name order (Muhurta-chintamani
// Ch. 4):
//
//   0 Ananda, 1 Kaladanda, 2 Dhumra, 3 Prajapati, 4 Saumya, 5 Dhwanksha,
//   6 Dhwaja, 7 Shrivatsa, 8 Vajra, 9 Mudgara, 10 Chhatra, 11 Maitra,
//   12 Manasa, 13 Padma, 14 Lumba, 15 Utpaata, 16 Mrityu, 17 Kana,
//   18 Siddhi, 19 Shubha, 20 Amrita, 21 Musala, 22 Gada, 23 Matanga,
//   24 Raksha, 25 Charma, 26 Sthira, 27 Vardhamana.
//
// Phasing per weekday (DrikPanchang convention, also Muhurta-chintamani):
// Ananda (yoga 0) anchors at Ashwini on Sunday and advances +4 nakshatras
// per weekday in the *28-nakshatra* system that includes Abhijit. The
// classical lookup is published in 28-naks form (Abhijit between Uttara
// Ashadha and Shravana). This codebase uses 27 nakshatras throughout, so we
// derive the table programmatically with Abhijit's row elided — i.e. for
// n_27 ∈ [21, 26] the 28-naks index is n_27 + 1.
//
// The closed-form rule:
//   const n28 = n27 < 21 ? n27 : n27 + 1;
//   ANANDADI_TABLE[v][n27] = (n28 - 4*v + 28) % 28;
//
// Sources:
//   - Muhurta-chintamani Ch. 4 (Rama Daivajna, c. 1600 CE) — name list & phasing.
//   - DrikPanchang's published Anandadi Yoga rows (Sunday: Ananda@Ashwini …
//     Vardhamana@Revati; Monday: Ananda@Mrigashira …) confirm both the +4
//     weekday step and the Abhijit-skip when reduced to 27 naks.
//
// Notes on regional variants. The 28th name varies by tradition: most South
// Indian and Maharashtrian almanacs use **Vardhamana** (matching the form
// `Vrudhhi/Vriddhi` used in some Marathi sources); North Indian sources
// occasionally substitute **Pravardhamana**. Sources (e.g. astrosagga.com)
// that list 27 yogas with a different name set (Sankata/Ghatotkacha/...)
// describe a different system and are not used here.
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

export const ANANDADI_TABLE: readonly (readonly number[])[] = buildAnandadiTable();

/**
 * Auspicious / inauspicious classification per Anandadi yoga, indexed
 * 0..27 in the canonical name order above. Aligned to DrikPanchang (the
 * project's parity oracle): 16 are auspicious (Ananda, Prajapati, Saumya,
 * Dhwaja, Shrivatsa, Chhatra, Maitra, Manasa, Padma, Siddhi, Shubha,
 * Amrita, Matanga, Charma, Sthira, Vardhamana) and the remaining 12 are
 * inauspicious. Matanga (23) and Charma (25) are marked auspicious by
 * DrikPanchang day-panchang (verified 2026-06-26 Matanga, 2026-06-16 Chara).
 */
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
  'auspicious',   // 23 Matanga  (auspicious per DrikPanchang)
  'inauspicious', // 24 Raksha
  'auspicious',   // 25 Charma   (auspicious per DrikPanchang)
  'auspicious',   // 26 Sthira
  'auspicious',   // 27 Vardhamana
];

/** Total number of Anandadi yogas in the cycle. */
export const TOTAL_ANANDADI_YOGAS = 28;
