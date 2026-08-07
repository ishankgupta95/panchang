/**
 * Counting shim for astronomy-engine. esbuild aliases 'astronomy-engine' to
 * this, so every call the library makes is tallied without touching src/.
 */
import * as AE from '/Users/ishank/code/personal/panchang-ts/node_modules/astronomy-engine/esm/astronomy.js';

export const COUNTS: Record<string, number> = Object.create(null);
export function resetCounts(): void {
  for (const k of Object.keys(COUNTS)) delete COUNTS[k];
}
const count = <T extends (...a: never[]) => unknown>(name: string, fn: T): T =>
  ((...args: never[]) => { COUNTS[name] = (COUNTS[name] ?? 0) + 1; return fn(...args); }) as T;

export const Body = AE.Body;
export const EclipseKind = AE.EclipseKind;
export const Observer = AE.Observer;
export const MakeTime = count('MakeTime', AE.MakeTime);
export const Ecliptic = count('Ecliptic', AE.Ecliptic);
export const GeoMoon = count('GeoMoon', AE.GeoMoon);
export const SunPosition = count('SunPosition', AE.SunPosition);
export const GeoVector = count('GeoVector', AE.GeoVector);
export const Equator = count('Equator', AE.Equator);
export const Horizon = count('Horizon', AE.Horizon);
export const SiderealTime = count('SiderealTime', AE.SiderealTime);
export const SearchRiseSet = count('SearchRiseSet', AE.SearchRiseSet);
export const MoonPhase = count('MoonPhase', AE.MoonPhase);
export const SearchMoonPhase = count('SearchMoonPhase', AE.SearchMoonPhase);
export const SearchMoonQuarter = count('SearchMoonQuarter', AE.SearchMoonQuarter);
export const NextMoonQuarter = count('NextMoonQuarter', AE.NextMoonQuarter);
export const SearchLunarEclipse = count('SearchLunarEclipse', AE.SearchLunarEclipse);
export const NextLunarEclipse = count('NextLunarEclipse', AE.NextLunarEclipse);
export const SearchLocalSolarEclipse = count('SearchLocalSolarEclipse', AE.SearchLocalSolarEclipse);
export const NextLocalSolarEclipse = count('NextLocalSolarEclipse', AE.NextLocalSolarEclipse);
