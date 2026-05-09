import { computeLagna } from './lagna';
import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getSiderealSunLongitude } from '../astronomy/sun';
import { resolveMasaName } from '../i18n/resolver';
import { Body, Equator, Horizon, MakeTime, Observer } from 'astronomy-engine';
import { normalize360 } from '../utils/angle';
import { GULIKA_SLOTS } from '../utils/constants';
import { validateDate, validateLocation } from '../utils/validation';
import type { AyanamsaType, BirthChartOptions, Language } from '../types/options';
import type { GeoLocation } from '../types/location';
import type { UpagrahaPosition, Upagrahas } from '../types/jyotish';

// ── Constants ──────────────────────────────────────────

/**
 * **Day-birth** Gulika segment indices, indexed by weekday (0 = Sunday
 * … 6 = Saturday). Same as `GULIKA_SLOTS` from `utils/constants` — the
 * weekday-lord rotation Sun → Moon → Mars → Mercury → Jupiter → Venus
 * → Saturn through the 8 day segments places Saturn at these slots.
 */
const DAY_GULIKA_SLOT = GULIKA_SLOTS;

/**
 * **Night-birth** Gulika segment indices. Per Phaladeepika Ch. 5: the
 * first night segment is ruled by the planet 5 weekdays from the
 * birth-day-lord; the rotation continues identically. The slot at which
 * Saturn falls is:
 *
 *   - Sunday night    → Jupiter, Venus, Saturn, …  → Saturn at slot 2
 *   - Monday night    → Venus, Saturn, …            → Saturn at slot 1
 *   - Tuesday night   → Saturn, …                    → Saturn at slot 0
 *   - Wednesday night → Sun, Moon, …, Saturn, Sun   → Saturn at slot 6
 *   - Thursday night  → Moon, …, Saturn             → Saturn at slot 5
 *   - Friday night    → Mars, …, Saturn             → Saturn at slot 4
 *   - Saturday night  → Mercury, Jupiter, Venus, Saturn → Saturn at slot 3
 *
 * Cross-checked against drikpanchang.com's night-Gulika convention.
 */
const NIGHT_GULIKA_SLOT: readonly number[] = [2, 1, 0, 6, 5, 4, 3];

/**
 * Sun-derived upagraha offsets in degrees. Classical Tajik / BPHS
 * literature defines these as fixed offsets from the sidereal Sun:
 *
 *   - Dhuma      = Sun + 133°20'
 *   - Vyatipata  = 360° − Dhuma
 *   - Parivesha  = Vyatipata + 180°
 *   - Indrachapa = 360° − Parivesha
 *   - Upaketu    = Indrachapa + 16°40'
 *
 * 133°20' = 133 + 20/60 = 133.3333...°
 * 16°40' = 16 + 40/60 = 16.6667°
 */
const DHUMA_OFFSET_DEG = 133 + 20 / 60;
const UPAKETU_OFFSET_DEG = 16 + 40 / 60;

// ── Public API ─────────────────────────────────────────

