import type { NakshatraInfo, RashiInfo } from './elements';

// ── Graha (planetary) positions ──────────────────────

export type GrahaName =
  | 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn'
  | 'Rahu' | 'Ketu';

export interface GrahaPosition {
  /** Planet name in English */
  planet: GrahaName;
  /** Sidereal ecliptic longitude in degrees [0, 360) */
  siderealLongitude: number;
  /** Zodiac sign the planet occupies */
  rashi: RashiInfo;
  /** Degrees within the sign [0, 30) */
  degreeInRashi: number;
  /** Nakshatra the planet occupies */
  nakshatra: NakshatraInfo;
  /**
   * True when the planet appears to move retrograde (west relative to stars).
   * Always false for Sun and Moon (they never retrograde).
   * Rahu/Ketu are always retrograde by definition.
   */
  isRetrograde: boolean;
}

export interface PlanetaryPositions {
  sun: GrahaPosition;
  moon: GrahaPosition;
  mars: GrahaPosition;
  mercury: GrahaPosition;
  jupiter: GrahaPosition;
  venus: GrahaPosition;
  saturn: GrahaPosition;
  rahu: GrahaPosition;
  ketu: GrahaPosition;
}

// ── Vimshottari Dasha ─────────────────────────────────

export type DashaLord =
  | 'Ketu' | 'Venus' | 'Sun' | 'Moon' | 'Mars'
  | 'Rahu' | 'Jupiter' | 'Saturn' | 'Mercury';

export interface AntarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

/**
 * Pratyantar dasha — the third (sub-sub) level in the Vimshottari hierarchy.
 * Each antardasha is divided into 9 pratyantars proportionally; the first
 * pratyantar's lord is the antardasha lord, then the cycle continues.
 */
export interface PratyantarDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
}

export interface MahaDasha {
  lord: DashaLord;
  startDate: Date;
  endDate: Date;
  /** Duration in years */
  years: number;
  antarDashas: AntarDasha[];
}

export interface VimshottariDashaResult {
  /** The current active Mahadasha lord */
  currentMahaDashaLord: DashaLord;
  /** Index into mahaDashas of the current mahadasha */
  currentIndex: number;
  /**
   * Full 120-year sequence starting from birth.
   * The first entry is the dasha active at birth (possibly mid-cycle).
   */
  mahaDashas: MahaDasha[];
}

// ── Chandra Balam ─────────────────────────────────────

/**
 * Transit Moon strength relative to a native's janma (birth) rashi.
 *
 * Classical Chandra Balam rule (cf. Parashara, BPHS Ch. 3): Moon is **Shubha**
 * (strong / favorable) when transiting houses 1, 3, 6, 7, 10, 11 from the janma
 * rashi, and **Ashubha** (weak / unfavorable) in houses 2, 4, 5, 8, 9, 12. This
 * is the bare house-based rule; some traditions soften it via a parihara
 * (Tara Balam) adjustment not applied here.
 */
export interface ChandraBalamInfo {
  /** 1 = janma rashi itself; 2 = next rashi; … 12 = rashi prior to janma */
  house: number;
  /** Classical quality — 'strong' maps to Shubha, 'weak' to Ashubha */
  quality: 'strong' | 'weak';
  /** Sanskrit transliteration ('Shubha' | 'Ashubha') */
  englishName: string;
  /** Locale-specific name */
  name: string;
}

// ── Lagna (Ascendant) ────────────────────────────────

/**
 * Lagna — the sidereal ecliptic longitude rising on the eastern horizon at a
 * given instant + location. The foundation of any Vedic birth chart: house
 * cusps, divisional charts, and most strength/aspect calculations are anchored
 * to lagna.
 *
 * Algorithm: Meeus *Astronomical Algorithms* eq. 13.6 (atan2 form), tropical
 * → sidereal by subtracting the configured ayanamsa.
 */
export interface LagnaInfo {
  /** Sidereal ecliptic longitude in degrees, range [0, 360). */
  siderealLongitude: number;
  /** Zodiac sign the ascendant occupies (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the rashi, range [0, 30). */
  degreeInRashi: number;
  /** Nakshatra index (0 = Ashwini … 26 = Revati) and localized name. */
  nakshatra: { index: number; name: string };
  /** Pada (1..4) within the nakshatra. */
  pada: number;
}

/**
 * `SripatiLagnaInfo` extends {@link LagnaInfo} with the 12 *Sripati Paddhati*
 * bhava-madhya cusps. Returned by `computeSripatiLagna` only when
 * `options.includeCusps` is `true`; the default no-options call still
 * returns `LagnaInfo` (cusp 1 only) for backwards compatibility.
 *
 * Each `cusps[i]` is the sidereal ecliptic longitude (degrees, [0, 360))
 * of the *bhava madhya* (mid-point) of bhava `i+1`. By construction
 * `cusps[0]` equals `siderealLongitude`, `cusps[3]` equals the sidereal
 * IC (MC + 180°), `cusps[6]` equals the descendant (lagna + 180°), and
 * `cusps[9]` equals the sidereal MC. Opposite cusps differ by exactly
 * 180° (Sripati Paddhati invariant — see BPHS Ch. 5).
 *
 * The non-angular cusps (2, 3, 5, 6, 8, 9, 11, 12) are computed by
 * trisecting each of the four ASC→IC→DSC→MC→ASC ecliptic-arc quadrants
 * — the classical formula attributed to Sripati (12th c.) and unanimous
 * across modern Vedic sources (Jothishi, planetarypositions.com,
 * astrologershukla, Lalitha Anamika's substack, etc.). At the equator
 * the four arcs are exactly 90° each and the Sripati chart degenerates
 * to the Equal House chart; at higher latitudes the arcs become
 * asymmetric (e.g. at 47°N the ASC→IC arc can be ~63° while IC→DSC
 * is ~117°).
 */
