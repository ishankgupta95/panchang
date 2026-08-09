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
 *   - vivah / grihaPravesh / vahanKharidi lists validated against drik's
 *     published shubh-dates calendars, 2025–2027 Mumbai (see the per-rule
 *     docblocks and `tests/validation/drik-muhurta-lists.test.ts`)
 *
 * ## Scope and limits of this model
 *
 * These lists are a coarse screen, not a full muhurta reading.
 *
 * Classical muhurta judges *combinations* of angas, not each anga alone:
 * Rikta tithis are redeemed on a Saturday (Siddha yoga), and otherwise-fine
 * tithis are spoiled on particular weekdays (Dagdha, Visha, Hutasana). Those
 * tithi x vara rules are not expressible as per-anga lists, so they live in
 * the engine instead — see `varaTithiYogas.ts`, applied to every rule here
 * unless `varaTithiYogas: false` switches them off.
 *
 * Still outside the model: Chandra bala and Tara bala (both need a natal
 * Moon), the muhurta lagna and its navamsa, nakshatra *pada* boundaries, and
 * the vara x nakshatra yogas beyond the handful `specialYogas.ts` covers.
 *
 * Treat a passing day as "not ruled out on the panchanga axes", and defer
 * to an astrologer for the joint reading.
 *
 * Nakshatra indices: 0 = Ashwini … 26 = Revati.
 * Tithi indices: 0..14 Shukla, 15..29 Krishna; 14 = Purnima, 29 = Amavasya.
 * Vara indices: 0 = Sunday … 6 = Saturday.
 * Yoga indices: 0..26.
 */

import type { MuhurtaRule } from '../engine';

// ── Index helpers ────────────────────────────────────
//
// Classical sources name tithis by their *number within the paksha* (1..14)
// and nakshatras by name. Transcribing those into the 0-based indices the
// engine wants is where off-by-one errors breed, so the rules below never
// spell a raw index: they go through these helpers.

/**
 * Tithi indices for tithi *number* `n` (1..14), in **both** pakshas.
 *
 * Tithi quality in the classical scheme (Nanda / Bhadra / Jaya / Rikta /
 * Purna) is a property of the number within the fortnight, and the cycle
 * repeats identically in Shukla and Krishna paksha — so a rule that names
 * "Dwitiya" means both. Use `requirePaksha` to restrict to one fortnight.
 */
const bothPakshas = (...numbers: readonly number[]): readonly number[] =>
  numbers.flatMap((n) => [n - 1, n + 14]).sort((a, b) => a - b);

/** Purnima (full moon) — the 15th tithi of Shukla paksha. */
const PURNIMA = 14;
/** Amavasya (new moon) — the 15th tithi of Krishna paksha. */
const AMAVASYA = 29;

/**
 * Rikta ("empty") tithis — the 4th, 9th and 14th of each paksha. Avoided
 * for every mangala karya; the most universally applied tithi rule there
 * is. Both pakshas, six indices in all.
 */
const RIKTA = bothPakshas(4, 9, 14);

/** Ashtami — widely avoided alongside the Rikta tithis for samskaras. */
const ASHTAMI = bothPakshas(8);

/** Nakshatra indices by name, so the lists below read as the sources do. */
const N = {
  ashwini: 0, bharani: 1, krittika: 2, rohini: 3, mrigashira: 4,
  ardra: 5, punarvasu: 6, pushya: 7, ashlesha: 8, magha: 9,
  purvaPhalguni: 10, uttaraPhalguni: 11, hasta: 12, chitra: 13,
  swati: 14, vishakha: 15, anuradha: 16, jyeshtha: 17, mula: 18,
  purvaAshadha: 19, uttaraAshadha: 20, shravana: 21, dhanishtha: 22,
  shatabhisha: 23, purvaBhadrapada: 24, uttaraBhadrapada: 25, revati: 26,
} as const;

