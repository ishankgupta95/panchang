package calendar

import (
	"context"
	"errors"
	"math"
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const dayMs int64 = 24 * 3600_000

type ekadashiDay struct {
	dMs   int64
	tithi int
}

func ComputeEkadashiDatesForYear(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]types.JSDate, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	out := []types.JSDate{}
	first := utils.UtcDateMs(year, 0, 1)
	last := utils.UtcDateMs(year, 11, 31)
	ayanamsa := yearlyResolvedAyanamsa(options)

	days := make([]ekadashiDay, 0, 370)
	var offset int
	var hint *int
	for d := first - dayMs; d <= last+2*dayMs; d += dayMs {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		midnight, dayOffset, err := utils.WallClockToUtc(d, options.Timezone, hint)
		if err != nil {
			return nil, err
		}
		offset, hint = dayOffset, &offset
		if floorDiv(midnight+int64(dayOffset)*60_000, dayMs)*dayMs != d {
			continue
		}
		sunriseUtcMs, err := astronomy.ComputeSunrise(eph, midnight, location,
			astronomy.DefaultRiseSetLimitDays)
		if err == nil {
			var sunsetUtcMs int64
			sunsetUtcMs, err = astronomy.ComputeSunset(eph, sunriseUtcMs, location,
				astronomy.DefaultRiseSetLimitDays)
			if err == nil {
				_, err = astronomy.ComputeSunrise(eph, sunsetUtcMs, location,
					astronomy.DefaultRiseSetLimitDays)
			}
		}
		if err != nil {
			if isPolarRiseSetError(err) {
				continue
			}
			return nil, err
		}

		siderealMoon, err := astronomy.GetSiderealMoonLongitude(eph, sunriseUtcMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		siderealSun, err := astronomy.GetSiderealSunLongitude(eph, sunriseUtcMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		days = append(days, ekadashiDay{dMs: d, tithi: core.GetTithiIndexFromLons(siderealMoon, siderealSun)})
	}

	for i := 0; i < len(days); i++ {
		d, tithi := days[i].dMs, days[i].tithi
		next, hasNext := 0, false
		if i+1 < len(days) && days[i+1].dMs-d == dayMs {
			next, hasNext = days[i+1].tithi, true
		}
		fast, isFast := int64(0), false
		switch {
		case (tithi == 10 || tithi == 25) && !(hasNext && next == tithi):
			fast, isFast = d, true
			if hasNext && (next == 12 || next == 27) && i > 0 && d-days[i-1].dMs == dayMs {
				fast = days[i-1].dMs
			}
		case hasNext && ((tithi == 9 && next == 11) || (tithi == 24 && next == 26)):
			fast, isFast = d, true
		}
		if isFast && fast >= first && fast <= last {
			value, err := utils.CivilDayValue(fast, options.Timezone)
			if err != nil {
				return nil, err
			}
			out = append(out, types.Date(value))
		}
	}
	return out, nil
}

func floorDiv(a, b int64) int64 {
	q := a / b
	if a%b != 0 && (a < 0) != (b < 0) {
		q--
	}
	return q
}

// isPolarRiseSetError matches by code, not against the exported Sentinel
// variables, whose Code any importer can overwrite.
func isPolarRiseSetError(err error) bool {
	var pe *types.PanchangError
	return errors.As(err, &pe) && (pe.Code == types.ErrNoSunrise || pe.Code == types.ErrNoSunset)
}

func ComputeSankrantisForYear(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]SankrantiEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	lang := yearlyResolvedLanguage(options)
	ayanamsa := yearlyResolvedAyanamsa(options)
	// The scan grid's offset only aligns the daily probes: each transit's year comes from its own day.
	gridOffset, err := utils.ResolveUtcOffset(options.Timezone, utils.UtcDateMs(year, 6, 1))
	if err != nil {
		return nil, err
	}
	rashiAt := func(ms int64) (int, error) {
		lon, err := astronomy.GetSiderealSunLongitude(eph, ms, ayanamsa)
		if err != nil {
			return 0, err
		}
		return int(math.Floor(lon/30)) % 12, nil
	}

	scanStart := utils.UtcDateMs(year, 0, 1) - int64(gridOffset)*60_000 - dayMs
	scanEnd := utils.UtcDateMs(year, 11, 31) + 23*3600_000 + 59*60_000 -
		int64(gridOffset)*60_000 + dayMs

	out := []SankrantiEvent{}
	prevMs := scanStart
	prevRashi, err := rashiAt(prevMs)
	if err != nil {
		return nil, err
	}
	for t := scanStart + dayMs; t <= scanEnd; t += dayMs {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
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

		anchorMs, anchorErr := sankrantiAnchor(eph, hi, location)
		if anchorErr != nil {
			if !isPolarRiseSetError(anchorErr) {
				return nil, anchorErr
			}
			anchorMs = transitUtcMs
		}

		anchorOffset, err := utils.ResolveUtcOffset(options.Timezone, anchorMs)
		if err != nil {
			return nil, err
		}
		local := types.Date(utils.UtcToLocalDisplay(anchorMs, anchorOffset))
		date, err := utils.CivilDayValue(
			utils.UtcDateMs(local.UTCFullYear(), local.UTCMonth(), local.UTCDate()), options.Timezone)
		if err != nil {
			return nil, err
		}
		if local.UTCFullYear() == year {
			out = append(out, SankrantiEvent{
				Date:      types.Date(date),
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
	eph *astronomy.EphemerisCtx, transitMs int64, location types.GeoLocation,
) (int64, error) {
	dayStart, err := astronomy.ComputeSunrise(eph, transitMs-30*3600_000, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	for i := 0; i < 3; i++ {
		sunset, err := astronomy.ComputeSunset(eph, dayStart, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		next, err := astronomy.ComputeSunrise(eph, sunset, location,
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
	dayEnd, err := astronomy.ComputeSunset(eph, dayStart, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	if transitMs <= dayEnd {
		return dayStart, nil
	}
	return astronomy.ComputeSunrise(eph, dayEnd, location, astronomy.DefaultRiseSetLimitDays)
}

func ComputeFestivalsInRange(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	startMs, endMs int64,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]FestivalDay, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
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
	return festivalsOnCivilDays(ctx, eph, startMs, endMs, location, options)
}

func festivalsOnCivilDays(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	startMs, endMs int64,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]FestivalDay, error) {
	out := []FestivalDay{}
	opts := yearlyPanchangOptions(options)
	opts.Sections = core.Sections(core.SectionFestivals, core.SectionEclipse)
	opts.SectionsGiven = true
	computeEndTimes := false
	opts.ComputeEndTimes = &computeEndTimes

	next, err := utils.CivilDayStepper(startMs, options.Timezone)
	if err != nil {
		return nil, err
	}
	for {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		t, err := next()
		if err != nil {
			return nil, err
		}
		if t > endMs {
			break
		}
		day, ok, err := core.GetDailyLabels(eph, utils.ClampToSupported(t), location, opts)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		for _, f := range day.Festivals {
			out = append(out, FestivalDay{Date: day.Date, Festival: f})
		}
	}
	return out, nil
}

func GetUpcomingEclipses(
	eph *astronomy.EphemerisCtx,
	fromMs int64,
	location types.GeoLocation,
	count int,
) ([]astronomy.EclipseInfo, error) {
	return GetUpcomingEclipsesContext(context.Background(), eph, fromMs, location, count)
}

// GetUpcomingEclipsesContext is GetUpcomingEclipses checking ctx before it
// validates and before each eclipse it looks for.
func GetUpcomingEclipsesContext(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	fromMs int64,
	location types.GeoLocation,
	count int,
) ([]astronomy.EclipseInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
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
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		sol, hasSol := astronomy.GetUpcomingSolarEclipse(eph, cursorMs, location, withinDays, types.LanguageEn)
		lun, hasLun := astronomy.GetUpcomingLunarEclipse(eph, cursorMs, location, withinDays, types.LanguageEn)
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

func ComputeEclipsesInRange(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	startMs, endMs int64,
	location types.GeoLocation,
) ([]astronomy.EclipseInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
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

	// A walk only finds syzygies at or after startMs; the search from a day earlier adds one that peaks after it.
	walk := func(next func(fromMs int64, withinDays int) (astronomy.EclipseInfo, bool)) ([]astronomy.EclipseInfo, error) {
		acc := []astronomy.EclipseInfo{}
		cursorMs := startMs
		for step := 0; step < maxSteps; step++ {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			e, ok := next(cursorMs, spanDays)
			if !ok || e.PeakMs.Ms() > endMs {
				break
			}
			if e.PeakMs.Ms() >= startMs {
				acc = append(acc, e)
			}
			cursorMs = e.EndMs.Ms() + 1000
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		early, ok := next(startMs-dayMs, 2)
		if !ok || early.PeakMs.Ms() < startMs || early.PeakMs.Ms() > endMs {
			return acc, nil
		}
		for _, e := range acc {
			if d := e.PeakMs.Ms() - early.PeakMs.Ms(); d > -dayMs && d < dayMs {
				return acc, nil
			}
		}
		return append([]astronomy.EclipseInfo{early}, acc...), nil
	}

	solar, err := walk(func(fromMs int64, withinDays int) (astronomy.EclipseInfo, bool) {
		return astronomy.GetUpcomingSolarEclipse(eph, fromMs, location, withinDays, types.LanguageEn)
	})
	if err != nil {
		return nil, err
	}
	lunar, err := walk(func(fromMs int64, withinDays int) (astronomy.EclipseInfo, bool) {
		return astronomy.GetUpcomingLunarEclipse(eph, fromMs, location, withinDays, types.LanguageEn)
	})
	if err != nil {
		return nil, err
	}

	all := make([]astronomy.EclipseInfo, 0, len(solar)+len(lunar))
	all = append(all, solar...)
	all = append(all, lunar...)
	sort.SliceStable(all, func(i, j int) bool { return all[i].PeakMs.Ms() < all[j].PeakMs.Ms() })
	return all, nil
}

func ComputeFestivalsForYear(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	options YearlyListingOptions,
) ([]FestivalDay, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	startMs, endMs, err := utils.LocalYearWindow(year, options.Timezone)
	if err != nil {
		return nil, err
	}
	if err := utils.ValidateLocalYearWindow(year, startMs, endMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	return festivalsOnCivilDays(ctx, eph, startMs, endMs, location, options)
}

func ComputeEclipsesForYear(ctx context.Context,
	eph *astronomy.EphemerisCtx,
	year int,
	location types.GeoLocation,
	timezone types.Timezone,
) ([]astronomy.EclipseInfo, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	startMs, endMs, err := utils.LocalYearWindow(year, timezone)
	if err != nil {
		return nil, err
	}
	if err := utils.ValidateLocalYearWindow(year, startMs, endMs); err != nil {
		return nil, err
	}
	return ComputeEclipsesInRange(ctx, eph, utils.ClampToSupported(startMs), utils.ClampToSupported(endMs), location)
}
