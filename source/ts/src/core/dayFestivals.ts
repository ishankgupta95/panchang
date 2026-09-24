import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getMoonrise } from '../astronomy/moonrise';
import { searchMoonPhase } from '../astronomy/lunation';
import { PanchangError } from '../types/errors';
import { nakshatraOf, TOTAL_TITHIS } from '../utils/constants';
import { normalize360 } from '../utils/angle';
import { utcToLocalDisplay } from '../utils/timezone';
import { getTithiIndexFromLons } from './tithi';
import { computeFestivals, type DayGeometry, type FestivalDateRule, type KalaDay } from './festivals';
import { resolveRegionAlias } from './regionAlias';
import { resolveMasaName } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { FestivalRegion, Language, LegacyFestivalRegion } from '../types/options';
import type { ChandraMasaInfo, FestivalInfo, UtcWindow } from '../types/elements';
import type { PanchangTranslations } from '../i18n/types';

const DAY_MS = 86_400_000;

export interface DayFestivalInputs {
  sunriseUtc: Date;
  sunsetUtc: Date;
  nextSunriseUtc: Date;
  location: GeoLocation;
  offsetMinutes: number;
  tithiIndexAtSunrise: number;
  siderealMoonAtSunrise: number;
  siderealSunAtSunrise: number;
  varaIndex: number;
  chandramasa: ChandraMasaInfo;
  /** Lazy: costs a bounding-new-moon search, and only a kshaya Shukla Pratipada reads it. */
  nextDayMasa?: () => { index: number; isAdhika: boolean };
  lang: Language;
  t: PanchangTranslations;
  region?: FestivalRegion | LegacyFestivalRegion;
  /** First moonrise at/after local midnight, or `null` when not yet resolved. */
  moonriseUtc: Date | null;
  bhadraUtc: UtcWindow | null;
  getMoon: (d: Date) => number;
  getSun: (d: Date) => number;
}

