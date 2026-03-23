import { validateDate, validateLocation } from '../utils/validation';
import { LongitudeCache } from '../astronomy/cache';
import { computeAyanamsa } from '../astronomy/ayanamsa';
import { computeSunrise } from '../astronomy/sunrise';
import { findTransitionTime } from '../utils/search';
import { NAKSHATRA_SPAN } from '../utils/constants';
import {
  computeTithiFromLongitudes,
  getTithiIndexAtTime,
  getTithiIndexFromLons,
} from './tithi';
import {
  computeNakshatraFromLongitude,
  getNakshatraIndexAtTime,
} from './nakshatra';
import {
  computeYogaFromLongitudes,
  getYogaIndexAtTime,
  getYogaIndex,
} from './yoga';
import {
  computeKaranaFromLongitudes,
  getKaranaIndexAtTime,
  getKaranaIndex,
} from './karana';
import { computeVara } from './vara';
import {
  resolveTithiName,
  resolveNakshatraName,
  resolveYogaName,
  resolveKaranaName,
  getTranslations,
} from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { InstantPanchangOptions } from '../types/options';
import type { InstantPanchangResult } from '../types/panchang';

export function getInstantPanchang(
  date: Date,
  location: GeoLocation,
  options?: InstantPanchangOptions,
): InstantPanchangResult {
  validateDate(date);
  validateLocation(location);

  const ayanamsaType = options?.ayanamsa ?? 'lahiri';
  const lang = options?.language ?? 'en';
  const doEndTimes = options?.computeEndTimes !== false;
  const maxIter = options?.precision === 'high' ? 25 : 15;

  const cache = new LongitudeCache(ayanamsaType);
  const getMoon = (d: Date) => cache.getMoon(d);
  const getSun = (d: Date) => cache.getSun(d);

  const siderealMoon = getMoon(date);
  const siderealSun = getSun(date);
  const ayanamsaValue = computeAyanamsa(date, ayanamsaType);

  const tithi = computeTithiFromLongitudes(
    siderealMoon, siderealSun,
    resolveTithiName(getTithiIndexFromLons(siderealMoon, siderealSun), lang),
  );
  const nakshatra = computeNakshatraFromLongitude(
    siderealMoon,
    resolveNakshatraName(Math.floor(siderealMoon / NAKSHATRA_SPAN), lang),
  );
  const yoga = computeYogaFromLongitudes(
    siderealMoon, siderealSun,
    resolveYogaName(getYogaIndex(siderealMoon, siderealSun), lang),
  );
  const karana = computeKaranaFromLongitudes(
    siderealMoon, siderealSun,
    resolveKaranaName(getKaranaIndex(siderealMoon, siderealSun), lang),
  );

  // For Vara in instant mode, we need sunrise to know if the moment is before/after sunrise
  const sunriseUtc = computeSunrise(
    new Date(date.getTime() - 12 * 3600_000),
    location,
  );
  const vara = computeVara(date, sunriseUtc, getTranslations(lang).varaNames);

  if (doEndTimes) {
    tithi.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      tithi.index, (d) => getTithiIndexAtTime(d, getMoon, getSun), maxIter,
    );
    nakshatra.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      nakshatra.index, (d) => getNakshatraIndexAtTime(d, getMoon), maxIter,
    );
    yoga.endTime = findTransitionTime(
      date, new Date(date.getTime() + 36 * 3600_000),
      yoga.index, (d) => getYogaIndexAtTime(d, getMoon, getSun), maxIter,
    );
    karana.endTime = findTransitionTime(
      date, new Date(date.getTime() + 18 * 3600_000),
      karana.index, (d) => getKaranaIndexAtTime(d, getMoon, getSun), maxIter,
    );
  }

  return {
    timestamp: date,
    location,
    tithi,
    nakshatra,
    yoga,
    karana,
    vara,
    ayanamsa: ayanamsaValue,
    siderealSun,
    siderealMoon,
  };
}