export interface SripatiLagnaInfo extends LagnaInfo {
  /** 12 bhava-madhya longitudes; `cusps[i]` is the madhya of bhava `i+1`. */
  cusps: number[];
}

// ── Bhava (Houses) ───────────────────────────────────

/**
 * One of the twelve houses (bhavas) in a Vedic birth chart. The cusp longitude
 * defines where the house *begins* in zodiacal order; the house spans up to
 * the next cusp longitude.
 *
 * For `'whole-sign'` houses the cusp falls at exactly 0° of the corresponding
 * rashi. For `'equal'` it falls at the lagna's exact degree within each rashi.
 * For `'placidus-kp'` it is the iteratively-solved cusp longitude.
 */
export interface HouseInfo {
  /** House number 1..12, where house 1 is the ascendant. */
  house: number;
  /** Sidereal ecliptic longitude of the cusp in degrees, [0, 360). */
  cuspLongitude: number;
  /** Zodiac sign at the cusp (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the cusp's rashi, [0, 30). */
  degreeInRashi: number;
}

/**
 * The 12 house cusps for a birth chart, plus the ascendant/MC longitudes for
 * convenient access. `system` records which house system was used.
 */
export interface BhavaChart {
  /** Configured house system. */
  system: 'whole-sign' | 'equal' | 'placidus-kp';
  /** 12 houses in order (index 0 = house 1 = ascendant). */
  houses: HouseInfo[];
  /** Sidereal ascendant longitude, [0, 360). Same as `houses[0].cuspLongitude`. */
  ascendantLongitude: number;
  /**
   * Sidereal Midheaven (10th cusp) longitude, [0, 360). For `'whole-sign'` and
   * `'equal'` systems the MC is not a literal cusp; the value is provided as
   * an informational anchor (the rashi 10 houses from lagna for whole-sign;
   * lagna + 270° for equal).
   */
  mcLongitude: number;
}

// ── Birth chart (D1) and divisional charts ───────────

/**
 * One graha's placement in a chart (D1 or divisional).
 *
 * For D1 (rashi chart) the longitude/degree fields carry the natal sidereal
 * position. For divisional charts (D9, etc.) they carry the *transformed*
 * position in the divisional frame.
 */
export interface PlanetPlacement {
  planet: GrahaName;
  /** Sidereal longitude in this chart's frame, [0, 360). */
  longitude: number;
  /** Zodiac sign (0 = Mesha … 11 = Meena). */
  rashi: RashiInfo;
  /** Degrees within the rashi, [0, 30). */
  degreeInRashi: number;
  /** House (1..12) from the chart's lagna. House system follows the chart context. */
  house: number;
  /** Retrograde at the natal moment. Sun, Moon, Rahu, Ketu have a fixed value. */
  isRetrograde: boolean;
}

/**
 * Full natal D1 (Rashi) chart — sidereal lagna, bhava cusps under the
 * configured house system, and 9 graha placements with house assignments.
 */
export interface BirthChart {
  divisional: 'D1';
  lagna: LagnaInfo;
  bhava: BhavaChart;
  planets: PlanetPlacement[];
  /**
   * The same nine placements keyed by graha, for direct lookup.
   *
   * `planets` stays the canonical ordered list — iterate that. Reach for this
   * when you want one specific graha: `chart.byPlanet.Mars` replaces
   * `chart.planets.find(p => p.planet === 'Mars')!`, which appeared ~20 times
   * across the dosha / yoga / bala code and required a non-null assertion at
   * every site even though the entry is always present.
   *
   * Both views reference the same objects, so a mutation through one is
   * visible through the other.
   */
  byPlanet: Readonly<Record<GrahaName, PlanetPlacement>>;
}

/**
 * Identifier for a divisional (varga) chart kind. The value names follow the
 * classical D-N convention (D2 = Hora, D3 = Drekkana, D7 = Saptamsa,
 * D9 = Navamsa, D10 = Dasamsa, D12 = Dwadasamsa, D30 = Trimsamsa). Each
 * divisional applies its own per-classical-rule mapping from natal sidereal
 * longitude to the chart's frame.
 */
export type Divisional = 'D2' | 'D3' | 'D7' | 'D9' | 'D10' | 'D12' | 'D30';

/**
 * Divisional chart (D2/D3/D7/D9/D10/D12/D30). Always whole-sign anchored to
 * the divisional lagna — divisional charts in classical Vedic practice are
 * sign-based, not cuspal.
 */
