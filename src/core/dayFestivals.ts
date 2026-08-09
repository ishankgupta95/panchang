import { computeSunrise, computeSunset } from '../astronomy/sunrise';
import { getMoonrise } from '../astronomy/moonrise';
import { PanchangError } from '../types/errors';
import { nakshatraOf } from '../utils/constants';
import { utcToLocalDisplay } from '../utils/timezone';
import { getTithiIndexFromLons } from './tithi';
import { computeChandraMasa } from './chandramasa';
import { computeFestivals, type FestivalDateRule } from './festivals';
import { resolveRegionAlias } from './regionAlias';
import { resolveChandraMasaName, resolveMasaName } from '../i18n/resolver';
import type { NewMoonBounds } from '../astronomy/newMoon';
import type { GeoLocation } from '../types/location';
import type { FestivalRegion, Language, LegacyFestivalRegion, MasaSystem } from '../types/options';
import type { ChandraMasaInfo, FestivalInfo, UtcWindow } from '../types/elements';
import type { PanchangTranslations } from '../i18n/types';

/** Everything the festival pipeline needs from the surrounding daily panchang. */
export interface DayFestivalInputs {
  sunriseUtc: Date;
  sunsetUtc: Date;
  nextSunriseUtc: Date;
  location: GeoLocation;
  /** UTC offset in minutes, for rendering Bhadra clock times in descriptions. */
  offsetMinutes: number;
  /** Tithi index at sunrise (0..29). */
  tithiIndexAtSunrise: number;
  siderealMoonAtSunrise: number;
  siderealSunAtSunrise: number;
  varaIndex: number;
  chandramasa: ChandraMasaInfo;
  masaSystem: MasaSystem;
  lang: Language;
  t: PanchangTranslations;
  region?: FestivalRegion | LegacyFestivalRegion;
  /** First moonrise at/after local midnight, or `null` when not yet resolved. */
  moonriseUtc: Date | null;
  /** Bhadra window overlapping the Hindu day, or `null`. */
  bhadraUtc: UtcWindow | null;
  getMoon: (d: Date) => number;
  getSun: (d: Date) => number;
  getBounds: (ref: Date) => NewMoonBounds;
}

/**
 * Resolve every festival emission for one Hindu day.
 *
 * This is the most expensive optional block of `getDailyPanchang`: beyond the
 * day's own longitude samples it needs the *prior* day's sunrise/sunset (for
 * the long-tithi dedupe and Ekadashi viddha), the *following* day's solar
 * transit (for day-before observances like Lohri), and the prior day's Chandra
 * Masa. It lives here rather than inline so the daily entry point can skip it
 * wholesale via the `'festivals'` section, and so the vyapini/viddha reasoning
 * reads as one unit.
 *
 * Anchors within the Hindu day (sunrise → nextSunrise). Where a kala spans a
 * range we anchor near its END, so a tithi that only just entered the kala is
 * not counted as "pervading" it. That also prevents duplicate emission the next
 * day when a long tithi barely overlaps into that day's kala (e.g. an Amavasya
 * spanning two pradoshas).
 *
 *   madhyahna   — mid-day, midpoint of sunrise-to-sunset
 *   aparahna    — end of aparahna kala (0.8 of day-length after sunrise)
 *   pradosha    — end of pradosha kala (sunset + ~60 min = 2.5 ghatikas)
 *   nishita     — local midnight, midpoint of sunset-to-nextSunrise
 *   chandrodaya — moonrise within the Hindu day (null if the moon doesn't rise)
 *   arunodaya   — 96 minutes before sunrise (Ekadashi Dashami-viddha check)
 */
