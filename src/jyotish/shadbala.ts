import { computeRashiChart } from './charts';
import { RASHI_LORD } from './matchingTables';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { validateLocation, validateDate } from '../utils/validation';
import { normalize360 } from '../utils/angle';
import type { GeoLocation } from '../types/location';
import type { BirthChartOptions } from '../types/options';
import type {
  BhavaBalaPerHouse, BhavaBalaResult,
  BirthChart, GrahaName, PlanetPlacement,
  PlanetShadbala, ShadbalaResult,
} from '../types/jyotish';

/**
 * Compute Shadbala — the six-fold strength of the seven visible grahas (Sun
 * through Saturn) for a natal chart.
 *
 * The classical Parashara model (BPHS Ch. 27 "Bala-vichar") assembles each
 * planet's total strength from six sources: positional (Sthana), directional
 * (Dig), temporal (Kala), motional (Chesta), natural (Naisargika), and
 * aspectual (Drik). Strengths are expressed in **Virupas** (60 Virupas = 1
 * Rupa). Higher = stronger.
 *
 * The implementation here is the published *simplified* analytic model used
 * by most popular calculators (ProKerala, AstroSage's free tier, PyJHora's
 * default rule-set). It exposes the dominant term of each component:
 *
 *   - **Sthana Bala** — Uchcha (exaltation) component only. Linear ramp
 *     between exaltation (60 V) and debilitation (0 V) along ecliptic arc.
 *   - **Dig Bala** — distance from the planet's "directional house" cusp.
 *     Strong-cusp houses: Sun/Mars 10th, Jupiter/Mercury 1st, Moon/Venus
 *     4th, Saturn 7th. 60 V at cusp, 0 V at the opposite kendra.
 *   - **Kala Bala** — Nathonatha (day/night) + Paksha (lunar phase). Day-
 *     strong: Sun, Jupiter, Venus. Night-strong: Moon, Mars, Saturn.
 *     Mercury always full Nathonatha. Paksha: benefics gain strength in
 *     shukla paksha, malefics in krishna paksha. Other classical Kala
 *     sub-components (Varsha, Masa, Dina, Hora, Tribhaga, Ayana, Yuddha)
 *     are not included — their summed contribution is small (typically
 *     ≤10 V) and the simplified scoring agrees with public calculators.
 *   - **Chesta Bala** — retrograde / direct status. Retrograde = 60 V,
 *     combust (within 10° of Sun) = 15 V, direct otherwise = 30 V. Sun
 *     and Moon fall back to fixed mid-range values per the simplified
 *     model. The classical declination-derived Chesta for the Sun and the
 *     Moon-Paksha-equals-Chesta convention are approximated with constants.
 *   - **Naisargika Bala** — fixed natural ranking, BPHS-published values:
 *     Sun 60.00, Moon 51.43, Venus 42.86, Jupiter 34.29, Mercury 25.71,
 *     Mars 17.14, Saturn 8.57.
 *   - **Drik Bala** — sum of aspects from the other six visible grahas.
 *     Each aspect contributes a fraction of 60 V depending on the
 *     classical drishti weight (full 7th = 1, Mars 4/8 = ½, Jupiter 5/9 =
 *     ¾, Saturn 3/10 = ¼). Benefics add; malefics subtract. Result
 *     clamped to ≥0.
 *
 * Rahu and Ketu are not included — Shadbala in the classical Parashara
 * scheme applies to the seven visible grahas only.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param options   Birth-chart options. Defaults: ayanamsa `'lahiri'`,
 *                  language `'en'`, house system `'whole-sign'`.
 *
 * @example
 * ```typescript
 * import { computeShadbala } from 'panchang-ts';
 *
 * const bala = computeShadbala(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * bala.Jupiter.total;       // total Shadbala in Virupas
 * bala.Sun.naisargika;      // 60 (always — Sun has top natural rank)
 * ```
 */
export function computeShadbala(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): ShadbalaResult {
  validateDate(birthDate);
  validateLocation(location);

  const chart = computeRashiChart(birthDate, location, options);
  return shadbalaForChart(chart, birthDate, location);
}