export interface DivisionalChart {
  divisional: Divisional;
  /** Divisional lagna rashi (chart-relative house 1). */
  lagnaRashi: RashiInfo;
  /** 9 grahas placed in divisional rashis with whole-sign house numbers. */
  planets: PlanetPlacement[];
}

// ── Mangal Dosha (Manglik) ────────────────────────────

/**
 * Severity classification of Mangal Dosha based on how many of the three
 * reference charts (Lagna, Moon, Venus) show Mars in a manglik house.
 * The classification is computed from the **raw** per-chart flags, before
 * cancellations are applied, so it always reflects the natural strength
 * of the dosha presence in the chart.
 *
 *   - `'none'`  — 0 of 3 charts flag.
 *   - `'anshik'` — partial Manglik: 1 or 2 of 3 charts flag.
 *   - `'purna'` — full Manglik: all 3 charts flag.
 *
 * Per AstroSage's published rule: "If Mars is placed in 1st, 2nd, 4th,
 * 7th, 8th or 12th houses from Natal Chart, Moon Chart and Venus Chart,
 * then it will be considered as High Manglik Dosha. If Mars is placed in
 * those houses from any one of these three charts, then it will be
 * considered as Low Manglik Dosha or 'Partial Manglik Dosha'."
 */
export type MangalDoshaSeverity = 'none' | 'anshik' | 'purna';

/**
 * Mangal Dosha (Manglik) is the classical malefic affliction caused by Mars
 * in houses 1, 2, 4, 7, 8, or 12 from lagna, Moon, or Venus. All three
 * reference points are scored independently; if any flags, the native is
 * considered manglik unless a cancellation applies.
 *
 * Reference rule set follows drik panchang's stated algorithm (Lagna +
 * Moon + Venus charts) and the cancellation set used by mainstream pandits.
 * Drik panchang itself does not enumerate cancellations on its calculator
 * page — these are sourced from the multi-pandit consensus that drik
 * panchang's results agree with. Cancellations applied:
 *
 *   - Mars in own sign (Aries / Scorpio) or exalted (Capricorn).
 *   - Mars conjunct Jupiter (same house) — Jupiter's benefic presence
 *     neutralizes the affliction.
 *   - Mars conjunct Moon (same house) — Moon's softening effect.
 *   - Mars conjunct Venus (same house) — Venus's benefic conjunction
 *     softens Mars. Notably this also self-cancels the from-Venus check
 *     trivially (Mars in 1st from Venus).
 *   - Mars aspected by Jupiter — Jupiter's 5th, 7th, or 9th sign-aspect
 *     onto Mars (whole-sign aspect, i.e. Mars rashi is 5th/7th/9th from
 *     Jupiter rashi).
 *
 * The `severity` field surfaces the Anshik / Purna classification used by
 * AstroSage and many pandits — it is independent of cancellations, so a
 * chart can be `severity: 'anshik'` but `afflicted: false` when
 * cancellations apply.
 */
export interface MangalDoshaInfo {
  /** Final affliction status after applying cancellations. */
  afflicted: boolean;
  /**
   * Anshik (partial) / Purna (full) severity classification, computed
   * from the raw per-chart flags before cancellations. See
   * {@link MangalDoshaSeverity}.
   */
  severity: MangalDoshaSeverity;
  fromLagna: { afflicted: boolean; house: number };
  fromMoon:  { afflicted: boolean; house: number };
  fromVenus: { afflicted: boolean; house: number };
  /** Cancellations that were applied. Empty when none triggered. */
  cancellations: string[];
}

// ── Sade Sati ─────────────────────────────────────────

/**
 * Sade Sati — the 7.5-year period during which transit Saturn passes
 * through the 12th, 1st, and 2nd rashis from the native's natal Moon.
 *
 * Phases:
 *   1 — Saturn in 12th rashi from natal Moon (rising arc)
 *   2 — Saturn in natal Moon's rashi (peak)
 *   3 — Saturn in 2nd rashi from natal Moon (descending arc)
 *
 * Arc boundaries are determined from Saturn's apparent (true) sidereal
 * longitude with a stability window to handle retrograde re-crossings of
 * rashi boundaries.
 */
export interface SadeSatiInfo {
  /** True when Saturn is currently in the Sade Sati arc relative to natal Moon. */
  active: boolean;
  /** Phase 1, 2, or 3 if `active`; null otherwise. */
  phase: 1 | 2 | 3 | null;
  /** Start date of the current 7.5-year arc (null when not active). */
  currentArcStart: Date | null;
  /** End date of the current 7.5-year arc (null when not active). */
  currentArcEnd: Date | null;
  /** Start date of the next arc — only set when not currently active. */
  nextArcStart: Date | null;
}

// ── Tarabala ──────────────────────────────────────────

