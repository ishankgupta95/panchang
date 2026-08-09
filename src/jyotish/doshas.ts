import type {
  BirthChart, GrahaName, MangalDoshaInfo, MangalDoshaSeverity,
  MangalCompatibility, KaalSarpDoshaInfo, KaalSarpSubtype, PitruDoshaInfo,
} from '../types/jyotish';
import { RASHI_LORD } from './matchingTables';

/** Houses (1..12) where Mars classically afflicts the chart. */
const MANGAL_HOUSES: ReadonlySet<number> = new Set([1, 2, 4, 7, 8, 12]);

/** Mars's own and exalted rashis (cancel Mangal Dosha when Mars sits there). */
const MARS_OWN_RASHIS: ReadonlySet<number> = new Set([0, 7]); // Aries, Scorpio
const MARS_EXALTED_RASHI = 9; // Capricorn

/**
 * Compute Mangal Dosha (Manglik) status for a birth chart.
 *
 * Reference rule set follows drik panchang's stated algorithm (Lagna +
 * Moon + Venus charts) and the cancellation set used by mainstream
 * pandits. Mars in houses 1, 2, 4, 7, 8, or 12 from any of the three
 * reference points flags affliction. Cancellations applied:
 *
 *   - Mars in own sign (Aries / Scorpio) or exalted (Capricorn).
 *   - Mars conjunct Jupiter (same house) — Jupiter's benefic presence.
 *   - Mars conjunct Moon (same house) — Moon's softening effect.
 *   - Mars conjunct Venus (same house) — Venus's benefic conjunction.
 *     Note: this trivially cancels the "Mars in 1st from Venus" trigger,
 *     so any Mars–Venus conjunction self-cancels.
 *   - Mars aspected by Jupiter — Jupiter's 5th, 7th, or 9th sign-aspect
 *     onto Mars (whole-sign: Mars rashi is 5th/7th/9th from Jupiter rashi).
 *
 * Mutual-mangalik cancellation (both partners afflicted) is a matching
 * rule, not a chart-only rule, so it is not applied here — use
 * {@link computeMangalCompatibility} for a pair.
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
  const mars = chart.byPlanet.Mars;
  const moon = chart.byPlanet.Moon;
  const venus = chart.byPlanet.Venus;
  const jupiter = chart.byPlanet.Jupiter;

  const marsRashi = mars.rashi.index;
  const houseFrom = (refRashi: number): number =>
    ((marsRashi - refRashi + 12) % 12) + 1;

  const fromLagnaHouse = houseFrom(chart.lagna.rashi.index);
  const fromMoonHouse = houseFrom(moon.rashi.index);
  const fromVenusHouse = houseFrom(venus.rashi.index);

  const fromLagnaAfflicted = MANGAL_HOUSES.has(fromLagnaHouse);
  const fromMoonAfflicted = MANGAL_HOUSES.has(fromMoonHouse);
  const fromVenusAfflicted = MANGAL_HOUSES.has(fromVenusHouse);

  const flaggedCount =
    (fromLagnaAfflicted ? 1 : 0) +
    (fromMoonAfflicted ? 1 : 0) +
    (fromVenusAfflicted ? 1 : 0);
  const severity: MangalDoshaSeverity =
    flaggedCount === 0 ? 'none'
    : flaggedCount === 3 ? 'purna'
    : 'anshik';

  let afflicted = flaggedCount > 0;
  const cancellations: string[] = [];

  if (afflicted) {
    if (MARS_OWN_RASHIS.has(marsRashi)) {
      cancellations.push(`Mars in own sign ${marsRashi === 0 ? 'Aries' : 'Scorpio'}`);
      afflicted = false;
    } else if (marsRashi === MARS_EXALTED_RASHI) {
      cancellations.push('Mars exalted in Capricorn');
      afflicted = false;
    }

    if (mars.house === jupiter.house) {
      cancellations.push(`Mars conjunct Jupiter in house ${mars.house}`);
      afflicted = false;
    }
    if (mars.house === moon.house) {
      cancellations.push(`Mars conjunct Moon in house ${mars.house}`);
      afflicted = false;
    }
    if (mars.house === venus.house) {
      cancellations.push(`Mars conjunct Venus in house ${mars.house}`);
      afflicted = false;
    }

    // Jupiter's whole-sign aspects fall on the 5th, 7th, and 9th rashis
    // from Jupiter. Equivalently, Mars is aspected by Jupiter iff Mars's
    // rashi is the 5th, 7th, or 9th from Jupiter's rashi.
    const marsFromJupiter = ((marsRashi - jupiter.rashi.index + 12) % 12) + 1;
    if (marsFromJupiter === 5 || marsFromJupiter === 7 || marsFromJupiter === 9) {
      cancellations.push(`Mars aspected by Jupiter (${marsFromJupiter}th aspect)`);
      afflicted = false;
    }
  }

  return {
    afflicted,
    severity,
    fromLagna: { afflicted: fromLagnaAfflicted, house: fromLagnaHouse },
    fromMoon: { afflicted: fromMoonAfflicted, house: fromMoonHouse },
    fromVenus: { afflicted: fromVenusAfflicted, house: fromVenusHouse },
    cancellations,
  };
}

/**
 * Assess Mangal Dosha for a couple, applying the mutual-Manglik cancellation.
 *
 * {@link computeMangalDosha} answers "is this native Manglik", which is not
 * the question a match asks. The classical position — and the one mainstream
 * matchmaking applies — is that when *both* partners are Manglik the two
 * afflictions neutralise each other, so the pair is unafflicted. A Manglik
 * matched with a non-Manglik is the case that carries the dosha.
 *
 * Chart-level cancellations run first, inside {@link computeMangalDosha}, so
 * a native whose Mars is (say) exalted arrives here already unafflicted and
 * cannot contribute to a mutual cancellation.
 *
 * Scope. This applies the binary rule. Sources note the neutralisation reads
 * most cleanly when the two afflictions are of comparable strength, and
 * {@link MangalDoshaInfo.severity} is carried through on both natives so a
 * caller can weigh an anshik-against-purna pairing themselves; no severity
 * threshold is imposed here, because the sources do not agree on one.
 *
 * @param boyChart   Natal D1 chart for the first native.
 * @param girlChart  Natal D1 chart for the second native.
 *
 * @example
 * ```typescript
 * const m = computeMangalCompatibility(boyChart, girlChart);
 * if (!m.afflicted) console.log(m.description);
 * // "both natives Manglik — mutually cancelled"
 * ```
 */