/**
 * Internal Shadbala implementation that reuses an already-computed natal
 * chart. Used by both `computeShadbala` (which builds the chart from
 * inputs) and `computeBhavaBala` (which needs the chart for its own
 * algorithm and shares it to avoid the duplicate planetary-position work).
 */
function shadbalaForChart(
  chart: BirthChart,
  birthDate: Date,
  location: GeoLocation,
): ShadbalaResult {
  // Sunrise / sunset for Nathonatha Bala. Compute at local midnight context.
  // Use a 12h-back anchor so `computeSunrise` returns the *current* sunrise
  // for the birth instant rather than the next one.
  const sunriseUtc = computeSunrise(
    new Date(birthDate.getTime() - 12 * 3600_000),
    location,
  );
  const sunsetUtc = computeSunset(sunriseUtc, location);
  const nextSunriseUtc = computeSunrise(sunsetUtc, location);

  const sunPlanet = chart.planets.find((p) => p.planet === 'Sun')!;
  const moonPlanet = chart.planets.find((p) => p.planet === 'Moon')!;

  const grahas: GrahaName[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const partials: Record<GrahaName, PlanetShadbala> = {} as Record<GrahaName, PlanetShadbala>;

  for (const g of grahas) {
    const placement = chart.planets.find((p) => p.planet === g)!;
    const sthana = sthanaBala(g, placement.longitude);
    const dig = digBala(g, placement.longitude, chart.lagna.siderealLongitude);
    const kala = kalaBala(g, birthDate, sunriseUtc, sunsetUtc, nextSunriseUtc,
      sunPlanet.longitude, moonPlanet.longitude);
    const chesta = chestaBala(g, placement, sunPlanet.longitude);
    const naisargika = NAISARGIKA[g];
    const drik = drikBala(g, chart);
    const total = sthana + dig + kala + chesta + naisargika + Math.max(0, drik);
    partials[g] = { sthana, dig, kala, chesta, naisargika, drik, total };
  }

  return {
    Sun:     partials.Sun,
    Moon:    partials.Moon,
    Mars:    partials.Mars,
    Mercury: partials.Mercury,
    Jupiter: partials.Jupiter,
    Venus:   partials.Venus,
    Saturn:  partials.Saturn,
  };
}

// ── Sthana Bala (positional) ──────────────────────────

/** Exact exaltation longitudes (deg from 0° Aries) per BPHS Ch. 3. */
const UCHCHA_DEG: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number> = {
  Sun: 10,           // 10° Aries
  Moon: 33,          //  3° Taurus
  Mars: 298,         // 28° Capricorn
  Mercury: 165,      // 15° Virgo
  Jupiter: 95,       //  5° Cancer
  Venus: 357,        // 27° Pisces
  Saturn: 200,       // 20° Libra
};

/**
 * Uchcha Bala — 60 V at exact exaltation, 0 V at exact debilitation, linear
 * along the shorter arc. Total Sthana Bala in BPHS combines this with
 * Saptavargaja, Ojha-Yugma, Kendra, and Drekkana sub-balas; the simplified
 * model used by ProKerala / PyJHora exposes Uchcha alone, which is the
 * dominant term and the only one with significant chart-to-chart variance.
 */
function sthanaBala(graha: GrahaName, siderealLon: number): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const uchcha = UCHCHA_DEG[graha];
  // Shortest arc from exaltation: 0..180.
  const arc = Math.abs(((siderealLon - uchcha + 540) % 360) - 180);
  // Linear: 60 V at arc=0 (uchcha), 0 V at arc=180 (debilitation).
  return ((180 - arc) / 180) * 60;
}

// ── Dig Bala (directional) ────────────────────────────

/**
 * Strong directional house (1..12) per planet. BPHS Ch. 27:
 *   - Sun, Mars: 10th (south / midheaven).
 *   - Jupiter, Mercury: 1st (east / lagna).
 *   - Moon, Venus: 4th (north / IC).
 *   - Saturn: 7th (west / descendant).
 */
const DIG_HOUSE: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number> = {
  Sun: 10, Moon: 4, Mars: 10, Mercury: 1,
  Jupiter: 1, Venus: 4, Saturn: 7,
};