/**
 * Transit Moon's position in the 9-tara cycle relative to a native's janma
 * (birth) nakshatra.
 *
 * Classical rule (cf. Muhurta-chintamani Ch. 4, BPHS Ch. 71): from the janma
 * nakshatra, the 27 nakshatras divide into nine taras that repeat three times.
 * The cycle, starting with janma itself, is (`taraIndex` is 0-based):
 *
 *   0. Janma     (auspicious, mild caution)
 *   1. Sampat    (auspicious — wealth)
 *   2. Vipat     (inauspicious — calamity)
 *   3. Kshema    (auspicious — well-being)
 *   4. Pratyari  (inauspicious — obstacles)
 *   5. Sadhaka   (auspicious — accomplishment)
 *   6. Vadha     (inauspicious — destruction)
 *   7. Mitra     (auspicious — friend)
 *   8. Ati-Mitra (auspicious — best friend)
 *
 * Three of nine — Vipat (2), Pratyari (4), Vadha (6) — are classed as
 * inauspicious; the other six are auspicious. This module reports that binary
 * quality alongside the tara index and name.
 */
export interface TarabalaInfo {
  /** 0..8 — position in the 9-tara cycle starting from janma nakshatra */
  taraIndex: number;
  /** Sanskrit transliteration: Janma | Sampat | Vipat | Kshema | Pratyari | Sadhaka | Vadha | Mitra | Ati-Mitra */
  englishName: string;
  /** Locale-specific name */
  name: string;
  /** 'inauspicious' for Vipat (2) / Pratyari (4) / Vadha (6); 'auspicious' otherwise */
  quality: 'auspicious' | 'inauspicious';
}

// ── Drishti (Aspects) ─────────────────────────────────

/**
 * The set of houses (1..12) aspected by every graha in a chart.
 *
 * Classical rule (BPHS Ch. 26): every graha aspects the 7th house from itself.
 * The four malefics gain extra "special" aspects:
 *
 *   - Mars: 4th and 8th from itself.
 *   - Jupiter: 5th and 9th from itself.
 *   - Saturn: 3rd and 10th from itself.
 *
 * Rahu and Ketu are taken to mirror Saturn / Jupiter respectively in some
 * traditions (also producing 5th and 9th aspects); the simpler form here
 * follows BPHS literally and gives them only the 7th aspect. Set
 * `nodeAspects: '5-and-9'` on `computeAspects` to enable the extended rule
 * if your tradition uses it.
 *
 * Houses are computed from the graha's own house in the chart — NOT from
 * the lagna — so a graha in house H aspects houses H+6, plus the special
 * houses for malefics. House numbers are 1..12 modulo 12.
 */
export interface AspectMap {
  /** Houses (1..12) aspected by Sun, in ascending order. */
  Sun: number[];
  Moon: number[];
  Mars: number[];
  Mercury: number[];
  Jupiter: number[];
  Venus: number[];
  Saturn: number[];
  Rahu: number[];
  Ketu: number[];
}

// ── Shadbala (Six-fold strength) ──────────────────────

/**
 * Six-fold strength components for one planet, expressed in **Virupa units**
 * (1 Rupa = 60 Virupas; classical convention). Higher values indicate greater
 * strength under that source. The six sub-strengths follow BPHS Ch. 27:
 *
 *   - **Sthana Bala** — positional strength (dignity, ucchabala, etc.).
 *   - **Dig Bala** — directional strength based on the kendra of the chart.
 *   - **Kala Bala** — temporal strength (day/night, paksha, varsha, hora …).
 *   - **Chesta Bala** — motional strength from retrogression / acceleration.
 *   - **Naisargika Bala** — natural strength ranking (Sun strongest, Saturn
 *     weakest, fixed independent of the chart).
 *   - **Drik Bala** — aspectual strength (sum of friendly minus unfriendly
 *     aspects from the other grahas, weighted by orb).
 *
 * `total` is the sum of the six components; classical "minimum required"
 * thresholds vary per planet and are not enforced here — the caller decides
 * how to interpret the totals.
 *
 * The implementation is a *simplified* analytic model targeting ~5%
 * agreement with ProKerala / PyJHora reference calculators. The classical
 * Parashara model has many sub-cases (e.g. Ojha-Yugma, Trikon Bala,
 * Kendra Bala, Drekkana Bala for Sthana; Yuddha Bala for Chesta) that
 * introduce small additive contributions; the simplified model exposes
 * the dominant terms and is documented per-component in
 * [src/jyotish/shadbala.ts](src/jyotish/shadbala.ts).
 */
export interface PlanetShadbala {
  sthana: number;
  dig: number;
  kala: number;
  chesta: number;
  naisargika: number;
  drik: number;
  /** Sum of the six sub-strengths in Virupas. */
  total: number;
}

/** Shadbala for the 7 visible grahas (Rahu and Ketu have no classical Shadbala). */
export interface ShadbalaResult {
  Sun: PlanetShadbala;
  Moon: PlanetShadbala;
  Mars: PlanetShadbala;
  Mercury: PlanetShadbala;
  Jupiter: PlanetShadbala;
  Venus: PlanetShadbala;
  Saturn: PlanetShadbala;
}

// ── Kaal Sarp + Pitru Doshas ──────────────────────────

/**
 * Kaal Sarp Dosha — every visible planet (Sun..Saturn) lies between Rahu
 * and Ketu on the same side of the nodal axis. There are 12 named subtypes,
 * one per Rahu-house axis (BPHS, Brihat Samhita commentaries).
 */