/** Each kala is anchored near its END, so a tithi that only just entered it does not count as "pervading" it. */
export function computeDayFestivals(input: DayFestivalInputs): FestivalInfo[] {
  const {
    sunriseUtc, sunsetUtc, nextSunriseUtc, location, offsetMinutes,
    tithiIndexAtSunrise, siderealMoonAtSunrise, siderealSunAtSunrise,
    varaIndex, chandramasa, nextDayMasa, lang, t, region,
    moonriseUtc, bhadraUtc, getMoon, getSun,
  } = input;

  const dayLengthMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const madhyahnaUtc = new Date(sunriseUtc.getTime() + dayLengthMs / 2);
  const aparahnaUtc = new Date(sunriseUtc.getTime() + (dayLengthMs * 8) / 10);
  const pradoshaUtc = new Date(sunsetUtc.getTime() + 60 * 60_000);
  const nishitaUtc = new Date((sunsetUtc.getTime() + nextSunriseUtc.getTime()) / 2);
  const arunodayaUtc = new Date(sunriseUtc.getTime() - 96 * 60_000);

  const tithiAt = (d: Date) => getTithiIndexFromLons(getMoon(d), getSun(d));

  const madhyahnaStartUtc = new Date(sunriseUtc.getTime() + dayLengthMs / 4);
  const aparahnaStartUtc = new Date(sunriseUtc.getTime() + (dayLengthMs * 3) / 5);
  const pradoshaStartUtc = sunsetUtc;
  const nishitaStartUtc = new Date(
    sunsetUtc.getTime() + (nextSunriseUtc.getTime() - sunsetUtc.getTime()) * 0.3,
  );

  type TithiByRule = Partial<Record<FestivalDateRule, number>>;
  const tithiByRule: TithiByRule = {
    madhyahna: tithiAt(madhyahnaUtc),
    aparahna:  tithiAt(aparahnaUtc),
    pradosha:  tithiAt(pradoshaUtc),
    nishita:   tithiAt(nishitaUtc),
  };
  const tithiByRuleStart: TithiByRule = {
    madhyahna: tithiAt(madhyahnaStartUtc),
    aparahna:  tithiAt(aparahnaStartUtc),
    pradosha:  tithiAt(pradoshaStartUtc),
    nishita:   tithiAt(nishitaStartUtc),
  };

  const moonriseInDayUtc =
    moonriseUtc !== null && moonriseUtc.getTime() >= sunriseUtc.getTime()
      ? moonriseUtc
      : getMoonrise(sunriseUtc, location);
  if (moonriseInDayUtc && moonriseInDayUtc.getTime() < nextSunriseUtc.getTime()) {
    tithiByRule.chandrodaya = tithiAt(moonriseInDayUtc);
    tithiByRuleStart.chandrodaya = tithiByRule.chandrodaya;
  }

  const nakshatraAt = (d: Date) => nakshatraOf(getMoon(d));
  const nakshatraByRule: Partial<Record<FestivalDateRule, number>> = {
    madhyahna: nakshatraAt(madhyahnaUtc),
    aparahna: nakshatraAt(aparahnaUtc),
  };
  const nakshatraByRuleStart: Partial<Record<FestivalDateRule, number>> = {
    madhyahna: nakshatraAt(madhyahnaStartUtc),
    aparahna: nakshatraAt(aparahnaStartUtc),
  };

  const yesterdaySunriseUtc = computeSunrise(
    new Date(sunriseUtc.getTime() - 24 * 3600_000 - 2 * 3600_000),
    location,
  );
  const priorDayNakshatraIndex = nakshatraAt(yesterdaySunriseUtc);

  let nextDayTithiMemo: {
    start: Partial<Record<FestivalDateRule, number>>;
    end: Partial<Record<FestivalDateRule, number>>;
  } | undefined;
  const nextDayTithiByRule = () => {
    if (nextDayTithiMemo !== undefined) return nextDayTithiMemo;
    const start: TithiByRule = {};
    const end: TithiByRule = {};
    try {
      const nextSunsetUtc = computeSunset(nextSunriseUtc, location);
      const base = nextSunriseUtc.getTime();
      const span = nextSunsetUtc.getTime() - base;
      start.madhyahna = tithiAt(new Date(base + span / 4));
      start.aparahna = tithiAt(new Date(base + (span * 3) / 5));
      end.madhyahna = tithiAt(new Date(base + span / 2));
      end.aparahna = tithiAt(new Date(base + (span * 8) / 10));
    } catch { /* no sunset: leave empty */ }
    nextDayTithiMemo = { start, end };
    return nextDayTithiMemo;
  };

  let nextDayNakshatraMemo: {
    start: Partial<Record<FestivalDateRule, number>>;
    end: Partial<Record<FestivalDateRule, number>>;
  } | undefined;
  const nextDayNakshatraByRule = () => {
    if (nextDayNakshatraMemo !== undefined) return nextDayNakshatraMemo;
    const start: Partial<Record<FestivalDateRule, number>> = {};
    const end: Partial<Record<FestivalDateRule, number>> = {};
    try {
      const nextSunsetUtc = computeSunset(nextSunriseUtc, location);
      const base = nextSunriseUtc.getTime();
      const span = nextSunsetUtc.getTime() - base;
      start.madhyahna = nakshatraAt(new Date(base + span / 4));
      start.aparahna = nakshatraAt(new Date(base + (span * 3) / 5));
      end.madhyahna = nakshatraAt(new Date(base + span / 2));
      end.aparahna = nakshatraAt(new Date(base + (span * 8) / 10));
    } catch { /* no sunset: leave empty */ }
    nextDayNakshatraMemo = { start, end };
    return nextDayNakshatraMemo;
  };

  let remainingPakshaMemo: ReadonlySet<number> | undefined;
  const remainingPakshaSunriseNakshatras = (): ReadonlySet<number> => {
    if (remainingPakshaMemo !== undefined) return remainingPakshaMemo;
    const startedShukla = tithiIndexAtSunrise < TOTAL_TITHIS / 2;
    const found = new Set<number>([nakshatraOf(siderealMoonAtSunrise)]);
    let cursor = sunriseUtc;
    for (let i = 0; i < 16; i++) {   // 16 is a backstop; the paksha test is the exit
      let next: Date;
      try {
        next = computeSunrise(new Date(cursor.getTime() + 22 * 3600_000), location);
      } catch {
        break;
      }
      if (getTithiIndexFromLons(getMoon(next), getSun(next)) < TOTAL_TITHIS / 2 !== startedShukla) break;
      found.add(nakshatraAt(next));
      cursor = next;
    }
    remainingPakshaMemo = found;
    return found;
  };

  const yesterdaySunsetUtc = computeSunset(yesterdaySunriseUtc, location);
  const yesterdayDayLengthMs = yesterdaySunsetUtc.getTime() - yesterdaySunriseUtc.getTime();
  const yesterdayMadhyahnaUtc = new Date(yesterdaySunriseUtc.getTime() + yesterdayDayLengthMs / 2);
  const yesterdayAparahnaUtc = new Date(
    yesterdaySunriseUtc.getTime() + (yesterdayDayLengthMs * 8) / 10,
  );
  const yesterdayPradoshaUtc = new Date(yesterdaySunsetUtc.getTime() + 60 * 60_000);
  const yesterdayNishitaUtc = new Date((yesterdaySunsetUtc.getTime() + sunriseUtc.getTime()) / 2);

  const priorDayTithiByRule: TithiByRule = {
    madhyahna: tithiAt(yesterdayMadhyahnaUtc),
    aparahna:  tithiAt(yesterdayAparahnaUtc),
    pradosha:  tithiAt(yesterdayPradoshaUtc),
    nishita:   tithiAt(yesterdayNishitaUtc),
  };
  const priorDayTithiByRuleStart: TithiByRule = {
    aparahna: tithiAt(new Date(yesterdaySunriseUtc.getTime() + (yesterdayDayLengthMs * 3) / 5)),
  };
  if (tithiByRule.chandrodaya === 18 || tithiIndexAtSunrise === 18) {
    const yesterdayMoonriseUtc = getMoonrise(yesterdaySunriseUtc, location);
    if (yesterdayMoonriseUtc && yesterdayMoonriseUtc.getTime() < sunriseUtc.getTime()) {
      priorDayTithiByRule.chandrodaya = tithiAt(yesterdayMoonriseUtc);
    }
  }

  const rashiAtSunset = Math.floor(getSun(sunsetUtc) / 30) % 12;
  const rashiAtYesterdaySunset = Math.floor(getSun(yesterdaySunsetUtc) / 30) % 12;
  const sankrantiRashi: number | null =
    rashiAtYesterdaySunset !== rashiAtSunset ? rashiAtSunset : null;

  let nextDaySankrantiRashi: number | null = null;
  try {
    const tomorrowSunsetUtc = computeSunset(nextSunriseUtc, location);
    const rashiAtTomorrowSunset = Math.floor(getSun(tomorrowSunsetUtc) / 30) % 12;
    if (rashiAtSunset !== rashiAtTomorrowSunset) {
      nextDaySankrantiRashi = rashiAtTomorrowSunset;
    }
  } catch (e: unknown) {
    if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
      throw e;
    }
  }

  const rashiAtSunrise = Math.floor(siderealSunAtSunrise / 30) % 12;
  const rashiAtYesterdaySunrise = Math.floor(getSun(yesterdaySunriseUtc) / 30) % 12;
  let prevDaySankrantiRashi: number | null = null;
  if (rashiAtYesterdaySunrise !== rashiAtYesterdaySunset) {
    prevDaySankrantiRashi = rashiAtYesterdaySunset;
  } else if (
    Math.floor(getSun(new Date(yesterdaySunriseUtc.getTime() - 24 * 3600_000)) / 30) % 12
      !== rashiAtYesterdaySunrise
  ) {
    try {
      const dayBeforeYesterdaySunriseUtc = computeSunrise(
        new Date(yesterdaySunriseUtc.getTime() - 30 * 3600_000), location,
      );
      const dayBeforeYesterdaySunsetUtc = computeSunset(dayBeforeYesterdaySunriseUtc, location);
      const rashiAtDayBeforeYesterdaySunset =
        Math.floor(getSun(dayBeforeYesterdaySunsetUtc) / 30) % 12;
      if (rashiAtDayBeforeYesterdaySunset !== rashiAtYesterdaySunrise) {
        prevDaySankrantiRashi = rashiAtYesterdaySunrise;
      }
    } catch (e: unknown) {
      if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
        throw e;
      }
    }
  }

  const rashiAt = (d: Date): number => Math.floor(getSun(d) / 30) % 12;
  const nakshatraAtSunrise = nakshatraOf(siderealMoonAtSunrise);
  const nakshatraAtSunset = nakshatraAt(sunsetUtc);
  const nextDayNakshatraIndex = nakshatraAt(nextSunriseUtc);

  const KRITTIKA = 2;
  const VRISCHIKA = 7;
  /** Krittika's first sunrise-or-sunset day; a transit touching neither (polar) belongs to the day holding it. */
  const masikKarthigaiToday =
    (nakshatraAt(yesterdaySunsetUtc) !== KRITTIKA &&
      (nakshatraAtSunrise === KRITTIKA || nakshatraAtSunset === KRITTIKA)) ||
    (nakshatraAtSunrise === KRITTIKA - 1 && nakshatraAtSunset !== KRITTIKA &&
      nextDayNakshatraIndex === KRITTIKA + 1);
  /** Sunset of the Masik Karthigai day of the first Krittika transit from `startDays` days away, or null. */
  const masikKarthigaiSunsetFrom = (startDays: number): Date | null => {
    try {
      let rise = computeSunrise(new Date(sunriseUtc.getTime() + startDays * DAY_MS - 2 * 3600_000), location);
      for (let i = 0; i < 10; i++) {
        const set = computeSunset(rise, location);
        const nextRise = computeSunrise(set, location);
        const riseNakshatra = nakshatraAt(rise);
        if (riseNakshatra === KRITTIKA || nakshatraAt(set) === KRITTIKA ||
            (riseNakshatra === KRITTIKA - 1 && nakshatraAt(nextRise) === KRITTIKA + 1)) {
          return set;
        }
        rise = nextRise;
      }
    } catch { /* polar: no such day */ }
    return null;
  };
  /** In-month full moon first, then the nearer full moon; ties go to the earlier day. */
  const karthigaiDeepamKey = (sunset: Date): [number, number] => {
    const full = searchMoonPhase(180, new Date(sunset.getTime() - 5 * DAY_MS), 10);
    if (full === null) return [1, Infinity];
    return [rashiAt(full) === VRISCHIKA ? 0 : 1, Math.abs(full.getTime() - sunset.getTime())];
  };
  const karthigaiDeepamToday = (): boolean => {
    if (rashiAtSunset !== VRISCHIKA) return false;
    const mine = karthigaiDeepamKey(sunsetUtc);
    for (const startDays of [-31, 24]) {
      const other = masikKarthigaiSunsetFrom(startDays);
      if (other === null || rashiAt(other) !== VRISCHIKA) continue;
      const theirs = karthigaiDeepamKey(other);
      if (theirs[0] < mine[0] ||
          (theirs[0] === mine[0] && (theirs[1] < mine[1] || (theirs[1] === mine[1] && startDays < 0)))) {
        return false;
      }
    }
    return true;
  };

  /** Walks sunrises from 20 days ahead while the Sun stays in today's sunrise rashi. */
  const nakshatraLaterInSolarMonth = (nakshatra: number): boolean => {
    const before = (nakshatra + 26) % 27;
    const after = (nakshatra + 1) % 27;
    try {
      let prev = computeSunrise(new Date(sunriseUtc.getTime() + 20 * DAY_MS - 2 * 3600_000), location);
      if (rashiAt(prev) !== rashiAtSunrise) return false;
      let prevNakshatra = nakshatraAt(prev);
      for (let i = 0; i < 16; i++) {   // 16 is a backstop; the month test is the exit
        const next = computeSunrise(new Date(prev.getTime() + 22 * 3600_000), location);
        const nextNakshatra = nakshatraAt(next);
        if (prevNakshatra === before && nextNakshatra === after) return true;
        if (rashiAt(next) !== rashiAtSunrise) return false;
        if (nextNakshatra === nakshatra && prevNakshatra !== nakshatra) return true;
        prev = next;
        prevNakshatra = nextNakshatra;
      }
    } catch { /* polar: stop the walk */ }
    return false;
  };

  /** Nepali months are solar, and the civil day holding the Sankranti opens the new one. */
  let varaMasaIndex = chandramasa.index;
  if (resolveRegionAlias(region) === 'nepal') {
    const local = new Date(sunriseUtc.getTime() + offsetMinutes * 60_000);
    const dayEndUtc = new Date(Date.UTC(
      local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1,
    ) - offsetMinutes * 60_000);
    varaMasaIndex = (rashiAt(dayEndUtc) + 1) % 12;
  }

  let vaisakhiToday = false;
  let vishuToday = false;
  let pohelaBoishakhToday = false;
  if (sankrantiRashi === 0 || nextDaySankrantiRashi === 0 || prevDaySankrantiRashi === 0) {
    const localMidnightUtc = (dayOffset: number): Date => {
      const local = new Date(sunriseUtc.getTime() + offsetMinutes * 60_000);
      return new Date(Date.UTC(
        local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset,
      ) - offsetMinutes * 60_000);
    };
    const rashiAtMidnight = (dayOffset: number): number =>
      Math.floor(getSun(localMidnightUtc(dayOffset)) / 30) % 12;
    const midnightToday = rashiAtMidnight(0);
    vaisakhiToday = midnightToday !== 0 && rashiAtMidnight(1) === 0;
    pohelaBoishakhToday = midnightToday === 0 && rashiAtMidnight(-1) !== 0;
    vishuToday = rashiAtSunrise === 0 && rashiAtYesterdaySunrise !== 0;
  }

  let ekadashiDashamiViddha = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    const tithiAtArunodaya = tithiAt(arunodayaUtc);
    const dashamiIndex = tithiIndexAtSunrise === 10 ? 9 : 24;
    ekadashiDashamiViddha = tithiAtArunodaya === dashamiIndex;
  }

  let vaishnavaDwadashiToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const ekadashiIndex = tithiIndexAtSunrise === 11 ? 10 : 25;
    const dashamiIndex = tithiIndexAtSunrise === 11 ? 9 : 24;
    const yesterdaySunriseTithi = tithiAt(yesterdaySunriseUtc);
    if (yesterdaySunriseTithi === ekadashiIndex) {
      const yesterdayArunodayaUtc = new Date(yesterdaySunriseUtc.getTime() - 96 * 60_000);
      const yesterdayArunodayaTithi = tithiAt(yesterdayArunodayaUtc);
      vaishnavaDwadashiToday = yesterdayArunodayaTithi === dashamiIndex;
    }
  }

  const tithiAtNextSunrise = tithiAt(nextSunriseUtc);

  const kshayaTithiIndices = new Set<number>();
  if (tithiIndexAtSunrise !== tithiAtNextSunrise) {
    for (
      let i = (tithiIndexAtSunrise + 1) % TOTAL_TITHIS;
      i !== tithiAtNextSunrise && kshayaTithiIndices.size < TOTAL_TITHIS;
      i = (i + 1) % TOTAL_TITHIS
    ) {
      kshayaTithiIndices.add(i);
    }
  }
  const nextDayMasaForKshaya =
    kshayaTithiIndices.has(0) && nextDayMasa !== undefined ? nextDayMasa() : undefined;
  let ekadashiKshayaToday = false;
  if (tithiIndexAtSunrise === 9 || tithiIndexAtSunrise === 24) {
    const dwadashiIndex = tithiIndexAtSunrise === 9 ? 11 : 26;
    ekadashiKshayaToday = tithiAtNextSunrise === dwadashiIndex;
  }
  let ekadashiGaunaToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const dashamiIndex = tithiIndexAtSunrise === 11 ? 9 : 24;
    ekadashiGaunaToday = tithiAt(yesterdaySunriseUtc) === dashamiIndex;
  }
  let ekadashiVriddhaDwadashiToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const ekadashiIndex = tithiIndexAtSunrise === 11 ? 10 : 25;
    ekadashiVriddhaDwadashiToday =
      tithiAtNextSunrise === tithiIndexAtSunrise
      && tithiAt(yesterdaySunriseUtc) === ekadashiIndex;
  }
  let ekadashiVriddhaFirstDay = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    ekadashiVriddhaFirstDay = tithiAtNextSunrise === tithiIndexAtSunrise;
  }
  const tithiAtDayAfterSunrise = (): number | null => {
    try {
      const tomorrowSunsetUtc = computeSunset(nextSunriseUtc, location);
      return tithiAt(computeSunrise(tomorrowSunsetUtc, location));
    } catch (e: unknown) {
      if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
        throw e;
      }
      return null;
    }
  };
  let ekadashiTrisprishaToday = false;
  if (tithiIndexAtSunrise === 9 || tithiIndexAtSunrise === 24) {
    const ekadashiIndex = tithiIndexAtSunrise === 9 ? 10 : 25;
    const trayodashiIndex = tithiIndexAtSunrise === 9 ? 12 : 27;
    if (tithiAtNextSunrise === ekadashiIndex) {
      ekadashiTrisprishaToday = tithiAtDayAfterSunrise() === trayodashiIndex;
    }
  }
  let ekadashiVriddhaDwadashiTomorrow = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    const dwadashiIndex = tithiIndexAtSunrise === 10 ? 11 : 26;
    if (tithiAtNextSunrise === dwadashiIndex) {
      ekadashiVriddhaDwadashiTomorrow = tithiAtDayAfterSunrise() === dwadashiIndex;
    }
  }
  let ekadashiTrisprishaYesterday = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    const trayodashiIndex = tithiIndexAtSunrise === 10 ? 12 : 27;
    ekadashiTrisprishaYesterday = tithiAtNextSunrise === trayodashiIndex;
  }
  let ekadashiVriddhaTrisprisha = false;
  if (ekadashiVriddhaFirstDay) {
    const trayodashiIndex = tithiIndexAtSunrise === 10 ? 12 : 27;
    ekadashiVriddhaTrisprisha = tithiAtDayAfterSunrise() === trayodashiIndex;
  }

  const KRISHNA_ASHTAMI = 22;
  const KRISHNA_SAPTAMI = 21;
  const ROHINI = 3;
  const nishitaWindow = (sunset: Date, sunriseAfter: Date): [Date, Date] => {
    const centerMs = (sunset.getTime() + sunriseAfter.getTime()) / 2;
    const halfMs = (sunriseAfter.getTime() - sunset.getTime()) / 30;
    return [new Date(centerMs - halfMs), new Date(centerMs + halfMs)];
  };
  const windowHas = (w: [Date, Date], pred: (d: Date) => boolean): boolean =>
    pred(w[0]) || pred(w[1]);
  let janmashtamiNishita:
    | { ashtamiAtNishita: boolean; rohiniAtNishita: boolean; nextDayClaims: boolean; prevDayClaimed: boolean }
    | undefined;
  if (tithiIndexAtSunrise === KRISHNA_ASHTAMI || tithiIndexAtSunrise === KRISHNA_SAPTAMI) {
    const wToday = nishitaWindow(sunsetUtc, nextSunriseUtc);
    const ashtamiAtNishita = windowHas(wToday, (d) => tithiAt(d) === KRISHNA_ASHTAMI);
    const rohiniAtNishita = windowHas(wToday, (d) => nakshatraAt(d) === ROHINI);
    let nextDayClaims = false;
    let prevDayClaimed = false;
    if (tithiIndexAtSunrise === KRISHNA_ASHTAMI) {
      if (tithiAt(yesterdaySunriseUtc) === KRISHNA_ASHTAMI) {
        const wYesterday = nishitaWindow(yesterdaySunsetUtc, sunriseUtc);
        prevDayClaimed =
          windowHas(wYesterday, (d) => tithiAt(d) === KRISHNA_ASHTAMI) ||
          windowHas(wYesterday, (d) => nakshatraAt(d) === ROHINI);
      }
    } else if (ashtamiAtNishita && tithiAtNextSunrise === KRISHNA_ASHTAMI) {
      try {
        const tomorrowSunsetUtc = computeSunset(nextSunriseUtc, location);
        const dayAfterSunriseUtc = computeSunrise(tomorrowSunsetUtc, location);
        const wTomorrow = nishitaWindow(tomorrowSunsetUtc, dayAfterSunriseUtc);
        nextDayClaims =
          windowHas(wTomorrow, (d) => tithiAt(d) === KRISHNA_ASHTAMI) ||
          windowHas(wTomorrow, (d) => nakshatraAt(d) === ROHINI);
      } catch (e: unknown) {
        if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
          throw e;
        }
      }
    }
    janmashtamiNishita = { ashtamiAtNishita, rohiniAtNishita, nextDayClaims, prevDayClaimed };
  }

  const dayGeometry = buildDayGeometry(
    { sunrise: sunriseUtc.getTime(), sunset: sunsetUtc.getTime(), nextSunrise: nextSunriseUtc.getTime() },
    location, offsetMinutes, getMoon, getSun,
  );

  const formatClock = (d: Date): string => {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  return computeFestivals(
    {
      tithiIndex: tithiIndexAtSunrise,
      nakshatraIndex: nakshatraOf(siderealMoonAtSunrise),
      chandraMasaIndex: chandramasa.amantaIndex,
      varaMasaIndex,
      amantaMasaName: chandramasa.amantaName,
      purnimantaMasaName: chandramasa.purnimantaName,
      isAdhika: chandramasa.isAdhika,
      varaIndex,
      solarMasaIndex: rashiAtSunrise,
      tithiByRule,
      tithiByRuleStart,
      priorDayTithiByRule,
      priorDayTithiByRuleStart,
      janmashtamiNishita,
      masikKarthigaiToday,
      karthigaiDeepamToday,
      nakshatraByRule,
      nakshatraByRuleStart,
      priorDayNakshatraIndex,
      nextDayNakshatraIndex,
      priorDaySolarMasaIndex: rashiAtYesterdaySunrise,
      nakshatraLaterInSolarMonth,
      remainingPakshaSunriseNakshatras,
      nextDayTithiByRule,
      nextDayNakshatraByRule,
      kshayaTithiIndices,
      ...(nextDayMasa === undefined ? {} : { nextDayMasa }),
      dayGeometry,
      ...(nextDayMasaForKshaya === undefined
        ? {}
        : { nextDayMasaIndex: nextDayMasaForKshaya.index, nextDayIsAdhika: nextDayMasaForKshaya.isAdhika }),
      sankrantiRashi,
      nextDaySankrantiRashi,
      prevDaySankrantiRashi,
      vaisakhiToday,
      vishuToday,
      pohelaBoishakhToday,
      ekadashiDashamiViddha,
      vaishnavaDwadashiToday,
      ekadashiKshayaToday,
      ekadashiGaunaToday,
      ekadashiVriddhaDwadashiToday,
      ekadashiVriddhaDwadashiTomorrow,
      ekadashiVriddhaFirstDay,
      ekadashiVriddhaTrisprisha,
      ekadashiTrisprishaToday,
      ekadashiTrisprishaYesterday,
      bhadra: bhadraUtc
        ? {
            start: utcToLocalDisplay(bhadraUtc.start, offsetMinutes),
            end: utcToLocalDisplay(bhadraUtc.end, offsetMinutes),
          }
        : null,
      formatClock,
      region: resolveRegionAlias(region),
    },
    (key) => t.festivalNames[key] ?? (t.misc as Record<string, string>)[key] ?? key,
    (idx) => resolveMasaName(idx, lang),
  );
}

