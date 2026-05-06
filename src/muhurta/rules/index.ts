/**
 * Stock muhurta rules for the most-requested classical occasions.
 *
 * Each rule is a pure data declaration consumed by `scoreMuhurta` /
 * `findAuspiciousDates` in the engine. Sources for the auspicious /
 * inauspicious lists below:
 *
 *   - Muhurta-chintamani (Rama Daivajna, c. 1600 CE) — Chs. 4, 9, 16
 *   - Muhurta-darpana (Lakshman, c. 17th c.)
 *   - BPHS Ch. 28 ("Muhurta-vichar")
 *   - K.S. Charak's *Predictive Astrology* Ch. 23
 *   - Cross-checked against drikpanchang.com/muhurat/* tables
 *
 * Nakshatra indices: 0 = Ashwini … 26 = Revati.
 * Tithi indices: 0..14 Shukla, 15..29 Krishna; 14 = Purnima, 29 = Amavasya.
 * Vara indices: 0 = Sunday … 6 = Saturday.
 * Yoga indices: 0..26.
 */

import type { MuhurtaRule } from '../engine';

/**
 * Vivah (Hindu wedding). Nakshatras Rohini, Mrigashira, Magha, Hasta,
 * Swati, Anuradha, Mula, Uttara Phalguni, Uttara Ashadha, Uttara
 * Bhadrapada, Revati are classically auspicious; Bharani / Krittika /
 * Ashlesha / Vishakha / Jyeshtha are avoided.
 */
export const vivahRule: MuhurtaRule = {
  occasion: 'vivah',
  name: 'Vivah (wedding)',
  auspiciousTithis: [1, 2, 4, 6, 10, 11, 12, 16, 17, 19, 21, 25, 26, 27],
  // Avoid Amavasya, full-moon Purnima (sometimes), Chaturdashi, Ashtami, Ekadashi.
  inauspiciousTithis: [3, 7, 13, 18, 22, 28, 14, 29],
  auspiciousNakshatras: [3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26],
  inauspiciousNakshatras: [1, 2, 8, 15, 17],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  excludeBhadra: true,
  excludeEkadashi: true,
  excludeAdhikaMasa: true,
  excludeEclipse: true,
  excludeGandaMula: true,
};

/**
 * Griha Pravesh (housewarming / first entry). Movable signs are avoided —
 * the rule here keys on tithi/nakshatra/vara only.
 */