export type KaalSarpSubtype =
  | 'anant' | 'kulik' | 'vasuki' | 'shankhpal'
  | 'padma' | 'mahapadma' | 'takshak' | 'karkotak'
  | 'shankhachud' | 'ghatak' | 'vishdhar' | 'sheshnag';

export interface KaalSarpDoshaInfo {
  /** True only when all 7 visible planets are between Rahu and Ketu. */
  afflicted: boolean;
  /** Subtype name, set when `afflicted` is true. */
  subtype: KaalSarpSubtype | null;
  /** Whether the dosha is *paritha* — partial — i.e. one planet outside the axis. */
  partial: boolean;
  /** Houses of Rahu and Ketu (1..12). */
  rahuHouse: number;
  ketuHouse: number;
}

/**
 * Pitru Dosha — affliction by ancestors. Triggered by Sun + Rahu/Ketu
 * conjunction in the same house, OR Sun + Saturn conjunction in the 9th
 * house. Several other classical rules (Sun debilitated in 9th, etc.) are
 * not folded in here — the two highest-frequency triggers are surfaced.
 */
export interface PitruDoshaInfo {
  afflicted: boolean;
  /** Reasons the dosha was flagged; empty when `afflicted` is false. */
  reasons: string[];
}

// ── Ashtakavarga ──────────────────────────────────────

/**
 * Per-receiver Bhinnashtaka grid: 12 cells (one per rashi, 0 = Mesha …
 * 11 = Meena), each holding the count of bindus contributed to that rashi
 * by all 8 contributors (the 7 visible grahas + Lagna). Range 0..8 per cell.
 */
export type BhinnashtakaGrid = number[];

/**
 * Ashtakavarga result — per-graha Bhinnashtaka grids and the summed
 * Sarvashtaka grid. Computed per BPHS Ch. 66.
 *
 *   - **Bhinnashtaka** — for each receiver graha (Sun..Saturn), a 12-cell
 *     grid of bindu counts (0..8 per cell). Sum across the 12 cells of
 *     receiver G is invariant: Sun=47, Moon=49, Mars=39, Mercury=54,
 *     Jupiter=56, Venus=52, Saturn=39 (per the canonical BPHS table).
 *   - **Sarvashtaka** — the cell-wise sum of the 7 Bhinnashtaka grids.
 *     12 cells, 0..56 per cell, total 336 across all cells.
 *   - **reduced** (only when `{ reductions: true }` is requested) —
 *     the Trikona-and-Ekadhipatya-Sodhana-reduced grids per BPHS Ch. 67.
 *     Reduced cell totals are ≤ unreduced.
 *
 * Rahu and Ketu are not included — Ashtakavarga in the classical scheme
 * applies to the 7 visible grahas only.
 */
export interface AshtakavargaResult {
  /** 12-cell Sarvashtaka grid (sum of 7 Bhinnashtakas). Range 0..56. */
  sarvashtaka: BhinnashtakaGrid;
  /** Per-receiver Bhinnashtaka grids. Each is 12 cells. */
  bhinnashtaka: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, BhinnashtakaGrid>;
  /** Reduced grids (Trikona + Ekadhipatya Sodhana per BPHS Ch. 67). */
  reduced?: {
    sarvashtaka: BhinnashtakaGrid;
    bhinnashtaka: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, BhinnashtakaGrid>;
  };
}

// ── Yogas (named classical combinations) ──────────────

/**
 * Classification of a named yoga by its general flavor:
 *
 *   - **mahapurusha** — Pancha Mahapurusha (Ruchaka, Bhadra, Hamsa, Malavya,
 *     Sasha): one of Mars/Mercury/Jupiter/Venus/Saturn in own/exalted in a
 *     kendra.
 *   - **lunar** — yogas read from the Moon's environment (Gajakesari,
 *     Sunapha, Anapha, Durudhura, Kemadruma).
 *   - **solar** — yogas read from the Sun's environment (Budha-Aditya,
 *     Veshi, Vasi, Ubhayachari).
 *   - **raja** — kingship / status combinations (kendra-trikona lord
 *     conjunctions, Dharma-Karmadhipati, Vipareeta Raja, Lakshmi).
 *   - **dhana** — wealth combinations (2nd–11th, 5th–9th, Vasumati).
 *   - **special** — Vargottama, Yogakaraka and other lagna-conditional
 *     classifications.
 *   - **cancellation** — Neecha Bhanga and other dosha-cancellation rules.
 *   - **negative** — Daridra and other malefic combinations.
 */
export type YogaType =
  | 'mahapurusha'
  | 'lunar'
  | 'solar'
  | 'raja'
  | 'dhana'
  | 'special'
  | 'cancellation'
  | 'negative';

/**
 * Names of the named yogas detected by `computeYogas`. The catalog is fixed
 * at ~25 entries — adding a new yoga is a data-only change in
 * `src/jyotish/yogasCatalog.ts`. Names are English/transliterated proper
 * nouns and intentionally **not** locale-resolved.
 */
