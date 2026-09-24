package core

import (
	"errors"
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const festivalDayMs = 86_400_000

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
	NextDayMasa           func() (index int, isAdhika bool)
	Lang                  types.Language
	T                     i18n.PanchangTranslations
	Region                types.FestivalRegion
	MoonriseMs            *int64
	Bhadra                *types.UnlocalizedBhadraInfo
	GetMoon               LongitudeAt
	GetSun                LongitudeAt
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

	nakshatraAt := func(ms int64) int { return utils.NakshatraOf(getMoon(ms)) }

	nakshatraByRule := map[FestivalDateRule]int{
		RuleMadhyahna: nakshatraAt(a.Madhyahna),
		RuleAparahna:  nakshatraAt(a.Aparahna),
	}
	nakshatraByRuleStart := map[FestivalDateRule]int{
		RuleMadhyahna: nakshatraAt(a.MadhyahnaStart),
		RuleAparahna:  nakshatraAt(a.AparahnaStart),
	}

	var nextDayTithiStart, nextDayTithiEnd map[FestivalDateRule]int
	nextDayTithiByRule := func() (map[FestivalDateRule]int, map[FestivalDateRule]int) {
		if nextDayTithiStart != nil {
			return nextDayTithiStart, nextDayTithiEnd
		}
		nextDayTithiStart, nextDayTithiEnd = map[FestivalDateRule]int{}, map[FestivalDateRule]int{}
		nextSunsetMs, err := astronomy.ComputeSunset(ctx, nextSunriseMs, location,
			astronomy.DefaultRiseSetLimitDays)
		if err == nil {
			n := computeKalaAnchors(nextSunriseMs, nextSunsetMs, nextSunriseMs)
			nextDayTithiStart[RuleMadhyahna] = tithiAt(n.MadhyahnaStart)
			nextDayTithiStart[RuleAparahna] = tithiAt(n.AparahnaStart)
			nextDayTithiEnd[RuleMadhyahna] = tithiAt(n.Madhyahna)
			nextDayTithiEnd[RuleAparahna] = tithiAt(n.Aparahna)
		}
		return nextDayTithiStart, nextDayTithiEnd
	}

	var nextDayNakStart, nextDayNakEnd map[FestivalDateRule]int
	nextDayNakshatraByRule := func() (map[FestivalDateRule]int, map[FestivalDateRule]int) {
		if nextDayNakStart != nil {
			return nextDayNakStart, nextDayNakEnd
		}
		nextDayNakStart, nextDayNakEnd = map[FestivalDateRule]int{}, map[FestivalDateRule]int{}
		nextSunsetMs, err := astronomy.ComputeSunset(ctx, nextSunriseMs, location,
			astronomy.DefaultRiseSetLimitDays)
		if err == nil {
			n := computeKalaAnchors(nextSunriseMs, nextSunsetMs, nextSunriseMs)
			nextDayNakStart[RuleMadhyahna] = nakshatraAt(n.MadhyahnaStart)
			nextDayNakStart[RuleAparahna] = nakshatraAt(n.AparahnaStart)
			nextDayNakEnd[RuleMadhyahna] = nakshatraAt(n.Madhyahna)
			nextDayNakEnd[RuleAparahna] = nakshatraAt(n.Aparahna)
		}
		return nextDayNakStart, nextDayNakEnd
	}

	var remainingPakshaMemo map[int]bool
	remainingPakshaSunriseNakshatras := func() map[int]bool {
		if remainingPakshaMemo != nil {
			return remainingPakshaMemo
		}
		startedShukla := in.TithiIndexAtSunrise < utils.TotalTithis/2
		found := map[int]bool{utils.NakshatraOf(in.SiderealMoonAtSunrise): true}
		cursor := sunriseMs
		for i := 0; i < 16; i++ { // 16 is a backstop; the paksha test is the exit
			next, err := astronomy.ComputeSunrise(ctx, cursor+22*3600_000, location,
				astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				break
			}
			if (tithiAt(next) < utils.TotalTithis/2) != startedShukla {
				break
			}
			found[nakshatraAt(next)] = true
			cursor = next
		}
		remainingPakshaMemo = found
		return remainingPakshaMemo
	}

	yesterdaySunriseMs, err := astronomy.ComputeSunrise(ctx,
		sunriseMs-24*3600_000-2*3600_000, location, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return nil, err
	}
	priorDayNakshatraIndex := nakshatraAt(yesterdaySunriseMs)
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
	priorDayTithiByRuleStart := map[FestivalDateRule]int{
		RuleAparahna: tithiAt(y.AparahnaStart),
	}
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

	rashiAt := func(ms int64) int { return int(math.Floor(getSun(ms)/30)) % 12 }
	nakshatraAtSunrise := utils.NakshatraOf(in.SiderealMoonAtSunrise)
	nakshatraAtSunset := nakshatraAt(sunsetMs)
	nextDayNakshatraIndex := nakshatraAt(nextSunriseMs)

	const krittika = 2
	const vrischika = 7
	// Krittika's first sunrise-or-sunset day; a transit touching neither
	// (polar) belongs to the day holding it.
	masikKarthigaiToday := (nakshatraAt(yesterdaySunsetMs) != krittika &&
		(nakshatraAtSunrise == krittika || nakshatraAtSunset == krittika)) ||
		(nakshatraAtSunrise == krittika-1 && nakshatraAtSunset != krittika &&
			nextDayNakshatraIndex == krittika+1)
	// masikKarthigaiSunsetFrom is the sunset of the Masik Karthigai day of the
	// first Krittika transit from startDays days away.
	masikKarthigaiSunsetFrom := func(startDays int64) (int64, bool) {
		rise, err := astronomy.ComputeSunrise(ctx, sunriseMs+startDays*festivalDayMs-2*3600_000, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, false
		}
		for i := 0; i < 10; i++ {
			set, err := astronomy.ComputeSunset(ctx, rise, location, astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				return 0, false
			}
			nextRise, err := astronomy.ComputeSunrise(ctx, set, location, astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				return 0, false
			}
			riseNakshatra := nakshatraAt(rise)
			if riseNakshatra == krittika || nakshatraAt(set) == krittika ||
				(riseNakshatra == krittika-1 && nakshatraAt(nextRise) == krittika+1) {
				return set, true
			}
			rise = nextRise
		}
		return 0, false
	}
	// karthigaiDeepamKey ranks an in-month full moon first, then the nearer
	// full moon; ties go to the earlier day.
	karthigaiDeepamKey := func(sunset int64) (int, int64) {
		full, ok := astronomy.SearchMoonPhase(ctx, 180, sunset-5*festivalDayMs, 10)
		if !ok {
			return 1, math.MaxInt64
		}
		rank := 1
		if rashiAt(full) == vrischika {
			rank = 0
		}
		dist := full - sunset
		if dist < 0 {
			dist = -dist
		}
		return rank, dist
	}
	karthigaiDeepamToday := func() bool {
		if rashiAtSunset != vrischika {
			return false
		}
		myRank, myDist := karthigaiDeepamKey(sunsetMs)
		for _, startDays := range [2]int64{-31, 24} {
			other, ok := masikKarthigaiSunsetFrom(startDays)
			if !ok || rashiAt(other) != vrischika {
				continue
			}
			rank, dist := karthigaiDeepamKey(other)
			if rank < myRank || (rank == myRank && (dist < myDist || (dist == myDist && startDays < 0))) {
				return false
			}
		}
		return true
	}

	// nakshatraLaterInSolarMonth walks sunrises from 20 days ahead while the
	// Sun stays in today's sunrise rashi.
	nakshatraLaterInSolarMonth := func(nakshatra int) bool {
		before, after := (nakshatra+26)%27, (nakshatra+1)%27
		prev, err := astronomy.ComputeSunrise(ctx, sunriseMs+20*festivalDayMs-2*3600_000, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil || rashiAt(prev) != rashiAtSunrise {
			return false
		}
		prevNakshatra := nakshatraAt(prev)
		for i := 0; i < 16; i++ { // 16 is a backstop; the month test is the exit
			next, err := astronomy.ComputeSunrise(ctx, prev+22*3600_000, location,
				astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				return false
			}
			nextNakshatra := nakshatraAt(next)
			if prevNakshatra == before && nextNakshatra == after {
				return true
			}
			if rashiAt(next) != rashiAtSunrise {
				return false
			}
			if nextNakshatra == nakshatra && prevNakshatra != nakshatra {
				return true
			}
			prev, prevNakshatra = next, nextNakshatra
		}
		return false
	}

	// Nepali months are solar, and the civil day holding the Sankranti opens
	// the new one.
	varaMasaIndex := in.Chandramasa.Index
	if ResolveRegionAlias(in.Region, nil) == "nepal" {
		local := types.Date(sunriseMs + int64(in.OffsetMinutes)*60_000)
		dayEndMs := int64(types.DateUTC(local.UTCFullYear(), local.UTCMonth(), local.UTCDate()+1)) -
			int64(in.OffsetMinutes)*60_000
		varaMasaIndex = (rashiAt(dayEndMs) + 1) % 12
	}

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

	tithiAtNextSunrise := tithiAt(nextSunriseMs)

	kshayaTithiIndices := map[int]bool{}
	if in.TithiIndexAtSunrise != tithiAtNextSunrise {
		for i := (in.TithiIndexAtSunrise + 1) % utils.TotalTithis; i != tithiAtNextSunrise &&
			len(kshayaTithiIndices) < utils.TotalTithis; i = (i + 1) % utils.TotalTithis {
			kshayaTithiIndices[i] = true
		}
	}
	nextDayMasaIndex, nextDayIsAdhika, hasNextDayMasa := 0, false, false
	if kshayaTithiIndices[0] && in.NextDayMasa != nil {
		nextDayMasaIndex, nextDayIsAdhika = in.NextDayMasa()
		hasNextDayMasa = true
	}
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
	ekadashiVriddhaTrisprisha := false
	if ekadashiVriddhaFirstDay {
		trayodashiIndex := 27
		if in.TithiIndexAtSunrise == 10 {
			trayodashiIndex = 12
		}
		dayAfter, ok, err := tithiAtDayAfterSunrise()
		if err != nil {
			return nil, err
		}
		ekadashiVriddhaTrisprisha = ok && dayAfter == trayodashiIndex
	}

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

	dayGeometry, geometryErr := buildDayGeometry(ctx,
		KalaDay{Sunrise: sunriseMs, Sunset: sunsetMs, NextSunrise: nextSunriseMs},
		location, in.OffsetMinutes, getMoon, getSun)

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
	festivals := ComputeFestivals(
		&FestivalComputeContext{
			TithiIndex:                       in.TithiIndexAtSunrise,
			NakshatraIndex:                   utils.NakshatraOf(in.SiderealMoonAtSunrise),
			MasikKarthigaiToday:              masikKarthigaiToday,
			HasMasikKarthigai:                true,
			KarthigaiDeepamToday:             karthigaiDeepamToday,
			NakshatraByRule:                  nakshatraByRule,
			NakshatraByRuleStart:             nakshatraByRuleStart,
			PriorDayNakshatraIndex:           priorDayNakshatraIndex,
			HasPriorDayNakshatraIndex:        true,
			NextDayNakshatraIndex:            nextDayNakshatraIndex,
			HasNextDayNakshatraIndex:         true,
			PriorDaySolarMasaIndex:           rashiAtYesterdaySunrise,
			HasPriorDaySolarMasaIndex:        true,
			NakshatraLaterInSolarMonth:       nakshatraLaterInSolarMonth,
			RemainingPakshaSunriseNakshatras: remainingPakshaSunriseNakshatras,
			NextDayNakshatraByRule:           nextDayNakshatraByRule,
			NextDayTithiByRule:               nextDayTithiByRule,
			KshayaTithiIndices:               kshayaTithiIndices,
			NextDayMasa:                      in.NextDayMasa,
			DayGeometry:                      dayGeometry,
			NextDayMasaIndex:                 nextDayMasaIndex,
			NextDayIsAdhika:                  nextDayIsAdhika,
			HasNextDayMasa:                   hasNextDayMasa,
			ChandraMasaIndex:                 in.Chandramasa.AmantaIndex,
			VaraMasaIndex:                    varaMasaIndex,
			HasVaraMasaIndex:                 true,
			AmantaMasaName:                   in.Chandramasa.AmantaName,
			PurnimantaMasaName:               in.Chandramasa.PurnimantaName,
			IsAdhika:                         in.Chandramasa.IsAdhika,
			VaraIndex:                        in.VaraIndex,
			SolarMasaIndex:                   rashiAtSunrise,
			TithiByRule:                      tithiByRule,
			TithiByRuleStart:                 tithiByRuleStart,
			PriorDayTithiByRule:              priorDayTithiByRule,
			PriorDayTithiByRuleStart:         priorDayTithiByRuleStart,
			JanmashtamiNishita:               janmashtamiNishita,
			SankrantiRashi:                   sankrantiRashi,
			NextDaySankrantiRashi:            nextDaySankrantiRashi,
			PrevDaySankrantiRashi:            prevDaySankrantiRashi,
			VaisakhiToday:                    vaisakhiToday,
			VishuToday:                       vishuToday,
			PohelaBoishakhToday:              pohelaBoishakhToday,

			EkadashiDashamiViddha:           ekadashiDashamiViddha,
			VaishnavaDwadashiToday:          vaishnavaDwadashiToday,
			EkadashiKshayaToday:             ekadashiKshayaToday,
			EkadashiGaunaToday:              ekadashiGaunaToday,
			EkadashiVriddhaDwadashiToday:    ekadashiVriddhaDwadashiToday,
			EkadashiVriddhaDwadashiTomorrow: ekadashiVriddhaDwadashiTomorrow,
			EkadashiVriddhaFirstDay:         ekadashiVriddhaFirstDay,
			EkadashiVriddhaTrisprisha:       ekadashiVriddhaTrisprisha,
			EkadashiTrisprishaToday:         ekadashiTrisprishaToday,
			EkadashiTrisprishaYesterday:     ekadashiTrisprishaYesterday,

			Bhadra:      bhadra,
			FormatClock: formatClock,
			Region:      ResolveRegionAlias(in.Region, nil),
		},
		func(key string) string { return resolveFestivalName(t, key) },
		func(idx int) string { return i18n.ResolveMasaName(idx, in.Lang) },
	)
	if *geometryErr != nil {
		return nil, *geometryErr
	}
	return festivals, nil
}

const (
	hourMs = 3600_000
	// crossingCellMs is the elongation solver's fixed bracket grid: one crossing per cell, the same
	// cell whoever asks.
	crossingCellMs                  = 6 * hourMs
	crossingToleranceMs             = 1000
	meanElongationDegPerDay float64 = 12.19
)

// buildDayGeometry chains days from today through each day's own sunset and next sunrise, the
// triple GetDailyPanchang builds for that day, so every day measures the same windows. A previous
// sunrise closer than 12 h, or one whose day does not end at the next day's sunrise, is a polar gap.
// A non-polar rise/set error is kept in the returned pointer, the TS throw.
func buildDayGeometry(
	ctx *astronomy.EphemerisCtx,
	today KalaDay,
	location types.GeoLocation,
	offsetMinutes int,
	getMoon, getSun LongitudeAt,
) (*DayGeometry, *error) {
	var firstErr error
	days := map[int]*KalaDay{0: &today}
	var day func(k int) (KalaDay, bool)
	day = func(k int) (KalaDay, bool) {
		if cached, seen := days[k]; seen {
			if cached == nil {
				return KalaDay{}, false
			}
			return *cached, true
		}
		var out *KalaDay
		keep := func(err error) {
			if !isPolarRiseSetError(err) && firstErr == nil {
				firstErr = err
			}
		}
		if k > 0 {
			if prev, ok := day(k - 1); ok {
				sunset, err := astronomy.ComputeSunset(ctx, prev.NextSunrise, location,
					astronomy.DefaultRiseSetLimitDays)
				var nextSunrise int64
				if err == nil {
					nextSunrise, err = astronomy.ComputeSunrise(ctx, sunset, location,
						astronomy.DefaultRiseSetLimitDays)
				}
				if err != nil {
					keep(err)
				} else {
					out = &KalaDay{Sunrise: prev.NextSunrise, Sunset: sunset, NextSunrise: nextSunrise}
				}
			}
		} else if next, ok := day(k + 1); ok {
			sunrise, err := astronomy.ComputeSunrise(ctx, next.Sunrise-26*hourMs, location,
				astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				keep(err)
			} else if next.Sunrise-sunrise >= 12*hourMs {
				sunset, err := astronomy.ComputeSunset(ctx, sunrise, location, astronomy.DefaultRiseSetLimitDays)
				var nextSunrise int64
				if err == nil {
					nextSunrise, err = astronomy.ComputeSunrise(ctx, sunset, location,
						astronomy.DefaultRiseSetLimitDays)
				}
				switch {
				case err != nil:
					keep(err)
				case nextSunrise == next.Sunrise:
					out = &KalaDay{Sunrise: sunrise, Sunset: sunset, NextSunrise: nextSunrise}
				}
			}
		}
		days[k] = out
		if out == nil {
			return KalaDay{}, false
		}
		return *out, true
	}

	elongation := func(ms int64) float64 { return utils.Normalize360(getMoon(ms) - getSun(ms)) }
	reached := map[float64]int64{}
	elongationReaches := func(deg float64, nearMs int64) int64 {
		if memo, ok := reached[deg]; ok {
			return memo
		}
		before := func(ms int64) bool { return utils.Normalize360(elongation(ms)-deg) > 180 }
		lead := utils.Normalize360(deg - elongation(nearMs))
		if lead > 180 {
			lead -= 360
		}
		aheadDays := lead / meanElongationDegPerDay
		lo := int64(math.Floor((float64(nearMs)+float64(aheadDays*86_400_000))/crossingCellMs)) * crossingCellMs
		for i := 0; i < 64 && !before(lo); i++ {
			lo -= crossingCellMs
		}
		for i := 0; i < 64 && before(lo+crossingCellMs); i++ {
			lo += crossingCellMs
		}
		hi := lo + crossingCellMs
		for hi-lo > crossingToleranceMs {
			mid := lo + (hi-lo)/2
			if before(mid) {
				lo = mid
			} else {
				hi = mid
			}
		}
		reached[deg] = hi
		return hi
	}

	return &DayGeometry{
		Today:             today,
		Day:               day,
		TithiAt:           func(ms int64) int { return GetTithiIndexFromLons(getMoon(ms), getSun(ms)) },
		NakshatraAt:       func(ms int64) int { return utils.NakshatraOf(getMoon(ms)) },
		ElongationReaches: elongationReaches,
		LocalDay: func(ms int64) int64 {
			return int64(math.Floor(float64(ms+int64(offsetMinutes)*60_000) / 86_400_000))
		},
	}, &firstErr
}

func resolveFestivalName(t i18n.PanchangTranslations, key string) string {
	if name, ok := t.FestivalNames[key]; ok {
		return name
	}
	if name, ok := t.MiscByKey(key); ok {
		return name
	}
	return key
}

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

// isPolarRiseSetError matches by code, not against the exported Sentinel
// variables, whose Code any importer can overwrite.
func isPolarRiseSetError(err error) bool {
	var pe *types.PanchangError
	return errors.As(err, &pe) && (pe.Code == types.ErrNoSunrise || pe.Code == types.ErrNoSunset)
}

func isMesha(rashi *int) bool { return rashi != nil && *rashi == 0 }

func nishitaWindow(sunsetMs, sunriseAfterMs int64) [2]int64 {
	centerMs := float64(sunsetMs+sunriseAfterMs) / 2
	halfMs := float64(sunriseAfterMs-sunsetMs) / 30
	return [2]int64{int64(centerMs - halfMs), int64(centerMs + halfMs)}
}

func windowHas(w [2]int64, pred func(ms int64) bool) bool {
	return pred(w[0]) || pred(w[1])
}

func twoDigits(n int) string {
	return string([]byte{byte('0' + n/10), byte('0' + n%10)})
}
