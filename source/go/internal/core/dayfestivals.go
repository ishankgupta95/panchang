package core

import (
	"errors"
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type DayFestivalInputs struct {
	SunriseMs     int64
	SunsetMs      int64
	NextSunriseMs int64
	Location      types.GeoLocation
	OffsetMinutes int

	TithiIndexAtSunrise   int
	SiderealMoonAtSunrise float64
	SiderealSunAtSunrise  float64
	VaraIndex             int
	Chandramasa           types.ChandraMasaInfo
	Lang                  types.Language
	T                     i18n.PanchangTranslations
	Region                types.FestivalRegion
	// First moonrise at/after local midnight.
	MoonriseMs *int64
	Bhadra     *types.UnlocalizedBhadraInfo
	GetMoon    LongitudeAt
	GetSun     LongitudeAt
}

func ComputeDayFestivals(ctx *astronomy.EphemerisCtx, in DayFestivalInputs) ([]types.FestivalInfo, error) {
	sunriseMs, sunsetMs, nextSunriseMs := in.SunriseMs, in.SunsetMs, in.NextSunriseMs
	location := in.Location
	getMoon, getSun := in.GetMoon, in.GetSun

	a := computeKalaAnchors(sunriseMs, sunsetMs, nextSunriseMs)

	tithiAt := func(ms int64) int { return GetTithiIndexFromLons(getMoon(ms), getSun(ms)) }

	tithiByRule := map[FestivalDateRule]int{
		RuleMadhyahna: tithiAt(a.Madhyahna),
		RuleAparahna:  tithiAt(a.Aparahna),
		RulePradosha:  tithiAt(a.Pradosha),
		RuleNishita:   tithiAt(a.Nishita),
	}
	tithiByRuleStart := map[FestivalDateRule]int{
		RuleMadhyahna: tithiAt(a.MadhyahnaStart),
		RuleAparahna:  tithiAt(a.AparahnaStart),
		RulePradosha:  tithiAt(a.PradoshaStart),
		RuleNishita:   tithiAt(a.NishitaStart),
	}

	var moonriseInDayMs int64
	moonriseInDayOK := false
	if in.MoonriseMs != nil && *in.MoonriseMs >= sunriseMs {
		moonriseInDayMs, moonriseInDayOK = *in.MoonriseMs, true
	} else {
		ms, ok, err := astronomy.GetMoonrise(ctx, sunriseMs, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return nil, err
		}
		moonriseInDayMs, moonriseInDayOK = ms, ok
	}
	if moonriseInDayOK && moonriseInDayMs < nextSunriseMs {
		tithiByRule[RuleChandrodaya] = tithiAt(moonriseInDayMs)
		tithiByRuleStart[RuleChandrodaya] = tithiByRule[RuleChandrodaya]
	}

	// A nakshatra spans ~24 h, so 4 samples cover the day.
	nakshatraAt := func(ms int64) int { return utils.NakshatraOf(getMoon(ms)) }
	nakshatraIndicesInDay := map[int]bool{
		nakshatraAt(sunriseMs):   true,
		nakshatraAt(a.Madhyahna): true,
		nakshatraAt(sunsetMs):    true,
		nakshatraAt(a.Nishita):   true,
	}

	yesterdaySunriseMs, err := astronomy.ComputeSunrise(ctx,
		sunriseMs-24*3600_000-2*3600_000, location, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return nil, err
	}
	yesterdaySunsetMs, err := astronomy.ComputeSunset(ctx, yesterdaySunriseMs, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return nil, err
	}
	y := computeKalaAnchors(yesterdaySunriseMs, yesterdaySunsetMs, sunriseMs)

	priorDayTithiByRule := map[FestivalDateRule]int{
		RuleMadhyahna: tithiAt(y.Madhyahna),
		RuleAparahna:  tithiAt(y.Aparahna),
		RulePradosha:  tithiAt(y.Pradosha),
		RuleNishita:   tithiAt(y.Nishita),
	}
	// One key only: a second entry would supply a sample that must stay undefined.
	priorDayTithiByRuleStart := map[FestivalDateRule]int{
		RuleAparahna: tithiAt(y.AparahnaStart),
	}
	// 18 = Krishna Chaturthi: dedupes a vriddha Chaturthi over two moonrises.
	if chandrodaya, ok := tithiByRule[RuleChandrodaya]; (ok && chandrodaya == 18) ||
		in.TithiIndexAtSunrise == 18 {
		yesterdayMoonriseMs, found, err := astronomy.GetMoonrise(ctx, yesterdaySunriseMs,
			location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return nil, err
		}
		if found && yesterdayMoonriseMs < sunriseMs {
			priorDayTithiByRule[RuleChandrodaya] = tithiAt(yesterdayMoonriseMs)
		}
	}

	// Day D observes the Sankranti iff the transit is in (sunset D-1, sunset D].
	rashiAtSunset := int(math.Floor(getSun(sunsetMs)/30)) % 12
	rashiAtYesterdaySunset := int(math.Floor(getSun(yesterdaySunsetMs)/30)) % 12
	var sankrantiRashi *int
	if rashiAtYesterdaySunset != rashiAtSunset {
		r := rashiAtSunset
		sankrantiRashi = &r
	}

	var nextDaySankrantiRashi *int
	if tomorrowSunsetMs, err := astronomy.ComputeSunset(ctx, nextSunriseMs, location,
		astronomy.DefaultRiseSetLimitDays); err != nil {
		if !isPolarRiseSetError(err) {
			return nil, err
		}
	} else {
		rashiAtTomorrowSunset := int(math.Floor(getSun(tomorrowSunsetMs)/30)) % 12
		if rashiAtSunset != rashiAtTomorrowSunset {
			r := rashiAtTomorrowSunset
			nextDaySankrantiRashi = &r
		}
	}

	rashiAtSunrise := int(math.Floor(in.SiderealSunAtSunrise/30)) % 12
	rashiAtYesterdaySunrise := int(math.Floor(getSun(yesterdaySunriseMs)/30)) % 12
	var prevDaySankrantiRashi *int
	if rashiAtYesterdaySunrise != rashiAtYesterdaySunset {
		r := rashiAtYesterdaySunset
		prevDaySankrantiRashi = &r
	} else if int(math.Floor(getSun(yesterdaySunriseMs-24*3600_000)/30))%12 !=
		rashiAtYesterdaySunrise {
		dayBeforeYesterdaySunriseMs, err := astronomy.ComputeSunrise(ctx,
			yesterdaySunriseMs-30*3600_000, location, astronomy.DefaultRiseSetLimitDays)
		var dayBeforeYesterdaySunsetMs int64
		if err == nil {
			dayBeforeYesterdaySunsetMs, err = astronomy.ComputeSunset(ctx,
				dayBeforeYesterdaySunriseMs, location, astronomy.DefaultRiseSetLimitDays)
		}
		switch {
		case err == nil:
			rashiAtDayBeforeYesterdaySunset :=
				int(math.Floor(getSun(dayBeforeYesterdaySunsetMs)/30)) % 12
			if rashiAtDayBeforeYesterdaySunset != rashiAtYesterdaySunrise {
				r := rashiAtYesterdaySunrise
				prevDaySankrantiRashi = &r
			}
		case !isPolarRiseSetError(err):
			return nil, err
		}
	}

	// Puthandu takes the generic Sankranti day; these three key the Mesha transit otherwise.
	vaisakhiToday, vishuToday, pohelaBoishakhToday := false, false, false
	if isMesha(sankrantiRashi) || isMesha(nextDaySankrantiRashi) || isMesha(prevDaySankrantiRashi) {
		localMidnightUtc := func(dayOffset int) int64 {
			local := types.Date(sunriseMs + int64(in.OffsetMinutes)*60_000)
			return int64(types.DateUTC(
				local.UTCFullYear(), local.UTCMonth(), local.UTCDate()+dayOffset,
			)) - int64(in.OffsetMinutes)*60_000
		}
		rashiAtMidnight := func(dayOffset int) int {
			return int(math.Floor(getSun(localMidnightUtc(dayOffset))/30)) % 12
		}
		midnightToday := rashiAtMidnight(0)
		vaisakhiToday = midnightToday != 0 && rashiAtMidnight(1) == 0
		pohelaBoishakhToday = midnightToday == 0 && rashiAtMidnight(-1) != 0
		vishuToday = rashiAtSunrise == 0 && rashiAtYesterdaySunrise != 0
	}

	// Dashami still running at arunodaya defers the Vaishnava fast.
	ekadashiDashamiViddha := false
	if in.TithiIndexAtSunrise == 10 || in.TithiIndexAtSunrise == 25 {
		tithiAtArunodaya := tithiAt(a.Arunodaya)
		dashamiIndex := 24
		if in.TithiIndexAtSunrise == 10 {
			dashamiIndex = 9
		}
		ekadashiDashamiViddha = tithiAtArunodaya == dashamiIndex
	}
	vaishnavaDwadashiToday := false
	if in.TithiIndexAtSunrise == 11 || in.TithiIndexAtSunrise == 26 {
		ekadashiIndex, dashamiIndex := 25, 24
		if in.TithiIndexAtSunrise == 11 {
			ekadashiIndex, dashamiIndex = 10, 9
		}
		yesterdaySunriseTithi := tithiAt(yesterdaySunriseMs)
		if yesterdaySunriseTithi == ekadashiIndex {
			yesterdayArunodayaMs := yesterdaySunriseMs - 96*60_000
			yesterdayArunodayaTithi := tithiAt(yesterdayArunodayaMs)
			vaishnavaDwadashiToday = yesterdayArunodayaTithi == dashamiIndex
		}
	}

	// Kshaya: the whole tithi falls between two sunrises.
	tithiAtNextSunrise := tithiAt(nextSunriseMs)
	ekadashiKshayaToday := false
	if in.TithiIndexAtSunrise == 9 || in.TithiIndexAtSunrise == 24 {
		dwadashiIndex := 26
		if in.TithiIndexAtSunrise == 9 {
			dwadashiIndex = 11
		}
		ekadashiKshayaToday = tithiAtNextSunrise == dwadashiIndex
	}
	ekadashiGaunaToday := false
	if in.TithiIndexAtSunrise == 11 || in.TithiIndexAtSunrise == 26 {
		dashamiIndex := 24
		if in.TithiIndexAtSunrise == 11 {
			dashamiIndex = 9
		}
		ekadashiGaunaToday = tithiAt(yesterdaySunriseMs) == dashamiIndex
	}
	// Vriddha (Pakshavardhini) Dwadashi prevails at two sunrises.
	ekadashiVriddhaDwadashiToday := false
	if in.TithiIndexAtSunrise == 11 || in.TithiIndexAtSunrise == 26 {
		ekadashiIndex := 25
		if in.TithiIndexAtSunrise == 11 {
			ekadashiIndex = 10
		}
		ekadashiVriddhaDwadashiToday = tithiAtNextSunrise == in.TithiIndexAtSunrise &&
			tithiAt(yesterdaySunriseMs) == ekadashiIndex
	}
	ekadashiVriddhaFirstDay := false
	if in.TithiIndexAtSunrise == 10 || in.TithiIndexAtSunrise == 25 {
		ekadashiVriddhaFirstDay = tithiAtNextSunrise == in.TithiIndexAtSunrise
	}
	// Trisprisha (kshaya Dwadashi): the Dwadashi after tomorrow's Ekadashi holds no sunrise.
	tithiAtDayAfterSunrise := func() (int, bool, error) {
		_, dayAfterSunriseMs, err := tomorrowNight(ctx, nextSunriseMs, location)
		if err != nil {
			if isPolarRiseSetError(err) {
				return 0, false, nil
			}
			return 0, false, err
		}
		return tithiAt(dayAfterSunriseMs), true, nil
	}
	ekadashiTrisprishaToday := false
	if in.TithiIndexAtSunrise == 9 || in.TithiIndexAtSunrise == 24 {
		ekadashiIndex, trayodashiIndex := 25, 27
		if in.TithiIndexAtSunrise == 9 {
			ekadashiIndex, trayodashiIndex = 10, 12
		}
		if tithiAtNextSunrise == ekadashiIndex {
			dayAfter, ok, err := tithiAtDayAfterSunrise()
			if err != nil {
				return nil, err
			}
			ekadashiTrisprishaToday = ok && dayAfter == trayodashiIndex
		}
	}
	ekadashiVriddhaDwadashiTomorrow := false
	if in.TithiIndexAtSunrise == 10 || in.TithiIndexAtSunrise == 25 {
		dwadashiIndex := 26
		if in.TithiIndexAtSunrise == 10 {
			dwadashiIndex = 11
		}
		if tithiAtNextSunrise == dwadashiIndex {
			dayAfter, ok, err := tithiAtDayAfterSunrise()
			if err != nil {
				return nil, err
			}
			ekadashiVriddhaDwadashiTomorrow = ok && dayAfter == dwadashiIndex
		}
	}
	ekadashiTrisprishaYesterday := false
	if in.TithiIndexAtSunrise == 10 || in.TithiIndexAtSunrise == 25 {
		trayodashiIndex := 27
		if in.TithiIndexAtSunrise == 10 {
			trayodashiIndex = 12
		}
		ekadashiTrisprishaYesterday = tithiAtNextSunrise == trayodashiIndex
	}

	// Udaya-Ashtami wins if Ashtami or Rohini touches its nishita; else the Saptami-viddha day that covers it.
	const krishnaAshtami = 22
	const krishnaSaptami = 21
	const rohini = 3
	var janmashtamiNishita *JanmashtamiNishita
	if in.TithiIndexAtSunrise == krishnaAshtami || in.TithiIndexAtSunrise == krishnaSaptami {
		wToday := nishitaWindow(sunsetMs, nextSunriseMs)
		ashtamiAtNishita := windowHas(wToday, func(ms int64) bool { return tithiAt(ms) == krishnaAshtami })
		rohiniAtNishita := windowHas(wToday, func(ms int64) bool { return nakshatraAt(ms) == rohini })
		nextDayClaims := false
		prevDayClaimed := false
		if in.TithiIndexAtSunrise == krishnaAshtami {
			if tithiAt(yesterdaySunriseMs) == krishnaAshtami {
				wYesterday := nishitaWindow(yesterdaySunsetMs, sunriseMs)
				prevDayClaimed =
					windowHas(wYesterday, func(ms int64) bool { return tithiAt(ms) == krishnaAshtami }) ||
						windowHas(wYesterday, func(ms int64) bool { return nakshatraAt(ms) == rohini })
			}
		} else if ashtamiAtNishita && tithiAtNextSunrise == krishnaAshtami {
			tomorrowSunsetMs, dayAfterSunriseMs, err := tomorrowNight(ctx, nextSunriseMs, location)
			switch {
			case err == nil:
				wTomorrow := nishitaWindow(tomorrowSunsetMs, dayAfterSunriseMs)
				nextDayClaims =
					windowHas(wTomorrow, func(ms int64) bool { return tithiAt(ms) == krishnaAshtami }) ||
						windowHas(wTomorrow, func(ms int64) bool { return nakshatraAt(ms) == rohini })
			case !isPolarRiseSetError(err):
				return nil, err
			}
		}
		janmashtamiNishita = &JanmashtamiNishita{
			AshtamiAtNishita: ashtamiAtNishita,
			RohiniAtNishita:  rohiniAtNishita,
			NextDayClaims:    nextDayClaims,
			PrevDayClaimed:   prevDayClaimed,
		}
	}

	// A wall clock already folded into the instant, so UTC accessors.
	formatClock := func(ms int64) string {
		d := types.Date(ms)
		return twoDigits(d.UTCHours()) + ":" + twoDigits(d.UTCMinutes())
	}

	var bhadra *UtcWindowMs
	if in.Bhadra != nil {
		bhadra = &UtcWindowMs{
			StartMs: utils.UtcToLocalDisplay(in.Bhadra.StartMs, in.OffsetMinutes),
			EndMs:   utils.UtcToLocalDisplay(in.Bhadra.EndMs, in.OffsetMinutes),
		}
	}

	t := in.T
	return ComputeFestivals(
		&FestivalComputeContext{
			TithiIndex:               in.TithiIndexAtSunrise,
			NakshatraIndex:           utils.NakshatraOf(in.SiderealMoonAtSunrise),
			NakshatraIndicesInDay:    nakshatraIndicesInDay,
			ChandraMasaIndex:         in.Chandramasa.AmantaIndex,
			AmantaMasaName:           in.Chandramasa.AmantaName,
			PurnimantaMasaName:       in.Chandramasa.PurnimantaName,
			IsAdhika:                 in.Chandramasa.IsAdhika,
			VaraIndex:                in.VaraIndex,
			SolarMasaIndex:           rashiAtSunrise,
			TithiByRule:              tithiByRule,
			TithiByRuleStart:         tithiByRuleStart,
			PriorDayTithiByRule:      priorDayTithiByRule,
			PriorDayTithiByRuleStart: priorDayTithiByRuleStart,
			JanmashtamiNishita:       janmashtamiNishita,
			SankrantiRashi:           sankrantiRashi,
			NextDaySankrantiRashi:    nextDaySankrantiRashi,
			PrevDaySankrantiRashi:    prevDaySankrantiRashi,
			VaisakhiToday:            vaisakhiToday,
			VishuToday:               vishuToday,
			PohelaBoishakhToday:      pohelaBoishakhToday,

			EkadashiDashamiViddha:           ekadashiDashamiViddha,
			VaishnavaDwadashiToday:          vaishnavaDwadashiToday,
			EkadashiKshayaToday:             ekadashiKshayaToday,
			EkadashiGaunaToday:              ekadashiGaunaToday,
			EkadashiVriddhaDwadashiToday:    ekadashiVriddhaDwadashiToday,
			EkadashiVriddhaDwadashiTomorrow: ekadashiVriddhaDwadashiTomorrow,
			EkadashiVriddhaFirstDay:         ekadashiVriddhaFirstDay,
			EkadashiTrisprishaToday:         ekadashiTrisprishaToday,
			EkadashiTrisprishaYesterday:     ekadashiTrisprishaYesterday,

			Bhadra:      bhadra,
			FormatClock: formatClock,
			Region:      ResolveRegionAlias(in.Region, nil),
		},
		func(key string) string { return resolveFestivalName(t, key) },
		func(idx int) string { return i18n.ResolveMasaName(idx, in.Lang) },
	), nil
}

// Comma-ok: a key mapped to "" must resolve to "", not fall through.
func resolveFestivalName(t i18n.PanchangTranslations, key string) string {
	if name, ok := t.FestivalNames[key]; ok {
		return name
	}
	if name, ok := t.MiscByKey(key); ok {
		return name
	}
	return key
}

// Float spelling deliberate: integer division lands 1 ms early; NishitaStart is an anti-FMA barrier.
type kalaAnchors struct {
	Madhyahna int64
	Aparahna  int64
	Pradosha  int64
	Nishita   int64
	Arunodaya int64

	MadhyahnaStart int64
	AparahnaStart  int64
	PradoshaStart  int64
	NishitaStart   int64
}

func computeKalaAnchors(sunriseMs, sunsetMs, nextSunriseMs int64) kalaAnchors {
	dayLengthMs := sunsetMs - sunriseMs
	nightLengthMs := nextSunriseMs - sunsetMs
	return kalaAnchors{
		Madhyahna: int64(float64(sunriseMs) + float64(dayLengthMs)/2),
		Aparahna:  int64(float64(sunriseMs) + float64(dayLengthMs*8)/10),
		Pradosha:  sunsetMs + 60*60_000,
		Nishita:   (sunsetMs + nextSunriseMs) / 2,
		Arunodaya: sunriseMs - 96*60_000,

		MadhyahnaStart: int64(float64(sunriseMs) + float64(dayLengthMs)/4),
		AparahnaStart:  int64(float64(sunriseMs) + float64(dayLengthMs*3)/5),
		PradoshaStart:  sunsetMs,
		NishitaStart:   int64(float64(sunsetMs) + float64(float64(nightLengthMs)*0.3)),
	}
}

func tomorrowNight(ctx *astronomy.EphemerisCtx, nextSunriseMs int64,
	location types.GeoLocation) (tomorrowSunsetMs, dayAfterSunriseMs int64, err error) {
	tomorrowSunsetMs, err = astronomy.ComputeSunset(ctx, nextSunriseMs, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, 0, err
	}
	dayAfterSunriseMs, err = astronomy.ComputeSunrise(ctx, tomorrowSunsetMs, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, 0, err
	}
	return tomorrowSunsetMs, dayAfterSunriseMs, nil
}

// Anything else must propagate: a diverged search is never read as "no sunrise".
func isPolarRiseSetError(err error) bool {
	return errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel)
}

func isMesha(rashi *int) bool { return rashi != nil && *rashi == 0 }

func nishitaWindow(sunsetMs, sunriseAfterMs int64) [2]int64 {
	centerMs := float64(sunsetMs+sunriseAfterMs) / 2
	halfMs := float64(sunriseAfterMs-sunsetMs) / 30
	return [2]int64{int64(centerMs - halfMs), int64(centerMs + halfMs)}
}

// A tithi or nakshatra spell cannot fit inside the ~48-min window, so the edges decide.
func windowHas(w [2]int64, pred func(ms int64) bool) bool {
	return pred(w[0]) || pred(w[1])
}

func twoDigits(n int) string {
	return string([]byte{byte('0' + n/10), byte('0' + n%10)})
}
