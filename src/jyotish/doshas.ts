import type {
  BirthChart, MangalDoshaInfo,
  KaalSarpDoshaInfo, KaalSarpSubtype, PitruDoshaInfo,
} from '../types/jyotish';

/** Houses (1..12) where Mars classically afflicts the chart. */
const MANGAL_HOUSES: ReadonlySet<number> = new Set([1, 2, 4, 7, 8, 12]);

/** Mars's own and exalted rashis (cancel Mangal Dosha when Mars sits there). */
const MARS_OWN_RASHIS: ReadonlySet<number> = new Set([0, 7]); // Aries, Scorpio
const MARS_EXALTED_RASHI = 9; // Capricorn

/**
 * Compute Mangal Dosha (Manglik) status for a birth chart.
 *
 * Mars is checked from three classical reference points — lagna, Moon, and
 * Venus. Houses 1, 2, 4, 7, 8, 12 from any of the three flag affliction.
 * Cancellations applied: Mars in Aries / Scorpio (own) or Capricorn
 * (exalted). Other classical cancellations (mutual mangalik, planetary
 * aspect) are out of scope here.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`.
 *
 * @example
 * ```typescript
 * const chart = computeRashiChart(birthDate, location);
 * const mangal = computeMangalDosha(chart);
 * if (mangal.afflicted) console.log('Manglik:', mangal.cancellations);
 * ```
 */
export function computeMangalDosha(chart: BirthChart): MangalDoshaInfo {
  const mars = chart.planets.find((p) => p.planet === 'Mars')!;
  const moon = chart.planets.find((p) => p.planet === 'Moon')!;
  const venus = chart.planets.find((p) => p.planet === 'Venus')!;

  const marsRashi = mars.rashi.index;
  const houseFrom = (refRashi: number): number =>
    ((marsRashi - refRashi + 12) % 12) + 1;

  const fromLagnaHouse = houseFrom(chart.lagna.rashi.index);
  const fromMoonHouse = houseFrom(moon.rashi.index);
  const fromVenusHouse = houseFrom(venus.rashi.index);

  const fromLagnaAfflicted = MANGAL_HOUSES.has(fromLagnaHouse);
  const fromMoonAfflicted = MANGAL_HOUSES.has(fromMoonHouse);
  const fromVenusAfflicted = MANGAL_HOUSES.has(fromVenusHouse);

  let afflicted = fromLagnaAfflicted || fromMoonAfflicted || fromVenusAfflicted;
  const cancellations: string[] = [];

  if (afflicted) {
    if (MARS_OWN_RASHIS.has(marsRashi)) {
      cancellations.push(`Mars in own sign ${marsRashi === 0 ? 'Aries' : 'Scorpio'}`);
      afflicted = false;
    } else if (marsRashi === MARS_EXALTED_RASHI) {
      cancellations.push('Mars exalted in Capricorn');
      afflicted = false;
    }
  }

  return {
    afflicted,
    fromLagna: { afflicted: fromLagnaAfflicted, house: fromLagnaHouse },
    fromMoon: { afflicted: fromMoonAfflicted, house: fromMoonHouse },
    fromVenus: { afflicted: fromVenusAfflicted, house: fromVenusHouse },
    cancellations,
  };
}

// ── Kaal Sarp Dosha ───────────────────────────────────

/**
 * Subtype names by Rahu's house number (1..12). Each subtype is named after
 * a classical naga (serpent) and carries its own karmic flavor in the
 * literature.
 */
const KAAL_SARP_BY_RAHU_HOUSE: readonly KaalSarpSubtype[] = [
  'anant',       //  1 — Anant Kaal Sarp
  'kulik',       //  2 — Kulik
  'vasuki',      //  3 — Vasuki
  'shankhpal',   //  4 — Shankhpal
  'padma',       //  5 — Padma
  'mahapadma',   //  6 — Mahapadma
  'takshak',     //  7 — Takshak
  'karkotak',    //  8 — Karkotak
  'shankhachud', //  9 — Shankhachud
  'ghatak',      // 10 — Ghatak
  'vishdhar',    // 11 — Vishdhar
  'sheshnag',    // 12 — Sheshnag
];

