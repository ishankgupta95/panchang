import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getMoonrise } from '../astronomy/moonrise';
import { PanchangError } from '../types/errors';
import { nakshatraOf } from '../utils/constants';
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
    varaIndex, chandramasa, lang, t, region,
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

  // A nakshatra spell runs ≥ ~22 h, so four samples catch every transition.
  const nakshatraAt = (d: Date) => nakshatraOf(getMoon(d));
  const nakshatraIndicesInDay = new Set<number>([
    nakshatraAt(sunriseUtc),
    nakshatraAt(madhyahnaUtc),
    nakshatraAt(sunsetUtc),
    nakshatraAt(nishitaUtc),
  ]);

  const yesterdaySunriseUtc = computeSunrise(
    new Date(sunriseUtc.getTime() - 24 * 3600_000 - 2 * 3600_000),
    location,
  );
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
  // 18 = Krishna Chaturthi; dedupes a vriddha spell spanning two moonrises.
  if (tithiByRule.chandrodaya === 18 || tithiIndexAtSunrise === 18) {
    const yesterdayMoonriseUtc = getMoonrise(yesterdaySunriseUtc, location);
    if (yesterdayMoonriseUtc && yesterdayMoonriseUtc.getTime() < sunriseUtc.getTime()) {
      priorDayTithiByRule.chandrodaya = tithiAt(yesterdayMoonriseUtc);
    }
  }

  // The almanac's rule: day D observes iff the transit falls in (sunset D−1, sunset D].
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
      // Unreachable while the −26 h / −30 h offsets stand; kept because changing one revives it.
    }
  }

  // Four new-year traditions key the Mesha transit MOMENT differently: Puthandu
  // = the generic Sankranti day, Vaisakhi = the CIVIL day holding it, Vishu =
  // the first sunrise at/after it, Pohela Boishakh = the day AFTER its civil day.
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

  // Only the VAISHNAVA fast rejects Dashami-viddha, deferring to tomorrow's Dwadashi.
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

  // KSHAYA: the Ekadashi falls wholly between two sunrises. Smarta fasts on its
  // begin day, Vaishnava (Gauna) tomorrow.
  const tithiAtNextSunrise = tithiAt(nextSunriseUtc);
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
  // VRIDDHA DWADASHI (Pakshavardhini): the Dwadashi prevails at TWO sunrises.
  // Smarta stays on the Ekadashi day, Vaishnava moves to the first Dwadashi day.
  let ekadashiVriddhaDwadashiToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const ekadashiIndex = tithiIndexAtSunrise === 11 ? 10 : 25;
    ekadashiVriddhaDwadashiToday =
      tithiAtNextSunrise === tithiIndexAtSunrise
      && tithiAt(yesterdaySunriseUtc) === ekadashiIndex;
  }
  // VRIDDHA: Ekadashi prevails at TWO sunrises. The fast is a Mahadwadashi on
  // the SECOND day only; the almanac lists no fast at all on the first.
  let ekadashiVriddhaFirstDay = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    ekadashiVriddhaFirstDay = tithiAtNextSunrise === tithiIndexAtSunrise;
  }
  // TRISPRISHA (kshaya DWADASHI): the Dwadashi after tomorrow's Ekadashi has no
  // sunrise, so every tradition's fast moves to TODAY.
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

  // Janmashtami, the almanac's Smarta ladder: the UDAYA-Ashtami day wins whenever
  // Ashtami or Rohini touches ITS nishita, else the day Ashtami covers nishita
  // wins even when Saptami-viddha. Nishita = the midnight-centred 1/15th night.
  const KRISHNA_ASHTAMI = 22;
  const KRISHNA_SAPTAMI = 21;
  const ROHINI = 3;
  const nishitaWindow = (sunset: Date, sunriseAfter: Date): [Date, Date] => {
    const centerMs = (sunset.getTime() + sunriseAfter.getTime()) / 2;
    const halfMs = (sunriseAfter.getTime() - sunset.getTime()) / 30;
    return [new Date(centerMs - halfMs), new Date(centerMs + halfMs)];
  };
  // No tithi or nakshatra spell fits inside a ~48-min muhurta, so "touches the
  // window" ⟺ present at either edge.
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
