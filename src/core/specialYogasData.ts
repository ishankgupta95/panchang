/**
 * Lookup tables for `computeSpecialYogas`. Kept in a sibling file so the
 * compute logic in `specialYogas.ts` reads as a list of "for each yoga,
 * check the table" without scrolling past hundreds of lines of reference data.
 *
 * Sources are cited in-context next to each table; cross-references and
 * regional-variant notes are preserved verbatim from the original location.
 */

/**
 * Amrit Siddhi Yoga — auspicious Vara × Nakshatra combinations.
 *
 * Lookup: vara index (0 = Sunday … 6 = Saturday) → the single qualifying
 * Moon-nakshatra index (0 = Ashwini … 26 = Revati). The yoga is defined by
 * seven fixed weekday-nakshatra pairs (Kalamrita / Muhurta Parijata; matches
 * DrikPanchang's Amrit Siddhi emissions):
 *   Sun-Hasta, Mon-Mrigashira, Tue-Ashwini, Wed-Anuradha,
 *   Thu-Pushya, Fri-Revati, Sat-Rohini.
 *
 * NOTE: previously (incorrectly) modelled as a Vara × Tithi table, which both
 * false-fired on tithi coincidences and missed the real nakshatra-based days.
 */
export const AMRIT_SIDDHI_TABLE: ReadonlyMap<number, number> = new Map([
  [0, 12],  // Sunday    → Hasta
  [1, 4],   // Monday    → Mrigashira
  [2, 0],   // Tuesday   → Ashwini
  [3, 16],  // Wednesday → Anuradha
  [4, 7],   // Thursday  → Pushya
  [5, 26],  // Friday    → Revati
  [6, 3],   // Saturday  → Rohini
]);

/**
 * Sarvartha Siddhi Yoga — auspicious Vara × Nakshatra combinations.
 *
 * Lookup: vara index → set of nakshatra indices (0-based, 0–26).
 *
 * ## Derived from DrikPanchang, not merely checked against it (2026-08-08)
 *
 * Every Sarvartha Siddhi window drik publishes for 2026 at Mumbai — **116 of
 * them, all twelve months** — was fetched via the page's `?date=DD/MM/YYYY`
 * parameter. Each window is a nakshatra's span clipped to its Hindu day, so the
 * nakshatra live at the window's midpoint paired with that day's vara gives the
 * cell drik actually used. That recovers 35 distinct pairs, and this table is
 * now exactly that set.
 *
 * Ten cells changed. Three were absent and drik uses them repeatedly —
 * Sun + Ashwini (5 windows), Tue + Ashlesha (3), Wed + Krittika (2).
 * Seven were present and are falsified: each pairing
 * *occurred* three to five times during 2026, often spanning most of the Hindu
 * day, and drik published no window on any of those dates —
 * Sun + Shravana, Mon + Hasta, Tue + Uttara Phalguni, Thu + Swati,
 * Fri + Bharani, Fri + Chitra, Sat + Revati. (Sat + Revati is the clearest:
 * five Saturdays, one of them with Revati running 06:51 to 05:55 the next
 * morning, and silence from drik each time.)
 *
 * The corrected table then reproduces the published weekday lists at
 * astrodevam.com / shubhpanchang.com **exactly for six of the seven varas** —
 * Monday, Tuesday, Wednesday, Thursday and Friday match name for name, having
 * been derived independently from occurrence data. That agreement is the real
 * check here; it is not something a mis-derivation would produce by accident.
 *
 * Sunday is the one row where the two sources disagree: the secondary tables
 * list Ashlesha where drik's windows give Ashwini. That dispute is now
 * settled out-of-sample: Mumbai 2025, Mumbai 2027 and New Delhi 2026 were
 * scraped independently (2026-08-09), and across all four city-years
 * Sun + Ashwini fires 17 times while Sun + Ashlesha never occurs. Each of the
 * four datasets independently exercises exactly these 35 cells, and splitting
 * all 471 published windows at nakshatra boundaries and sunrises leaves no
 * segment longer than 2 minutes outside this table (the ≤2-minute strays are
 * drik's minute-rounding at boundaries).
 *
 * A Sat + Punarvasu cell was briefly added too and then withdrawn — adding it
 * bought one extra match at the cost of five spurious Saturdays. The window
 * that seemed to call for it (2026-10-04, 12:13 AM–06:30 AM) is one of the
 * rare pre-dawn windows drik dates by *Hindu day*: its clock times fall on
 * Oct 5 civil, where its start anchors to a nakshatra boundary, making it
 * Pushya's pre-dawn span on Hindu Sunday Oct 4 — Sun + Pushya, a cell this
 * table already carries. With the table as it stands each dataset reconciles
 * exactly (one drik 2025 pair shares a single Hindu day), which is the check
 * `tests/validation/drik-special-yogas.test.ts` now holds across all four
 * city-years.
 */
