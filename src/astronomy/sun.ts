// TODO: Phase 2 — implement after installing astronomy-engine
import { normalize360 } from '../utils/angle';
import { computeAyanamsa } from './ayanamsa';
import type { AyanamsaType } from '../types/options';

export function getSiderealSunLongitude(date: Date, ayanamsaType: AyanamsaType): number {
  // Placeholder — replace with astronomy-engine call in Phase 2:
  // import { Body, EclipticLongitude, MakeTime } from 'astronomy-engine';
  // const tropicalLon = EclipticLongitude(Body.Sun, MakeTime(date));
  const tropicalLon = 0; // TODO
  const ayanamsa = computeAyanamsa(date, ayanamsaType);
  return normalize360(tropicalLon - ayanamsa);
}
