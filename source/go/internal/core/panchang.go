package core

import (
	"errors"
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const panchangCacheMode = astronomy.ModeInterpolated

func tithiAngle(getMoon, getSun LongitudeAt) utils.ElementAngle {
	return utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return getMoon(ms) - getSun(ms) },
		SpanDeg: utils.TithiSpan,
	}
}

func karanaAngle(getMoon, getSun LongitudeAt) utils.ElementAngle {
	return utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return getMoon(ms) - getSun(ms) },
		SpanDeg: utils.KaranaSpan,
	}
}

func nakshatraAngle(getMoon LongitudeAt) utils.ElementAngle {
	return utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return getMoon(ms) },
		SpanDeg: utils.NakshatraSpan,
	}
}

func yogaAngle(getMoon, getSun LongitudeAt) utils.ElementAngle {
	return utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return getSun(ms) + getMoon(ms) },
		SpanDeg: utils.YogaSpan,
	}
}

var AllPanchangSections = []PanchangSection{
	SectionFestivals, SectionEclipse, SectionMoonTimes, SectionLunarWindows,
}

func AllSections() SectionSet { return SectionSet{All: true} }

func NoSections() SectionSet { return SectionSet{Set: map[PanchangSection]bool{}} }

func Sections(list ...PanchangSection) SectionSet {
	set := make(map[PanchangSection]bool, len(list))
	for _, s := range list {
		set[s] = true
	}
	return SectionSet{Set: set}
}

type resolvedOptions struct {
	ayanamsa        types.AyanamsaType
	lang            types.Language
	computeEndTimes bool
	masaSystem      types.MasaSystem
	janmaRashi      *int
	janmaNakshatra  *int
	region          types.FestivalRegion
	sections        SectionSet
}

func resolveCommon(o InstantPanchangOptions) resolvedOptions {
	r := resolvedOptions{
		ayanamsa:        o.Ayanamsa,
		lang:            o.Language,
		computeEndTimes: true,
		masaSystem:      o.MasaSystem,
		janmaRashi:      o.JanmaRashi,
		janmaNakshatra:  o.JanmaNakshatra,
		region:          ResolveRegionAlias(o.Region, o.RegionAliasWarner),
		sections:        AllSections(),
	}
	if r.ayanamsa == "" {
		r.ayanamsa = types.Lahiri
	}
	if r.lang == "" {
		r.lang = types.LanguageEn
	}
	if r.masaSystem == "" {
		r.masaSystem = types.Purnimanta
	}
	if o.ComputeEndTimes != nil {
		r.computeEndTimes = *o.ComputeEndTimes
	}
	return r
}

func resolveDaily(o PanchangOptions) resolvedOptions {
	r := resolveCommon(o.InstantPanchangOptions)
	if o.SectionsGiven {
		r.sections = o.Sections
	}
	return r
}

func varaIndexAtInstant(
	ctx *astronomy.EphemerisCtx,
	utcMs int64,
	location types.GeoLocation,
	offsetMinutes int,
	varaNames [7]types.VaraName,
) (int, error) {
	localMs := utils.UtcToLocalDisplay(utcMs, offsetMinutes)

	sunriseMs, err := astronomy.ComputeSunrise(ctx, utcMs-26*3600_000, location, astronomy.DefaultRiseSetLimitDays)
	if err == nil {
		for {
			var next int64
			next, err = astronomy.ComputeSunrise(ctx, sunriseMs+3600_000, location, astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				break
			}
			if next > utcMs {
				break
			}
			sunriseMs = next
		}
	}
	if err != nil {
		if errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel) {
			return types.Date(localMs).UTCDay(), nil
		}
		return 0, err
	}
	localSunrise := utils.UtcToLocalDisplay(sunriseMs, offsetMinutes)
	return ComputeVara(localSunrise, localSunrise, varaNames).Index, nil
}

type dailySegment struct {
	startTime *types.JSDate
	endTime   *types.JSDate
}

func segmentsOverlap(a, b dailySegment) bool {
	aStart, aEnd := math.Inf(-1), math.Inf(1)
	bStart, bEnd := math.Inf(-1), math.Inf(1)
	if a.startTime != nil {
		aStart = float64(a.startTime.Ms())
	}
	if a.endTime != nil {
		aEnd = float64(a.endTime.Ms())
	}
	if b.startTime != nil {
		bStart = float64(b.startTime.Ms())
	}
	if b.endTime != nil {
		bEnd = float64(b.endTime.Ms())
	}
	return aStart < bEnd && bStart < aEnd
}

func computeSpecialYogasOverDay(
	varaIndex int,
	tithis []types.DailyTithiInfo,
	nakshatras []types.DailyNakshatraInfo,
	suryaNakshatraIndex int,
	nameResolver func(types.SpecialYogaType) string,
) ([]types.SpecialYogaInfo, error) {
	out := make([]types.SpecialYogaInfo, 0, 2)
	seen := map[types.SpecialYogaType]bool{}
	for _, tithi := range tithis {
		for _, nakshatra := range nakshatras {
			if !segmentsOverlap(
				dailySegment{tithi.StartTime, tithi.EndTime},
				dailySegment{nakshatra.StartTime, nakshatra.EndTime},
			) {
				continue
			}
			found, err := ComputeSpecialYogas(
				varaIndex, tithi.Index, nakshatra.Index, suryaNakshatraIndex, nameResolver)
			if err != nil {
				return nil, err
			}
			for _, yoga := range found {
				if seen[yoga.Type] {
					continue
				}
				seen[yoga.Type] = true
				out = append(out, yoga)
			}
		}
	}
	return out, nil
}

