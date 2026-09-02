package calendar

import (
	"errors"
	"math"
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

const dayMs int64 = 24 * 3600_000

type YearlyListingOptions struct {
	Timezone          types.Timezone
	Ayanamsa          types.AyanamsaType
	MasaSystem        types.MasaSystem
	Language          types.Language
	Region            types.FestivalRegion
	RegionAliasWarner core.RegionAliasWarner
}

func (o YearlyListingOptions) panchangOptions() core.PanchangOptions {
	return core.PanchangOptions{
		InstantPanchangOptions: core.InstantPanchangOptions{
			Ayanamsa:          o.Ayanamsa,
			Language:          o.Language,
			MasaSystem:        o.MasaSystem,
			Region:            o.Region,
			RegionAliasWarner: o.RegionAliasWarner,
		},
		Timezone: o.Timezone,
	}
}

func (o YearlyListingOptions) resolvedAyanamsa() types.AyanamsaType {
	if o.Ayanamsa == "" {
		return types.Lahiri
	}
	return o.Ayanamsa
}

func (o YearlyListingOptions) resolvedLanguage() types.Language {
	if o.Language == "" {
		return types.LanguageEn
	}
	return o.Language
}

type FestivalDay struct {
	Date     types.JSDate       `json:"date"`
	Festival types.FestivalInfo `json:"festival"`
}

type SankrantiEvent struct {
	Date      types.JSDate `json:"date"`
	Moment    types.JSDate `json:"moment"`
	Rashi     int          `json:"rashi"`
	RashiName string       `json:"rashiName"`
}

type ekadashiDay struct {
	dMs   int64
	tithi int
}

func ComputeEkadashiDatesForYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]types.JSDate, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	out := []types.JSDate{}
	start := types.DateUTC(year, 0, 1).Ms()
	end := types.DateUTC(year, 11, 31).Ms()
	ayanamsa := options.resolvedAyanamsa()
	offsetMinutes, err := utils.ResolveUtcOffset(options.Timezone, types.DateUTC(year, 6, 1).Ms())
	if err != nil {
		return nil, err
	}

	days := make([]ekadashiDay, 0, 368)
	for t := start; t <= end+dayMs; t += dayMs {
		sunriseUtcMs, err := astronomy.ComputeSunrise(ctx,
			utils.GetLocalMidnightUtc(t, offsetMinutes), location,
			astronomy.DefaultRiseSetLimitDays)
		if err == nil {
			var sunsetUtcMs int64
			sunsetUtcMs, err = astronomy.ComputeSunset(ctx, sunriseUtcMs, location,
				astronomy.DefaultRiseSetLimitDays)
			if err == nil {
				_, err = astronomy.ComputeSunrise(ctx, sunsetUtcMs, location,
					astronomy.DefaultRiseSetLimitDays)
			}
		}
		if err != nil {
			if isPolarRiseSetError(err) {
				continue
			}
			return nil, err
		}

		siderealMoon, err := astronomy.GetSiderealMoonLongitude(ctx, sunriseUtcMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		siderealSun, err := astronomy.GetSiderealSunLongitude(ctx, sunriseUtcMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		days = append(days, ekadashiDay{dMs: t, tithi: core.GetTithiIndexFromLons(siderealMoon, siderealSun)})
	}

	for i := 0; i < len(days); i++ {
		d, tithi := days[i].dMs, days[i].tithi
		if d > end {
			break
		}
		next, hasNext := 0, false
		if i+1 < len(days) && days[i+1].dMs-d == dayMs {
			next, hasNext = days[i+1].tithi, true
		}
		isEkadashi := tithi == 10 || tithi == 25
		if isEkadashi && !(hasNext && next == tithi) {
			if hasNext && (next == 12 || next == 27) && i > 0 {
				if d-days[i-1].dMs == dayMs {
					out = append(out, types.Date(days[i-1].dMs))
					continue
				}
			}
			out = append(out, types.Date(d))
			continue
		}
		if hasNext && ((tithi == 9 && next == 11) || (tithi == 24 && next == 26)) {
			out = append(out, types.Date(d))
		}
	}
	return out, nil
}

func isPolarRiseSetError(err error) bool {
	return errors.Is(err, types.ErrNoSunriseSentinel) || errors.Is(err, types.ErrNoSunsetSentinel)
}

func ComputeSankrantisForYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]SankrantiEvent, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	lang := options.resolvedLanguage()
	ayanamsa := options.resolvedAyanamsa()
	offsetMinutes, err := utils.ResolveUtcOffset(options.Timezone, types.DateUTC(year, 6, 1).Ms())
	if err != nil {
		return nil, err
	}
	rashiAt := func(ms int64) (int, error) {
		lon, err := astronomy.GetSiderealSunLongitude(ctx, ms, ayanamsa)
		if err != nil {
			return 0, err
		}
		return int(math.Floor(lon/30)) % 12, nil
	}

	scanStart := types.DateUTC(year, 0, 1).Ms() - int64(offsetMinutes)*60_000 - dayMs
	scanEnd := types.DateUTC(year, 11, 31).Ms() + 23*3600_000 + 59*60_000 -
		int64(offsetMinutes)*60_000 + dayMs

	out := []SankrantiEvent{}
	prevMs := scanStart
	prevRashi, err := rashiAt(prevMs)
	if err != nil {
		return nil, err
	}
	for t := scanStart + dayMs; t <= scanEnd; t += dayMs {
		rashi, err := rashiAt(t)
		if err != nil {
			return nil, err
		}
		if rashi == prevRashi {
			prevMs, prevRashi = t, rashi
			continue
		}

		lo, hi := prevMs, t
		for hi-lo > 1000 {
			mid := (lo + hi) >> 1
			r, err := rashiAt(mid)
			if err != nil {
				return nil, err
			}
			if r == prevRashi {
				lo = mid
			} else {
				hi = mid
			}
		}
		transitUtcMs := hi

		anchorMs, anchorErr := sankrantiAnchor(ctx, hi, location)
		if anchorErr != nil {
			anchorMs = transitUtcMs
		}

		local := types.Date(utils.UtcToLocalDisplay(anchorMs, offsetMinutes))
		date := types.DateUTC(local.UTCFullYear(), local.UTCMonth(), local.UTCDate())
		if local.UTCFullYear() == year {
			out = append(out, SankrantiEvent{
				Date:      date,
				Moment:    types.Date(transitUtcMs),
				Rashi:     rashi,
				RashiName: i18n.ResolveMasaName(rashi, lang),
			})
		}

		prevMs, prevRashi = t, rashi
	}
	return out, nil
}