/**
 * Vivah (Hindu wedding). Nakshatras Rohini, Mrigashira, Magha, Hasta,
 * Swati, Anuradha, Mula, Uttara Phalguni, Uttara Ashadha, Uttara
 * Bhadrapada, Revati are classically auspicious; Bharani / Krittika /
 * Ashlesha / Vishakha / Jyeshtha are avoided.
 *
 * Tithis follow drikpanchang's marriage page: Dwitiya, Tritiya, Panchami,
 * Saptami, Ekadashi and Trayodashi are best; the Rikta tithis (4, 9, 14)
 * are rejected.
 *
 * Note `excludeGandaMula` is deliberately **not** set: Magha, Mula and
 * Revati are Ganda Mula *and* three of the eleven canonical vivah
 * nakshatras. The classical rejection there is at *pada* granularity (the
 * first quarter of Magha and Mula, the last quarter of Revati), which this
 * model does not resolve — so the whole-nakshatra veto would be far wider
 * than the source. Ashlesha and Jyeshtha, the Ganda Mula nakshatras that
 * *are* rejected outright for vivah, are listed as inauspicious below.
 *
 * Validated against drik's published marriage calendars for 2025–2027
 * (Mumbai): every one of drik's ~230 muhurat days sits on one of the eleven
 * nakshatras below (21–27 occurrences each; the stray sub-3 listings are
 * window-boundary label artifacts). Drik's stated marriage shuddhi is
 * "Nakshatra, Yoga and Karana" over the six allowed solar months — it
 * deliberately applies **no weekday or tithi shuddhi** ("Tithis and weekdays
 * are given less importance… our marriage calculations don't consider
 * Weekdays and Tithis"), while its prose affirms the same classical
 * preferences this rule encodes as soft factors. Day-level parity with
 * drik's published dates is therefore not expected: this rule is the
 * narrower classical screen, and drik's extra rejections (Tara Asta, solar
 * month, Chaturmas) are natal-calendar factors outside this model.
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
  // No excludeEkadashi: Ekadashi is one of the six preferred vivah tithis.
  excludeAdhikaMasa: true,
  excludeEclipse: true,
};

/**
 * Griha Pravesh (housewarming / first entry). Movable signs are avoided —
 * the rule here keys on tithi/nakshatra/vara only.
 *
 * Lists validated against drik's published Griha Pravesh calendars for
 * 2025–2027 (Mumbai; drik states its shuddhi axes as "Nakshatra, Weekday,
 * Tithi and Lunar Month"). Across 121 published muhurat days:
 *
 *   - Nakshatras: exactly the classical eight fixed-and-soft set below, each
 *     appearing 15–20 times. Magha, Hasta, Swati and Shravana — previously
 *     carried here — appear 0–1 times in three years and are removed; drik's
 *     one Hasta / Ashwini / Jyeshtha listings are window-boundary label
 *     artifacts (the "extra" nakshatra begins exactly when the window ends).
 *   - Tithis: Dashami (25) and Ekadashi (22) are among drik's most-used
 *     griha pravesh tithis, so 10 and 11 are auspicious and the former
 *     `excludeEkadashi` hard veto is gone. Shashthi and Dwadashi (1–2 in
 *     three years) dropped to neutral. Pratipada occurs 9 times, so it is no
 *     longer inauspicious; Rikta / Purnima / Amavasya stay banned (0–1
 *     occurrences).
 *   - Weekdays: drik's per-day rejection reason "Prohibited Weekday" hits
 *     only Sundays (68) and Tuesdays (66); Saturday carries 23 published
 *     muhurats — as many as Monday — and joins the auspicious list.
 */
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

/**
 * Namakarana (naming ceremony). Performed on the 11th day after birth in
 * many traditions; the rule scores days based on tithi/nakshatra/vara
 * favorability.
 */
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

/**
 * Vidyarambh (commencement of education). Sarasvati-presided occasion;
 * Vasant Panchami (Magha Shukla Panchami) is the canonical day.
 */
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