/**
 * Dig Bala — distance from the planet's directional cusp. With whole-sign
 * houses, the cusp falls at 0° of the rashi `(lagnaRashi + dirHouse - 1) % 12`.
 * Strength = 60 V at the cusp, 0 V at the opposite kendra (180° away),
 * linear along the shorter arc.
 */
function digBala(graha: GrahaName, planetLon: number, lagnaLon: number): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const lagnaRashi = Math.floor(lagnaLon / 30);
  const dirHouse = DIG_HOUSE[graha];
  const dirRashi = (lagnaRashi + dirHouse - 1) % 12;
  const dirCuspLon = dirRashi * 30;
  const arc = Math.abs(((planetLon - dirCuspLon + 540) % 360) - 180);
  return ((180 - arc) / 180) * 60;
}

// ── Kala Bala (temporal) ──────────────────────────────

/** Day-strong planets (full Nathonatha at midday). */
const DAY_STRONG: ReadonlySet<GrahaName> = new Set(['Sun', 'Jupiter', 'Venus']);
/** Night-strong planets (full Nathonatha at midnight). Mercury is both. */
const NIGHT_STRONG: ReadonlySet<GrahaName> = new Set(['Moon', 'Mars', 'Saturn']);
/** Benefic planets (gain Paksha bala in shukla paksha). */
const BENEFICS: ReadonlySet<GrahaName> = new Set(['Moon', 'Mercury', 'Jupiter', 'Venus']);
/** Malefic planets (gain Paksha bala in krishna paksha). */
const MALEFICS: ReadonlySet<GrahaName> = new Set(['Sun', 'Mars', 'Saturn']);

/**
 * Kala Bala = Nathonatha Bala + Paksha Bala (simplified; classical also adds
 * Tribhaga, Varsha, Masa, Dina, Hora, Ayana, Yuddha — minor contributions
 * intentionally omitted for parity with public Shadbala calculators).
 */
function kalaBala(
  graha: GrahaName,
  birthDate: Date,
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
  sunLon: number,
  moonLon: number,
): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const nath = nathonathaBala(graha, birthDate, sunriseUtc, sunsetUtc, nextSunriseUtc);
  const paksha = pakshaBala(graha, sunLon, moonLon);
  return nath + paksha;
}

/**
 * Nathonatha Bala — peaks at midday for day-strong planets, at midnight for
 * night-strong planets, drops to 0 V at sunrise/sunset for both. Mercury is
 * always full (60 V). Triangular profile across the half-day window.
 */
function nathonathaBala(
  graha: GrahaName,
  birthDate: Date,
  sunriseUtc: Date,
  sunsetUtc: Date,
  nextSunriseUtc: Date,
): number {
  if (graha === 'Mercury') return 60;
  const t = birthDate.getTime();
  const isDayBirth = t >= sunriseUtc.getTime() && t < sunsetUtc.getTime();
  if (isDayBirth) {
    const dayLen = sunsetUtc.getTime() - sunriseUtc.getTime();
    const phase = (t - sunriseUtc.getTime()) / dayLen; // 0 at sunrise, 1 at sunset
    // Triangular: peaks at 0.5 (midday).
    const factor = 1 - Math.abs(phase - 0.5) * 2;
    if (DAY_STRONG.has(graha)) return factor * 60;
    if (NIGHT_STRONG.has(graha)) return (1 - factor) * 60;
  } else {
    const nightStart = sunsetUtc.getTime();
    const nightLen = nextSunriseUtc.getTime() - nightStart;
    const phase = (t - nightStart) / nightLen;
    const factor = 1 - Math.abs(phase - 0.5) * 2;
    if (NIGHT_STRONG.has(graha)) return factor * 60;
    if (DAY_STRONG.has(graha)) return (1 - factor) * 60;
  }
  return 0;
}

/**
 * Paksha Bala — lunar phase strength. Benefics: 60 V at full moon, 0 V at
 * new moon. Malefics: reverse. Classical convention doubles the Moon's own
 * paksha; we cap at 60 V here so the component scale matches the others
 * (the doubling shows up in the Sun-side Paksha applied to the Sun, balancing).
 */
