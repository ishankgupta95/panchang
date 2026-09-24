package calendar

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var AllPakshas = []Paksha{PakshaShukla, PakshaKrishna}

// convertLabelOptions is convertPanchangOptions for the converters, which read
// only each day's sunrise tithi, vara, lunar month and samvat. None of those
// depends on the optional sections or on the anga end times, so every section
// is off and the end times are not searched.
func convertLabelOptions(o ConvertOptions) types.PanchangOptions {
	opts := convertPanchangOptions(o)
	opts.Sections = core.NoSections()
	opts.SectionsGiven = true
	computeEndTimes := false
	opts.ComputeEndTimes = &computeEndTimes
	return opts
}

func ConvertGregorianToHindu(
	ctx *astronomy.EphemerisCtx,
	dateMs int64,
	location types.GeoLocation,
	options ConvertOptions,
) (HinduCalendarCoords, error) {
	if err := utils.ValidateDate(dateMs); err != nil {
		return HinduCalendarCoords{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return HinduCalendarCoords{}, err
	}
	day, ok, err := core.GetDailyLabels(ctx, dateMs, location, convertLabelOptions(options))
	if err != nil {
		return HinduCalendarCoords{}, err
	}
	if !ok {
		return HinduCalendarCoords{}, types.NewPanchangError(
			"Cannot convert "+types.Date(dateMs).ISOString()+
				" to Hindu calendar: polar location with no sunrise",
			types.ErrNoSunrise)
	}
	tithiAtSunrise := day.Tithi
	paksha := PakshaKrishna
	if tithiAtSunrise.Index < 15 {
		paksha = PakshaShukla
	}
	return HinduCalendarCoords{
		TithiName:    tithiAtSunrise.Name,
		Tithi:        tithiAtSunrise.Index + 1,
		PakshaTithi:  tithiAtSunrise.Number,
		Paksha:       paksha,
		MasaName:     day.Chandramasa.Name,
		MasaIndex:    day.Chandramasa.Index,
		IsAdhika:     day.Chandramasa.IsAdhika,
		VikramSamvat: day.Samvat.VikramSamvat,
		ShakaSamvat:  day.Samvat.ShakaSamvat,
		VaraName:     day.Vara.Name,
		VaraIndex:    day.Vara.Index,
	}, nil
}

func ConvertHinduToGregorian(
	ctx *astronomy.EphemerisCtx,
	coords HinduDateCoords,
	location types.GeoLocation,
	options ConvertOptions,
) ([]types.JSDate, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return nil, err
	}
	if coords.MasaIndex < 0 || coords.MasaIndex > 11 {
		return nil, types.Codef(types.ErrInvalidInput,
			"masaIndex must be in [0, 11], got %d", coords.MasaIndex)
	}
	if coords.PakshaTithi < 1 || coords.PakshaTithi > 15 {
		return nil, types.Codef(types.ErrInvalidInput,
			"pakshaTithi must be in [1, 15], got %d", coords.PakshaTithi)
	}
	if coords.Paksha != PakshaShukla && coords.Paksha != PakshaKrishna {
		return nil, types.Codef(types.ErrInvalidInput,
			"paksha must be 'shukla' or 'krishna'")
	}

	ceYear := coords.VikramSamvat - 57
	masaSystem := convertResolvedMasaSystem(options)
	wrapsYearEnd := masaSystem == types.Purnimanta &&
		coords.MasaIndex == 0 && coords.Paksha == PakshaKrishna
	var masaMidMs int64
	if wrapsYearEnd {
		masaMidMs = utils.UtcDateMs(ceYear+1, 2, 10)
	} else {
		masaMidMs = utils.UtcDateMs(ceYear, 2, 25) + int64(coords.MasaIndex)*30*dayMs
	}
	targetTithi := coords.PakshaTithi - 1
	if coords.Paksha == PakshaKrishna {
		targetTithi += 15
	}

	opts := convertLabelOptions(options)
	scan := func(firstMs, lastMs int64) ([]types.JSDate, error) {
		out := []types.JSDate{}
		for day := firstMs; day <= lastMs; day += dayMs {
			if err := utils.ValidateDate(day); err != nil {
				return nil, err
			}
			t, onDay, err := utils.InstantInCivilDay(day, options.Timezone)
			if err != nil {
				return nil, err
			}
			if !onDay {
				continue
			}
			p, ok, err := core.GetDailyLabels(ctx, t, location, opts)
			if err != nil {
				return nil, err
			}
			if !ok {
				continue
			}
			tithi := p.Tithi.Index
			masa := p.Chandramasa.Index
			if tithi != targetTithi {
				continue
			}
			if masa != coords.MasaIndex {
				continue
			}
			if p.Samvat.VikramSamvat != coords.VikramSamvat {
				continue
			}
			if coords.AdhikaOnly && !p.Chandramasa.IsAdhika {
				continue
			}
			value, err := utils.CivilDayValue(day, options.Timezone)
			if err != nil {
				return nil, err
			}
			out = append(out, types.Date(value))
		}
		return out, nil
	}

	out, err := scan(masaMidMs-50*dayMs, masaMidMs+60*dayMs)
	if err != nil || !wrapsYearEnd {
		return out, err
	}
	// An Adhika Chaitra's Krishna paksha opens the samvat year instead of closing it.
	adhikaMidMs := utils.UtcDateMs(ceYear, 2, 25)
	adhikaFirstMs, adhikaLastMs := adhikaMidMs-50*dayMs, adhikaMidMs+60*dayMs
	if adhikaFirstMs < utils.SupportedStartMs {
		adhikaFirstMs = utils.SupportedStartMs
	}
	if adhikaLastMs > utils.SupportedEndMs {
		adhikaLastMs = utils.SupportedEndMs
	}
	adhika, err := scan(adhikaFirstMs, adhikaLastMs)
	if err != nil {
		return nil, err
	}
	return append(adhika, out...), nil
}

