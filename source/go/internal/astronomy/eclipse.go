package astronomy

import (
	"math"
	"strconv"
	"strings"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type (
	EclipseSubtype = types.EclipseSubtype
	EclipseKind    = types.EclipseKind
)

const (
	EclipsePartial   = types.EclipsePartial
	EclipseTotal     = types.EclipseTotal
	EclipseAnnular   = types.EclipseAnnular
	EclipsePenumbral = types.EclipsePenumbral

	EclipseSolar = types.EclipseSolar
	EclipseLunar = types.EclipseLunar
)

const (
	solarSutakHours = 12
	lunarSutakHours = 9
)

const eclipseLatitudeLimitDeg = 1.8

const syzygyAdvanceDays = 10

func IsBodyAboveHorizon(ctx *EphemerisCtx, ms int64, location types.GeoLocation, body HorizonBody) bool {
	return BodyAltitudeDegrees(ctx, ms, location, body) > 0
}

func IsEclipseVisibleAnyPhase(ctx *EphemerisCtx, eclipse EclipseInfo, location types.GeoLocation) bool {
	body := HorizonMoon
	if eclipse.Kind == EclipseSolar {
		body = HorizonSun
	}
	startMs := eclipse.StartMs
	endMs := eclipse.EndMs
	const samples = 12
	for i := 0; i <= samples; i++ {
		t := int64(float64(startMs) + float64(endMs-startMs)*float64(i)/samples)
		if IsBodyAboveHorizon(ctx, t, location, body) {
			return true
		}
	}
	return false
}

func searchFromSyzygies[T any](
	ctx *EphemerisCtx,
	fromMs int64,
	targetElongationDeg float64,
	syzygyLimitMs int64,
	attempt func(syzygyMs int64) (T, bool),
) (T, bool) {
	var zero T
	cursor := fromMs
	maxIterations := int(math.Ceil(float64(syzygyLimitMs-fromMs)/(29.5*dayMS))) + 2
	for i := 0; i < maxIterations; i++ {
		syzygy, ok := SearchMoonPhase(ctx, targetElongationDeg, cursor, 45)
		if !ok || syzygy > syzygyLimitMs {
			return zero, false
		}
		if math.Abs(GetMoonPosition(ctx, syzygy).Latitude) < eclipseLatitudeLimitDeg {
			if hit, found := attempt(syzygy); found {
				return hit, true
			}
		}
		cursor = syzygy + syzygyAdvanceDays*dayMS
	}
	return zero, false
}

func GetUpcomingLunarEclipse(
	ctx *EphemerisCtx, fromMs int64, location types.GeoLocation, withinDays int, lang types.Language,
) (EclipseInfo, bool) {
	windowEndMs := fromMs + int64(withinDays)*dayMS
	eclipse, found := searchFromSyzygies(ctx, fromMs, 180, windowEndMs+dayMS,
		func(oppositionMs int64) (LunarEclipse, bool) {
			found, ok := FindLunarEclipse(ctx, oppositionMs)
			if !ok {
				return LunarEclipse{}, false
			}
			if found.PenumbralEndMs <= fromMs {
				return LunarEclipse{}, false
			}
			return found, true
		})
	if !found {
		return EclipseInfo{}, false
	}
	if eclipse.PenumbralBeginMs > windowEndMs {
		return EclipseInfo{}, false
	}

	subtype := EclipseSubtype(eclipse.Kind)
	umbralBegin := eclipse.PartialBeginMs
	umbralEnd := eclipse.PartialEndMs
	hasUmbra := umbralBegin != nil && umbralEnd != nil
	visibleFromLocation := IsBodyAboveHorizon(ctx, eclipse.PeakMs, location, HorizonMoon)

	out := EclipseInfo{
		Kind:                EclipseLunar,
		Subtype:             subtype,
		StartMs:             types.Date(eclipse.PenumbralBeginMs),
		PeakMs:              types.Date(eclipse.PeakMs),
		EndMs:               types.Date(eclipse.PenumbralEndMs),
		VisibleFromLocation: visibleFromLocation,
		Obscuration:         eclipse.UmbralObscuration,
		Magnitude:           eclipse.UmbralMagnitude,
		Description: describeEclipse(
			EclipseLunar, subtype, eclipse.UmbralObscuration, visibleFromLocation, lang),
	}
	if hasUmbra {
		start := types.Date(*umbralBegin - lunarSutakHours*3600_000)
		end := types.Date(*umbralEnd)
		out.SutakStartMs = &start
		out.SutakEndMs = &end
	}
	return out, true
}

func GetUpcomingSolarEclipse(
	ctx *EphemerisCtx, fromMs int64, location types.GeoLocation, withinDays int, lang types.Language,
) (EclipseInfo, bool) {
	windowEndMs := fromMs + int64(withinDays)*dayMS
	eclipse, found := searchFromSyzygies(ctx, fromMs, 0, windowEndMs+dayMS,
		func(conjunctionMs int64) (LocalSolarEclipse, bool) {
			local, ok := FindLocalSolarEclipse(ctx, conjunctionMs, location)
			if !ok {
				return LocalSolarEclipse{}, false
			}
			if local.PartialEndMs <= fromMs {
				return LocalSolarEclipse{}, false
			}
			if local.BeginAltitude > 0 || local.EndAltitude > 0 {
				return local, true
			}
			return LocalSolarEclipse{}, false
		})
	if !found {
		return EclipseInfo{}, false
	}
	if eclipse.PartialBeginMs > windowEndMs {
		return EclipseInfo{}, false
	}

	subtype := EclipseSubtype(eclipse.Kind)
	visibleFromLocation := eclipse.PeakAltitude > 0

	sutakStartDate := types.Date(eclipse.PartialBeginMs - solarSutakHours*3600_000)
	sutakEndDate := types.Date(eclipse.PartialEndMs)
	return EclipseInfo{
		Kind:                EclipseSolar,
		Subtype:             subtype,
		StartMs:             types.Date(eclipse.PartialBeginMs),
		PeakMs:              types.Date(eclipse.PeakMs),
		EndMs:               types.Date(eclipse.PartialEndMs),
		VisibleFromLocation: visibleFromLocation,
		Obscuration:         eclipse.Obscuration,
		Magnitude:           eclipse.Magnitude,
		SutakStartMs:        &sutakStartDate,
		SutakEndMs:          &sutakEndDate,
		Description: describeEclipse(
			EclipseSolar, subtype, eclipse.Obscuration, visibleFromLocation, lang),
	}, true
}

func DirectLongitudes(ctx *EphemerisCtx) SyzygyLongitudes {
	return SyzygyLongitudes{
		TropicalMoon: func(ms int64) float64 { return GetTropicalMoonLongitude(ctx, ms) },
		TropicalSun:  func(ms int64) float64 { return GetTropicalSunLongitude(ctx, ms) },
	}
}

func elongationAt(ms int64, lon SyzygyLongitudes) float64 {
	return utils.Normalize360(lon.TropicalMoon(ms) - lon.TropicalSun(ms))
}

func syzygyBetween(fromMs, toMs int64, targetDeg float64, lon SyzygyLongitudes) bool {
	relFrom := utils.Normalize360(elongationAt(fromMs, lon) - targetDeg)
	relTo := utils.Normalize360(elongationAt(toMs, lon) - targetDeg)
	if relFrom == 0 {
		return true
	}
	return relTo < relFrom
}

const syzygyGuardMarginMS = 12 * 3600_000

func GetEclipseDuringDay(
	ctx *EphemerisCtx, sunriseMs, nextSunriseMs int64, location types.GeoLocation,
	lang types.Language, longitudes SyzygyLongitudes,
) (EclipseInfo, bool) {
	windowMs := nextSunriseMs - sunriseMs
	windowDays := int(math.Ceil(float64(windowMs)/(24*3600_000))) + 1

	guardFrom := sunriseMs - syzygyGuardMarginMS
	guardTo := nextSunriseMs + syzygyGuardMarginMS

	if syzygyBetween(guardFrom, guardTo, 0, longitudes) {
		if solar, ok := GetUpcomingSolarEclipse(ctx, sunriseMs, location, windowDays, lang); ok &&
			solar.PeakMs.Ms() < nextSunriseMs {
			return solar, true
		}
	}

	if syzygyBetween(guardFrom, guardTo, 180, longitudes) {
		if lunar, ok := GetUpcomingLunarEclipse(ctx, sunriseMs, location, windowDays, lang); ok &&
			lunar.PeakMs.Ms() < nextSunriseMs {
			return lunar, true
		}
	}

	return EclipseInfo{}, false
}

func describeEclipse(
	kind EclipseKind, subtype EclipseSubtype, obscuration float64, visible bool, lang types.Language,
) string {
	e := i18n.GetTranslations(lang).Eclipse
	var kindName string
	if kind == EclipseSolar {
		kindName = e.Kind.Solar
	} else {
		kindName = e.Kind.Lunar
	}
	var subtypeName string
	switch subtype {
	case EclipsePartial:
		subtypeName = e.Subtype.Partial
	case EclipseTotal:
		subtypeName = e.Subtype.Total
	case EclipseAnnular:
		subtypeName = e.Subtype.Annular
	case EclipsePenumbral:
		subtypeName = e.Subtype.Penumbral
	}
	visibility := e.Visibility.NotVisible
	if visible {
		visibility = e.Visibility.Visible
	}
	s := e.Template
	s = strings.Replace(s, "{subtype}", subtypeName, 1)
	s = strings.Replace(s, "{kind}", kindName, 1)
	s = strings.Replace(s, "{percent}", strconv.Itoa(int(jsnum.Round(obscuration*100))), 1)
	s = strings.Replace(s, "{visibility}", visibility, 1)
	return s
}