/**
 * Compute the 7 Upagrahas (sub-grahas) at a given UTC instant for a
 * given location.
 *
 * **Gulika & Mandi.** Day birth: divide sunrise → sunset into 8 equal
 * segments; the day-lord rotation Sun → Moon → Mars → Mercury → Jupiter
 * → Venus → Saturn places Saturn at one of those segments per weekday
 * (`DAY_GULIKA_SLOT`). Gulika's longitude is the **rising ascendant at
 * the *start* of Saturn's segment**; Mandi is the **rising ascendant at
 * the *midpoint*** of the same segment. Night birth: divide sunset →
 * next-sunrise into 8; the rotation continues from the planet 5 days
 * from the day-lord (`NIGHT_GULIKA_SLOT`).
 *
 * **Sun-derived upagrahas.** Computed from the sidereal Sun at the
 * given instant via the fixed-offset formulas pinned in
 * {@link DHUMA_OFFSET_DEG} / {@link UPAKETU_OFFSET_DEG}.
 *
 * Each upagraha is returned with its sidereal longitude, rashi index,
 * localized rashi name, and whole-sign house from the natal lagna at
 * `birthDate`.
 *
 * @param birthDate UTC instant.
 * @param location  Geographic location.
 * @param options   Birth-chart options (ayanamsa, language). House
 *                  numbers always use the natal lagna's whole-sign frame
 *                  regardless of `options.houseSystem`, since upagrahas
 *                  are typically read in whole-sign analysis.
 *
 * @example
 * ```typescript
 * import { computeUpagrahas } from 'panchang-ts';
 *
 * const u = computeUpagrahas(
 *   new Date('1995-08-15T05:30:00Z'),
 *   { latitude: 28.6139, longitude: 77.2090 },
 * );
 * u.gulika.longitude;   // sidereal degrees
 * u.gulika.house;       // whole-sign house from natal lagna
 * u.dhuma.rashiName;    // Dhuma's rashi (localized)
 * u.upaketu.rashi;      // 0..11
 * ```
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

  // Gulika & Mandi need day/night detection + segment timing.
  const gulikaTimes = locateGulikaSegment(birthDate, location);
  const gulikaLon = computeLagna(gulikaTimes.start, location, ayanamsaType, lang).siderealLongitude;
  const mandiLon = computeLagna(gulikaTimes.midpoint, location, ayanamsaType, lang).siderealLongitude;

  // Sun-derived upagrahas — fixed offsets from sidereal Sun.
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

// ── Helpers ────────────────────────────────────────────

/**
 * Build a `UpagrahaPosition` from a sidereal longitude.
 */
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

/**
 * Locate the start and midpoint of Saturn's segment (1/8 of day or
 * night) for the given UTC instant + location. Used by Gulika (start)
 * and Mandi (midpoint).
 *
 * @internal — exported via `_locateGulikaSegmentForTest` for unit tests.
 */
function locateGulikaSegment(
  birthDate: Date,
  location: GeoLocation,
): { start: Date; midpoint: Date } {
  // Day vs night: is the Sun above the horizon at birthDate?
  const day = isDayBirth(birthDate, location);

  // Determine the weekday index 0..6 (Sunday..Saturday) of the *birth's
  // panchang day*. The panchang day starts at sunrise — for births
  // between midnight and sunrise the weekday belongs to the prior
  // calendar day. We use `getDay()` of the sunrise that anchors the
  // birth's panchang day.
  const baseSunrise = day
    ? findSunriseBeforeBirth(birthDate, location)
    : findSunriseBeforeBirth(birthDate, location);
  const varaIndex = baseSunrise.getUTCDay();
  // Note: getUTCDay returns 0 = Sunday … 6 = Saturday based on UTC
  // time. For panchang purposes the weekday is determined by the
  // local date of sunrise; near midnight UTC the local weekday could
  // differ. The simplification here matches the convention in the rest
  // of the library (`computeRahuKalam` etc. take `varaIndex` from the
  // caller; here we derive it locally for upagraha self-containment).

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
    // Night: from the prior sunset to the next sunrise.
    const priorSunrise = baseSunrise;
    const priorSunset = computeSunset(priorSunrise, location);
    let segmentSunset: Date;
    let segmentNextSunrise: Date;

    if (birthDate.getTime() < priorSunset.getTime()) {
      // Birth is before the prior sunset → not really night by the
      // convention. Fall back to using priorSunset → priorSunrise+24h.
      segmentSunset = priorSunset;
      segmentNextSunrise = computeSunrise(new Date(priorSunset.getTime() + 60_000), location);
    } else {
      // Birth is after sunset of birth-day. Use that sunset → next sunrise.
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

/** @internal */
export const _locateGulikaSegmentForTest = locateGulikaSegment;

/**
 * Day-birth flag: true iff the Sun is geometrically above the horizon.
 * Mirrors the helper in `varshaphala.ts` to keep this module
 * self-contained.
 */
function isDayBirth(date: Date, location: GeoLocation): boolean {
  const observer = new Observer(location.latitude, location.longitude, location.elevation ?? 0);
  const time = MakeTime(date);
  const equ = Equator(Body.Sun, time, observer, true, true);
  const hor = Horizon(time, observer, equ.ra, equ.dec, 'normal');
  return hor.altitude > 0;
}

/**
 * Most-recent sunrise at or before `date`. Walks forward by ≤22h hops
 * to handle pre-sunrise / post-sunrise cases.
 */
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
