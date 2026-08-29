import type {
  BirthChart, GrahaName, Jaimini8Karakas, JaiminiKarakas, Karaka8Name,
  KarakaName, PlanetPlacement,
} from '../types/jyotish';

const KARAKA_ORDER: readonly KarakaName[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Putrakaraka',
  'Gnatikaraka',
  'Darakaraka',
];

const KARAKA_8_ORDER: readonly Karaka8Name[] = [
  'Atmakaraka',
  'Amatyakaraka',
  'Bhratrukaraka',
  'Matrukaraka',
  'Pitrukaraka',
  'Putrakaraka',
  'Gnatikaraka',
  'Darakaraka',
];

/** Parashara order, which doubles as the stable-sort tie-break on equal degrees. */
const VISIBLE_GRAHAS: readonly GrahaName[] = [
  'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn',
];

/** Rahu last, so it loses every tie. */
const VISIBLE_GRAHAS_8: readonly GrahaName[] = [
  ...VISIBLE_GRAHAS, 'Rahu',
];

export interface ComputeJaiminiKarakasOptions {
  variant?: '7-parashara' | '8-jaimini';
}

/**
 * Chara (movable) Jaimini Karakas: grahas ranked by descending `degreeInRashi`,
 * highest first; Ketu is in neither variant.
 *
 * @param options `{ variant: '8-jaimini' }` (Upadesa Sutras Ch. 1, per Sanjay Rath) adds Rahu with its degree reversed, 30 - deg, for its permanent retrogression, and makes Pitrukaraka the 5th role; the default is the 7-Karaka Parashara variant of BPHS Ch. 32.
 */
export function computeJaiminiKarakas(chart: BirthChart): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '7-parashara' },
): JaiminiKarakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options: { variant: '8-jaimini' },
): Jaimini8Karakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options?: ComputeJaiminiKarakasOptions,
): JaiminiKarakas | Jaimini8Karakas;
export function computeJaiminiKarakas(
  chart: BirthChart,
  options?: ComputeJaiminiKarakasOptions,
): JaiminiKarakas | Jaimini8Karakas {
  const planetByName = {} as Record<GrahaName, PlanetPlacement>;
  for (const p of chart.planets) planetByName[p.planet] = p;

  if (options?.variant === '8-jaimini') {
    const ranked = VISIBLE_GRAHAS_8.map((g) => ({
      graha: g,
      degree: g === 'Rahu'
        ? 30 - planetByName[g].degreeInRashi
        : planetByName[g].degreeInRashi,
    }));
    ranked.sort((a, b) => b.degree - a.degree);

    const result = {} as Jaimini8Karakas;
    for (let i = 0; i < KARAKA_8_ORDER.length; i++) {
      result[KARAKA_8_ORDER[i]!] = ranked[i]!.graha;
    }
    return result;
  }

  const ranked = VISIBLE_GRAHAS.map((g) => ({
    graha: g,
    degree: planetByName[g].degreeInRashi,
  }));

  ranked.sort((a, b) => b.degree - a.degree);

  const result = {} as JaiminiKarakas;
  for (let i = 0; i < KARAKA_ORDER.length; i++) {
    result[KARAKA_ORDER[i]!] = ranked[i]!.graha;
  }
  return result;
}