const kaliyugaEpochYear = -3101

func GetKaliYugaYear(ctx *astronomy.EphemerisCtx, dateMs int64) (int, error) {
	if err := utils.ValidateDate(dateMs); err != nil {
		return 0, err
	}
	y := types.Date(dateMs).UTCFullYear()
	newMoonMs, err := core.ChaitraNewMoon(ctx, y)
	if err != nil {
		return 0, err
	}
	if dateMs >= newMoonMs {
		return y - kaliyugaEpochYear, nil
	}
	return y - kaliyugaEpochYear - 1, nil
}

func GetHinduNewYear(
	ctx *astronomy.EphemerisCtx,
	gregorianYear int,
	region types.FestivalRegion,
	location types.GeoLocation,
	options ConvertOptions,
) (types.JSDate, bool, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, false, err
	}

	useSolarAnchor := region == types.LegacyRegionTamil || region == types.RegionTamilNadu ||
		region == types.RegionKerala ||
		region == types.RegionPunjab ||
		region == types.LegacyRegionBengal || region == types.RegionWestBengal ||
		region == types.RegionAssam ||
		region == types.RegionOdisha

	if useSolarAnchor {
		return findMeshaSankranti(ctx, gregorianYear, region, location, options)
	}

	return findChaitraShuklaPratipada(ctx, gregorianYear, location, options)
}

type chandraMasaState struct {
	masa   int
	adhika bool
	have   bool
	dayMs  int64
	tithi  int
}

func findChaitraShuklaPratipada(
	ctx *astronomy.EphemerisCtx,
	gregorianYear int,
	location types.GeoLocation,
	options ConvertOptions,
) (types.JSDate, bool, error) {
	amantaOptions := convertLabelOptions(options)
	amantaOptions.MasaSystem = types.Amanta
	lastMs := utils.UtcDateMs(gregorianYear, 4, 15)
	var prev chandraMasaState
	for day := utils.UtcDateMs(gregorianYear, 1, 15); day <= lastMs; day += dayMs {
		if err := utils.ValidateDate(day); err != nil {
			return 0, false, err
		}
		t, onDay, err := utils.InstantInCivilDay(day, options.Timezone)
		if err != nil {
			return 0, false, err
		}
		if !onDay {
			continue
		}
		p, ok, err := core.GetDailyLabels(ctx, t, location, amantaOptions)
		if err != nil {
			return 0, false, err
		}
		if !ok {
			continue
		}
		masa := p.Chandramasa.Index
		adhika := p.Chandramasa.IsAdhika
		tithi := p.Tithi.Index
		if masa == 0 && !adhika && prev.have && (prev.masa != 0 || prev.adhika) {
			kshayaPratipada := prev.dayMs == day-dayMs && !prev.adhika && prev.tithi == 29 && tithi == 1
			newYear := day
			if kshayaPratipada {
				newYear = prev.dayMs
			}
			value, err := utils.CivilDayValue(newYear, options.Timezone)
			if err != nil {
				return 0, false, err
			}
			return types.Date(value), true, nil
		}
		prev = chandraMasaState{masa: masa, adhika: adhika, have: true, dayMs: day, tithi: tithi}
	}
	return 0, false, nil
}

type meshaDayRule string

const (
	meshaSankrantiDay  meshaDayRule = "sankranti-day"
	meshaCivilDay      meshaDayRule = "civil-day"
	meshaNextSunrise   meshaDayRule = "next-sunrise"
	meshaCivilDayPlus1 meshaDayRule = "civil-day-plus-1"
	meshaNightCutoff   meshaDayRule = "night-cutoff"
)

// panaNightCutoffPerMille is how far into the night, in thousandths of sunset
// to sunrise, a transit moves Pana Sankranti to the next civil date: the
// reference almanac's Bhubaneswar dates put it between 305 (2067, same date)
// and 327 (2028, next date).
const panaNightCutoffPerMille int64 = 315

