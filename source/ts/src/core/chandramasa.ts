import type { ChandraMasaInfo } from '../types/elements';
import type { MasaSystem } from '../types/options';
import { boundingNewMoons, type NewMoonBounds } from '../astronomy/newMoon';

/**
 * The Amavasya initiating an Amanta month falls one rashi behind the month's name
 * (Sun in Meena → Chaitra). Mean-motion new moons overshoot the Sankranti boundary
 * near aphelion, where Adhika Jyeshtha/Ashadha occur, so the TRUE ones are required.
 */
export function computeChandraMasa(
  siderealSun: number,
  siderealMoon: number,
  nameFn: (index: number, isAdhika: boolean) => string,
  system: MasaSystem = 'purnimanta',
  refDate: Date,
  getSiderealSun: (d: Date) => number,
  getBounds: (ref: Date) => NewMoonBounds = boundingNewMoons,
): ChandraMasaInfo {
  const elongation = ((siderealMoon - siderealSun) + 360) % 360;

  const { prev, next } = getBounds(refDate);
  const sunAtPrevNewMoon = ((getSiderealSun(prev) % 360) + 360) % 360;
  const sunAtNextNewMoon = ((getSiderealSun(next) % 360) + 360) % 360;
  const solarMonthAtPrev = Math.floor(sunAtPrevNewMoon / 30);
  const solarMonthAtNext = Math.floor(sunAtNextNewMoon / 30);

  const isAdhika = solarMonthAtPrev === solarMonthAtNext;

  const amantaIndex = (solarMonthAtPrev + 1) % 12;
  const amantaName = nameFn(amantaIndex, isAdhika);

  // An Adhika month has no Sankranti, so its Purnimanta name does NOT advance.
  const isKrishnaPaksha = elongation >= 180;
  const purnimantaIndex =
    isKrishnaPaksha && !isAdhika ? (amantaIndex + 1) % 12 : amantaIndex;
  const purnimantaName = nameFn(purnimantaIndex, isAdhika);

  const index = system === 'amanta' ? amantaIndex : purnimantaIndex;
  const name = system === 'amanta' ? amantaName : purnimantaName;

  return { index, name, isAdhika, system, amantaIndex, amantaName, purnimantaIndex, purnimantaName };
}