export function computeDayFestivals(input: DayFestivalInputs): FestivalInfo[] {
  const {
    sunriseUtc, sunsetUtc, nextSunriseUtc, location, offsetMinutes,
    tithiIndexAtSunrise, siderealMoonAtSunrise, siderealSunAtSunrise,
    varaIndex, chandramasa, masaSystem, lang, t, region,
    moonriseUtc, bhadraUtc, getMoon, getSun, getBounds,
  } = input;

  const dayLengthMs = sunsetUtc.getTime() - sunriseUtc.getTime();
  const madhyahnaUtc = new Date(sunriseUtc.getTime() + dayLengthMs / 2);
  const aparahnaUtc = new Date(sunriseUtc.getTime() + (dayLengthMs * 8) / 10);
  const pradoshaUtc = new Date(sunsetUtc.getTime() + 60 * 60_000);
  const nishitaUtc = new Date((sunsetUtc.getTime() + nextSunriseUtc.getTime()) / 2);
  const arunodayaUtc = new Date(sunriseUtc.getTime() - 96 * 60_000);

  const tithiAt = (d: Date) => getTithiIndexFromLons(getMoon(d), getSun(d));

  // Anchors for the START of each kala (used by the long-tithi dedupe).
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

  // Moonrise within this Hindu day (may be null if the moon doesn't rise in the
  // window). `moonriseUtc` is the first rise at/after local midnight, and local
  // midnight precedes sunrise — so whenever that rise already falls at/after
  // sunrise it is *also* the first rise at/after sunrise, and no second search
  // is needed. Only when the moon rose between midnight and sunrise do the two
  // queries differ, which is the minority of days.
  const moonriseInDayUtc =
    moonriseUtc !== null && moonriseUtc.getTime() >= sunriseUtc.getTime()
      ? moonriseUtc
      : getMoonrise(sunriseUtc, location);
  if (moonriseInDayUtc && moonriseInDayUtc.getTime() < nextSunriseUtc.getTime()) {
    tithiByRule.chandrodaya = tithiAt(moonriseInDayUtc);
    tithiByRuleStart.chandrodaya = tithiByRule.chandrodaya;
  }

  // Set of nakshatra indices that occur during this Hindu day. Used by
  // nakshatra-prevailing rules (e.g. Masik Karthigai = Krittika anywhere
  // during the day, not strictly at sunrise). Sample at sunrise / midday /
  // sunset / midnight — this catches both same-nakshatra-all-day cases and
  // single mid-day transitions (a 24h nakshatra spans at most 2 calendar days).
  const nakshatraAt = (d: Date) => nakshatraOf(getMoon(d));
  const nakshatraIndicesInDay = new Set<number>([
    nakshatraAt(sunriseUtc),
    nakshatraAt(madhyahnaUtc),
    nakshatraAt(sunsetUtc),
    nakshatraAt(nishitaUtc),
  ]);

  // Yesterday's tithi-by-rule values: we re-run the same anchor math a day back
  // so the dedupe only suppresses when yesterday genuinely held the same tithi
  // across its kala. This is a cheap extra set of longitude samples.
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

  // Sankranti: transit-time search. Compare Sun's rashi at sunrise vs nextSunrise;
  // if different, a transit occurred during this Hindu day. We emit Sankranti on
  // the day containing the transit (the unambiguous rule for sunrise-to-sunrise days).
  const rashiAtSunrise = Math.floor(siderealSunAtSunrise / 30) % 12;
  const rashiAtNextSunrise = Math.floor(getSun(nextSunriseUtc) / 30) % 12;
  const sankrantiRashi: number | null =
    rashiAtSunrise !== rashiAtNextSunrise ? rashiAtNextSunrise : null;

  // Next-day Sankranti — Sun's rashi at the sunrise AFTER nextSunrise. Used
  // by "day before Sankranti" observances (Lohri = day before Makara, Pahili
  // Raja = day before Karka). We detect transit across TOMORROW'S Hindu day
  // (nextSunrise → dayAfterSunrise) and return the target rashi. Anchored
  // via tomorrow's sunset so `SearchRiseSet` unambiguously advances past
  // tomorrow's sunrise.
  let nextDaySankrantiRashi: number | null = null;
  try {
    const tomorrowSunsetUtc = computeSunset(nextSunriseUtc, location);
    const dayAfterSunriseUtc = computeSunrise(tomorrowSunsetUtc, location);
    const rashiAtDayAfterSunrise = Math.floor(getSun(dayAfterSunriseUtc) / 30) % 12;
    if (rashiAtNextSunrise !== rashiAtDayAfterSunrise) {
      nextDaySankrantiRashi = rashiAtDayAfterSunrise;
    }
  } catch (e: unknown) {
    if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
      throw e;
    }
    // Polar days with no tomorrow sunrise/sunset: skip next-day marker.
  }

  // Prev-day Sankranti — Sun's rashi at YESTERDAY's sunrise vs today's. If
  // they differ, a transit happened during yesterday's Hindu day. Used by
  // "day after Sankranti" observances (Basi Raja = day after Karka). The
  // yesterdaySunriseUtc and yesterdaySun longitudes are already computed for
  // viddha / priorMasaWasAdhika, so this is a cheap reuse.
  const rashiAtYesterdaySunrise = Math.floor(getSun(yesterdaySunriseUtc) / 30) % 12;
  const prevDaySankrantiRashi: number | null =
    rashiAtYesterdaySunrise !== rashiAtSunrise ? rashiAtSunrise : null;

  // Ekadashi Dashami-viddha: if tithi-at-sunrise is Ekadashi (10/25) and
  // tithi-at-arunodaya (~96 min before sunrise) is Dashami (9/24), the Ekadashi
  // is Dashami-viddha and the Smarta fast shifts to Dwadashi.
  let ekadashiDashamiViddha = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    const tithiAtArunodaya = tithiAt(arunodayaUtc);
    const dashamiIndex = tithiIndexAtSunrise === 10 ? 9 : 24;
    ekadashiDashamiViddha = tithiAtArunodaya === dashamiIndex;
  }

  // Smarta-Dwadashi: did yesterday's sunrise hold a Dashami-viddha Ekadashi
  // AND today's sunrise hold Dwadashi (11 or 26)? If so, the Smarta fast
  // observed today rather than yesterday.
  let smartaDwadashiToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const ekadashiIndex = tithiIndexAtSunrise === 11 ? 10 : 25;
    const dashamiIndex = tithiIndexAtSunrise === 11 ? 9 : 24;
    const yesterdaySunriseTithi = tithiAt(yesterdaySunriseUtc);
    if (yesterdaySunriseTithi === ekadashiIndex) {
      const yesterdayArunodayaUtc = new Date(yesterdaySunriseUtc.getTime() - 96 * 60_000);
      const yesterdayArunodayaTithi = tithiAt(yesterdayArunodayaUtc);
      smartaDwadashiToday = yesterdayArunodayaTithi === dashamiIndex;
    }
  }

  // priorMasaWasAdhika: if today's amanta masa equals yesterday's amanta
  // masa AND yesterday was Adhika, today falls in the Nija that follows
  // an Adhika (relevant for `shift-to-nija` festivals).
  const yesterdayMoon = getMoon(yesterdaySunriseUtc);
  const yesterdaySun = getSun(yesterdaySunriseUtc);
  const yesterdayChandramasa = computeChandraMasa(
    yesterdaySun, yesterdayMoon,
    (idx, isAdhika) => resolveChandraMasaName(idx, lang, isAdhika),
    masaSystem,
    yesterdaySunriseUtc, getSun, getBounds,
  );
  const priorMasaWasAdhika =
    yesterdayChandramasa.amantaIndex === chandramasa.amantaIndex &&
    yesterdayChandramasa.isAdhika &&
    !chandramasa.isAdhika;

  // Format a clock string from offset-adjusted local Date for descriptions.
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
      purnimantaMasaIndex: chandramasa.purnimantaIndex,
      amantaMasaName: chandramasa.amantaName,
      purnimantaMasaName: chandramasa.purnimantaName,
      isAdhika: chandramasa.isAdhika,
      priorMasaWasAdhika,
      varaIndex,
      solarMasaIndex: rashiAtSunrise,
      tithiByRule,
      tithiByRuleStart,
      priorDayTithiByRule,
      nakshatraIndicesInDay,
      sankrantiRashi,
      nextDaySankrantiRashi,
      prevDaySankrantiRashi,
      ekadashiDashamiViddha,
      smartaDwadashiToday,
      moonriseInDay: moonriseInDayUtc,
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
