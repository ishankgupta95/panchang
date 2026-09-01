import { rashiChartFromBasis } from './charts';
import { divisionalChartFromBasis } from './divisionals';
import { computeNatalBasis, type NatalBasis } from './natalBasis';
import { computeDignity } from './dignity';
import { RASHI_LORD } from './matchingTables';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { findSunriseBefore } from './lagna';
import { normalize360 } from '../utils/angle';
import type { GeoLocation } from '../types/location';
import type { BirthChartOptions } from '../types/options';
import type { Divisional } from '../types/jyotish';
import type {
  BhavaBalaPerHouse, BhavaBalaResult,
  BirthChart, DivisionalChart, GrahaName, PlanetPlacement,
  PlanetShadbala, ShadbalaResult,
} from '../types/jyotish';

/** Shadbala: six-fold strength of the seven visible grahas, in Virupas
 *  (60 V = 1 Rupa), per BPHS Ch. 27. */
export function computeShadbala(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): ShadbalaResult {
  const basis = computeNatalBasis(birthDate, location, options);
  return shadbalaForChart(rashiChartFromBasis(basis, options), basis);
}

function shadbalaForChart(chart: BirthChart, basis: NatalBasis): ShadbalaResult {
  const { birthDate, location } = basis;
  const sunriseUtc = findSunriseBefore(birthDate, location);
  const sunsetUtc = computeSunset(sunriseUtc, location);
  const nextSunriseUtc = computeSunrise(sunsetUtc, location);

  const sunPlanet = chart.byPlanet.Sun;
  const moonPlanet = chart.byPlanet.Moon;

  const VARGAS: readonly Divisional[] = ['D2', 'D3', 'D7', 'D9', 'D12', 'D30'];
  const divisionalCharts: Record<Divisional, DivisionalChart> = {} as Record<Divisional, DivisionalChart>;
  for (const v of VARGAS) {
    divisionalCharts[v] = divisionalChartFromBasis(basis, v);
  }

  const grahas: GrahaName[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const partials: Record<GrahaName, PlanetShadbala> = {} as Record<GrahaName, PlanetShadbala>;

  for (const g of grahas) {
    const placement = chart.byPlanet[g];
    const sthana = sthanaBala(g, placement, chart, divisionalCharts);
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

/** Exact exaltation longitudes (deg from 0° Aries) per BPHS Ch. 3. */
const UCHCHA_DEG: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number> = {
  Sun: 10,
  Moon: 33,
  Mars: 298,
  Mercury: 165,
  Jupiter: 95,
  Venus: 357,
  Saturn: 200,
};

function sthanaBala(
  graha: GrahaName,
  placement: PlanetPlacement,
  chart: BirthChart,
  divisionalCharts: Record<Divisional, DivisionalChart>,
): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const uchcha = uchchaBala(graha, placement.longitude);
  const saptavargaja = saptavargajaBala(graha, chart, divisionalCharts);
  const ojhaYugma = ojhaYugmaBala(graha, chart, divisionalCharts);
  const drekkana = drekkanaBala(graha, placement.degreeInRashi);
  return uchcha + saptavargaja + ojhaYugma + drekkana;
}

function uchchaBala(graha: GrahaName, siderealLon: number): number {
  const uchcha = UCHCHA_DEG[graha as Exclude<GrahaName, 'Rahu' | 'Ketu'>];
  const arc = Math.abs(((siderealLon - uchcha + 540) % 360) - 180);
  return ((180 - arc) / 180) * 60;
}

/** Dignity → Virupas, BPHS Ch. 27 v17; `computeDignity` collapses great-friend
 *  and great-enemy into friend and enemy, so those take the lower bound. */
const SAPT_VIRUPAS: Record<string, number> = {
  exalted:      45,
  moolatrikona: 45,
  own:          30,
  friend:       15,
  neutral:       7.5,
  enemy:         3.75,
  debilitated:   1.875,
};

const SAPT_VARGAS: readonly Divisional[] = ['D2', 'D3', 'D7', 'D9', 'D12', 'D30'];

function saptavargajaBala(
  graha: GrahaName,
  chart: BirthChart,
  divisionalCharts: Record<Divisional, DivisionalChart>,
): number {
  const d1Rashi = chart.byPlanet[graha].rashi.index;
  let total = SAPT_VIRUPAS[computeDignity(graha, d1Rashi)]!;
  for (const v of SAPT_VARGAS) {
    const rashi = divisionalCharts[v].planets.find((p) => p.planet === graha)!.rashi.index;
    total += SAPT_VIRUPAS[computeDignity(graha, rashi)]!;
  }
  return total;
}

/** NOT the Drekkana gender triple: only Moon and Venus gain in even signs (BPHS Ch. 27 v18-19). */
const OJHA_ODD_GAINERS: ReadonlySet<GrahaName> = new Set(['Sun', 'Mars', 'Jupiter', 'Mercury', 'Saturn']);
const OJHA_EVEN_GAINERS: ReadonlySet<GrahaName> = new Set(['Moon', 'Venus']);

function ojhaYugmaBala(
  graha: GrahaName,
  chart: BirthChart,
  divisionalCharts: Record<Divisional, DivisionalChart>,
): number {
  const d1Rashi = chart.byPlanet[graha].rashi.index;
  const d9Rashi = divisionalCharts.D9.planets.find((p) => p.planet === graha)!.rashi.index;
  const d1Odd = (d1Rashi % 2) === 0;
  const d9Odd = (d9Rashi % 2) === 0;
  let total = 0;
  if (OJHA_ODD_GAINERS.has(graha)) {
    if (d1Odd) total += 15;
    if (d9Odd) total += 15;
  } else if (OJHA_EVEN_GAINERS.has(graha)) {
    if (!d1Odd) total += 15;
    if (!d9Odd) total += 15;
  }
  return total;
}

/** BPHS Ch. 27 v20: 0 = Male → 1st decanate, 1 = Eunuch → 2nd, 2 = Female → 3rd. */
const DREKKANA_GROUP: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number> = {
  Sun: 0, Mars: 0, Jupiter: 0,
  Mercury: 1, Saturn: 1,
  Moon: 2, Venus: 2,
};

function drekkanaBala(graha: GrahaName, degreeInRashi: number): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const decanate = Math.floor(degreeInRashi / 10);
  return decanate === DREKKANA_GROUP[graha as Exclude<GrahaName, 'Rahu' | 'Ketu'>] ? 15 : 0;
}

/** Strong directional house per graha, BPHS Ch. 27: 1 = east, 4 = north, 7 = west, 10 = south. */
const DIG_HOUSE: Record<Exclude<GrahaName, 'Rahu' | 'Ketu'>, number> = {
  Sun: 10, Moon: 4, Mars: 10, Mercury: 1,
  Jupiter: 1, Venus: 4, Saturn: 7,
};

function digBala(graha: GrahaName, planetLon: number, lagnaLon: number): number {
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  const lagnaRashi = Math.floor(lagnaLon / 30);
  const dirHouse = DIG_HOUSE[graha];
  const dirRashi = (lagnaRashi + dirHouse - 1) % 12;
  const dirCuspLon = dirRashi * 30;
  const arc = Math.abs(((planetLon - dirCuspLon + 540) % 360) - 180);
  return ((180 - arc) / 180) * 60;
}

const DAY_STRONG: ReadonlySet<GrahaName> = new Set(['Sun', 'Jupiter', 'Venus']);
const NIGHT_STRONG: ReadonlySet<GrahaName> = new Set(['Moon', 'Mars', 'Saturn']);
const BENEFICS: ReadonlySet<GrahaName> = new Set(['Moon', 'Mercury', 'Jupiter', 'Venus']);
const MALEFICS: ReadonlySet<GrahaName> = new Set(['Sun', 'Mars', 'Saturn']);

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
    const phase = (t - sunriseUtc.getTime()) / dayLen;
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

/** The classical doubling of the Moon's own Paksha is dropped, to keep the 60 V scale. */
function pakshaBala(graha: GrahaName, sunLon: number, moonLon: number): number {
  const sepFromSun = normalize360(moonLon - sunLon);
  const arc = sepFromSun > 180 ? 360 - sepFromSun : sepFromSun;
  const beneficBala = (arc / 180) * 60;
  if (BENEFICS.has(graha)) return beneficBala;
  if (MALEFICS.has(graha)) return 60 - beneficBala;
  return 0;
}

/** The classical 8-fold vakra split reduced to three buckets; Sun's and Moon's Chesta is tied to Ayana and Paksha, so they take fixed values. */
function chestaBala(graha: GrahaName, placement: PlanetPlacement, sunLon: number): number {
  if (graha === 'Sun') return 30;
  if (graha === 'Moon') return 30;
  if (graha === 'Rahu' || graha === 'Ketu') return 0;
  if (placement.isRetrograde) return 60;
  const angularDistance = Math.abs(((placement.longitude - sunLon + 540) % 360) - 180);
  if (angularDistance <= 10) return 15;
  return 30;
}

/** BPHS natural strengths in Virupas: 60·k/7 for k = 7..1 down the rank order. */
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

/** Drishti weights out of 1 (= 60 V), keyed by house offset: 6 is the 7th aspect. */
const ASPECT_WEIGHTS: Record<number, number> = {
  6: 1,
  3: 0.5,
  7: 0.5,
  4: 0.75,
  8: 0.75,
  2: 0.25,
  9: 0.25,
};

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

function drikBala(graha: GrahaName, chart: BirthChart): number {
  const target = chart.byPlanet[graha];
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

/** Index order must match `RASHI_LORD`. */
const GRAHA_BY_INDEX: readonly Exclude<GrahaName, 'Rahu' | 'Ketu'>[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/** Not the canonical BPHS Ch. 27 table: cardinal bhavas 1/4/7/10 anchor at 60/0/15/30 V
 *  and the rest interpolate, per Sanjay Rath, *Crux of Vedic Astrology* Ch. 6. */
const BHAVA_DIK_VALUES: readonly number[] = Object.freeze([
  60,
  40,
  20,
  0,
  5,
  10,
  15,
  20,
  25,
  30,
  40,
  50,
]);

/** Bhava Bala, the per-house strength in Virupas, BPHS Ch. 27: Bhavadhipati +
 *  Bhava Dik + Bhava Drik + Bhavasthana. */
export function computeBhavaBala(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): BhavaBalaResult {
  const basis = computeNatalBasis(birthDate, location, options);
  const chart = rashiChartFromBasis(basis, options);
  const shadbala = shadbalaForChart(chart, basis);

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

/** @internal */
export const _BHAVA_DIK_VALUES_FOR_TEST = BHAVA_DIK_VALUES;

/** @internal */
export const _ojhaYugmaBalaForTest = ojhaYugmaBala;
