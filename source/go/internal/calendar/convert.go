package calendar

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type HinduCalendarCoords struct {
	TithiName    string `json:"tithiName"`
	Tithi        int    `json:"tithi"`
	PakshaTithi  int    `json:"pakshaTithi"`
	Paksha       Paksha `json:"paksha"`
	MasaName     string `json:"masaName"`
	MasaIndex    int    `json:"masaIndex"`
	IsAdhika     bool   `json:"isAdhika"`
	VikramSamvat int    `json:"vikramSamvat"`
	ShakaSamvat  int    `json:"shakaSamvat"`
	VaraName     string `json:"varaName"`
	VaraIndex    int    `json:"varaIndex"`
}

type Paksha string

const (
	PakshaShukla  Paksha = "shukla"
	PakshaKrishna Paksha = "krishna"
)

var AllPakshas = []Paksha{PakshaShukla, PakshaKrishna}

type ConvertOptions struct {
	Timezone   types.Timezone
	Ayanamsa   types.AyanamsaType
	MasaSystem types.MasaSystem
	Language   types.Language
}

func (o ConvertOptions) panchangOptions() core.PanchangOptions {
	return core.PanchangOptions{
		InstantPanchangOptions: core.InstantPanchangOptions{
			Ayanamsa:   o.Ayanamsa,
			Language:   o.Language,
			MasaSystem: o.MasaSystem,
		},
		Timezone: o.Timezone,
	}
}

func (o ConvertOptions) resolvedAyanamsa() types.AyanamsaType {
	if o.Ayanamsa == "" {
		return types.Lahiri
	}
	return o.Ayanamsa
}

func (o ConvertOptions) resolvedMasaSystem() types.MasaSystem {
	if o.MasaSystem == "" {
		return types.Purnimanta
	}
	return o.MasaSystem
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
	panchang, ok, err := core.GetDailyPanchang(ctx, dateMs, location,
		options.panchangOptions(), core.NatalResolvers{})
	if err != nil {
		return HinduCalendarCoords{}, err
	}
	if !ok {
		return HinduCalendarCoords{}, types.NewPanchangError(
			"Cannot convert "+types.Date(dateMs).ISOString()+
				" to Hindu calendar: polar location with no sunrise",
			types.ErrNoSunrise)
	}
	tithiAtSunrise := panchang.Angas.Tithis[0]
	paksha := PakshaKrishna
	if tithiAtSunrise.Index < 15 {
		paksha = PakshaShukla
	}
	return HinduCalendarCoords{
		TithiName:    tithiAtSunrise.Name,
		Tithi:        tithiAtSunrise.Index + 1,
		PakshaTithi:  tithiAtSunrise.Number,
		Paksha:       paksha,
		MasaName:     panchang.Calendar.Chandramasa.Name,
		MasaIndex:    panchang.Calendar.Chandramasa.Index,
		IsAdhika:     panchang.Calendar.Chandramasa.IsAdhika,
		VikramSamvat: panchang.Calendar.Samvat.VikramSamvat,
		ShakaSamvat:  panchang.Calendar.Samvat.ShakaSamvat,
		VaraName:     panchang.Angas.Vara.Name,
		VaraIndex:    panchang.Angas.Vara.Index,
	}, nil
}

type HinduDateCoords struct {
	VikramSamvat int
	MasaIndex    int
	Paksha       Paksha
	PakshaTithi  int
	AdhikaOnly   bool
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
	masaSystem := options.resolvedMasaSystem()
	wrapsYearEnd := masaSystem == types.Purnimanta &&
		coords.MasaIndex == 0 && coords.Paksha == PakshaKrishna
	var masaMidMs int64
	if wrapsYearEnd {
		masaMidMs = types.DateUTC(ceYear+1, 2, 10).Ms()
	} else {
		masaMidMs = types.DateUTC(ceYear, 2, 25).Ms() + int64(coords.MasaIndex)*30*dayMs
	}
	startMs := masaMidMs - 50*dayMs
	endMs := masaMidMs + 60*dayMs
	targetTithi := coords.PakshaTithi - 1
	if coords.Paksha == PakshaKrishna {
		targetTithi += 15
	}

	opts := options.panchangOptions()
	out := []types.JSDate{}
	for t := startMs; t <= endMs; t += dayMs {
		p, ok, err := core.GetDailyPanchang(ctx, t, location, opts, core.NatalResolvers{})
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		tithi := p.Angas.Tithis[0].Index
		masa := p.Calendar.Chandramasa.Index
		if tithi != targetTithi {
			continue
		}
		if masa != coords.MasaIndex {
			continue
		}
		if p.Calendar.Samvat.VikramSamvat != coords.VikramSamvat {
			continue
		}
		if coords.AdhikaOnly && !p.Calendar.Chandramasa.IsAdhika {
			continue
		}
		out = append(out, p.Date)
	}
	return out, nil
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
		region == types.RegionAssam

	if useSolarAnchor {
		return findMeshaSankranti(ctx, gregorianYear, region, location, options)
	}

	return findChaitraShuklaPratipada(ctx, gregorianYear, location, options)
}