func meshaDayRuleFor(region types.FestivalRegion) meshaDayRule {
	switch region {
	case types.RegionPunjab:
		return meshaCivilDay
	case types.RegionKerala:
		return meshaNextSunrise
	case types.LegacyRegionBengal, types.RegionWestBengal:
		return meshaCivilDayPlus1
	case types.RegionOdisha:
		return meshaNightCutoff
	default:
		return meshaSankrantiDay
	}
}

func findMeshaSankranti(
	ctx *astronomy.EphemerisCtx,
	gregorianYear int,
	region types.FestivalRegion,
	location types.GeoLocation,
	options ConvertOptions,
) (types.JSDate, bool, error) {
	gridOffset, err := utils.ResolveUtcOffset(options.Timezone, utils.UtcDateMs(gregorianYear, 3, 1))
	if err != nil {
		return 0, false, err
	}
	ayanamsa := convertResolvedAyanamsa(options)
	rashiAt := func(ms int64) (int, error) {
		lon, err := astronomy.GetSiderealSunLongitude(ctx, ms, ayanamsa)
		if err != nil {
			return 0, err
		}
		return int(math.Floor(lon/30)) % 12, nil
	}

	scanStart := utils.UtcDateMs(gregorianYear, 3, 1) - int64(gridOffset)*60_000 - dayMs
	scanEnd := utils.UtcDateMs(gregorianYear, 3, 20) - int64(gridOffset)*60_000
	transitMs, haveTransit := int64(0), false
	prevMs := scanStart
	prevRashi, err := rashiAt(prevMs)
	if err != nil {
		return 0, false, err
	}
	for t := scanStart + dayMs; t <= scanEnd; t += dayMs {
		rashi, err := rashiAt(t)
		if err != nil {
			return 0, false, err
		}
		if rashi != prevRashi && rashi == 0 {
			lo, hi := prevMs, t
			for hi-lo > 1000 {
				mid := (lo + hi) >> 1
				r, err := rashiAt(mid)
				if err != nil {
					return 0, false, err
				}
				if r == prevRashi {
					lo = mid
				} else {
					hi = mid
				}
			}
			transitMs, haveTransit = hi, true
			break
		}
		prevMs, prevRashi = t, rashi
	}
	if !haveTransit {
		return 0, false, nil
	}

	civilDay := func(ms int64, dayShift int) (types.JSDate, bool, error) {
		offset, err := utils.ResolveUtcOffset(options.Timezone, ms)
		if err != nil {
			return 0, false, err
		}
		local := types.Date(utils.UtcToLocalDisplay(ms, offset))
		value, err := utils.CivilDayValue(
			utils.UtcDateMs(local.UTCFullYear(), local.UTCMonth(), local.UTCDate()+dayShift), options.Timezone)
		if err != nil {
			return 0, false, err
		}
		return types.Date(value), true, nil
	}

	rule := meshaDayRuleFor(region)
	if rule == meshaCivilDay {
		return civilDay(transitMs, 0)
	}
	if rule == meshaCivilDayPlus1 {
		return civilDay(transitMs, 1)
	}

	day, err := meshaSunriseAnchor(ctx, transitMs, rule, location)
	if err != nil {
		if !isPolarRiseSetError(err) {
			return 0, false, err
		}
		return civilDay(transitMs, 0)
	}
	return civilDay(day, 0)
}

func meshaSunriseAnchor(
	ctx *astronomy.EphemerisCtx,
	transitMs int64,
	rule meshaDayRule,
	location types.GeoLocation,
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
	if rule == meshaNextSunrise {
		if dayStart >= transitMs {
			return dayStart, nil
		}
		sunset, err := astronomy.ComputeSunset(ctx, dayStart, location,
			astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		return astronomy.ComputeSunrise(ctx, sunset, location, astronomy.DefaultRiseSetLimitDays)
	}
	dayEnd, err := astronomy.ComputeSunset(ctx, dayStart, location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return 0, err
	}
	if rule == meshaNightCutoff {
		if transitMs <= dayEnd {
			return transitMs, nil
		}
		nextSunrise, err := astronomy.ComputeSunrise(ctx, dayEnd, location, astronomy.DefaultRiseSetLimitDays)
		if err != nil {
			return 0, err
		}
		if 1000*(transitMs-dayEnd) > panaNightCutoffPerMille*(nextSunrise-dayEnd) {
			return nextSunrise, nil
		}
		return transitMs, nil
	}
	if transitMs <= dayEnd {
		return dayStart, nil
	}
	return astronomy.ComputeSunrise(ctx, dayEnd, location, astronomy.DefaultRiseSetLimitDays)
}

func ComputeSamvat(ctx *astronomy.EphemerisCtx, dateMs int64) (types.SamvatInfo, error) {
	return core.ComputeSamvat(ctx, dateMs)
}
