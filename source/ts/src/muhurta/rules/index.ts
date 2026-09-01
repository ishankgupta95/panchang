/**
 * Lists drawn from Muhurta-chintamani Chs. 4, 9, 16; Muhurta-darpana; BPHS Ch. 28;
 * K.S. Charak's *Predictive Astrology* Ch. 23; the tithi x vara combinations live in
 * `varaTithiYogas.ts`. Tithi 0..14 Shukla, 15..29 Krishna; vara 0 = Sunday … 6 = Saturday.
 */

import type { MuhurtaRule } from '../engine';

/** Tithi *number* `n` (1..14) in both pakshas: quality belongs to the number, not the fortnight. */
const bothPakshas = (...numbers: readonly number[]): readonly number[] =>
  numbers.flatMap((n) => [n - 1, n + 14]).sort((a, b) => a - b);

const PURNIMA = 14;
const AMAVASYA = 29;

/** Rikta ("empty") tithis, avoided for every mangala karya. */
const RIKTA = bothPakshas(4, 9, 14);

const ASHTAMI = bothPakshas(8);

const N = {
  ashwini: 0, bharani: 1, krittika: 2, rohini: 3, mrigashira: 4,
  ardra: 5, punarvasu: 6, pushya: 7, ashlesha: 8, magha: 9,
  purvaPhalguni: 10, uttaraPhalguni: 11, hasta: 12, chitra: 13,
  swati: 14, vishakha: 15, anuradha: 16, jyeshtha: 17, mula: 18,
  purvaAshadha: 19, uttaraAshadha: 20, shravana: 21, dhanishtha: 22,
  shatabhisha: 23, purvaBhadrapada: 24, uttaraBhadrapada: 25, revati: 26,
} as const;

/**
 * `excludeGandaMula` is deliberately unset: Magha, Mula and Revati are Ganda Mula *and*
 * canonical vivah nakshatras, rejected only at *pada* granularity, which this model cannot resolve.
 */
export const vivahRule: MuhurtaRule = {
  occasion: 'vivah',
  name: 'Vivah (wedding)',
  auspiciousTithis: bothPakshas(2, 3, 5, 7, 11, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.mrigashira, N.magha, N.uttaraPhalguni, N.hasta, N.swati,
    N.anuradha, N.mula, N.uttaraAshadha, N.uttaraBhadrapada, N.revati,
  ],
  inauspiciousNakshatras: [N.bharani, N.krittika, N.ashlesha, N.vishakha, N.jyeshtha],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  bhadra: 'penalize',
  excludeAdhikaMasa: true,
  excludeEclipse: true,
};

export const grihaPraveshRule: MuhurtaRule = {
  occasion: 'grihaPravesh',
  name: 'Griha Pravesh (housewarming)',
  auspiciousTithis: bothPakshas(2, 3, 5, 7, 10, 11, 13),
  inauspiciousTithis: [...RIKTA, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.mrigashira, N.uttaraPhalguni, N.chitra, N.anuradha,
    N.uttaraAshadha, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5, 6],
  inauspiciousVaras: [0, 2],
  bhadra: 'penalize',
  excludeAdhikaMasa: true,
  excludeEclipse: true,
};