type chandraMasaState struct {
	masa   int
	adhika bool
	have   bool
}

func findChaitraShuklaPratipada(
	ctx *astronomy.EphemerisCtx,
	gregorianYear int,
	location types.GeoLocation,
	options ConvertOptions,
) (types.JSDate, bool, error) {
	amantaOptions := options.panchangOptions()
	amantaOptions.MasaSystem = types.Amanta
	startMs := types.DateUTC(gregorianYear, 1, 15).Ms()
	endMs := types.DateUTC(gregorianYear, 4, 15).Ms()
	var prev chandraMasaState
	for t := startMs; t <= endMs; t += dayMs {
		p, ok, err := core.GetDailyPanchang(ctx, t, location, amantaOptions, core.NatalResolvers{})
		if err != nil {
			return 0, false, err
		}
		if !ok {
			continue
		}
		masa := p.Calendar.Chandramasa.Index
		adhika := p.Calendar.Chandramasa.IsAdhika
		if masa == 0 && !adhika && prev.have && (prev.masa != 0 || prev.adhika) {
			return p.Date, true, nil
		}
		prev = chandraMasaState{masa: masa, adhika: adhika, have: true}
	}
	return 0, false, nil
}

type meshaDayRule string

const (
	meshaSankrantiDay  meshaDayRule = "sankranti-day"
	meshaCivilDay      meshaDayRule = "civil-day"
	meshaNextSunrise   meshaDayRule = "next-sunrise"
	meshaCivilDayPlus1 meshaDayRule = "civil-day-plus-1"
)

func meshaDayRuleFor(region types.FestivalRegion) meshaDayRule {
	switch region {
	case types.RegionPunjab:
		return meshaCivilDay
	case types.RegionKerala:
		return meshaNextSunrise
	case types.LegacyRegionBengal, types.RegionWestBengal:
		return meshaCivilDayPlus1
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
	offsetMinutes, err := utils.ResolveUtcOffset(options.Timezone,
		types.DateUTC(gregorianYear, 3, 1).Ms())
	if err != nil {
		return 0, false, err
	}
	ayanamsa := options.resolvedAyanamsa()
	rashiAt := func(ms int64) (int, error) {
		lon, err := astronomy.GetSiderealSunLongitude(ctx, ms, ayanamsa)
		if err != nil {
			return 0, err
		}
		return int(math.Floor(lon/30)) % 12, nil
	}

	scanStart := types.DateUTC(gregorianYear, 3, 1).Ms() - int64(offsetMinutes)*60_000 - dayMs
	scanEnd := types.DateUTC(gregorianYear, 3, 20).Ms() - int64(offsetMinutes)*60_000
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

	civilDay := func(ms int64, dayShift int) types.JSDate {
		local := types.Date(utils.UtcToLocalDisplay(ms, offsetMinutes))
		return types.DateUTC(local.UTCFullYear(), local.UTCMonth(), local.UTCDate()+dayShift)
	}

	rule := meshaDayRuleFor(region)
	if rule == meshaCivilDay {
		return civilDay(transitMs, 0), true, nil
	}
	if rule == meshaCivilDayPlus1 {
		return civilDay(transitMs, 1), true, nil
	}

	day, err := meshaSunriseAnchor(ctx, transitMs, rule, location)
	if err != nil {
		if !isPolarRiseSetError(err) {
			return 0, false, err
		}
		return civilDay(transitMs, 0), true, nil
	}
	return civilDay(day, 0), true, nil
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
	if transitMs <= dayEnd {
		return dayStart, nil
	}
	return astronomy.ComputeSunrise(ctx, dayEnd, location, astronomy.DefaultRiseSetLimitDays)
}

func ComputeSamvat(ctx *astronomy.EphemerisCtx, dateMs int64) (types.SamvatInfo, error) {
	return core.ComputeSamvat(ctx, dateMs)
}
