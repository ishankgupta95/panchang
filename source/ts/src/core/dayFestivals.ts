import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getMoonrise } from '../astronomy/moonrise';
import { PanchangError } from '../types/errors';
import { nakshatraOf, TOTAL_TITHIS } from '../utils/constants';
import { utcToLocalDisplay } from '../utils/timezone';
import { getTithiIndexFromLons } from './tithi';
import { computeFestivals, type FestivalDateRule } from './festivals';
import { resolveRegionAlias } from './regionAlias';
import { resolveMasaName } from '../i18n/resolver';
import type { GeoLocation } from '../types/location';
import type { FestivalRegion, Language, LegacyFestivalRegion } from '../types/options';
import type { ChandraMasaInfo, FestivalInfo, UtcWindow } from '../types/elements';
import type { PanchangTranslations } from '../i18n/types';

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
  const nakshatraIndicesInDay = new Set<number>([
    nakshatraAt(sunriseUtc),
    nakshatraAt(madhyahnaUtc),
    nakshatraAt(sunsetUtc),
    nakshatraAt(nishitaUtc),
  ]);
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
      nakshatraIndicesInDay,
      nakshatraByRule,
      nakshatraByRuleStart,
      priorDayNakshatraIndex,
      remainingPakshaSunriseNakshatras,
      nextDayTithiByRule,
      nextDayNakshatraByRule,
      kshayaTithiIndices,
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
