package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func resolveAyanamsa(a types.AyanamsaType) types.AyanamsaType {
	if a == "" {
		return types.Lahiri
	}
	return a
}

func resolveLang(l types.Language) types.Language {
	if l == "" {
		return types.LanguageEn
	}
	return l
}

func ComputeLagna(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.LagnaInfo, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.LagnaInfo{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.LagnaInfo{}, err
	}
	ayanamsaType = resolveAyanamsa(ayanamsaType)
	lang = resolveLang(lang)

	lstDeg := utils.Normalize360(astronomy.GreenwichApparentSiderealDegrees(ctx, birthMs) + location.Longitude)
	theta := utils.DegToRad(lstDeg)

	t := (astronomy.DateToJulianDay(birthMs) - 2451545.0) / 36525.0
	eps := utils.DegToRad(MeanObliquity(t))
	phi := utils.DegToRad(location.Latitude)

	numerator := math.Cos(theta)
	denominator := -float64(math.Sin(eps)*math.Tan(phi)) - float64(math.Cos(eps)*math.Sin(theta))
	tropicalLagna := utils.Normalize360((math.Atan2(numerator, denominator) * 180) / jsnum.PI)

	ayanamsa, err := astronomy.ComputeAyanamsa(birthMs, ayanamsaType)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	siderealLongitude := utils.Normalize360(tropicalLagna - ayanamsa)

	rashiIndex := int(math.Floor(siderealLongitude / 30))
	degreeInRashi := siderealLongitude - float64(float64(rashiIndex)*30)
	nakIdx := utils.NakshatraOf(siderealLongitude)
	degreesInNakshatra := math.Max(siderealLongitude-float64(float64(nakIdx)*utils.NakshatraSpan), 0)
	pada := int(math.Floor(degreesInNakshatra/utils.NakshatraPadaSpan)) + 1
	if pada > 4 {
		pada = 4
	}

	return types.LagnaInfo{
		SiderealLongitude: siderealLongitude,
		Rashi:             types.RashiInfo{Index: rashiIndex, Name: i18n.ResolveMasaName(rashiIndex, lang)},
		DegreeInRashi:     degreeInRashi,
		Nakshatra:         types.LagnaNakshatra{Index: nakIdx, Name: i18n.ResolveNakshatraName(nakIdx, lang)},
		Pada:              pada,
	}, nil
}

