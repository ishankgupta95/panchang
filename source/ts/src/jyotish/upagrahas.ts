import { computeLagna } from './lagna';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveMasaName } from '../i18n/resolver';
import { normalize360 } from '../utils/angle';
import { GULIKA_SLOTS } from '../utils/constants';
import { validateDate, validateLocation } from '../utils/validation';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { UpagrahaPosition, Upagrahas } from '../types/jyotish';

const DAY_GULIKA_SLOT = GULIKA_SLOTS;

/** Phaladeepika Ch. 5: the first night segment is ruled by the planet 5 weekdays from the birth-day lord; these are the slots where Saturn then falls. */
const NIGHT_GULIKA_SLOT: readonly number[] = [2, 1, 0, 6, 5, 4, 3];

/** Classical Tajik / BPHS offsets. */
const DHUMA_OFFSET_DEG = 133 + 20 / 60;
const UPAKETU_OFFSET_DEG = 16 + 40 / 60;

/**
 * The seven Upagrahas: Gulika is the ascendant at the *start* of Saturn's one-eighth day
 * or night segment, Mandi at its *midpoint*, the other five fixed offsets from the sidereal Sun.
 *
 * @param options Houses are whole-sign from the natal lagna whatever `options.houseSystem` says.
 */
export function computeUpagrahas(
  birthDate: Date,
  location: GeoLocation,
  options: BirthChartOptions = {},
): Upagrahas {
  validateDate(birthDate);
  validateLocation(location);

  const ayanamsaType: AyanamsaType = options.ayanamsa ?? 'lahiri';
  const lang: Language = options.language ?? 'en';

  const natalLagna = computeLagna(birthDate, location, ayanamsaType, lang);
  const natalLagnaRashi = natalLagna.rashi.index;

  const sunLon = getSiderealSunLongitude(birthDate, ayanamsaType);

  const gulikaTimes = locateGulikaSegment(birthDate, location);
  const gulikaLon = computeLagna(gulikaTimes.start, location, ayanamsaType, lang).siderealLongitude;
  const mandiLon = computeLagna(gulikaTimes.midpoint, location, ayanamsaType, lang).siderealLongitude;

  const dhuma = normalize360(sunLon + DHUMA_OFFSET_DEG);
  const vyatipata = normalize360(360 - dhuma);
  const parivesha = normalize360(vyatipata + 180);
  const indrachapa = normalize360(360 - parivesha);
  const upaketu = normalize360(indrachapa + UPAKETU_OFFSET_DEG);

  return {
    gulika: makeUpagrahaPos(gulikaLon, natalLagnaRashi, lang),
    mandi: makeUpagrahaPos(mandiLon, natalLagnaRashi, lang),
    dhuma: makeUpagrahaPos(dhuma, natalLagnaRashi, lang),
    vyatipata: makeUpagrahaPos(vyatipata, natalLagnaRashi, lang),
    parivesha: makeUpagrahaPos(parivesha, natalLagnaRashi, lang),
    indrachapa: makeUpagrahaPos(indrachapa, natalLagnaRashi, lang),
    upaketu: makeUpagrahaPos(upaketu, natalLagnaRashi, lang),
  };
}

function makeUpagrahaPos(
  longitude: number,
  natalLagnaRashi: number,
  lang: Language,
): UpagrahaPosition {
  const lon = normalize360(longitude);
  const rashi = Math.floor(lon / 30);
  return {
    longitude: lon,
    rashi,
    rashiName: resolveMasaName(rashi, lang),
    house: ((rashi - natalLagnaRashi + 12) % 12) + 1,
  };
}

function locateGulikaSegment(
  birthDate: Date,
  location: GeoLocation,
): { start: Date; midpoint: Date } {
  const baseSunrise = findSunriseBeforeBirth(birthDate, location);
  const day = birthDate.getTime() < computeSunset(baseSunrise, location).getTime();
  const varaIndex = new Date(
    baseSunrise.getTime() + (location.longitude / 15) * 3600_000,
  ).getUTCDay();

  let segStart: Date;
  let segEnd: Date;
  let slot: number;

  if (day) {
    const sunrise = baseSunrise;
    const sunset = computeSunset(sunrise, location);
    const dayMs = sunset.getTime() - sunrise.getTime();
    const segLen = dayMs / 8;
    slot = DAY_GULIKA_SLOT[varaIndex]!;
    segStart = new Date(sunrise.getTime() + slot * segLen);
    segEnd = new Date(segStart.getTime() + segLen);
  } else {
    const priorSunrise = baseSunrise;
    const priorSunset = computeSunset(priorSunrise, location);
    let segmentSunset: Date;
    let segmentNextSunrise: Date;

    if (birthDate.getTime() < priorSunset.getTime()) {
      segmentSunset = priorSunset;
      segmentNextSunrise = computeSunrise(new Date(priorSunset.getTime() + 60_000), location);
    } else {
      segmentSunset = priorSunset;
      segmentNextSunrise = computeSunrise(new Date(segmentSunset.getTime() + 60_000), location);
    }

    const nightMs = segmentNextSunrise.getTime() - segmentSunset.getTime();
    const segLen = nightMs / 8;
    slot = NIGHT_GULIKA_SLOT[varaIndex]!;
    segStart = new Date(segmentSunset.getTime() + slot * segLen);
    segEnd = new Date(segStart.getTime() + segLen);
  }

  const midpoint = new Date((segStart.getTime() + segEnd.getTime()) / 2);
  return { start: segStart, midpoint };
}

export const _locateGulikaSegmentForTest = locateGulikaSegment;

function findSunriseBeforeBirth(date: Date, location: GeoLocation): Date {
  const back30h = new Date(date.getTime() - 30 * 3600_000);
  let candidate = computeSunrise(back30h, location);
  for (let i = 0; i < 4; i++) {
    const lookAhead = new Date(candidate.getTime() + 22 * 3600_000);
    const next = computeSunrise(lookAhead, location);
    if (next.getTime() > date.getTime()) return candidate;
    candidate = next;
  }
  return candidate;
}