func buildPanchakaInfo(
	referenceUtcMs int64,
	siderealMoonNow float64,
	getMoon LongitudeAt,
	varaIndexAt func(utcMs int64) (int, error),
	t i18n.PanchangTranslations,
) (types.PanchakaInfo, error) {
	if !ComputePanchaka(siderealMoonNow) {
		return types.PanchakaInfo{Active: false}, nil
	}
	onsetMs, ok := FindPanchakaOnset(referenceUtcMs, getMoon)
	if !ok {
		return types.PanchakaInfo{Active: false}, nil
	}

	onsetVara, err := varaIndexAt(onsetMs)
	if err != nil {
		return types.PanchakaInfo{}, err
	}
	typ, err := ClassifyPanchaka(onsetVara)
	if err != nil {
		return types.PanchakaInfo{}, err
	}
	return types.PanchakaInfo{
		Active:    true,
		Type:      typ,
		Name:      t.PanchakaType(typ),
		IsDosha:   IsPanchakaDosha(typ),
		OnsetVara: onsetVara,
	}, nil
}

func noFestivals() []types.FestivalInfo { return []types.FestivalInfo{} }

func GetInstantPanchang(
	ctx *astronomy.EphemerisCtx,
	dateMs int64,
	location types.GeoLocation,
	options InstantPanchangOptions,
	natal NatalResolvers,
) (types.InstantPanchangResult, bool, error) {
	if err := utils.ValidateDate(dateMs); err != nil {
		return types.InstantPanchangResult{}, false, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.InstantPanchangResult{}, false, err
	}

	o := resolveCommon(options)
	t := i18n.GetTranslations(o.lang)

	cache, err := astronomy.NewLongitudeCache(ctx, o.ayanamsa, panchangCacheMode)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}
	getMoon := LongitudeAt(cache.GetMoon)
	getSun := LongitudeAt(cache.GetSun)

	siderealMoon := getMoon(dateMs)
	siderealSun := getSun(dateMs)
	ayanamsaValue, err := astronomy.ComputeAyanamsa(dateMs, o.ayanamsa)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}

	tithiIdx := GetTithiIndexFromLons(siderealMoon, siderealSun)
	tithi := ComputeTithiFromLongitudes(siderealMoon, siderealSun,
		i18n.ResolveTithiName(tithiIdx, o.lang), i18n.ResolvePakshaName(tithiIdx, o.lang))
	nakshatra := ComputeNakshatraFromLongitude(siderealMoon,
		i18n.ResolveNakshatraName(utils.NakshatraOf(siderealMoon), o.lang))
	yoga := ComputeYogaFromLongitudes(siderealMoon, siderealSun,
		i18n.ResolveYogaName(GetYogaIndex(siderealMoon, siderealSun), o.lang))
	karana := ComputeKaranaFromLongitudes(siderealMoon, siderealSun,
		i18n.ResolveKaranaName(GetKaranaIndex(siderealMoon, siderealSun), o.lang))

	lmtOffsetMinutes := int(jsnum.Round(location.Longitude * 4))
	sunriseUtcMs, err := astronomy.ComputeSunrise(ctx, dateMs-26*3600_000, location,
		astronomy.DefaultRiseSetLimitDays)
	if err == nil {
		for {
			var next int64
			next, err = astronomy.ComputeSunrise(ctx, sunriseUtcMs+3600_000, location,
				astronomy.DefaultRiseSetLimitDays)
			if err != nil || next > dateMs {
				break
			}
			sunriseUtcMs = next
		}
	}
	if err != nil {
		if errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel) {
			return types.InstantPanchangResult{}, false, nil
		}
		return types.InstantPanchangResult{}, false, err
	}

	sunriseLocal := utils.UtcToLocalDisplay(sunriseUtcMs, lmtOffsetMinutes)
	vara := ComputeVara(sunriseLocal, sunriseLocal, t.VaraNames)

	chandramasa, err := ComputeChandraMasa(siderealSun, siderealMoon,
		func(idx int, isAdhika bool) string {
			return i18n.ResolveChandraMasaName(idx, o.lang, isAdhika)
		},
		o.masaSystem, dateMs, getSun,
		func(ref int64) (astronomy.NewMoonBounds, error) {
			return astronomy.BoundingNewMoons(ctx, ref)
		})
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}
	samvat, err := ComputeSamvat(ctx, dateMs)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}
	chandraRashi := ComputeChandraRashi(siderealMoon,
		func(idx int) string { return i18n.ResolveMasaName(idx, o.lang) })
	suryaNakshatra := ComputeSuryaNakshatra(siderealSun,
		func(idx int) string { return i18n.ResolveNakshatraName(idx, o.lang) })

	if o.computeEndTimes {
		set := func(target **types.JSDate, windowHours float64, index int,
			indexAt func(int64) int, angle utils.ElementAngle) error {
			ms, err := utils.FindTransitionTime(dateMs, dateMs+int64(windowHours)*3600_000,
				index, indexAt, utils.StandardPrecision.MaxIterations,
				utils.StandardPrecision.ToleranceMs, &angle)
			if err != nil {
				return err
			}
			*target = types.NullableDate(&ms)
			return nil
		}
		if err := set(&tithi.EndTime, 36, tithi.Index,
			func(ms int64) int { return GetTithiIndexAtTime(ms, getMoon, getSun) },
			tithiAngle(getMoon, getSun)); err != nil {
			return types.InstantPanchangResult{}, false, err
		}
		if err := set(&nakshatra.EndTime, 36, nakshatra.Index,
			func(ms int64) int { return GetNakshatraIndexAtTime(ms, getMoon) },
			nakshatraAngle(getMoon)); err != nil {
			return types.InstantPanchangResult{}, false, err
		}
		if err := set(&yoga.EndTime, 36, yoga.Index,
			func(ms int64) int { return GetYogaIndexAtTime(ms, getMoon, getSun) },
			yogaAngle(getMoon, getSun)); err != nil {
			return types.InstantPanchangResult{}, false, err
		}
		if err := set(&karana.EndTime, 18, karana.Index,
			func(ms int64) int { return GetKaranaIndexAtTime(ms, getMoon, getSun) },
			karanaAngle(getMoon, getSun)); err != nil {
			return types.InstantPanchangResult{}, false, err
		}
	}

	specialYogas, err := ComputeSpecialYogas(vara.Index, tithi.Index,
		utils.NakshatraOf(siderealMoon), suryaNakshatra.Index,
		func(y types.SpecialYogaType) string { return t.SpecialYoga(y) })
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}

	festivalList := ComputeFestivals(
		&FestivalComputeContext{
			TithiIndex:       tithi.Index,
			NakshatraIndex:   utils.NakshatraOf(siderealMoon),
			ChandraMasaIndex: chandramasa.AmantaIndex,
			IsAdhika:         chandramasa.IsAdhika,
			VaraIndex:        vara.Index,
			SolarMasaIndex:   int(math.Floor(siderealSun/30)) % 12,
			Region:           o.region,
		},
		func(key string) string { return resolveFestivalName(t, key) },
		func(idx int) string { return i18n.ResolveMasaName(idx, o.lang) },
	)

	var chandraBalam *types.ChandraBalamInfo
	if o.janmaRashi != nil {
		if natal.ChandraBalam == nil {
			return types.InstantPanchangResult{}, false, errMissingChandraBalam
		}
		cb, err := natal.ChandraBalam(*o.janmaRashi, chandraRashi.Index, o.lang)
		if err != nil {
			return types.InstantPanchangResult{}, false, err
		}
		chandraBalam = &cb
	}
	var tarabala *types.TarabalaInfo
	if o.janmaNakshatra != nil {
		if natal.Tarabala == nil {
			return types.InstantPanchangResult{}, false, errMissingTarabala
		}
		tb, err := natal.Tarabala(*o.janmaNakshatra,
			utils.NakshatraOf(siderealMoon), o.lang)
		if err != nil {
			return types.InstantPanchangResult{}, false, err
		}
		tarabala = &tb
	}
	gandaMula, err := ComputeGandaMula(utils.NakshatraOf(siderealMoon), o.lang)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}
	anandadiYoga, err := ComputeAnandadiYoga(vara.Index, utils.NakshatraOf(siderealMoon), o.lang)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}

	panchakaInfo, err := buildPanchakaInfo(dateMs, siderealMoon, getMoon,
		func(utcMs int64) (int, error) {
			return varaIndexAtInstant(ctx, utcMs, location, lmtOffsetMinutes, t.VaraNames)
		}, t)
	if err != nil {
		return types.InstantPanchangResult{}, false, err
	}

	return types.InstantPanchangResult{
		Timestamp:    types.Date(dateMs),
		Location:     location,
		Ayanamsa:     ayanamsaValue,
		Sun:          types.SunPosition{SiderealLongitude: siderealSun, Nakshatra: suryaNakshatra},
		Moon:         types.MoonPosition{SiderealLongitude: siderealMoon, Rashi: chandraRashi},
		Angas:        types.InstantAngas{Tithi: tithi, Nakshatra: nakshatra, Yoga: yoga, Karana: karana, Vara: vara},
		Calendar:     types.CalendarLabels{Chandramasa: chandramasa, Samvat: samvat},
		Inauspicious: types.InstantInauspicious{Panchaka: ComputePanchaka(siderealMoon), PanchakaInfo: panchakaInfo, GandaMula: gandaMula},
		SpecialYogas: specialYogas,
		AnandadiYoga: anandadiYoga,
		Festivals:    festivalList,
		ChandraBalam: chandraBalam,
		Tarabala:     tarabala,
	}, true, nil
}

