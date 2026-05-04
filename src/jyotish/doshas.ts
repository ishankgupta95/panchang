import type { BirthChart, MangalDoshaInfo } from '../types/jyotish';

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