export const SARVARTHA_SIDDHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [0, new Set([0, 7, 11, 12, 18, 20, 25])], // Sunday:    Ashwini, Pushya, UPhalguni, Hasta, Mula, UAshadha, UBhadrapada
  [1, new Set([3, 4, 7, 16, 21])],          // Monday:    Rohini, Mrigashira, Pushya, Anuradha, Shravana
  [2, new Set([0, 2, 8, 25])],              // Tuesday:   Ashwini, Krittika, Ashlesha, UBhadrapada
  [3, new Set([2, 3, 4, 12, 16])],          // Wednesday: Krittika, Rohini, Mrigashira, Hasta, Anuradha
  [4, new Set([0, 6, 7, 16, 26])],          // Thursday:  Ashwini, Punarvasu, Pushya, Anuradha, Revati
  [5, new Set([0, 6, 16, 21, 26])],         // Friday:    Ashwini, Punarvasu, Anuradha, Shravana, Revati
  [6, new Set([3, 14, 21])],                // Saturday:  Rohini, Swati, Shravana
]);

// ── Pushkar / Jwalamukhi rule data (Step 28-6, v2.3) ────────────────────────
//
// Dwipushkar / Tripushkar / Jwalamukhi share the same shape — they all key
// off (vara, paksha-tithi-number, nakshatra). Tables below mirror the
// Muhurta-chintamani / Drik Panchang convention; alternative source notes
// are inline.

/**
 * Bhadra-tithi numbers (1–15 within paksha) shared by Dwipushkar and Tripushkar.
 * Classical name "Bhadra" — Dvitiya, Saptami, Dwadashi.
 */
export const PUSHKAR_BHADRA_TITHIS: ReadonlySet<number> = new Set([2, 7, 12]);

/**
 * Vara indices shared by Dwipushkar and Tripushkar — Sunday (0), Tuesday (2),
 * Saturday (6). These are the three "Bhadra-vara" days where the Pushkar
 * pairing activates.
 */
export const PUSHKAR_VARAS: ReadonlySet<number> = new Set([0, 2, 6]);

/**
 * Dwipushkar nakshatras — actions on this combination yield doubled results.
 *
 * Source: DrikPanchang (https://www.drikpanchang.com/yoga/dwipushkar-yoga.html)
 * lists Mrigashira (4), Chitra (13), Dhanishtha (22) — all three are
 * 2-pada-spanning ("dwi-paada") nakshatras whose 4 quarters split across two
 * rashis. The same triplet is given in Muhurta-chintamani Ch. 6.
 */
export const DWIPUSHKAR_NAKSHATRAS: ReadonlySet<number> = new Set([4, 13, 22]);

/**
 * Tripushkar nakshatras — actions on this combination yield tripled results.
 *
 * Source: DrikPanchang (https://www.drikpanchang.com/yoga/tripushkar-yoga.html)
 * lists Krittika (2), Punarvasu (6), Uttara Phalguni (11), Vishakha (15),
 * Uttara Ashadha (20), Purva Bhadrapada (24) — the six "tri-paada" nakshatras
 * whose 4 quarters split across three rashis.
 */
export const TRIPUSHKAR_NAKSHATRAS: ReadonlySet<number> = new Set([2, 6, 11, 15, 20, 24]);

/**
 * Jwalamukhi Yoga — inauspicious tithi+nakshatra combinations classically said
 * to consume the fruits of the action ("mūlakarma-vināśinī").
 *
 * Lookup: paksha-tithi-number (1–15) → set of nakshatra indices. Applies in
 * either paksha — the rule is keyed off the within-paksha tithi number, not
 * the global tithi index.
 *
 * Source: Muhurta-chintamani 6.32 / Vaidyanatha Dixit, as reproduced in:
 *   - https://astroask.com/jwalamukhi-yoga/ (5-row enumeration matching below)
 *   - https://astrodisha.com/jwalamukhi-yoga-inauspicious-muhurat-day-yoga-kya-hai/
 *   - DrikPanchang's emission page
 *     (https://www.drikpanchang.com/panchang/yoga/jwalamukhi/jwalamukhi-yoga.html)
 *     publishes occurrences but no rule text — empirical cross-check confirms
 *     this 5-row table.
 *
 * The classical verse:
 *   "प्रतिपद्मूलयुक्ता च भरण्या पञ्चमी तथा।
 *    कृत्तिकाष्टमी रोहिण्या नवमी आश्लेषदशमी।"
 *
 * Some regional almanacs add a sixth row (Trayodashi+Ardra or Dwadashi+Mrigashira).
 * Those variants are not adopted here; they are not present in DrikPanchang's
 * emission stream.
 */