export type YogaName =
  | 'Ruchaka'
  | 'Bhadra'
  | 'Hamsa'
  | 'Malavya'
  | 'Sasha'
  | 'Gajakesari'
  | 'Sunapha'
  | 'Anapha'
  | 'Durudhura'
  | 'Kemadruma'
  | 'Budha-Aditya'
  | 'Veshi'
  | 'Vasi'
  | 'Ubhayachari'
  | 'Raja Yoga'
  | 'Dharma-Karmadhipati'
  | 'Vipareeta Raja Yoga'
  | 'Lakshmi Yoga'
  | 'Dhana Yoga (2-11)'
  | 'Dhana Yoga (5-9)'
  | 'Vasumati Yoga'
  | 'Vargottama'
  | 'Yogakaraka'
  | 'Neecha Bhanga'
  | 'Daridra Yoga';

/**
 * One detected yoga in a natal chart.
 *
 *   - `name` — canonical English/transliterated name from the fixed catalog.
 *   - `type` — broad classification (see {@link YogaType}).
 *   - `reasons` — 1-or-more human-readable strings describing *why* the
 *     yoga matched (e.g. `'Jupiter in 4th from Moon (kendra)'`). For
 *     yogas with multiple BPHS sub-rules (e.g. Neecha Bhanga) every
 *     triggered sub-rule contributes its own entry.
 *   - `bhanga` — optional classical cancellation annotation. Present
 *     only on yogas that carry a multi-source-cited bhanga rule:
 *       - **Pancha Mahapurusha** (Ruchaka / Bhadra / Hamsa / Malavya /
 *         Sasha): Sun-or-Moon conjunction with the yoga-causing planet.
 *       - **Gajakesari**: Jupiter combust within 10° of Sun, or Jupiter
 *         debilitated in Capricorn.
 *     Yogas without a catalog bhanga rule (Raja Yoga, Lakshmi Yoga,
 *     Dhana Yoga, etc.) omit the field entirely — see
 *     `notes/phase34c-research.md` §4 for the BPHS Vipareeta-Raja-Yoga
 *     conflict that motivates the Raja Yoga deferral. The positive
 *     `name` detection is **independent** of `bhanga` — a yoga can be
 *     both detected and bhanga-cancelled (`bhanga.applies: true`);
 *     callers choose whether to honor the annotation.
 */
export interface Yoga {
  name: YogaName;
  type: YogaType;
  reasons: string[];
  bhanga?: { applies: boolean; reasons: string[] };
}

// ── Jaimini Karakas ───────────────────────────────────

/**
 * The 7 Chara (movable) Karakas in the Parashara variant. Order is the
 * canonical Atmakaraka → Darakaraka ranking — index 0 is the karaka
 * derived from the highest degree-in-rashi, index 6 from the lowest.
 *
 *   - **Atmakaraka**     — significator of the Self.
 *   - **Amatyakaraka**   — minister / mind / livelihood.
 *   - **Bhratrukaraka**  — siblings, courage.
 *   - **Matrukaraka**    — mother, conveyance.
 *   - **Putrakaraka**    — children, intellect.
 *   - **Gnatikaraka**    — relatives, struggle.
 *   - **Darakaraka**     — spouse.
 */
export type KarakaName =
  | 'Atmakaraka'
  | 'Amatyakaraka'
  | 'Bhratrukaraka'
  | 'Matrukaraka'
  | 'Putrakaraka'
  | 'Gnatikaraka'
  | 'Darakaraka';

/**
 * Mapping from each of the 7 Karaka roles to the graha that fills it for
 * a given chart. Uses the 7-Karaka Parashara variant — the 7 visible
 * grahas (Sun..Saturn) ranked by descending degree-in-rashi. The reversed-
 * Rahu 8-Karaka Jaimini variant uses {@link Jaimini8Karakas} instead.
 */
export type JaiminiKarakas = Record<KarakaName, GrahaName>;

/**
 * 8 Karaka role names for the Jaimini variant. Extends the Parashara
 * 7-role set with **Pitrukaraka** (father) inserted at position 5 of
 * the canonical ordering:
 *
 *     Atmakaraka → Amatyakaraka → Bhratrukaraka → Matrukaraka →
 *     **Pitrukaraka** → Putrakaraka → Gnatikaraka → Darakaraka
 *
 * **Source.** Jaimini *Upadesa Sutras* Ch.1 First Foot (Adhikaar Sutras)
 * V.10; Sanjay Rath, *Jaimini Maharishi's Upadesa Sutras* (Sagar
 * Publications). Multi-pandit consensus across Sanjay Rath / Komilla
 * Sutton / Sarvatobhadra / Wikipedia traditions; K.N. Rao + Narasimha
 * Rao traditions retain the 7-role Parashara variant via
 * {@link KarakaName}.
 */
export type Karaka8Name = KarakaName | 'Pitrukaraka';

