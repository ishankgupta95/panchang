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
  // Yesterday's aparahna START (3/5 of daylight) — with the end sample above
  // it tells the `aparahna-full` ladder (Vijayadashami) whether yesterday
  // covered its whole aparahna kala or merely brushed its end.
  const priorDayTithiByRuleStart: TithiByRule = {
    aparahna: tithiAt(new Date(yesterdaySunriseUtc.getTime() + (yesterdayDayLengthMs * 3) / 5)),
  };
  // Yesterday's moonrise tithi, computed only when Krishna Chaturthi is in
  // play today (≈ once a lunar month): it dedupes a vriddha Chaturthi
  // spanning two consecutive moonrises, and anchors the no-moonrise-match
  // sunrise fallback (see `prevailsInKala`'s chandrodaya branch).
  if (tithiByRule.chandrodaya === 18 || tithiIndexAtSunrise === 18) {
    const yesterdayMoonriseUtc = getMoonrise(yesterdaySunriseUtc, location);
    if (yesterdayMoonriseUtc && yesterdayMoonriseUtc.getTime() < sunriseUtc.getTime()) {
      priorDayTithiByRule.chandrodaya = tithiAt(yesterdayMoonriseUtc);
    }
  }

  // Sankranti attribution (drik's rule, 2026-08-14 audit): a transit during
  // daylight [sunrise, sunset] is observed on that civil day; a transit
  // between sunset and the next sunrise is observed on the NEXT sunrise's
  // day. Equivalently, day D observes a Sankranti iff the transit falls in
  // (sunset of D−1, sunset of D] — which one rashi comparison per day
  // detects. An earlier revision attributed the whole Hindu day (sunrise →
  // next sunrise) to the sunrise date, mis-dating every post-sunset transit
  // (2027: Makara, Tula, Vrishchika).
  const rashiAtSunset = Math.floor(getSun(sunsetUtc) / 30) % 12;
  const rashiAtYesterdaySunset = Math.floor(getSun(yesterdaySunsetUtc) / 30) % 12;
  const sankrantiRashi: number | null =
    rashiAtYesterdaySunset !== rashiAtSunset ? rashiAtSunset : null;

  // Next-day Sankranti — same rule shifted one day: tomorrow observes iff
  // the transit falls in (today's sunset, tomorrow's sunset]. Used by "day
  // before Sankranti" observances (Lohri = day before Makara, Pahili Raja =
  // day before Karka).
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
    // Polar days with no tomorrow sunrise/sunset: skip next-day marker.
  }

  // Prev-day Sankranti — yesterday observed iff the transit fell in
  // (sunset of D−2, sunset of D−1]. Used by "day after Sankranti"
  // observances (Basi Raja = day after Karka). The daylight-yesterday case
  // reads off longitudes already in hand; the night-before-yesterday case
  // needs D−2's sunset, so it is gated behind a cheap "did the rashi change
  // in the 24 h before yesterday's sunrise" test (true ≤ 12 days a year)
  // before spending the two extra rise/set searches.
  const rashiAtSunrise = Math.floor(siderealSunAtSunrise / 30) % 12;
  const rashiAtYesterdaySunrise = Math.floor(getSun(yesterdaySunriseUtc) / 30) % 12;
  let prevDaySankrantiRashi: number | null = null;
  if (rashiAtYesterdaySunrise !== rashiAtYesterdaySunset) {
    // Daylight transit yesterday → yesterday's own day.
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
        // Transit after D−2's sunset but before yesterday's sunrise →
        // attributed to yesterday.
        prevDaySankrantiRashi = rashiAtYesterdaySunrise;
      }
    } catch (e: unknown) {
      if (!(e instanceof PanchangError && (e.code === 'NO_SUNRISE' || e.code === 'NO_SUNSET'))) {
        throw e;
      }
      // Polar edge: no D−2 sunset to test against; skip the prev-day marker.
    }
  }

  // ── Regional solar new years (Mesha transit) ──────────────────
  //
  // The four traditions that anchor their new year on Mesha Sankranti key the
  // day off the transit MOMENT in three different ways, so they can land on
  // three different dates in the same year. Validated against DrikPanchang
  // 2025–2029 (Chennai / Cochin / Amritsar / Kolkata), whose five transit
  // moments — Apr 14 03:30, Apr 14 09:39, Apr 14 15:33, Apr 13 21:47,
  // Apr 14 03:56 IST — cover pre-dawn, morning, afternoon and post-sunset:
  //
  //   Puthandu (Tamil)      = the generic Sankranti observance day (`sankrantiRashi`):
  //                           daylight transit → its own day, night transit →
  //                           the next sunrise's day. 14/14/14/14/14.
  //   Vaisakhi (Punjab)     = the CIVIL day containing the transit. 14/14/14/13/14 —
  //                           2028 is the discriminator (transit 21:47 on Apr 13).
  //   Vishu (Kerala)        = the day of the first sunrise at or after the transit.
  //                           14/15/15/14/14 — 2026 and 2027 discriminate.
  //   Pohela Boishakh (WB)  = the day AFTER the transit's civil day (the transit day
  //                           itself is Chaitra Sankranti, the old year's last).
  //                           15/15/15/14/15.
  //
  // Each is one rashi comparison across the window that defines it. The whole
  // block is gated on a Mesha transit being within a day either side, so the
  // two extra `getSun` calls are paid on ≤3 days a year.
  let vaisakhiToday = false;
  let vishuToday = false;
  let pohelaBoishakhToday = false;
  if (sankrantiRashi === 0 || nextDaySankrantiRashi === 0 || prevDaySankrantiRashi === 0) {
    // Local civil midnight opening day D+n, as a UTC instant.
    const localMidnightUtc = (dayOffset: number): Date => {
      const local = new Date(sunriseUtc.getTime() + offsetMinutes * 60_000);
      return new Date(Date.UTC(
        local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset,
      ) - offsetMinutes * 60_000);
    };
    const rashiAtMidnight = (dayOffset: number): number =>
      Math.floor(getSun(localMidnightUtc(dayOffset)) / 30) % 12;
    const midnightToday = rashiAtMidnight(0);
    // Transit inside [midnight(D), midnight(D+1)) — the Sun only ever moves
    // forward, so "not yet Mesha at the opening midnight, Mesha at the next".
    vaisakhiToday = midnightToday !== 0 && rashiAtMidnight(1) === 0;
    // Transit inside D−1's civil day.
    pohelaBoishakhToday = midnightToday === 0 && rashiAtMidnight(-1) !== 0;
    // Transit inside (sunrise(D−1), sunrise(D)] — both rashis already in hand.
    vishuToday = rashiAtSunrise === 0 && rashiAtYesterdaySunrise !== 0;
  }

  // Ekadashi Dashami-viddha: if tithi-at-sunrise is Ekadashi (10/25) and
  // tithi-at-arunodaya (~96 min before sunrise) is Dashami (9/24), the Ekadashi
  // is Dashami-viddha. The Smarta fast still falls on this udaya-vyapini day;
  // it is the VAISHNAVA fast that rejects a viddha Ekadashi and defers to the
  // Dwadashi tomorrow (drik prints the unqualified name on the viddha day and
  // "Vaishnava <name>" the day after — Vijaya 2024-03-06/07, Apara
  // 2024-06-02/03, Papamochani 2025-03-25/26, Rama 2027-10-25/26, Aja
  // 2028-08-16/17, all five with the tithi beginning 15–79 min before sunrise
  // against a 132-min minimum across the 94 non-split days of 2024–2028).
  let ekadashiDashamiViddha = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    const tithiAtArunodaya = tithiAt(arunodayaUtc);
    const dashamiIndex = tithiIndexAtSunrise === 10 ? 9 : 24;
    ekadashiDashamiViddha = tithiAtArunodaya === dashamiIndex;
  }

  // Vaishnava-Dwadashi: did yesterday's sunrise hold a Dashami-viddha Ekadashi
  // AND today's sunrise hold Dwadashi (11 or 26)? If so, the Vaishnava fast
  // lands here rather than on yesterday's viddha Ekadashi.
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

  // Kshaya / vriddha Ekadashi, both diagnosed from consecutive sunrise tithis.
  // The rules were derived from DrikPanchang's published 2026 fast list with
  // per-tithi windows (Yogini Jul 10, Devutthana Nov 20, Unmilini May 27):
  //
  // - KSHAYA: the whole Ekadashi tithi falls between two sunrises (today's
  //   sunrise holds Dashami, tomorrow's holds Dwadashi — the tithi sequence
  //   passes through Ekadashi entirely inside the gap). Drik observes the
  //   Smarta fast TODAY, the day the tithi begins, and the Vaishnava (Gauna)
  //   fast tomorrow. A sunrise-prevalence rule alone emits nothing at all,
  //   which silently dropped Devutthana Ekadashi in 2026.
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
  // - VRIDDHA DWADASHI (Pakshavardhini): the Dwadashi that follows an ordinary
  //   Ekadashi-at-sunrise day prevails at TWO consecutive sunrises. The Smarta
  //   fast stays on the Ekadashi day; the alternate (Vaishnava) fast is
  //   observed on the first Dwadashi day. Diagnosed here purely from sunrise
  //   tithis — yesterday Ekadashi, today Dwadashi, tomorrow still the same
  //   Dwadashi — so it costs no extra rise/set search.
  //
  //   Derived from drik 2024–2028 (Jaipur): the geometry occurs 4 times
  //   (Nirjala 2025-06-06/07, Shravana Putrada 2026-08-23/24, Vijaya
  //   2028-02-20/21, Devutthana 2028-10-28/29) and drik prints a standalone
  //   "Vaishnava <name>" on the second day in all four, with no counterexample
  //   among the other 105 Ekadashi windows in those five years.
  let ekadashiVriddhaDwadashiToday = false;
  if (tithiIndexAtSunrise === 11 || tithiIndexAtSunrise === 26) {
    const ekadashiIndex = tithiIndexAtSunrise === 11 ? 10 : 25;
    ekadashiVriddhaDwadashiToday =
      tithiAtNextSunrise === tithiIndexAtSunrise
      && tithiAt(yesterdaySunriseUtc) === ekadashiIndex;
  }
  // - VRIDDHA: Ekadashi prevails at TWO consecutive sunrises. The fast is a
  //   Mahadwadashi observed on the SECOND day only (drik lists no fast on the
  //   first day at all — 2026-05-26 vs the observed 05-27).
  let ekadashiVriddhaFirstDay = false;
  if (tithiIndexAtSunrise === 10 || tithiIndexAtSunrise === 25) {
    ekadashiVriddhaFirstDay = tithiAtNextSunrise === tithiIndexAtSunrise;
  }
  // - TRISPRISHA (kshaya DWADASHI): tomorrow's sunrise holds Ekadashi but the
  //   sunrise after that already holds Trayodashi — the intervening Dwadashi
  //   contains no sunrise, so there is no valid parana morning within it and
  //   the fast (all traditions) advances to TODAY, the day the Ekadashi tithi
  //   begins (drik: Pausha Putrada 2027 on Jan 18, parana Jan 19 in the
  //   pre-sunrise remainder of Dwadashi). The Ekadashi-at-sunrise day itself
  //   then emits nothing.
  //
  // Both this rule and the vriddha-Dwadashi lookahead below need the tithi at
  // the sunrise AFTER tomorrow's; `tithiAtDayAfterSunrise` computes it lazily
  // (two rise/set searches) and returns null on polar days with no such
  // sunrise, so neither rule pays for it on the ~93% of days that skip both.
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
  // Companion to `ekadashiVriddhaDwadashiToday`, seen from the Ekadashi day:
  // when the following Dwadashi is vriddha the Vaishnava fast moves off this
  // day onto that Dwadashi, so this day emits the Smarta fast alone — exactly
  // as on a Dashami-viddha day.
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

  // ── Janmashtami nishita features (Krishna Saptami/Ashtami days only) ──
  //
  // Drik's Smarta ladder, recovered from 7 drik years (2024–2030, Delhi):
  // the UDAYA-Ashtami day (Ashtami at sunrise) wins whenever Ashtami or
  // Rohini touches ITS nishita muhurta; otherwise the day Ashtami covers
  // nishita wins, even when Saptami-viddha (2025: Ashtami from 11:49 PM,
  // drik still prints Aug 15 because Aug 16's nishita has neither Ashtami
  // nor Rohini). 2027/2029/2030 are the Rohini-decided years; 2028 shows
  // Rohini alone cannot pull the festival onto a Navami day. The nishita
  // muhurta here is the solar-midnight-centered 1/15th of the night —
  // matching drik's printed "Nishita Puja Time".
  const KRISHNA_ASHTAMI = 22;
  const KRISHNA_SAPTAMI = 21;
  const ROHINI = 3;
  const nishitaWindow = (sunset: Date, sunriseAfter: Date): [Date, Date] => {
    const centerMs = (sunset.getTime() + sunriseAfter.getTime()) / 2;
    const halfMs = (sunriseAfter.getTime() - sunset.getTime()) / 30;
    return [new Date(centerMs - halfMs), new Date(centerMs + halfMs)];
  };
  // A tithi (≥ ~13 h) or nakshatra (≥ ~22 h) spell cannot fit inside a
  // ~48-minute muhurta, so "touches the window" ⟺ present at either edge.
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
      // Vriddha dedupe: an udaya-Ashtami yesterday that already claimed.
      if (tithiAt(yesterdaySunriseUtc) === KRISHNA_ASHTAMI) {
        const wYesterday = nishitaWindow(yesterdaySunsetUtc, sunriseUtc);
        prevDayClaimed =
          windowHas(wYesterday, (d) => tithiAt(d) === KRISHNA_ASHTAMI) ||
          windowHas(wYesterday, (d) => nakshatraAt(d) === ROHINI);
      }
    } else if (ashtamiAtNishita && tithiAtNextSunrise === KRISHNA_ASHTAMI) {
      // Saptami-viddha day whose nishita holds Ashtami: yield to tomorrow's
      // udaya day iff tomorrow's nishita carries Ashtami or Rohini.
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
        // Polar edge: tomorrow's nishita unavailable; keep the claim local.
      }
    }
    janmashtamiNishita = { ashtamiAtNishita, rohiniAtNishita, nextDayClaims, prevDayClaimed };
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