func findSunriseBefore(ctx *astronomy.EphemerisCtx, ms int64, location types.GeoLocation) (int64, error) {
	back30h := ms - 30*3600_000
	candidate, err := astronomy.ComputeSunrise(ctx, back30h, location, astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	for i := 0; i < 4; i++ {
		lookAhead := candidate + 22*3600_000
		next, err := astronomy.ComputeSunrise(ctx, lookAhead, location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		if next > ms {
			return candidate, nil
		}
		candidate = next
	}
	return candidate, nil
}

func buildLagnaInfo(siderealLongitude float64, lang types.Language) types.LagnaInfo {
	sid := utils.Normalize360(siderealLongitude)
	rashiIndex := int(math.Floor(sid / 30))
	degreeInRashi := sid - float64(float64(rashiIndex)*30)
	nakIdx := utils.NakshatraOf(sid)
	degreesInNakshatra := math.Max(sid-float64(float64(nakIdx)*utils.NakshatraSpan), 0)
	pada := int(math.Floor(degreesInNakshatra/utils.NakshatraPadaSpan)) + 1
	if pada > 4 {
		pada = 4
	}
	return types.LagnaInfo{
		SiderealLongitude: sid,
		Rashi:             types.RashiInfo{Index: rashiIndex, Name: i18n.ResolveMasaName(rashiIndex, lang)},
		DegreeInRashi:     degreeInRashi,
		Nakshatra:         types.LagnaNakshatra{Index: nakIdx, Name: i18n.ResolveNakshatraName(nakIdx, lang)},
		Pada:              pada,
	}
}

func ComputeHoraLagna(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.LagnaInfo, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.LagnaInfo{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.LagnaInfo{}, err
	}
	ayanamsaType = resolveAyanamsa(ayanamsaType)
	lang = resolveLang(lang)

	sunriseMs, err := findSunriseBefore(ctx, birthMs, location)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	sunSidAtSunrise, err := astronomy.GetSiderealSunLongitude(ctx, sunriseMs, ayanamsaType)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	hoursSinceSunrise := float64(birthMs-sunriseMs) / 3600_000 // int64 division would truncate
	horaLon := sunSidAtSunrise + float64(hoursSinceSunrise*30)
	return buildLagnaInfo(horaLon, lang), nil
}

func ComputeGhatiLagna(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.LagnaInfo, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.LagnaInfo{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.LagnaInfo{}, err
	}
	ayanamsaType = resolveAyanamsa(ayanamsaType)
	lang = resolveLang(lang)

	sunriseMs, err := findSunriseBefore(ctx, birthMs, location)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	sunSidAtSunrise, err := astronomy.GetSiderealSunLongitude(ctx, sunriseMs, ayanamsaType)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	ghatikasSinceSunrise := float64(birthMs-sunriseMs) / (24 * 60 * 1000)
	ghatiLon := sunSidAtSunrise + float64(ghatikasSinceSunrise*30)
	return buildLagnaInfo(ghatiLon, lang), nil
}

func ComputeBhavaLagna(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.LagnaInfo, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.LagnaInfo{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return types.LagnaInfo{}, err
	}
	ayanamsaType = resolveAyanamsa(ayanamsaType)
	lang = resolveLang(lang)

	sunriseMs, err := findSunriseBefore(ctx, birthMs, location)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	sunSidAtSunrise, err := astronomy.GetSiderealSunLongitude(ctx, sunriseMs, ayanamsaType)
	if err != nil {
		return types.LagnaInfo{}, err
	}
	hoursSinceSunrise := float64(birthMs-sunriseMs) / 3600_000
	bhavaLon := sunSidAtSunrise + float64(hoursSinceSunrise*15)
	return buildLagnaInfo(bhavaLon, lang), nil
}

func ComputeSripatiLagna(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.LagnaInfo, error) {
	return ComputeLagna(ctx, birthMs, location, ayanamsaType, lang)
}

func ComputeSripatiLagnaWithCusps(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsaType types.AyanamsaType,
	lang types.Language,
) (types.SripatiLagnaInfo, error) {
	lagna, err := ComputeLagna(ctx, birthMs, location, ayanamsaType, lang)
	if err != nil {
		return types.SripatiLagnaInfo{}, err
	}
	ayanamsaType = resolveAyanamsa(ayanamsaType)

	lstDeg := utils.Normalize360(astronomy.GreenwichApparentSiderealDegrees(ctx, birthMs) + location.Longitude)
	theta := utils.DegToRad(lstDeg)
	t := (astronomy.DateToJulianDay(birthMs) - 2451545.0) / 36525.0
	eps := utils.DegToRad(MeanObliquity(t))
	mcTropical := utils.Normalize360(
		(math.Atan2(math.Sin(theta), math.Cos(theta)*math.Cos(eps)) * 180) / jsnum.PI,
	)
	ayanamsa, err := astronomy.ComputeAyanamsa(birthMs, ayanamsaType)
	if err != nil {
		return types.SripatiLagnaInfo{}, err
	}
	mcSidereal := utils.Normalize360(mcTropical - ayanamsa)

	return types.SripatiLagnaInfo{
		LagnaInfo: lagna,
		Cusps:     sripatiCusps(lagna.SiderealLongitude, mcSidereal),
	}, nil
}

func sripatiCusps(ascSidereal, mcSidereal float64) []float64 {
	asc := utils.Normalize360(ascSidereal)
	mc := utils.Normalize360(mcSidereal)
	ic := utils.Normalize360(mc + 180)
	dsc := utils.Normalize360(asc + 180)

	arcQ1 := utils.Normalize360(ic - asc)
	arcQ2 := utils.Normalize360(dsc - ic)
	arcQ3 := utils.Normalize360(mc - dsc)
	arcQ4 := utils.Normalize360(asc + 360 - mc)

	return []float64{
		asc,
		utils.Normalize360(asc + arcQ1/3),
		utils.Normalize360(asc + 2*arcQ1/3),
		ic,
		utils.Normalize360(ic + arcQ2/3),
		utils.Normalize360(ic + 2*arcQ2/3),
		dsc,
		utils.Normalize360(dsc + arcQ3/3),
		utils.Normalize360(dsc + 2*arcQ3/3),
		mc,
		utils.Normalize360(mc + arcQ4/3),
		utils.Normalize360(mc + 2*arcQ4/3),
	}
}