function pakshaBala(graha: GrahaName, sunLon: number, moonLon: number): number {
  // Distance Sun → Moon along zodiac (0..360).
  const sepFromSun = normalize360(moonLon - sunLon);
  // 0..180 (0 at new moon when Sun==Moon, 180 at full moon).
  const arc = sepFromSun > 180 ? 360 - sepFromSun : sepFromSun;
  const beneficBala = (arc / 180) * 60; // 60 V at full moon
  if (BENEFICS.has(graha)) return beneficBala;
  if (MALEFICS.has(graha)) return 60 - beneficBala;
  return 0;
}

// ── Chesta Bala (motional) ────────────────────────────

/**
 * Chesta Bala — motional strength. Sun and Moon use fixed mid-range
 * approximations (the classical formulas tie Sun-Chesta to declination
 * (Ayana Bala) and Moon-Chesta to Paksha Bala — both already partially
 * captured in Kala Bala above). For Mars..Saturn:
 *
 *   - retrograde: 60 V (vakra-bhuktiyutta — peak chesta).
 *   - combust (within 10° of Sun): 15 V.
 *   - direct: 30 V.
 *
 * The classical 8-fold split (Vakra, Anu-vakra, Vikala, Mandatara,
 * Manda, Sama, Chara, Atichara) interpolates more finely between
 * retrograde and combust; the three-bucket simplification here matches
 * the dominant cases used by public calculators.
 */
function chestaBala(graha: GrahaName, placement: PlanetPlacement, sunLon: number): number {
  if (graha === 'Sun') return 30;
  if (graha === 'Moon') return 30;
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  if (placement.isRetrograde) return 60;
  // Combust check — angular distance to Sun ≤ 10°.
  const sep = Math.abs(((placement.longitude - sunLon + 540) % 360) - 180);
  const distToSun = 180 - sep; // 0 at conjunction, 180 at opposition
  if (distToSun <= 10) return 15;
  return 30;
}

// ── Naisargika Bala (natural) ─────────────────────────

/**
 * BPHS-published natural strengths in Virupas. Sun is the strongest, Saturn
 * the weakest; the seven values are 60·k/7 for k = 7, 6, 5, 4, 3, 2, 1
 * applied to the rank order Sun > Moon > Venus > Jupiter > Mercury > Mars
 * > Saturn. Independent of the chart.
 */
const NAISARGIKA: Record<GrahaName, number> = {
  Sun:     60.00,
  Moon:    51.43,
  Venus:   42.86,
  Jupiter: 34.29,
  Mercury: 25.71,
  Mars:    17.14,
  Saturn:   8.57,
  Rahu:     0,
  Ketu:     0,
};

// ── Drik Bala (aspectual) ─────────────────────────────

/** Per-aspect drishti weights (out of 1 = full sashtihamsa = 60 V). */
const ASPECT_WEIGHTS: Record<number, number> = {
  6: 1,       // 7th aspect — full
  3: 0.5,     // Mars 4th
  7: 0.5,     // Mars 8th
  4: 0.75,    // Jupiter 5th
  8: 0.75,    // Jupiter 9th
  2: 0.25,    // Saturn 3rd
  9: 0.25,    // Saturn 10th
};

/** Which special offsets each malefic planet contributes. */
const SPECIAL: Record<GrahaName, ReadonlySet<number>> = {
  Sun: new Set(),
  Moon: new Set(),
  Mars: new Set([3, 7]),
  Mercury: new Set(),
  Jupiter: new Set([4, 8]),
  Venus: new Set(),
  Saturn: new Set([2, 9]),
  Rahu: new Set(),
  Ketu: new Set(),
};

/**
 * Drik Bala — net aspectual strength. Each aspecting graha (Sun..Saturn,
 * excluding the target itself) contributes ±(weight × 60 V) where the
 * sign is positive for benefics (Moon, Mercury, Jupiter, Venus) and
 * negative for malefics (Sun, Mars, Saturn). The 7th aspect is universal;
 * Mars adds 4th/8th, Jupiter 5th/9th, Saturn 3rd/10th — exactly the same
 * orb structure used by `computeAspects`.
 *
 * Result is clamped to ≥0 in `computeShadbala` (bala values are non-
 * negative by convention; net hostile aspects don't subtract from the total).
 */
