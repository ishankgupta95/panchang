/** Sources: BPHS ch. 7, Muhurta-chintamani, Brihat Samhita. Graha indices:
 *  0 Sun, 1 Moon, 2 Mars, 3 Mercury, 4 Jupiter, 5 Venus, 6 Saturn. */

export type Varna = 'brahmin' | 'kshatriya' | 'vaishya' | 'shudra';
export const VARNA_RANK: Record<Varna, number> = {
  brahmin: 4, kshatriya: 3, vaishya: 2, shudra: 1,
};
export const RASHI_VARNA: readonly Varna[] = [
  'kshatriya', // 0  Aries
  'vaishya',   // 1  Taurus
  'shudra',    // 2  Gemini
  'brahmin',   // 3  Cancer
  'kshatriya', // 4  Leo
  'vaishya',   // 5  Virgo
  'shudra',    // 6  Libra
  'brahmin',   // 7  Scorpio
  'kshatriya', // 8  Sagittarius
  'vaishya',   // 9  Capricorn
  'shudra',    // 10 Aquarius
  'brahmin',   // 11 Pisces
];

export type Vashya = 'quadruped' | 'human' | 'water' | 'wild' | 'insect';
/** Dominant vashya per rashi; the classical half-sign nuance is not modelled. */
export const RASHI_VASHYA: readonly Vashya[] = [
  'quadruped', // 0  Aries
  'quadruped', // 1  Taurus
  'human',     // 2  Gemini
  'water',     // 3  Cancer
  'wild',      // 4  Leo
  'human',     // 5  Virgo
  'human',     // 6  Libra
  'insect',    // 7  Scorpio
  'human',     // 8  Sagittarius
  'quadruped', // 9  Capricorn
  'human',     // 10 Aquarius
  'water',     // 11 Pisces
];

const V_INDEX: Record<Vashya, number> = {
  quadruped: 0, human: 1, water: 2, wild: 3, insect: 4,
};
export const VASHYA_SCORE: readonly (readonly number[])[] = [
  [ 2,  0,  1,  0,  1 ], // Quadruped
  [ 0,  2,  0.5, 0,  0.5 ], // Human
  [ 1,  0.5, 2,  0,  0.5 ], // Water
  [ 0,  0,  0,  2,  0 ], // Wild
  [ 0.5, 0.5, 0.5, 0,  2 ], // Insect
];
export function vashyaIndex(v: Vashya): number { return V_INDEX[v]; }

export type YoniAnimal =
  | 'horse' | 'elephant' | 'sheep' | 'snake' | 'dog' | 'cat'
  | 'rat' | 'cow' | 'buffalo' | 'tiger' | 'deer' | 'monkey'
  | 'mongoose' | 'lion';

export const NAKSHATRA_YONI: readonly YoniAnimal[] = [
  'horse',    // 0  Ashwini
  'elephant', // 1  Bharani
  'sheep',    // 2  Krittika
  'snake',    // 3  Rohini
  'snake',    // 4  Mrigashira
  'dog',      // 5  Ardra
  'cat',      // 6  Punarvasu
  'sheep',    // 7  Pushya
  'cat',      // 8  Ashlesha
  'rat',      // 9  Magha
  'rat',      // 10 P. Phalguni
  'cow',      // 11 U. Phalguni
  'buffalo',  // 12 Hasta
  'tiger',    // 13 Chitra
  'buffalo',  // 14 Swati
  'tiger',    // 15 Vishakha
  'deer',     // 16 Anuradha
  'deer',     // 17 Jyeshtha
  'dog',      // 18 Mula
  'monkey',   // 19 P. Ashadha
  'mongoose', // 20 U. Ashadha
  'monkey',   // 21 Shravana
  'lion',     // 22 Dhanishtha
  'horse',    // 23 Shatabhisha
  'lion',     // 24 P. Bhadrapada
  'cow',      // 25 U. Bhadrapada
  'elephant', // 26 Revati
];

const Y_INDEX: Record<YoniAnimal, number> = {
  horse: 0, elephant: 1, sheep: 2, snake: 3, dog: 4, cat: 5, rat: 6, cow: 7,
  buffalo: 8, tiger: 9, deer: 10, monkey: 11, mongoose: 12, lion: 13,
};
export function yoniIndex(y: YoniAnimal): number { return Y_INDEX[y]; }

/** Yoni compatibility per Brihat Samhita ch. 102: same animal 4, neutral 2, unfriendly 1, hostile 0. */
export const YONI_SCORE: readonly (readonly number[])[] = (() => {
  const N = 14;
  const t: number[][] = Array.from({ length: N }, () => Array(N).fill(2));
  for (let i = 0; i < N; i++) t[i]![i] = 4;
  const enemyPairs: [YoniAnimal, YoniAnimal][] = [
    ['horse', 'buffalo'],
    ['elephant', 'lion'],
    ['sheep', 'monkey'],
    ['snake', 'mongoose'],
    ['dog', 'deer'],
    ['cat', 'rat'],
    ['cow', 'tiger'],
  ];
  for (const [a, b] of enemyPairs) {
    t[Y_INDEX[a]]![Y_INDEX[b]] = 0;
    t[Y_INDEX[b]]![Y_INDEX[a]] = 0;
  }
  const unfriendlyPairs: [YoniAnimal, YoniAnimal][] = [
    ['horse', 'cow'],
    ['elephant', 'tiger'],
    ['cat', 'dog'],
    ['snake', 'horse'],
    ['monkey', 'sheep'],
  ];
  for (const [a, b] of unfriendlyPairs) {
    if (t[Y_INDEX[a]]![Y_INDEX[b]] === 2) t[Y_INDEX[a]]![Y_INDEX[b]] = 1;
    if (t[Y_INDEX[b]]![Y_INDEX[a]] === 2) t[Y_INDEX[b]]![Y_INDEX[a]] = 1;
  }
  return t.map((r) => Object.freeze([...r])) as readonly (readonly number[])[];
})();

