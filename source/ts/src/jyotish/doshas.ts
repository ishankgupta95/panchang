import type {
  BirthChart, GrahaName, MangalDoshaInfo, MangalDoshaSeverity,
  MangalCompatibility, KaalSarpDoshaInfo, KaalSarpSubtype, PitruDoshaInfo,
} from '../types/jyotish';
import { RASHI_LORD } from './matchingTables';

const MANGAL_HOUSES: ReadonlySet<number> = new Set([1, 2, 4, 7, 8, 12]);

const MARS_OWN_RASHIS: ReadonlySet<number> = new Set([0, 7]); // Aries, Scorpio
const MARS_EXALTED_RASHI = 9; // Capricorn

/** Mangal Dosha (Manglik) status: Mars in house 1, 2, 4, 7, 8 or 12 from the
 *  lagna, the Moon or Venus, less the classical cancellations. */
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

/** Mangal Dosha for a couple: two Manglik natives cancel each other, so only a
 *  Manglik matched with a non-Manglik carries the dosha. */
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
    cancellations.push('both natives Manglik, mutual cancellation');
    description = `both natives Manglik (${boy.severity} / ${girl.severity})`
      + ', mutually cancelled';
  } else if (boy.afflicted || girl.afflicted) {
    afflicted = true;
    const which = boy.afflicted ? 'boy' : 'girl';
    const severity = boy.afflicted ? boy.severity : girl.severity;
    description = `only the ${which} is Manglik (${severity}), dosha stands`;
  } else {
    afflicted = false;
    description = 'neither native is Manglik';
  }

  return { boy, girl, afflicted, cancellations, description };
}

const KAAL_SARP_BY_RAHU_HOUSE: readonly KaalSarpSubtype[] = [
  'anant',
  'kulik',
  'vasuki',
  'shankhpal',
  'padma',
  'mahapadma',
  'takshak',
  'karkotak',
  'shankhachud',
  'ghatak',
  'vishdhar',
  'sheshnag',
];

/** Kaal Sarp Dosha: all seven visible grahas inside one 180 deg arc bounded by
 *  Rahu and Ketu, either direction; `partial` (exactly one graha outside) is
 *  informational and sets neither `afflicted` nor `subtype`. */
export function computeKaalSarp(chart: BirthChart): KaalSarpDoshaInfo {
  const rahu = chart.byPlanet.Rahu;
  const ketu = chart.byPlanet.Ketu;
  const visiblePlanets = chart.planets.filter(
    (p) => p.planet !== 'Rahu' && p.planet !== 'Ketu',
  );

  const rahuLon = rahu.longitude;
  const distancesFromRahu = visiblePlanets.map(
    (p) => ((p.longitude - rahuLon) % 360 + 360) % 360,
  );

  let inForward = 0;
  let inBackward = 0;
  for (const d of distancesFromRahu) {
    if (d > 0 && d < 180) inForward++;
    else if (d > 180 && d < 360) inBackward++;
  }

  const total = visiblePlanets.length;
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

/** Index order must match `RASHI_LORD`. */
const GRAHA_NAME_BY_INDEX: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/** Pitru Dosha, on the pandit-consensus subset of triggers. */
export function computePitruDosha(chart: BirthChart): PitruDoshaInfo {
  const sun = chart.byPlanet.Sun;
  const rahu = chart.byPlanet.Rahu;
  const saturn = chart.byPlanet.Saturn;

  const ninthRashi = chart.bhava.houses[8]!.rashi.index;
  const ninthLordName = GRAHA_NAME_BY_INDEX[RASHI_LORD[ninthRashi]!]!;
  const ninthLord = chart.byPlanet[ninthLordName];

  const reasons: string[] = [];

  if (sun.house === rahu.house) {
    reasons.push(`Sun + Rahu conjunction in house ${sun.house}`);
  }
  if (sun.house === saturn.house) {
    reasons.push(`Sun + Saturn conjunction in house ${sun.house}`);
  }
  if (rahu.house === 9) {
    reasons.push('Rahu in the 9th house');
  }
  if (ninthLordName !== 'Sun' && ninthLord.house === rahu.house) {
    reasons.push(`9th-lord ${ninthLordName} conjunct Rahu in house ${ninthLord.house}`);
  }

  return {
    afflicted: reasons.length > 0,
    reasons,
  };
}