export function computeMangalCompatibility(
  boyChart: BirthChart,
  girlChart: BirthChart,
): MangalCompatibility {
  const boy = computeMangalDosha(boyChart);
  const girl = computeMangalDosha(girlChart);
  const cancellations: string[] = [];

  let afflicted: boolean;
  let description: string;

  if (boy.afflicted && girl.afflicted) {
    afflicted = false;
    cancellations.push('both natives Manglik — mutual cancellation');
    description = `both natives Manglik (${boy.severity} / ${girl.severity})`
      + ' — mutually cancelled';
  } else if (boy.afflicted || girl.afflicted) {
    afflicted = true;
    const which = boy.afflicted ? 'boy' : 'girl';
    const severity = boy.afflicted ? boy.severity : girl.severity;
    description = `only the ${which} is Manglik (${severity}) — dosha stands`;
  } else {
    afflicted = false;
    description = 'neither native is Manglik';
  }

  return { boy, girl, afflicted, cancellations, description };
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
 * Drik panchang explicitly does **not** surface partial Kaal Sarp in its
 * calculator ("As partial Kaal Sarpa Dosha is not widely accepted, Drik
 * Panchang does not list them"). The `partial` flag here is informational
 * only — the canonical `afflicted` flag and `subtype` always match drik
 * panchang's behavior. Callers wanting strict drik-panchang parity should
 * ignore `partial`.
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
  const rahu = chart.byPlanet.Rahu;
  const ketu = chart.byPlanet.Ketu;
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
 * Map from the 7-graha index used in `RASHI_LORD` (Sun=0..Saturn=6) to the
 * `GrahaName` used in chart.planets. Rashi-lord lookup never returns Rahu
 * or Ketu (they don't lord any rashi in the Parashara scheme).
 */
const GRAHA_NAME_BY_INDEX: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/**
 * Compute Pitru Dosha — affliction by ancestors. Drik panchang does not
 * publish a Pitru Dosha calculator, so the reference set is the
 * pandit-consensus subset (rules cited by ≥3 of 6 surveyed pandit
 * sources: AstroTalk, PujaYagna, MyPandit, Astrobix, Vinay Bajrangi,
 * GaneshaSpeaks). Four triggers are tested:
 *
 *   A. Sun + Rahu conjunction (any house) — the most universally cited
 *      Pitru Dosha rule; Sun (pitru karaka) shadowed by Rahu.
 *   C. Sun + Saturn conjunction (any house) — classical malefic
 *      affliction of the pitru karaka.
 *   E. Rahu in the 9th house — Rahu directly afflicting pitru bhava.
 *   G. 9th-house lord conjunct Rahu — pitru-bhava lord afflicted by
 *      Rahu. Skipped when the 9th lord is Sun (already covered by A).
 *
 * Rules dropped relative to earlier expansive readings (each cited by
 * ≤1 surveyed pandit source): Sun + Ketu conjunction, Sun in 9th alone
 * (Sun in own pitru bhava is often considered favorable), Ketu in 4th
 * (commonly classed as Matri Dosha, not Pitru), 9th lord + Saturn, and
 * 9th lord in dusthana (a generic weak-9th-lord rule, not a Pitru
 * Dosha rule per pandit consensus).
 *
 * Any one trigger sets `afflicted: true`; all matching triggers are
 * surfaced in `reasons`.
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
  const sun = chart.byPlanet.Sun;
  const rahu = chart.byPlanet.Rahu;
  const saturn = chart.byPlanet.Saturn;

  const ninthRashi = chart.bhava.houses[8]!.rashi.index;
  const ninthLordName = GRAHA_NAME_BY_INDEX[RASHI_LORD[ninthRashi]!]!;
  const ninthLord = chart.byPlanet[ninthLordName];

  const reasons: string[] = [];

  // A — Sun + Rahu conjunction.
  if (sun.house === rahu.house) {
    reasons.push(`Sun + Rahu conjunction in house ${sun.house}`);
  }
  // C — Sun + Saturn conjunction.
  if (sun.house === saturn.house) {
    reasons.push(`Sun + Saturn conjunction in house ${sun.house}`);
  }
  // E — Rahu in the 9th house.
  if (rahu.house === 9) {
    reasons.push('Rahu in the 9th house');
  }
  // G — 9th-lord conjunct Rahu. Skip when 9th lord is Sun (covered by A).
  if (ninthLordName !== 'Sun' && ninthLord.house === rahu.house) {
    reasons.push(`9th-lord ${ninthLordName} conjunct Rahu in house ${ninthLord.house}`);
  }

  return {
    afflicted: reasons.length > 0,
    reasons,
  };
}
