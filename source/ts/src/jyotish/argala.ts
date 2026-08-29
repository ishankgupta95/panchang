import type {
  ArgalaPerBhava, BirthChart, PlanetPlacement,
} from '../types/jyotish';

const ARGALA_OFFSETS: readonly number[] = [1, 3, 10]; // 0-based: 2 → 1, 4 → 3, 11 → 10
const VIRODHARGALA_OFFSETS: readonly number[] = [2, 9, 11]; // 0-based: 3 → 2, 10 → 9, 12 → 11

const TRIKONA_SOURCE_OFFSET = 4; // 0-based: the 5th from the bhava
const TRIKONA_VIRODHAKA_OFFSET = 8; // 0-based: the 9th from the bhava

/**
 * Per-bhava Argala (planets in the 2nd / 4th / 11th) and Virodhargala
 * (3rd / 10th / 12th), primary form only, per Jaimini *Upadesa Sutras* Ch. 1 and
 * BPHS Ch. 51; all 9 grahas participate, with no benefic / malefic filter.
 *
 * @param options `{ includeTrikonargala: true }` also fills `trikona` from the 5th (sources) and 9th (virodhakas), Ketu's role reversed; the 5/9 trine, not Rath's competing 5/8 "Secondary Argala".
 */
export function computeArgala(chart: BirthChart): ArgalaPerBhava[];
export function computeArgala(
  chart: BirthChart,
  options: { includeTrikonargala: true },
): ArgalaPerBhava[];
export function computeArgala(
  chart: BirthChart,
  options?: { includeTrikonargala?: boolean },
): ArgalaPerBhava[] {
  const planets = chart.planets;
  const includeTrikona = options?.includeTrikonargala === true;

  const out: ArgalaPerBhava[] = [];
  for (let bhava = 1; bhava <= 12; bhava++) {
    const argala: PlanetPlacement[] = [];
    const virodhargala: PlanetPlacement[] = [];
    const trikonaSources: PlanetPlacement[] = [];
    const trikonaVirodhakas: PlanetPlacement[] = [];

    for (const p of planets) {
      const offset = ((p.house - bhava) + 12) % 12;
      if (ARGALA_OFFSETS.includes(offset)) {
        argala.push(p);
      } else if (VIRODHARGALA_OFFSETS.includes(offset)) {
        virodhargala.push(p);
      }

      if (includeTrikona) {
        const isFifth = offset === TRIKONA_SOURCE_OFFSET;
        const isNinth = offset === TRIKONA_VIRODHAKA_OFFSET;
        if (isFifth || isNinth) {
          const isKetu = p.planet === 'Ketu';
          if ((isFifth && !isKetu) || (isNinth && isKetu)) {
            trikonaSources.push(p);
          } else {
            trikonaVirodhakas.push(p);
          }
        }
      }
    }

    const entry: ArgalaPerBhava = { bhava, argala, virodhargala };
    if (includeTrikona) {
      entry.trikona = { sources: trikonaSources, virodhakas: trikonaVirodhakas };
    }
    out.push(entry);
  }
  return out;
}