export const namakaranaRule: MuhurtaRule = {
  occasion: 'namakarana',
  name: 'Namakarana (naming ceremony)',
  auspiciousTithis: bothPakshas(1, 2, 5, 6, 7, 10, 11, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.ashwini, N.rohini, N.mrigashira, N.punarvasu, N.pushya,
    N.uttaraPhalguni, N.hasta, N.chitra, N.anuradha, N.uttaraAshadha,
    N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
};

export const vidyarambhRule: MuhurtaRule = {
  occasion: 'vidyarambh',
  name: 'Vidyarambh (commencement of education)',
  auspiciousTithis: bothPakshas(1, 2, 3, 5, 6, 7, 10, 11, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.swati,
    N.anuradha, N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  bhadra: 'penalize',
};

/** The classical "shopping" muhurta, also used for gold and property. */
export const vahanKharidiRule: MuhurtaRule = {
  occasion: 'vahanKharidi',
  name: 'Vahan Kharidi (vehicle purchase)',
  auspiciousTithis: [...bothPakshas(1, 3, 5, 6, 8, 10, 11, 13), PURNIMA],
  inauspiciousTithis: [...RIKTA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.mrigashira, N.punarvasu, N.pushya, N.anuradha, N.hasta,
    N.chitra, N.swati, N.shravana, N.dhanishtha, N.shatabhisha, N.revati,
  ],
  auspiciousVaras: [0, 1, 3, 4, 5],
  inauspiciousVaras: [2, 6],
  bhadra: 'penalize',
};

export const annaprashanRule: MuhurtaRule = {
  occasion: 'annaprashan',
  name: 'Annaprashan (first solid food)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 11, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.swati,
    N.anuradha, N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
};

/** Several nakshatras on the classical Chudakarana list are Ganda Mula, so `excludeGandaMula` is unset. */
export const mundanRule: MuhurtaRule = {
  occasion: 'mundan',
  name: 'Mundan (first hair-cutting)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 11, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.ashwini, N.mrigashira, N.punarvasu, N.pushya, N.hasta, N.chitra,
    N.swati, N.jyeshtha, N.shravana, N.dhanishtha, N.shatabhisha, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [2, 6],
  bhadra: 'penalize',
};

export const upanayanamRule: MuhurtaRule = {
  occasion: 'upanayanam',
  name: 'Upanayanam (sacred thread ceremony)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.mrigashira, N.pushya, N.uttaraPhalguni, N.hasta, N.anuradha,
    N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
  excludeEkadashi: true,
};

export const karnavedhaRule: MuhurtaRule = {
  occasion: 'karnavedha',
  name: 'Karnavedha (ear piercing)',
  auspiciousTithis: bothPakshas(2, 6, 7, 10, 11, 12, 13),
  inauspiciousTithis: [...RIKTA, AMAVASYA],
  auspiciousNakshatras: [
    N.mrigashira, N.pushya, N.uttaraPhalguni, N.hasta, N.anuradha,
    N.uttaraAshadha, N.shravana, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
};

export const aksharabhyasamRule: MuhurtaRule = {
  occasion: 'aksharabhyasam',
  name: 'Aksharabhyasam (introduction to letters)',
  auspiciousTithis: bothPakshas(5, 6, 10, 11, 12, 13),
  inauspiciousTithis: [...RIKTA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.swati,
    N.anuradha, N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
};

/** Unlike vivah this keeps `excludeGandaMula`, so Revati is omitted rather than left unreachable. */
export const seemanthamRule: MuhurtaRule = {
  occasion: 'seemantham',
  name: 'Seemantham (Vedic baby shower)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.mrigashira, N.punarvasu, N.uttaraPhalguni, N.hasta, N.swati,
    N.anuradha, N.uttaraAshadha, N.shravana, N.uttaraBhadrapada,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  bhadra: 'penalize',
  excludeEkadashi: true,
  excludeGandaMula: true,
};

export const shopOpeningRule: MuhurtaRule = {
  occasion: 'shopOpening',
  name: 'Shop / business opening',
  auspiciousTithis: bothPakshas(1, 2, 5, 6, 10, 11, 13),
  inauspiciousTithis: [...RIKTA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.anuradha,
    N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  auspiciousVaras: [1, 3, 4, 5],
  inauspiciousVaras: [0, 2, 6],
  bhadra: 'penalize',
  excludeAdhikaMasa: true,
};

export const travelStartRule: MuhurtaRule = {
  occasion: 'travelStart',
  name: 'Travel start (Yatra)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.anuradha,
    N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  inauspiciousVaras: [2, 6],
  bhadra: 'penalize',
  excludeEkadashi: true,
};

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