func GetDailyPanchang(
	ctx *astronomy.EphemerisCtx,
	dateMs int64,
	location types.GeoLocation,
	options PanchangOptions,
	natal NatalResolvers,
) (types.DailyPanchangResult, bool, error) {
	fail := func(err error) (types.DailyPanchangResult, bool, error) {
		return types.DailyPanchangResult{}, false, err
	}

	if err := utils.ValidateDate(dateMs); err != nil {
		return fail(err)
	}
	if err := utils.ValidateLocation(location); err != nil {
		return fail(err)
	}
	offsetMinutes, err := utils.ResolveUtcOffset(options.Timezone, dateMs)
	if err != nil {
		return fail(err)
	}
	resolvedTimezone := types.ResolvedTimezone{OffsetMinutes: offsetMinutes}
	if options.Timezone.IsNamed() {
		resolvedTimezone.Zone = options.Timezone.Name()
	}
	o := resolveDaily(options)
	t := i18n.GetTranslations(o.lang)

	wantFestivals := o.sections.Wants(SectionFestivals)
	wantEclipse := o.sections.Wants(SectionEclipse)
	wantMoonTimes := o.sections.Wants(SectionMoonTimes)
	wantLunarWindows := o.sections.Wants(SectionLunarWindows)
	needBhadra := wantLunarWindows || wantFestivals

	cache, err := astronomy.NewLongitudeCache(ctx, o.ayanamsa, panchangCacheMode)
	if err != nil {
		return fail(err)
	}
	getMoon := LongitudeAt(cache.GetMoon)
	getSun := LongitudeAt(cache.GetSun)
	newMoons := &astronomy.NewMoonCache{}
	getBounds := BoundsAt(func(ref int64) (astronomy.NewMoonBounds, error) {
		return newMoons.Bounding(ctx, ref)
	})

	localMidnightUtcMs := utils.GetLocalMidnightUtc(dateMs, offsetMinutes)
	var sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs int64
	sunriseUtcMs, err = astronomy.ComputeSunrise(ctx, localMidnightUtcMs, location,
		astronomy.DefaultRiseSetLimitDays)
	if err == nil {
		sunsetUtcMs, err = astronomy.ComputeSunset(ctx, sunriseUtcMs, location,
			astronomy.DefaultRiseSetLimitDays)
	}
	if err == nil {
		nextSunriseUtcMs, err = astronomy.ComputeSunrise(ctx, sunsetUtcMs, location,
			astronomy.DefaultRiseSetLimitDays)
	}
	if err != nil {
		if errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel) {
			return types.DailyPanchangResult{}, false, nil
		}
		return fail(err)
	}

	siderealMoonAtSunrise := getMoon(sunriseUtcMs)
	siderealSunAtSunrise := getSun(sunriseUtcMs)
	ayanamsaValue, err := astronomy.ComputeAyanamsa(sunriseUtcMs, o.ayanamsa)
	if err != nil {
		return fail(err)
	}

	tithiIdxAtSunrise := GetTithiIndexFromLons(siderealMoonAtSunrise, siderealSunAtSunrise)
	tithiAtSunrise := ComputeTithiFromLongitudes(siderealMoonAtSunrise, siderealSunAtSunrise,
		i18n.ResolveTithiName(tithiIdxAtSunrise, o.lang),
		i18n.ResolvePakshaName(tithiIdxAtSunrise, o.lang))
	nakshatraAtSunrise := ComputeNakshatraFromLongitude(siderealMoonAtSunrise,
		i18n.ResolveNakshatraName(utils.NakshatraOf(siderealMoonAtSunrise), o.lang))
	yogaAtSunrise := ComputeYogaFromLongitudes(siderealMoonAtSunrise, siderealSunAtSunrise,
		i18n.ResolveYogaName(GetYogaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), o.lang))
	karanaAtSunrise := ComputeKaranaFromLongitudes(siderealMoonAtSunrise, siderealSunAtSunrise,
		i18n.ResolveKaranaName(GetKaranaIndex(siderealMoonAtSunrise, siderealSunAtSunrise), o.lang))

	sunriseLocal := utils.UtcToLocalDisplay(sunriseUtcMs, offsetMinutes)
	vara := ComputeVara(sunriseLocal, sunriseLocal, t.VaraNames)
	masa := ComputeMasa(siderealSunAtSunrise,
		func(idx int) string { return i18n.ResolveMasaName(idx, o.lang) })
	chandramasa, err := ComputeChandraMasa(siderealSunAtSunrise, siderealMoonAtSunrise,
		func(idx int, isAdhika bool) string {
			return i18n.ResolveChandraMasaName(idx, o.lang, isAdhika)
		},
		o.masaSystem, sunriseUtcMs, getSun, getBounds)
	if err != nil {
		return fail(err)
	}
	samvat, err := ComputeSamvat(ctx, sunriseUtcMs)
	if err != nil {
		return fail(err)
	}
	chandraRashi := ComputeChandraRashi(siderealMoonAtSunrise,
		func(idx int) string { return i18n.ResolveMasaName(idx, o.lang) })
	suryaNakshatra := ComputeSuryaNakshatra(siderealSunAtSunrise,
		func(idx int) string { return i18n.ResolveNakshatraName(idx, o.lang) })
	brahmaMuhurta := ComputeBrahmaMuhurta(sunriseUtcMs, sunsetUtcMs)
	qualityNameFn := func(q types.ChoghadiyaQuality) string { return t.Quality(q) }
	choghadiya := ComputeChoghadiya(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs, vara.Index,
		func(idx int) string { return t.ChoghadiyaNames[idx] }, qualityNameFn)
	hora := ComputeHora(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs, vara.Index,
		func(idx int) string { return t.GrahaNames[idx] })
	gowriPanchangam := ComputeGowriPanchangam(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs, vara.Index,
		func(idx int) string { return t.GowriNames[idx] }, qualityNameFn)

	needMoonrise := wantMoonTimes || wantFestivals
	var moonriseSearchMs *int64
	if needMoonrise {
		ms, found, err := astronomy.GetMoonrise(ctx, localMidnightUtcMs, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return fail(err)
		}
		if found {
			moonriseSearchMs = &ms
		}
	}
	var moonriseUtcMs *int64
	if moonriseSearchMs != nil && *moonriseSearchMs < localMidnightUtcMs+86_400_000 {
		moonriseUtcMs = moonriseSearchMs
	}
	var moonsetUtcMs *int64
	if wantMoonTimes {
		from := localMidnightUtcMs
		if moonriseUtcMs != nil {
			from = *moonriseUtcMs
		}
		ms, found, err := astronomy.GetMoonset(ctx, from, location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return fail(err)
		}
		if found {
			moonsetUtcMs = &ms
		}
	}

	panchaka := ComputePanchaka(siderealMoonAtSunrise)
	panchakaInfo, err := buildPanchakaInfo(sunriseUtcMs, siderealMoonAtSunrise, getMoon,
		func(utcMs int64) (int, error) {
			return varaIndexAtInstant(ctx, utcMs, location, offsetMinutes, t.VaraNames)
		}, t)
	if err != nil {
		return fail(err)
	}
	panchakaRahitaUtc := []types.UtcWindow{}
	if wantLunarWindows {
		panchakaRahitaUtc = ComputePanchakaRahita(sunriseUtcMs, nextSunriseUtcMs, getMoon)
	}
	doGhatiMuhurta := ComputeDoGhati(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs,
		func(idx int) string { return t.DoGhatiNames[idx] }, qualityNameFn)
	durMuhurtaUtc := ComputeDurMuhurta(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs, vara.Index)

	var bhadraUtc *types.UnlocalizedBhadraInfo
	if needBhadra {
		if b, ok := ComputeBhadraKaal(sunriseUtcMs, nextSunriseUtcMs, getMoon, getSun,
			func(key types.BhadraLocation) string { return t.BhadraLocation(key) }); ok {
			bhadraUtc = &b
		}
	}

	varjyamUtc := []types.UtcWindow{}
	if wantLunarWindows {
		varjyamUtc = ComputeVarjyamWindows(sunriseUtcMs, nextSunriseUtcMs, getMoon)
	}

	gandaMula, err := ComputeGandaMula(nakshatraAtSunrise.Index, o.lang)
	if err != nil {
		return fail(err)
	}
	anandadiYoga, err := ComputeAnandadiYoga(vara.Index, nakshatraAtSunrise.Index, o.lang)
	if err != nil {
		return fail(err)
	}

	festivalList := noFestivals()
	if wantFestivals {
		festivalList, err = ComputeDayFestivals(ctx, DayFestivalInputs{
			SunriseMs: sunriseUtcMs, SunsetMs: sunsetUtcMs,
			NextSunriseMs: nextSunriseUtcMs, Location: location, OffsetMinutes: offsetMinutes,
			TithiIndexAtSunrise:   tithiAtSunrise.Index,
			SiderealMoonAtSunrise: siderealMoonAtSunrise,
			SiderealSunAtSunrise:  siderealSunAtSunrise,
			VaraIndex:             vara.Index, Chandramasa: chandramasa,
			NextDayMasa: func() (int, bool) {
				next, err := ComputeChandraMasa(getSun(nextSunriseUtcMs), getMoon(nextSunriseUtcMs),
					func(idx int, isAdhika bool) string {
						return i18n.ResolveChandraMasaName(idx, o.lang, isAdhika)
					},
					o.masaSystem, nextSunriseUtcMs, getSun,
					func(ref int64) (astronomy.NewMoonBounds, error) {
						return astronomy.BoundingNewMoons(ctx, ref)
					})
				if err != nil {
					return chandramasa.AmantaIndex, chandramasa.IsAdhika
				}
				return next.AmantaIndex, next.IsAdhika
			},
			Lang: o.lang, T: t, Region: o.region,
			MoonriseMs: moonriseSearchMs, Bhadra: bhadraUtc,
			GetMoon: getMoon, GetSun: getSun,
		})
		if err != nil {
			return fail(err)
		}
	}

	var eclipseUtc *astronomy.EclipseInfo
	if wantEclipse {
		if e, ok := astronomy.GetEclipseDuringDay(ctx, sunriseUtcMs, nextSunriseUtcMs,
			location, o.lang, astronomy.SyzygyLongitudes{
				TropicalMoon: cache.GetTropicalMoon,
				TropicalSun:  cache.GetTropicalSun,
			}); ok {
			eclipseUtc = &e
		}
	}
	if eclipseUtc != nil {
		eclipseKey := "chandra_grahan"
		fallback := "Chandra Grahan"
		if eclipseUtc.Kind == types.EclipseSolar {
			eclipseKey, fallback = "surya_grahan", "Surya Grahan"
		}
		eclipseName := t.Festival(eclipseKey)
		if eclipseName == "" {
			eclipseName = fallback
		}
		festivalList = append([]types.FestivalInfo{{
			Key: eclipseKey, Name: eclipseName,
			Type: types.FestivalEclipse, Description: eclipseUtc.Description,
		}}, festivalList...)
	}

	local := func(ms int64) string { return utils.FormatInZone(ms, offsetMinutes) }
	localOrNull := func(ms *int64) *string {
		if ms == nil {
			return nil
		}
		s := local(*ms)
		return &s
	}

	var tithis []types.DailyTithiInfo
	var nakshatras []types.DailyNakshatraInfo
	var yogas []types.DailyYogaInfo
	var karanas []types.DailyKaranaInfo

	if o.computeEndTimes {
		tithis, err = utils.FindDailyElements(sunriseUtcMs, nextSunriseUtcMs, tithiAtSunrise,
			func(e types.TithiInfo) int { return e.Index },
			func(ms int64) int { return GetTithiIndexAtTime(ms, getMoon, getSun) },
			func(ms int64) types.TithiInfo {
				moon, sun := getMoon(ms), getSun(ms)
				idx := GetTithiIndexFromLons(moon, sun)
				return ComputeTithiFromLongitudes(moon, sun,
					i18n.ResolveTithiName(idx, o.lang), i18n.ResolvePakshaName(idx, o.lang))
			},
			36, utils.StandardPrecision, 3, ptrAngle(tithiAngle(getMoon, getSun)),
			func(e types.TithiInfo, startMs, endMs int64, active bool) types.DailyTithiInfo {
				return types.DailyTithiInfo{
					Index: e.Index, Name: e.Name, Paksha: e.Paksha, Number: e.Number,
					CompletionPercentage: e.CompletionPercentage,
					EndTime:              types.NullableDate(&endMs),
					StartTime:            types.NullableDate(&startMs),
					IsActiveAtSunrise:    active,
					StartTimeLocal:       localOrNull(&startMs),
					EndTimeLocal:         localOrNull(&endMs),
				}
			})
		if err != nil {
			return fail(err)
		}
		nakshatras, err = utils.FindDailyElements(sunriseUtcMs, nextSunriseUtcMs, nakshatraAtSunrise,
			func(e types.NakshatraInfo) int { return e.Index },
			func(ms int64) int { return GetNakshatraIndexAtTime(ms, getMoon) },
			func(ms int64) types.NakshatraInfo {
				moon := getMoon(ms)
				return ComputeNakshatraFromLongitude(moon,
					i18n.ResolveNakshatraName(utils.NakshatraOf(moon), o.lang))
			},
			36, utils.StandardPrecision, 3, ptrAngle(nakshatraAngle(getMoon)),
			func(e types.NakshatraInfo, startMs, endMs int64, active bool) types.DailyNakshatraInfo {
				return types.DailyNakshatraInfo{
					Index: e.Index, Name: e.Name, Pada: e.Pada,
					DegreesInNakshatra:   e.DegreesInNakshatra,
					CompletionPercentage: e.CompletionPercentage,
					EndTime:              types.NullableDate(&endMs),
					StartTime:            types.NullableDate(&startMs),
					IsActiveAtSunrise:    active,
					StartTimeLocal:       localOrNull(&startMs),
					EndTimeLocal:         localOrNull(&endMs),
				}
			})
		if err != nil {
			return fail(err)
		}
		yogas, err = utils.FindDailyElements(sunriseUtcMs, nextSunriseUtcMs, yogaAtSunrise,
			func(e types.YogaInfo) int { return e.Index },
			func(ms int64) int { return GetYogaIndexAtTime(ms, getMoon, getSun) },
			func(ms int64) types.YogaInfo {
				moon, sun := getMoon(ms), getSun(ms)
				return ComputeYogaFromLongitudes(moon, sun,
					i18n.ResolveYogaName(GetYogaIndex(moon, sun), o.lang))
			},
			36, utils.StandardPrecision, 3, ptrAngle(yogaAngle(getMoon, getSun)),
			func(e types.YogaInfo, startMs, endMs int64, active bool) types.DailyYogaInfo {
				return types.DailyYogaInfo{
					Index: e.Index, Name: e.Name,
					CompletionPercentage: e.CompletionPercentage,
					EndTime:              types.NullableDate(&endMs),
					StartTime:            types.NullableDate(&startMs),
					IsActiveAtSunrise:    active,
					StartTimeLocal:       localOrNull(&startMs),
					EndTimeLocal:         localOrNull(&endMs),
				}
			})
		if err != nil {
			return fail(err)
		}
		karanas, err = utils.FindDailyElements(sunriseUtcMs, nextSunriseUtcMs, karanaAtSunrise,
			func(e types.KaranaInfo) int { return e.Index },
			func(ms int64) int { return GetKaranaIndexAtTime(ms, getMoon, getSun) },
			func(ms int64) types.KaranaInfo {
				moon, sun := getMoon(ms), getSun(ms)
				return ComputeKaranaFromLongitudes(moon, sun,
					i18n.ResolveKaranaName(GetKaranaIndex(moon, sun), o.lang))
			},
			18, utils.StandardPrecision, 5, ptrAngle(karanaAngle(getMoon, getSun)),
			func(e types.KaranaInfo, startMs, endMs int64, active bool) types.DailyKaranaInfo {
				return types.DailyKaranaInfo{
					Index: e.Index, Name: e.Name, Type: e.Type,
					CompletionPercentage: e.CompletionPercentage,
					EndTime:              types.NullableDate(&endMs),
					StartTime:            types.NullableDate(&startMs),
					IsActiveAtSunrise:    active,
					StartTimeLocal:       localOrNull(&startMs),
					EndTimeLocal:         localOrNull(&endMs),
				}
			})
		if err != nil {
			return fail(err)
		}
	} else {
		tithis = []types.DailyTithiInfo{{
			Index: tithiAtSunrise.Index, Name: tithiAtSunrise.Name,
			Paksha: tithiAtSunrise.Paksha, Number: tithiAtSunrise.Number,
			CompletionPercentage: tithiAtSunrise.CompletionPercentage,
			EndTime:              tithiAtSunrise.EndTime, IsActiveAtSunrise: true,
		}}
		nakshatras = []types.DailyNakshatraInfo{{
			Index: nakshatraAtSunrise.Index, Name: nakshatraAtSunrise.Name,
			Pada: nakshatraAtSunrise.Pada, DegreesInNakshatra: nakshatraAtSunrise.DegreesInNakshatra,
			CompletionPercentage: nakshatraAtSunrise.CompletionPercentage,
			EndTime:              nakshatraAtSunrise.EndTime, IsActiveAtSunrise: true,
		}}
		yogas = []types.DailyYogaInfo{{
			Index: yogaAtSunrise.Index, Name: yogaAtSunrise.Name,
			CompletionPercentage: yogaAtSunrise.CompletionPercentage,
			EndTime:              yogaAtSunrise.EndTime, IsActiveAtSunrise: true,
		}}
		karanas = []types.DailyKaranaInfo{{
			Index: karanaAtSunrise.Index, Name: karanaAtSunrise.Name, Type: karanaAtSunrise.Type,
			CompletionPercentage: karanaAtSunrise.CompletionPercentage,
			EndTime:              karanaAtSunrise.EndTime, IsActiveAtSunrise: true,
		}}
	}

	specialYogas, err := computeSpecialYogasOverDay(vara.Index, tithis, nakshatras,
		suryaNakshatra.Index, func(y types.SpecialYogaType) string { return t.SpecialYoga(y) })
	if err != nil {
		return fail(err)
	}

	rahuKalam := ComputeRahuKalam(sunriseUtcMs, sunsetUtcMs, vara.Index)
	gulikaKalam := ComputeGulikaKalam(sunriseUtcMs, sunsetUtcMs, vara.Index)
	yamaganda := ComputeYamaganda(sunriseUtcMs, sunsetUtcMs, vara.Index)
	abhijitMuhurta, haveAbhijit := ComputeAbhijitMuhurta(sunriseUtcMs, sunsetUtcMs, &vara.Index)
	vijayaMuhurtaUtc := ComputeVijayaMuhurta(sunriseUtcMs, sunsetUtcMs)
	godhuliMuhurtaUtc := ComputeGodhuliMuhurta(sunsetUtcMs)
	nishitaMuhurtaUtc := ComputeNishitaMuhurta(sunsetUtcMs, nextSunriseUtcMs)
	amritKalaUtc := ComputeAmritKalaWindows(sunriseUtcMs, nextSunriseUtcMs, getMoon)
	madhyahnaWindowUtc := ComputeMadhyahna(sunriseUtcMs, sunsetUtcMs)
	pratahSandhyaUtc := ComputePratahSandhya(sunriseUtcMs, sunsetUtcMs, nextSunriseUtcMs)
	sayahnaSandhyaUtc := ComputeSayahnaSandhya(sunsetUtcMs, nextSunriseUtcMs)

	withLocal := func(w types.UtcWindow) types.TimePeriod {
		return types.TimePeriod{
			Start: types.Date(w.StartMs), End: types.Date(w.EndMs),
			StartLocal: local(w.StartMs), EndLocal: local(w.EndMs),
		}
	}
	withLocalAll := func(ws []types.UtcWindow) []types.TimePeriod {
		out := make([]types.TimePeriod, 0, len(ws))
		for _, w := range ws {
			out = append(out, withLocal(w))
		}
		return out
	}

	dayDurationMs := sunsetUtcMs - sunriseUtcMs
	nightDurationMs := nextSunriseUtcMs - sunsetUtcMs

	var chandraBalam *types.ChandraBalamInfo
	if o.janmaRashi != nil {
		if natal.ChandraBalam == nil {
			return fail(errMissingChandraBalam)
		}
		cb, err := natal.ChandraBalam(*o.janmaRashi, chandraRashi.Index, o.lang)
		if err != nil {
			return fail(err)
		}
		chandraBalam = &cb
	}
	var tarabala *types.TarabalaInfo
	if o.janmaNakshatra != nil {
		if natal.Tarabala == nil {
			return fail(errMissingTarabala)
		}
		tb, err := natal.Tarabala(*o.janmaNakshatra,
			utils.NakshatraOf(siderealMoonAtSunrise), o.lang)
		if err != nil {
			return fail(err)
		}
		tarabala = &tb
	}

	dayMinutes := int(jsnum.Round(float64(dayDurationMs) / 60_000))
	nightMinutes := int(jsnum.Round(float64(nightDurationMs) / 60_000))

	var abhijit *types.TimePeriod
	if haveAbhijit {
		a := withLocal(abhijitMuhurta)
		abhijit = &a
	}

	durMuhurta := make([]types.DurMuhurtaPeriod, 0, len(durMuhurtaUtc))
	for _, w := range durMuhurtaUtc {
		durMuhurta = append(durMuhurta, types.DurMuhurtaPeriod{
			Start: types.Date(w.StartMs), End: types.Date(w.EndMs),
			StartLocal: local(w.StartMs), EndLocal: local(w.EndMs),
			Segment: w.Segment,
		})
	}

	var bhadra *types.BhadraInfo
	if bhadraUtc != nil {
		vasa := make([]types.BhadraVasaSegment, 0, len(bhadraUtc.Vasa))
		for _, s := range bhadraUtc.Vasa {
			vasa = append(vasa, types.BhadraVasaSegment{
				Start: types.Date(s.StartMs), End: types.Date(s.EndMs),
				Location: s.Location, LocationName: s.LocationName,
				StartLocal: local(s.StartMs), EndLocal: local(s.EndMs),
			})
		}
		bhadra = &types.BhadraInfo{
			Start: types.Date(bhadraUtc.StartMs), End: types.Date(bhadraUtc.EndMs),
			StartLocal: local(bhadraUtc.StartMs), EndLocal: local(bhadraUtc.EndMs),
			Location: bhadraUtc.Location, LocationName: bhadraUtc.LocationName,
			Vasa: vasa, IsActive: bhadraUtc.IsActive,
		}
	}

	var eclipse *types.DailyEclipseInfo
	if eclipseUtc != nil {
		e := types.DailyEclipseInfo{
			Kind: eclipseUtc.Kind, Subtype: eclipseUtc.Subtype,
			Start: eclipseUtc.StartMs, Peak: eclipseUtc.PeakMs, End: eclipseUtc.EndMs,
			StartLocal:          local(eclipseUtc.StartMs.Ms()),
			PeakLocal:           local(eclipseUtc.PeakMs.Ms()),
			EndLocal:            local(eclipseUtc.EndMs.Ms()),
			VisibleFromLocation: eclipseUtc.VisibleFromLocation,
			Obscuration:         eclipseUtc.Obscuration,
			Magnitude:           eclipseUtc.Magnitude,
			SutakStart:          eclipseUtc.SutakStartMs,
			SutakEnd:            eclipseUtc.SutakEndMs,
			Description:         eclipseUtc.Description,
		}
		if eclipseUtc.SutakStartMs != nil {
			s := local(eclipseUtc.SutakStartMs.Ms())
			e.SutakStartLocal = &s
		}
		if eclipseUtc.SutakEndMs != nil {
			s := local(eclipseUtc.SutakEndMs.Ms())
			e.SutakEndLocal = &s
		}
		eclipse = &e
	}

	return types.DailyPanchangResult{
		Date:     types.Date(dateMs),
		Location: location,
		Timezone: resolvedTimezone,
		Ayanamsa: ayanamsaValue,
		Sun: types.DailySun{
			Rise: types.Date(sunriseUtcMs), Set: types.Date(sunsetUtcMs),
			NextRise:           types.Date(nextSunriseUtcMs),
			RiseLocal:          local(sunriseUtcMs),
			SetLocal:           local(sunsetUtcMs),
			NextRiseLocal:      local(nextSunriseUtcMs),
			DayDurationMinutes: dayMinutes, NightDurationMinutes: nightMinutes,
			DinamanaMinutes: dayMinutes, RatrimanaMinutes: nightMinutes,
			SiderealLongitude: siderealSunAtSunrise, Nakshatra: suryaNakshatra,
		},
		Moon: types.DailyMoon{
			Rise: types.NullableDate(moonriseUtcMs), Set: types.NullableDate(moonsetUtcMs),
			RiseLocal: localOrNull(moonriseUtcMs), SetLocal: localOrNull(moonsetUtcMs),
			SiderealLongitude: siderealMoonAtSunrise, Rashi: chandraRashi,
		},
		Angas: types.DailyAngas{
			Tithis: tithis, Nakshatras: nakshatras, Yogas: yogas, Karanas: karanas, Vara: vara,
		},
		Calendar: types.DailyCalendarLabels{Masa: masa, Chandramasa: chandramasa, Samvat: samvat},
		Muhurtas: types.MuhurtaWindows{
			Abhijit:        abhijit,
			Brahma:         withLocal(brahmaMuhurta),
			Vijaya:         withLocal(vijayaMuhurtaUtc),
			Godhuli:        withLocal(godhuliMuhurtaUtc),
			Nishita:        withLocal(nishitaMuhurtaUtc),
			AmritKala:      withLocalAll(amritKalaUtc),
			Madhyahna:      withLocal(madhyahnaWindowUtc),
			PratahSandhya:  withLocal(pratahSandhyaUtc),
			SayahnaSandhya: withLocal(sayahnaSandhyaUtc),
			DoGhati: types.DoGhatiInfo{
				Day:   localizeDoGhati(doGhatiMuhurta.Day, local),
				Night: localizeDoGhati(doGhatiMuhurta.Night, local),
			},
		},
		Inauspicious: types.InauspiciousWindows{
			RahuKalam:      withLocal(rahuKalam),
			GulikaKalam:    withLocal(gulikaKalam),
			Yamaganda:      withLocal(yamaganda),
			DurMuhurta:     durMuhurta,
			Varjyam:        withLocalAll(varjyamUtc),
			Bhadra:         bhadra,
			GandaMula:      gandaMula,
			Panchaka:       panchaka,
			PanchakaInfo:   panchakaInfo,
			PanchakaRahita: withLocalAll(panchakaRahitaUtc),
		},
		Periods: types.DayPeriods{
			Choghadiya: types.ChoghadiyaInfo{
				Day:   localizeChoghadiya(choghadiya.Day, local),
				Night: localizeChoghadiya(choghadiya.Night, local),
			},
			Hora: types.HoraInfo{
				Day:   localizeHora(hora.Day, local),
				Night: localizeHora(hora.Night, local),
			},
			Gowri: types.GowriInfo{
				Day:   localizeGowri(gowriPanchangam.Day, local),
				Night: localizeGowri(gowriPanchangam.Night, local),
			},
		},
		SpecialYogas: specialYogas,
		AnandadiYoga: anandadiYoga,
		Festivals:    festivalList,
		Eclipse:      eclipse,
		ChandraBalam: chandraBalam,
		Tarabala:     tarabala,
	}, true, nil
}