/**
 * Compute Kaal Sarp Dosha — the classical affliction in which all seven
 * visible grahas (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn) lie
 * within a single 180° arc bounded by Rahu and Ketu.
 *
 * Two boundary conventions are tested:
 *
 *   1. **Forward arc** — all seven planet longitudes fall in `(rahuLon,
 *      rahuLon + 180°)` modulo 360°.
 *   2. **Backward arc** — all seven fall in `(rahuLon + 180°, rahuLon +
 *      360°)`, i.e. on the Ketu-Rahu side.
 *
 * If either applies, Kaal Sarp is active and the subtype is named after
 * Rahu's house (Anant, Kulik, …, Sheshnag — see {@link KaalSarpSubtype}).
 *
 * **Partial (Paritha) variant.** When exactly one of the seven planets is
 * outside the bounded arc, `partial: true` is set. Some traditions
 * (Brahmavarchas, parts of South Indian Phaladeepika commentary) emit a
 * dosha-bhanga ("broken dosha") signal in this case — treat it as a soft
 * indicator, not a strict affliction.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`.
 *
 * @example
 * ```typescript
 * const ksd = computeKaalSarp(chart);
 * if (ksd.afflicted) console.log(`Kaal Sarp (${ksd.subtype}): Rahu in house ${ksd.rahuHouse}`);
 * ```
 */
export function computeKaalSarp(chart: BirthChart): KaalSarpDoshaInfo {
  const rahu = chart.planets.find((p) => p.planet === 'Rahu')!;
  const ketu = chart.planets.find((p) => p.planet === 'Ketu')!;
  const visiblePlanets = chart.planets.filter(
    (p) => p.planet !== 'Rahu' && p.planet !== 'Ketu',
  );

  // Angular distance from Rahu in the zodiacal direction, normalized to [0, 360).
  const rahuLon = rahu.longitude;
  const distancesFromRahu = visiblePlanets.map(
    (p) => ((p.longitude - rahuLon) % 360 + 360) % 360,
  );

  // Forward arc: all in (0, 180). Backward arc: all in (180, 360).
  let inForward = 0;
  let inBackward = 0;
  for (const d of distancesFromRahu) {
    // Treat planets exactly on the axis (d=0 or d=180) as outside both arcs;
    // they are conjunct Rahu or Ketu, breaking the strict between-axis rule.
    if (d > 0 && d < 180) inForward++;
    else if (d > 180 && d < 360) inBackward++;
  }

  const total = visiblePlanets.length; // 7
  const afflicted = inForward === total || inBackward === total;
  const partial = !afflicted && (inForward === total - 1 || inBackward === total - 1);

  return {
    afflicted,
    subtype: afflicted ? KAAL_SARP_BY_RAHU_HOUSE[rahu.house - 1]! : null,
    partial,
    rahuHouse: rahu.house,
    ketuHouse: ketu.house,
  };
}

// ── Pitru Dosha ───────────────────────────────────────

/**
 * Compute Pitru Dosha — affliction by ancestors. Two highest-frequency
 * triggers are tested (further classical rules exist; this surfaces the
 * dominant ones used by public calculators):
 *
 *   1. Sun + Rahu in the same house — the most-cited Pitru Dosha rule.
 *   2. Sun + Ketu in the same house — same axial principle.
 *   3. Sun + Saturn conjunction in the 9th house — bhagya bhava affliction.
 *
 * The full Parashara catalog includes additional rules (debilitated Sun in
 * 9th, 9th lord in dusthana, malefic 9th lord, etc.) — those are out of
 * scope here. The two surfaced rules account for the majority of Pitru
 * Dosha flags returned by ProKerala / DrikPanchang's free panels.
 *
 * @param chart  Natal D1 chart from `computeRashiChart`.
 *
 * @example
 * ```typescript
 * const pitru = computePitruDosha(chart);
 * if (pitru.afflicted) console.log('Pitru Dosha:', pitru.reasons.join('; '));
 * ```
 */
export function computePitruDosha(chart: BirthChart): PitruDoshaInfo {
  const sun = chart.planets.find((p) => p.planet === 'Sun')!;
  const rahu = chart.planets.find((p) => p.planet === 'Rahu')!;
  const ketu = chart.planets.find((p) => p.planet === 'Ketu')!;
  const saturn = chart.planets.find((p) => p.planet === 'Saturn')!;

  const reasons: string[] = [];
  if (sun.house === rahu.house) {
    reasons.push(`Sun + Rahu conjunction in house ${sun.house}`);
  }
  if (sun.house === ketu.house) {
    reasons.push(`Sun + Ketu conjunction in house ${sun.house}`);
  }
  if (sun.house === 9 && saturn.house === 9) {
    reasons.push('Sun + Saturn conjunction in the 9th house (bhagya bhava)');
  }

  return {
    afflicted: reasons.length > 0,
    reasons,
  };
}