export const grihaPraveshRule: MuhurtaRule = {
  occasion: 'grihaPravesh',
  name: 'Griha Pravesh (housewarming)',
  auspiciousTithis: [1, 2, 4, 5, 6, 7, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 9, 14, 29, 0, 15],
  auspiciousNakshatras: [3, 9, 11, 12, 14, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  excludeBhadra: true,
  excludeEkadashi: true,
  excludeAdhikaMasa: true,
  excludeEclipse: true,
};

/**
 * Namakarana (naming ceremony). Performed on the 11th day after birth in
 * many traditions; the rule scores days based on tithi/nakshatra/vara
 * favorability.
 */
export const namakaranaRule: MuhurtaRule = {
  occasion: 'namakarana',
  name: 'Namakarana (naming ceremony)',
  auspiciousTithis: [0, 1, 4, 5, 6, 9, 10, 12, 13],
  inauspiciousTithis: [3, 7, 8, 14, 18, 22, 28, 29],
  auspiciousNakshatras: [0, 3, 4, 6, 7, 11, 12, 13, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
};

/**
 * Vidyarambh (commencement of education). Sarasvati-presided occasion;
 * Vasant Panchami (Magha Shukla Panchami) is the canonical day.
 */
export const vidyarambhRule: MuhurtaRule = {
  occasion: 'vidyarambh',
  name: 'Vidyarambh (commencement of education)',
  auspiciousTithis: [0, 1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 14, 22, 28, 29],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 14, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  excludeBhadra: true,
};

/**
 * Vahan Kharidi (vehicle purchase). The classical "shopping" muhurta — also
 * applicable to gold / property purchases.
 */
export const vahanKharidiRule: MuhurtaRule = {
  occasion: 'vahanKharidi',
  name: 'Vahan Kharidi (vehicle purchase)',
  auspiciousTithis: [0, 1, 2, 4, 5, 6, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 7, 8, 14, 18, 22, 28, 29],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [2, 6],
  excludeBhadra: true,
};

/**
 * Annaprashan (first solid food, performed at 6 months of age). The rule
 * is permissive on tithi but specific on nakshatra (avoid harsh / Krura
 * nakshatras).
 */
export const annaprashanRule: MuhurtaRule = {
  occasion: 'annaprashan',
  name: 'Annaprashan (first solid food)',
  auspiciousTithis: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 14, 22, 29],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 14, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
};

/**
 * Mundan (first hair-cutting / chudakarana). 1st or 3rd year typical.
 * Avoid soft-month restrictions; use nakshatra-led rule.
 */
export const mundanRule: MuhurtaRule = {
  occasion: 'mundan',
  name: 'Mundan (first hair-cutting)',
  auspiciousTithis: [1, 2, 4, 5, 6, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 7, 8, 14, 22, 28, 29],
  auspiciousNakshatras: [4, 7, 8, 12, 13, 14, 16, 20, 21, 22, 23, 26],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [2, 6],
  excludeBhadra: true,
};

/**
 * Upanayanam (sacred-thread ceremony). Usually performed in age 5–8 for
 * Brahmin boys; auspicious-window heavy on Pushya / Hasta / Shravana.
 */
export const upanayanamRule: MuhurtaRule = {
  occasion: 'upanayanam',
  name: 'Upanayanam (sacred thread ceremony)',
  auspiciousTithis: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 14, 22, 28, 29],
  auspiciousNakshatras: [3, 4, 7, 11, 12, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
  excludeEkadashi: true,
};

/** Karnavedha (ear-piercing). Similar permissive rule to Annaprashan. */
export const karnavedhaRule: MuhurtaRule = {
  occasion: 'karnavedha',
  name: 'Karnavedha (ear piercing)',
  auspiciousTithis: [1, 5, 6, 9, 10, 11, 12, 13],
  auspiciousNakshatras: [4, 7, 11, 12, 16, 20, 21, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
};

/** Aksharabhyasam (introduction to letters; Sarasvati-led). */
export const aksharabhyasamRule: MuhurtaRule = {
  occasion: 'aksharabhyasam',
  name: 'Aksharabhyasam (introduction to letters)',
  auspiciousTithis: [4, 5, 9, 10, 11, 12],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 14, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
};

/** Seemantham (baby shower; 7th–9th month of pregnancy). */
export const seemanthamRule: MuhurtaRule = {
  occasion: 'seemantham',
  name: 'Seemantham (Vedic baby shower)',
  auspiciousTithis: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 14, 22, 29],
  auspiciousNakshatras: [3, 4, 6, 11, 12, 14, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  excludeBhadra: true,
  excludeEkadashi: true,
  excludeGandaMula: true,
};

/** Shop / business opening — earnings-focused, weekday-led rule. */
export const shopOpeningRule: MuhurtaRule = {
  occasion: 'shopOpening',
  name: 'Shop / business opening',
  auspiciousTithis: [0, 1, 4, 5, 9, 10, 12, 13],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 16, 20, 21, 25, 26],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  excludeBhadra: true,
  excludeAdhikaMasa: true,
};

/** Travel start (Yatra muhurta). Vara-led; nakshatra-disha rules apply. */
export const travelStartRule: MuhurtaRule = {
  occasion: 'travelStart',
  name: 'Travel start (Yatra)',
  auspiciousTithis: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 13],
  inauspiciousTithis: [3, 8, 14, 18, 22, 28, 29],
  auspiciousNakshatras: [3, 6, 7, 11, 12, 16, 20, 21, 25, 26],
  // Avoid Tuesdays (Mars) and Saturdays (Saturn) for long journeys.
  inauspiciousVaras: [2, 6],
  excludeBhadra: true,
  excludeEkadashi: true,
};

/** Map of all stock rules keyed by occasion id. Useful for batch lookups. */
export const STOCK_MUHURTA_RULES: Record<string, MuhurtaRule> = {
  vivah: vivahRule,
  grihaPravesh: grihaPraveshRule,
  namakarana: namakaranaRule,
  vidyarambh: vidyarambhRule,
  vahanKharidi: vahanKharidiRule,
  annaprashan: annaprashanRule,
  mundan: mundanRule,
  upanayanam: upanayanamRule,
  karnavedha: karnavedhaRule,
  aksharabhyasam: aksharabhyasamRule,
  seemantham: seemanthamRule,
  shopOpening: shopOpeningRule,
  travelStart: travelStartRule,
};