/**
 * Mapping from each of the 8 Karaka roles to the graha that fills it for
 * a given chart. Uses the 8-Karaka Jaimini variant — the 7 visible
 * grahas (Sun..Saturn) **plus Rahu** ranked by descending effective
 * degree-in-rashi, where Rahu's effective degree is `30 − degreeInRashi`
 * (reversed because Rahu is permanently retrograde).
 *
 * Tie-break extends the canonical Parashara order one slot:
 *
 *     Sun > Moon > Mars > Mercury > Jupiter > Venus > Saturn > Rahu
 *
 * Returned by `computeJaiminiKarakas(chart, { variant: '8-jaimini' })`.
 * The default {@link JaiminiKarakas} (no options arg) returns the 7-role
 * Parashara variant unchanged.
 */
export type Jaimini8Karakas = Record<Karaka8Name, GrahaName>;

// ── Bhava Bala (House strength) ───────────────────────

/**
 * Four-source strength contributions for one bhava (1..12), expressed in
 * **Virupa units** (1 Rupa = 60 Virupas). BPHS Ch. 27 (second half) decomposes
 * Bhava Bala into:
 *
 *   - **bhavadhipati** — total Shadbala of the rashi-lord of the bhava cusp.
 *     Reuses {@link PlanetShadbala} `total` from `computeShadbala`.
 *   - **dik** — directional strength of the bhava itself, from a fixed
 *     12-cell table keyed by bhava number. Simplified cardinal-anchor
 *     scheme (not the canonical BPHS Ch. 27 table); see `BHAVA_DIK_VALUES`
 *     in [src/jyotish/shadbala.ts](src/jyotish/shadbala.ts). Independent
 *     of the chart.
 *   - **drik** — net aspectual strength on the bhava cusp from the 7 visible
 *     grahas. Each aspect contributes ± a fraction of 60 V using the same
 *     drishti weights as `PlanetShadbala.drik` (full 7th = 1, Mars 4/8 = ½,
 *     Jupiter 5/9 = ¾, Saturn 3/10 = ¼); benefics add, malefics subtract.
 *     Clamped to ≥ 0.
 *   - **sthana** — sum of {@link PlanetShadbala} natural strength
 *     (Naisargika) for grahas occupying the bhava: positive for benefics
 *     (Moon, Mercury, Jupiter, Venus), negative for malefics (Sun, Mars,
 *     Saturn). Rahu and Ketu are excluded.
 *
 * `total` is the arithmetic sum of the four sub-strengths.
 */
export interface BhavaBalaPerHouse {
  bhavadhipati: number;
  dik: number;
  drik: number;
  sthana: number;
  total: number;
}

/**
 * Bhava Bala — four-source house strength for the 12 bhavas of a natal
 * chart, BPHS Ch. 27. Implemented as an additive companion to
 * {@link ShadbalaResult}; both share the natural-strength table, the
 * benefic/malefic classification, and the drishti-weight table from
 * `computeShadbala`.
 */
export interface BhavaBalaResult {
  /** 12 entries in bhava order (index 0 = bhava 1 = lagna). */
  houses: BhavaBalaPerHouse[];
}

// ── Arudha Lagna + 12 Arudha Padas ────────────────────

/**
 * One Arudha pada — the **image / reflection** of a bhava in the chart.
 *
 * Per Jaimini *Upadesa Sutras* Ch. 1: "the lord (of the bhava) is counted
 * from the bhava as many houses as the bhava is from the lord". With two
 * canonical exceptions to avoid the Arudha collapsing onto the bhava
 * itself or its 7th:
 *
 *   - If `D == 1` (lord is in its own bhava) → Arudha = 10th from lord.
 *   - If `D == 7` (lord is in 7th from bhava) → Arudha = 4th from lord.
 *
 * Bhava 1's Arudha is **Arudha Lagna (AL)** — the social / public-facing
 * image of the native, distinct from Lagna (the inner / soul-rooted self).
 */
export interface Arudha {
  /** Bhava number 1..12 whose Arudha this is. */
  bhava: number;
  /** Rashi (0..11) the Arudha pada falls in. */
  arudhaRashi: number;
  /** Localized rashi name (`en` or `hi`) — same locale as the source chart. */
  arudhaRashiName: string;
  /** Rashi-lord of `arudhaRashi` — one of the 7 visible grahas. */
  arudhaLord: Exclude<GrahaName, 'Rahu' | 'Ketu'>;
}

// ── Special Lagnas (Hora / Ghati / Bhava / Sripati) ───

/**
 * Special-lagna kind. Each lagna advances at a different rate from
 * sunrise; together they form the classical timing-sensitive frame
 * around the natal ascendant:
 *
 *   - `'hora'`   — advances 1 rashi per 2 hours (15°/h).
 *   - `'ghati'`  — advances 1 rashi per ghatika (24 min) → 75°/h.
 *   - `'bhava'` — advances 1 rashi per 5 ghatikas (2 hours) → 15°/h.
 *     Mathematically identical to Hora Lagna in advance-rate but the two
 *     are conceptually distinct anchors in classical practice.
 *   - `'sripati'` — Sripati cuspal lagna; classical Indian variant of
 *     Placidus (currently identical to the Placidus-KP cusp 1 in the
 *     simplified mapping).
 */
export type SpecialLagnaKind = 'hora' | 'ghati' | 'bhava' | 'sripati';

// ── Upagrahas (sub-grahas) ─────────────────────────────