/**
 * Vahan Kharidi (vehicle purchase). The classical "shopping" muhurta — also
 * applicable to gold / property purchases.
 *
 * Lists validated against drik's published Vehicle Purchase calendars for
 * 2025–2027 (Mumbai). Drik's own stated rule is class-based — "Movable
 * Nakshatra Punarvasu, Swati, Shravana, Dhanishtha and Shatabhisha are the
 * best … other Nakshatras which are considered sweet and small are also
 * good" (Chara + Mridu + Laghu) — and its 311 published muhurat days
 * exercise exactly the twelve nakshatras below, each 28–37 times:
 *
 *   - The three fixed (Sthira) nakshatras previously carried here — Uttara
 *     Phalguni, Uttara Ashadha, Uttara Bhadrapada — never occur in three
 *     years of listings and are removed; Sthira suits the *house*
 *     occasions, not vehicles. Mrigashira, Chitra, Swati, Dhanishtha and
 *     Shatabhisha (30–37 occurrences each) are added. Rohini (29) is kept
 *     even though drik's prose omits it, and Ashwini stays out: nominally
 *     Laghu, it never appears in the listings.
 *   - Tithis follow drik's operative set {1, 3, 5, 6, 8, 10, 11, 13,
 *     Purnima}: Ashtami (44 occurrences) and Purnima (23) — previously
 *     banned here — are drik staples, while Dwitiya / Saptami / Dwadashi
 *     (0–2 in three years) drop to neutral. Rikta and Amavasya stay banned.
 *   - Weekdays: drik rejects only Tuesdays and Saturdays (146 each in three
 *     years); Sunday carries 62 published days and joins the auspicious
 *     list.
 */
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

/**
 * Annaprashan (first solid food, performed at 6 months of age). The rule
 * is permissive on tithi but specific on nakshatra (avoid harsh / Krura
 * nakshatras).
 */
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

/**
 * Mundan (first hair-cutting / chudakarana). 1st or 3rd year typical.
 * Avoid soft-month restrictions; use nakshatra-led rule.
 *
 * Nakshatras follow the classical Chudakarana list — Ashwini, Mrigashira,
 * Punarvasu, Pushya, Hasta, Chitra, Swati, Jyeshtha, Shravana, Dhanishtha,
 * Shatabhisha, Revati. Several of these are Ganda Mula, so this rule does
 * not set `excludeGandaMula`.
 */
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

/**
 * Upanayanam (sacred-thread ceremony). Usually performed in age 5–8 for
 * Brahmin boys; auspicious-window heavy on Pushya / Hasta / Shravana.
 */
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

/** Karnavedha (ear-piercing). Similar permissive rule to Annaprashan. */
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

/** Aksharabhyasam (introduction to letters; Sarasvati-led). */
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

/**
 * Seemantham (baby shower; 7th–9th month of pregnancy).
 *
 * Unlike vivah, this rule keeps `excludeGandaMula`: it is a child-protective
 * rite and no source overrides the Ganda Mula veto for it, so Revati is
 * omitted from the auspicious list rather than being silently unreachable.
 */
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

/** Shop / business opening — earnings-focused, weekday-led rule. */
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

/** Travel start (Yatra muhurta). Vara-led; nakshatra-disha rules apply. */
export const travelStartRule: MuhurtaRule = {
  occasion: 'travelStart',
  name: 'Travel start (Yatra)',
  auspiciousTithis: bothPakshas(2, 3, 5, 6, 7, 10, 12, 13),
  inauspiciousTithis: [...RIKTA, ...ASHTAMI, PURNIMA, AMAVASYA],
  auspiciousNakshatras: [
    N.rohini, N.punarvasu, N.pushya, N.uttaraPhalguni, N.hasta, N.anuradha,
    N.uttaraAshadha, N.shravana, N.uttaraBhadrapada, N.revati,
  ],
  // Avoid Tuesdays (Mars) and Saturdays (Saturn) for long journeys.
  inauspiciousVaras: [2, 6],
  bhadra: 'penalize',
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