export const RASHI_LORD: readonly number[] = [
  2, // 0  Aries: Mars
  5, // 1  Taurus: Venus
  3, // 2  Gemini: Mercury
  1, // 3  Cancer: Moon
  0, // 4  Leo: Sun
  3, // 5  Virgo: Mercury
  5, // 6  Libra: Venus
  2, // 7  Scorpio: Mars
  4, // 8  Sagittarius: Jupiter
  6, // 9  Capricorn: Saturn
  6, // 10 Aquarius: Saturn
  4, // 11 Pisces: Jupiter
];

/** Naisargika Maitri per BPHS ch. 4: 1 = Mitra, 0 = Sama, -1 = Shatru. The
 *  diagonal is unused: a shared rashi-lord scores full marks by convention. */
export const NAISARGIKA_MAITRI: readonly (readonly number[])[] = [
  [ 0,  1,   1,   0,   1,  -1,  -1 ],
  [ 1,  0,   0,   1,   0,   0,   0 ],
  [ 1,  1,   0,  -1,   1,   0,   0 ],
  [ 1,  -1,  0,   0,   0,   1,   0 ],
  [ 1,  1,   1,  -1,   0,  -1,   0 ],
  [-1,  -1,  0,   1,   0,   0,   1 ],
  [-1,  -1, -1,   1,   0,   1,   0 ],
];

export const GRAHA_MAITRI_SCORE: readonly (readonly number[])[] = [
  [ 0,     1,       0.5 ],
  [ 1,     3,       4   ],
  [ 0.5,   4,       5   ],
];
export function maitriIdx(v: number): number { return v + 1; }

export type Gana = 'deva' | 'manushya' | 'rakshasa';
export const NAKSHATRA_GANA: readonly Gana[] = [
  'deva',     // 0  Ashwini
  'manushya', // 1  Bharani
  'rakshasa', // 2  Krittika
  'manushya', // 3  Rohini
  'deva',     // 4  Mrigashira
  'manushya', // 5  Ardra
  'deva',     // 6  Punarvasu
  'deva',     // 7  Pushya
  'rakshasa', // 8  Ashlesha
  'rakshasa', // 9  Magha
  'manushya', // 10 P. Phalguni
  'manushya', // 11 U. Phalguni
  'deva',     // 12 Hasta
  'rakshasa', // 13 Chitra
  'deva',     // 14 Swati
  'rakshasa', // 15 Vishakha
  'deva',     // 16 Anuradha
  'rakshasa', // 17 Jyeshtha
  'rakshasa', // 18 Mula
  'manushya', // 19 P. Ashadha
  'manushya', // 20 U. Ashadha
  'deva',     // 21 Shravana
  'rakshasa', // 22 Dhanishtha
  'rakshasa', // 23 Shatabhisha
  'manushya', // 24 P. Bhadrapada
  'manushya', // 25 U. Bhadrapada
  'deva',     // 26 Revati
];
const G_INDEX: Record<Gana, number> = { deva: 0, manushya: 1, rakshasa: 2 };
export function ganaIdx(g: Gana): number { return G_INDEX[g]; }
export const GANA_SCORE: readonly (readonly number[])[] = [
  [ 6, 5,   1 ],
  [ 5, 6,   0 ],
  [ 1, 0,   6 ],
];

export type Nadi = 'adi' | 'madhya' | 'antya';
export const NAKSHATRA_NADI: readonly Nadi[] = [
  'adi',    // 0  Ashwini
  'madhya', // 1  Bharani
  'antya',  // 2  Krittika
  'antya',  // 3  Rohini
  'madhya', // 4  Mrigashira
  'adi',    // 5  Ardra
  'adi',    // 6  Punarvasu
  'madhya', // 7  Pushya
  'antya',  // 8  Ashlesha
  'antya',  // 9  Magha
  'madhya', // 10 P. Phalguni
  'adi',    // 11 U. Phalguni
  'adi',    // 12 Hasta
  'madhya', // 13 Chitra
  'antya',  // 14 Swati
  'antya',  // 15 Vishakha
  'madhya', // 16 Anuradha
  'adi',    // 17 Jyeshtha
  'adi',    // 18 Mula
  'madhya', // 19 P. Ashadha
  'antya',  // 20 U. Ashadha
  'antya',  // 21 Shravana
  'madhya', // 22 Dhanishtha
  'adi',    // 23 Shatabhisha
  'adi',    // 24 P. Bhadrapada
  'madhya', // 25 U. Bhadrapada
  'antya',  // 26 Revati
];

/** Inauspicious-tara remainders (1-indexed): 3=Vipat, 5=Pratyari, 7=Vadha. */
export const INAUSPICIOUS_TARA_REMAINDERS: readonly number[] = [3, 5, 7];

/** Bhakoot pairs that score 0, ordered (d_boy_to_girl, d_girl_to_boy). */
export const BHAKOOT_DOSHIC_DISTANCES: readonly (readonly [number, number])[] = [
  [2, 12], [12, 2],
  [5, 9],  [9, 5],
  [6, 8],  [8, 6],
];