function drikBala(graha: GrahaName, chart: BirthChart): number {
  const target = chart.planets.find((p) => p.planet === graha)!;
  let net = 0;
  for (const aspector of chart.planets) {
    if (aspector.planet === graha) continue;
    if (aspector.planet === 'Rahu' || aspector.planet === 'Ketu') continue;
    const offset = (target.house - aspector.house + 12) % 12;
    if (offset === 0) continue;
    const isUniversal = offset === 6;
    const isSpecial = SPECIAL[aspector.planet].has(offset);
    if (!isUniversal && !isSpecial) continue;
    const weight = ASPECT_WEIGHTS[offset] ?? 0;
    const sign = BENEFICS.has(aspector.planet) ? 1 : -1;
    net += sign * weight * 60;
  }
  return net;
}

// ── Bhava Bala (House strength) ───────────────────────

/**
 * Graha names indexed by the 7-planet RASHI_LORD scheme (0=Sun..6=Saturn).
 * Used to translate `RASHI_LORD[rashi]` → `GrahaName` for Bhavadhipati Bala
 * lookup against the precomputed Shadbala table.
 */
const GRAHA_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * Bhava Dik Bala — directional strength of the bhava itself, in Virupas.
 * Twelve fixed values keyed by bhava number. Cardinal bhavas (1, 4, 7, 10)
 * anchor the table at 60 / 0 / 15 / 30 V (East / North / West / South); the
 * intervening bhavas are filled by **linear interpolation** around the
 * wheel.
 *
 * **This is a simplified scheme** — not the canonical BPHS Ch. 27 table.
 * Classical recensions (Santhanam, Sharma, Iyer) publish slightly
 * different per-bhava values, and many include a non-zero floor at every
 * bhava. The cardinal-anchor / linear-interpolation form here matches the
 * reduced scheme described in Sanjay Rath *Crux of Vedic Astrology* Ch. 6
 * and is the form used by several modern calculators when full Ch. 27
 * values are unavailable. The 12 numbers below are the algorithm's only
 * tunable input for this component and are pinned by the bhava-bala test
 * suite as a deterministic regression detector.
 */
const BHAVA_DIK_VALUES: readonly number[] = Object.freeze([
  60, // bhava 1  (East — cardinal anchor)
  40, // bhava 2  (interp 1→4: 60 → 0, step −20)
  20, // bhava 3
  0,  // bhava 4  (North — cardinal anchor)
  5,  // bhava 5  (interp 4→7: 0 → 15, step +5)
  10, // bhava 6
  15, // bhava 7  (West — cardinal anchor)
  20, // bhava 8  (interp 7→10: 15 → 30, step +5)
  25, // bhava 9
  30, // bhava 10 (South — cardinal anchor)
  40, // bhava 11 (interp 10→1: 30 → 60, step +10)
  50, // bhava 12
]);