func ptrAngle(a utils.ElementAngle) *utils.ElementAngle { return &a }

func localizeChoghadiya(in []types.UnlocalizedChoghadiyaSlot, local func(int64) string) []types.ChoghadiyaSlot {
	out := make([]types.ChoghadiyaSlot, 0, len(in))
	for _, s := range in {
		out = append(out, types.ChoghadiyaSlot{
			Start: types.Date(s.StartMs), End: types.Date(s.EndMs),
			Index: s.Index, Name: s.Name, Quality: s.Quality, QualityName: s.QualityName,
			StartLocal: local(s.StartMs), EndLocal: local(s.EndMs),
		})
	}
	return out
}

func localizeHora(in []types.UnlocalizedHoraSlot, local func(int64) string) []types.HoraSlot {
	out := make([]types.HoraSlot, 0, len(in))
	for _, s := range in {
		out = append(out, types.HoraSlot{
			Start: types.Date(s.StartMs), End: types.Date(s.EndMs),
			PlanetIndex: s.PlanetIndex, Planet: s.Planet,
			StartLocal: local(s.StartMs), EndLocal: local(s.EndMs),
		})
	}
	return out
}

func localizeGowri(in []types.UnlocalizedGowriSlot, local func(int64) string) []types.GowriSlot {
	out := make([]types.GowriSlot, 0, len(in))
	for _, s := range in {
		out = append(out, types.GowriSlot{
			Start: types.Date(s.StartMs), End: types.Date(s.EndMs),
			Index: s.Index, Name: s.Name, Quality: s.Quality, QualityName: s.QualityName,
			StartLocal: local(s.StartMs), EndLocal: local(s.EndMs),
		})
	}
	return out
}

func localizeDoGhati(in []types.UnlocalizedDoGhatiSlot, local func(int64) string) []types.DoGhatiSlot {
	out := make([]types.DoGhatiSlot, 0, len(in))
	for _, s := range in {
		out = append(out, types.DoGhatiSlot{
			Start: types.Date(s.StartMs), End: types.Date(s.EndMs),
			Index: s.Index, Name: s.Name, Quality: s.Quality, QualityName: s.QualityName,
			StartLocal: local(s.StartMs), EndLocal: local(s.EndMs),
		})
	}
	return out
}