const HOUR_MS = 3600_000;
/** The elongation solver's fixed bracket grid: one crossing per cell, the same cell whoever asks. */
const CROSSING_CELL_MS = 6 * HOUR_MS;
const CROSSING_TOLERANCE_MS = 1000;
/** Mean Moon-Sun elongation rate, degrees per day: only seeds the grid walk. */
const MEAN_ELONGATION_DEG_PER_DAY = 12.19;

function isPolarRiseSet(e: unknown): boolean {
  return e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET');
}

/**
 * Days are chained from today through each day's own sunset and next sunrise, the triple `getDailyPanchang`
 * builds for that day, so every day measures the same windows. A previous sunrise closer than 12 h, or one
 * whose day does not end at the next day's sunrise, is a polar gap.
 */
function buildDayGeometry(
  today: KalaDay,
  location: GeoLocation,
  offsetMinutes: number,
  getMoon: (d: Date) => number,
  getSun: (d: Date) => number,
): DayGeometry {
  const days = new Map<number, KalaDay | null>([[0, today]]);
  const day = (k: number): KalaDay | null => {
    const cached = days.get(k);
    if (cached !== undefined) return cached;
    let out: KalaDay | null = null;
    try {
      if (k > 0) {
        const prev = day(k - 1);
        if (prev !== null) {
          const sunset = computeSunset(new Date(prev.nextSunrise), location).getTime();
          const nextSunrise = computeSunrise(new Date(sunset), location).getTime();
          out = { sunrise: prev.nextSunrise, sunset, nextSunrise };
        }
      } else {
        const next = day(k + 1);
        if (next !== null) {
          const sunrise = computeSunrise(new Date(next.sunrise - 26 * HOUR_MS), location).getTime();
          if (next.sunrise - sunrise >= 12 * HOUR_MS) {
            const sunset = computeSunset(new Date(sunrise), location).getTime();
            const nextSunrise = computeSunrise(new Date(sunset), location).getTime();
            if (nextSunrise === next.sunrise) out = { sunrise, sunset, nextSunrise };
          }
        }
      }
    } catch (e: unknown) {
      if (!isPolarRiseSet(e)) throw e;
    }
    days.set(k, out);
    return out;
  };

  const elongation = (ms: number): number => normalize360(getMoon(new Date(ms)) - getSun(new Date(ms)));
  const reached = new Map<number, number>();
  const elongationReaches = (deg: number, nearMs: number): number => {
    const memo = reached.get(deg);
    if (memo !== undefined) return memo;
    const before = (ms: number): boolean => normalize360(elongation(ms) - deg) > 180;
    const lead = normalize360(deg - elongation(nearMs));
    const aheadDays = (lead > 180 ? lead - 360 : lead) / MEAN_ELONGATION_DEG_PER_DAY;
    let lo = Math.floor((nearMs + aheadDays * 86_400_000) / CROSSING_CELL_MS) * CROSSING_CELL_MS;
    for (let i = 0; i < 64 && !before(lo); i++) lo -= CROSSING_CELL_MS;
    for (let i = 0; i < 64 && before(lo + CROSSING_CELL_MS); i++) lo += CROSSING_CELL_MS;
    let hi = lo + CROSSING_CELL_MS;
    while (hi - lo > CROSSING_TOLERANCE_MS) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (before(mid)) lo = mid;
      else hi = mid;
    }
    reached.set(deg, hi);
    return hi;
  };

  return {
    today,
    day,
    tithiAt: (ms) => getTithiIndexFromLons(getMoon(new Date(ms)), getSun(new Date(ms))),
    nakshatraAt: (ms) => nakshatraOf(getMoon(new Date(ms))),
    elongationReaches,
    localDay: (ms) => Math.floor((ms + offsetMinutes * 60_000) / 86_400_000),
  };
}