/**
 * Sub-graha (upagraha) sensitive points used in Vedic and Tajik
 * analysis. The 7 upagrahas carried by `Upagrahas`:
 *
 *   - **Gulika** — rising longitude at the *start* of Saturn's segment
 *     (1/8 of day or night, weekday-rotated). Day birth: divide
 *     sunrise→sunset into 8 equal arcs; the segment ruled by the day-
 *     lord begins, then Sun → Moon → Mars → Mercury → Jupiter → Venus →
 *     Saturn rotation; the Saturn segment marks Gulika's onset. Night
 *     birth: divide sunset→next-sunrise into 8; rotation starts from
 *     the planet 5th from the day-lord (per Phaladeepika Ch. 5).
 *   - **Mandi** — Gulika's variant computed at the *midpoint* of
 *     Saturn's segment.
 *   - **Dhuma** — Sun + 133°20'.
 *   - **Vyatipata** — 360° − Dhuma.
 *   - **Parivesha** — Vyatipata + 180°.
 *   - **Indrachapa** — 360° − Parivesha.
 *   - **Upaketu** — Indrachapa + 16°40'.
 *
 * Sources: BPHS Ch. 5; Sanjay Rath *Brihat Nakshatra* (upagraha section);
 * Phaladeepika Ch. 5.
 */
export interface UpagrahaPosition {
  /** Sidereal longitude in degrees, [0, 360). */
  longitude: number;
  /** Rashi index 0..11 (Mesha … Meena). */
  rashi: number;
  /** Localized rashi name (`en` or `hi`). */
  rashiName: string;
  /** Whole-sign house 1..12 from the natal lagna. */
  house: number;
}

/** All 7 upagrahas at a given instant. */
export interface Upagrahas {
  /** Rising longitude at the start of Saturn's day/night segment. */
  gulika: UpagrahaPosition;
  /** Rising longitude at the midpoint of Saturn's day/night segment. */
  mandi: UpagrahaPosition;
  /** `Sun + 133°20'` mod 360. */
  dhuma: UpagrahaPosition;
  /** `360° − Dhuma`. */
  vyatipata: UpagrahaPosition;
  /** `Vyatipata + 180°` mod 360. */
  parivesha: UpagrahaPosition;
  /** `360° − Parivesha`. */
  indrachapa: UpagrahaPosition;
  /** `Indrachapa + 16°40'` mod 360. */
  upaketu: UpagrahaPosition;
}

// ── Argala (Jaimini intervention) ─────────────────────

/**
 * Per-bhava Argala (intervention / help) and Virodhargala (counter-
 * intervention) in the Jaimini sign-based scheme.
 *
 * Per Jaimini *Upadesa Sutras* Ch. 1 and BPHS Ch. 51: planets in the
 * **2nd, 4th, and 11th** from a bhava form *Argala* (positive influence
 * on the bhava); planets in the **3rd, 10th, and 12th** form
 * *Virodhargala* (negation). The 5th from a bhava ("primary Argala")
 * and the 9th ("primary Virodhargala") are sometimes added to the
 * respective lists in extended classical schemes; the simplified BPHS
 * Ch. 51 form pinned here uses the 2/4/11 vs 3/10/12 split exclusively.
 *
 * A planet in any chart contributes to **exactly 6 of the 12 bhavas**
 * (3 Argala + 3 Virodhargala) — the structural invariant the test
 * suite asserts.
 */
export interface ArgalaPerBhava {
  /** Bhava number 1..12. */
  bhava: number;
  /** Planets that form Argala on this bhava (occupants of 2nd / 4th / 11th from bhava). */
  argala: PlanetPlacement[];
  /** Planets that form Virodhargala (counter) — occupants of 3rd / 10th / 12th from bhava. */
  virodhargala: PlanetPlacement[];
  /**
   * **Trikonargala** (the 5/9 trine Argala variant, multi-source classical
   * Jaimini concept). Populated only when `computeArgala` is called with
   * `{ includeTrikonargala: true }`.
   *
   * - `sources` — planets in the **5th from this bhava** form the
   *   secondary trine Argala (positive sign-based influence on the bhava).
   * - `virodhakas` — planets in the **9th from this bhava** counter
   *   the Trikonargala (Trikona Virodhargala).
   *
   * **Ketu reversal**. For Ketu specifically, the role is swapped: Ketu in
   * 5th-from-bhava counts as a *virodhaka* (not a source), and Ketu in
   * 9th-from-bhava counts as a *source*. Three independent classical
   * sources attest this Ketu-specific reversal in the trine context
   * (sutramritam.blogspot.com, anandamoyee.home.blog, Sanjay Rath via
   * srath.com — the latter as a generalised "Argala reversed from Ketu"
   * rule).
   *
   * Default callers (no options arg) receive `trikona === undefined` to
   * preserve byte-for-byte backwards compatibility with pre-Phase-34e
   * `ArgalaPerBhava` consumers.
   */
  trikona?: {
    /** Planets in the 5th from bhava (or 9th from bhava if planet is Ketu). */
    sources: PlanetPlacement[];
    /** Planets in the 9th from bhava (or 5th from bhava if planet is Ketu). */
    virodhakas: PlanetPlacement[];
  };
}