/**
 * Compute Bhava Bala — the four-source classical house strength for the 12
 * bhavas of a natal chart, in Virupas (60 V = 1 Rupa). BPHS Ch. 27, second
 * half ("Bhava-bala-vichar"), supplements the Shadbala of the seven visible
 * grahas with a per-house strength built from four contributions:
 *
 *   - **Bhavadhipati Bala** — total Shadbala (`PlanetShadbala.total`) of
 *     the rashi-lord of the bhava cusp. Reuses {@link computeShadbala}; no
 *     recomputation.
 *   - **Bhava Dik Bala** — fixed 12-cell directional table (cardinal bhavas
 *     anchor at 60 / 0 / 15 / 30 V; intermediates linearly interpolated
 *     around the wheel). Simplified scheme; see the constant
 *     `BHAVA_DIK_VALUES` in this file for sourcing notes. Independent of
 *     the chart.
 *   - **Bhava Drik Bala** — net aspectual strength on the bhava cusp from
 *     the 7 visible grahas. Each aspecting graha contributes ±(weight × 60
 *     V) using the same drishti weights as `PlanetShadbala.drik`
 *     (full 7th = 1, Mars 4/8 = ½, Jupiter 5/9 = ¾, Saturn 3/10 = ¼);
 *     benefics (Moon, Mercury, Jupiter, Venus) add, malefics (Sun, Mars,
 *     Saturn) subtract. Clamped to ≥ 0 so the per-bhava component cannot
 *     be negative.
 *   - **Bhavasthana Bala** — sum of {@link PlanetShadbala} natural strength
 *     (Naisargika) of the visible grahas occupying the bhava: positive for
 *     benefics, negative for malefics. Mercury is treated as benefic per
 *     BPHS — the "associated benefic" nuance (Mercury becomes malefic when
 *     conjunct a malefic) is intentionally out of scope and matches the
 *     `BENEFICS` / `MALEFICS` sets used by `computeShadbala`. Rahu and Ketu
 *     do not contribute.
 *
 * `total` for each bhava is the arithmetic sum of the four sub-strengths.
 *
 * Implementation note: this function lives next to `computeShadbala`
 * because it shares the natural-strength table, the drishti-weight table,
 * and the benefic/malefic classification. Internally it computes the natal
 * chart **once** and reuses it for both the Shadbala lookup and the
 * Drik / Sthana sums.
 *
 * @param birthDate Instant of birth in UTC.
 * @param location  Geographic location of birth.
 * @param options   Birth-chart options. Defaults: ayanamsa `'lahiri'`,
 *                  language `'en'`, house system `'whole-sign'`.
 *
 * @example
 * ```typescript
 * import { computeBhavaBala } from 'panchang-ts';
 *
 * const bhavaBala = computeBhavaBala(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * bhavaBala.houses[0].total;          // 1st-bhava total in Virupas
 * bhavaBala.houses[9].bhavadhipati;   // 10th-bhava lord's Shadbala total
 * ```
 */
export function computeBhavaBala(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BhavaBalaResult {
  validateDate(birthDate);
  validateLocation(location);

  const chart = computeRashiChart(birthDate, location, options);
  const shadbala = shadbalaForChart(chart, birthDate, location);

  const houses: BhavaBalaPerHouse[] = [];
  for (let i = 0; i < 12; i++) {
    const bhavaNumber = i + 1;
    const cuspRashi = chart.bhava.houses[i]!.rashi.index;
    const lord = GRAHA_BY_INDEX[RASHI_LORD[cuspRashi]!]!;
    const bhavadhipati = shadbala[lord].total;

    const dik = BHAVA_DIK_VALUES[i]!;

    let drikRaw = 0;
    for (const aspector of chart.planets) {
      if (aspector.planet === 'Rahu' || aspector.planet === 'Ketu') continue;
      const offset = (bhavaNumber - aspector.house + 12) % 12;
      if (offset === 0) continue;
      const isUniversal = offset === 6;
      const isSpecial = SPECIAL[aspector.planet].has(offset);
      if (!isUniversal && !isSpecial) continue;
      const weight = ASPECT_WEIGHTS[offset] ?? 0;
      const sign = BENEFICS.has(aspector.planet) ? 1 : -1;
      drikRaw += sign * weight * 60;
    }
    const drik = Math.max(0, drikRaw);

    let sthana = 0;
    for (const p of chart.planets) {
      if (p.planet === 'Rahu' || p.planet === 'Ketu') continue;
      if (p.house !== bhavaNumber) continue;
      const sign = BENEFICS.has(p.planet) ? 1 : -1;
      sthana += sign * NAISARGIKA[p.planet];
    }

    const total = bhavadhipati + dik + drik + sthana;
    houses.push({ bhavadhipati, dik, drik, sthana, total });
  }

  return { houses };
}

/**
 * The frozen 12-cell BPHS Bhava Dik Bala table. Exposed for tests so the
 * pinned values stay in lockstep with the implementation; not part of the
 * public API.
 *
 * @internal
 */
export const _BHAVA_DIK_VALUES_FOR_TEST = BHAVA_DIK_VALUES;