func sankrantiAnchor(
	ctx *astronomy.EphemerisCtx, transitMs int64, location types.GeoLocation,
) (int64, error) {
	dayStart, err := astronomy.ComputeSunrise(ctx, transitMs-30*3600_000, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	for i := 0; i < 3; i++ {
		sunset, err := astronomy.ComputeSunset(ctx, dayStart, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		next, err := astronomy.ComputeSunrise(ctx, sunset, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		if next <= transitMs {
			dayStart = next
		} else {
			break
		}
	}
	dayEnd, err := astronomy.ComputeSunset(ctx, dayStart, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	if transitMs <= dayEnd {
		return dayStart, nil
	}
	return astronomy.ComputeSunrise(ctx, dayEnd, location, astronomy.DefaultRiseSetLimitDays)
}

func ComputeFestivalsInRange(
	ctx *astronomy.EphemerisCtx,
	startMs, endMs int64,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]FestivalDay, error) {
	if err := utils.ValidateDate(startMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateDate(endMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	if startMs > endMs {
		return nil, types.Codef(types.ErrInvalidInput,
			"start (%s) must be ≤ end (%s)",
			types.Date(startMs).ISOString(), types.Date(endMs).ISOString())
	}
	out := []FestivalDay{}
	opts := options.panchangOptions()
	opts.Sections = core.Sections(core.SectionFestivals, core.SectionEclipse)
	opts.SectionsGiven = true
	computeEndTimes := false
	opts.ComputeEndTimes = &computeEndTimes

	for t := startMs; t <= endMs; t += dayMs {
		p, ok, err := core.GetDailyPanchang(ctx, t, location, opts, core.NatalResolvers{})
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		for _, f := range p.Festivals {
			out = append(out, FestivalDay{Date: p.Date, Festival: f})
		}
	}
	return out, nil
}

func GetUpcomingEclipses(
	ctx *astronomy.EphemerisCtx,
	fromMs int64,
	location types.GeoLocation,
	count int,
) ([]astronomy.EclipseInfo, error) {
	if err := utils.ValidateDate(fromMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	if count < 1 {
		return nil, types.Codef(types.ErrInvalidInput,
			"count must be a positive integer, got %d", count)
	}
	yearsAhead := count
	if yearsAhead < 3 {
		yearsAhead = 3
	}
	withinDays := yearsAhead * 366

	collected := []astronomy.EclipseInfo{}
	cursorMs := fromMs

	for len(collected) < count {
		sol, hasSol := astronomy.GetUpcomingSolarEclipse(ctx, cursorMs, location, withinDays, types.LanguageEn)
		lun, hasLun := astronomy.GetUpcomingLunarEclipse(ctx, cursorMs, location, withinDays, types.LanguageEn)
		if !hasSol && !hasLun {
			break
		}
		var next astronomy.EclipseInfo
		switch {
		case !hasSol:
			next = lun
		case !hasLun:
			next = sol
		case sol.PeakMs.Ms() < lun.PeakMs.Ms():
			next = sol
		default:
			next = lun
		}

		collected = append(collected, next)
		cursorMs = next.EndMs.Ms() + 1000
	}

	return collected, nil
}

func ComputeEclipsesInRange(
	ctx *astronomy.EphemerisCtx,
	startMs, endMs int64,
	location types.GeoLocation,
) ([]astronomy.EclipseInfo, error) {
	if err := utils.ValidateDate(startMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateDate(endMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	if startMs > endMs {
		return nil, types.Codef(types.ErrInvalidInput,
			"start (%s) must be ≤ end (%s)",
			types.Date(startMs).ISOString(), types.Date(endMs).ISOString())
	}

	spanDays := int(math.Ceil(float64(endMs-startMs)/float64(24*3600_000))) + 1
	maxSteps := int(math.Ceil(float64(spanDays)/20)) + 50

	walk := func(next func(fromMs int64) (astronomy.EclipseInfo, bool)) []astronomy.EclipseInfo {
		acc := []astronomy.EclipseInfo{}
		cursorMs := startMs
		for step := 0; step < maxSteps; step++ {
			e, ok := next(cursorMs)
			if !ok || e.PeakMs.Ms() > endMs {
				break
			}
			acc = append(acc, e)
			cursorMs = e.EndMs.Ms() + 1000
		}
		return acc
	}

	solar := walk(func(fromMs int64) (astronomy.EclipseInfo, bool) {
		return astronomy.GetUpcomingSolarEclipse(ctx, fromMs, location, spanDays, types.LanguageEn)
	})
	lunar := walk(func(fromMs int64) (astronomy.EclipseInfo, bool) {
		return astronomy.GetUpcomingLunarEclipse(ctx, fromMs, location, spanDays, types.LanguageEn)
	})

	all := make([]astronomy.EclipseInfo, 0, len(solar)+len(lunar))
	all = append(all, solar...)
	all = append(all, lunar...)
	sort.SliceStable(all, func(i, j int) bool { return all[i].PeakMs.Ms() < all[j].PeakMs.Ms() })
	return all, nil
}

func localYearWindow(year int, timezone types.Timezone) (int64, int64, error) {
	offsetMinutes, err := utils.ResolveUtcOffset(timezone, types.DateUTC(year, 6, 1).Ms())
	if err != nil {
		return 0, 0, err
	}
	off := int64(offsetMinutes) * 60_000
	return types.DateUTC(year, 0, 1).Ms() - off,
		types.DateUTC(year, 11, 31).Ms() + dayMs - 1 - off, nil
}

func ComputeFestivalsForYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]FestivalDay, error) {
	startMs, endMs, err := localYearWindow(year, options.Timezone)
	if err != nil {
		return nil, err
	}
	return ComputeFestivalsInRange(ctx, startMs, endMs, location, options)
}

func ComputeEclipsesForYear(
	ctx *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	timezone types.Timezone,
) ([]astronomy.EclipseInfo, error) {
	startMs, endMs, err := localYearWindow(year, timezone)
	if err != nil {
		return nil, err
	}
	return ComputeEclipsesInRange(ctx, startMs, endMs, location)
}