export const JWALAMUKHI_TABLE: ReadonlyMap<number, ReadonlySet<number>> = new Map([
  [1,  new Set([18])],   // Pratipada + Mula
  [5,  new Set([1])],    // Panchami  + Bharani
  [8,  new Set([2])],    // Ashtami   + Krittika
  [9,  new Set([3])],    // Navami    + Rohini
  [10, new Set([8])],    // Dashami   + Ashlesha
]);

/**
 * Aadal Yoga (auspicious) and Vidaal Yoga (inauspicious) distance sets.
 *
 * **Important sourcing note.** These yogas are sometimes described in popular
 * commentaries as a Tamil-Vakya weekday × nakshatra subset. Every authoritative
 * classical compilation we located defines them instead as **nakshatra-distance
 * positions of the Moon counted from the Sun's nakshatra in the 28-nakshatra
 * scheme** (i.e., counting Abhijit between Uttara Ashadha and Shravana).
 *
 * Sources (accessed 2026-04-26):
 *   - AstroShastra Muhurta page:
 *     https://www.astroshastra.com/Muhurta/combinationyogas.php
 *   - HoraSarvam (Soma Sekhar Sarva), 2023-04 article:
 *     https://horasarvam.blogspot.com/2023/04/tri-pushkara-yoga-and-oher-yogas-formed.html
 *   - Ernst Wilhelm, *Muhurta Yogas: Combinations of Vara, Tithi & Nakshatra*
 *     (Vedic Astrology compilation; numerical convention identical).
 *
 * DrikPanchang publishes Adal/Vidaal occurrence pages but no algorithmic rule
 * text, so we cannot quote DrikPanchang verbatim — the parity check is the
 * cross-validation in `tests/integration/specialYogas-v23-wiring.test.ts`.
 *
 * Convention. `distance = ((moonNak28 - sunNak28 + 28) % 28) + 1`, so
 * distance 1 means Moon and Sun share a nakshatra and distance 28 means Moon
 * is at the position immediately preceding Sun. Abhijit is treated as the
 * 22nd nakshatra (between index 20 and index 21 in the 27-nakshatra scheme).
 */
export const AADAL_DISTANCES: ReadonlySet<number> = new Set([2, 7, 9, 14, 16, 21, 23, 28]);
export const VIDAAL_DISTANCES: ReadonlySet<number> = new Set([3, 6, 10, 13, 17, 20, 24, 27]);

/**
 * Ravi Yoga — auspicious nakshatra-distance set in the 27-nakshatra scheme
 * (Abhijit not counted, unlike Aadal/Vidaal).
 *
 * Sources (accessed 2026-04-26):
 *   - DrikPanchang occurrence page:
 *     https://www.drikpanchang.com/yoga/ravi-yoga-date-time.html
 *     (lists Ravi Yoga across all weekdays — empirically confirms there is no
 *     "must be Sunday" filter, contrary to some popular sources).
 *   - Jothishi (distance-only definition, no weekday): https://jothishi.com/ravi-yoga/
 *   - IndAstro (alternative interpretation that adds a Sunday-exclusion clause):
 *     https://www.indastro.com/learn-astrology/yoga-dasa/ravi-yoga.html
 *
 * The DrikPanchang convention (no weekday filter) is adopted here because the
 * project's parity oracle is DrikPanchang. Note that this makes Ravi Yoga
 * distinct from Ravi Pushya Yoga (which already requires Sunday + Pushya).
 *
 * Convention. `distance = ((moonNak27 - sunNak27 + 27) % 27) + 1`, so
 * distance 1 means Moon and Sun share a nakshatra.
 */
export const RAVI_DISTANCES: ReadonlySet<number> = new Set([4, 6, 9, 10, 13, 20]);

/**
 * Convert a 27-scheme nakshatra index (0=Ashwini … 26=Revati) to the
 * 28-scheme position (1=Ashwini … 21=UAshadha, 22=Abhijit, 23=Shravana,
 * … 28=Revati). Abhijit is inserted between Uttara Ashadha (20) and
 * Shravana (21).
 */
export function to28(nak27: number): number {
  return nak27 < 21 ? nak27 + 1 : nak27 + 2;
}
