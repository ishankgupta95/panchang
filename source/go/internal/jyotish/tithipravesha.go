package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type TithiPraveshaChart struct {
	PraveshInstant types.JSDate            `json:"praveshInstant"`
	NatalTithi     int                     `json:"natalTithi"`
	PraveshTithi   int                     `json:"praveshTithi"`
	VarshaLagna    types.LagnaInfo         `json:"varshaLagna"`
	Planets        []types.PlanetPlacement `json:"planets"`
	Bhava          types.BhavaChart        `json:"bhava"`
}

const tithiPraveshaSiderealYearDays float64 = 365.25636 // a separate, unused copy of siderealYearDays

const moonSunDiffDegPerDay = 360 / tithiPraveshaSynodicDays

const tithiPraveshaSynodicDays float64 = 29.5306

const synodicMonthDays float64 = 29.530589 // deliberately not tithiPraveshaSynodicDays: a Newton slope, not a bracket

const synodicMonthMs = synodicMonthDays * 86400_000

func ComputeTithiPravesha(
	ctx *astronomy.EphemerisCtx,
	natalBirthMs int64,
	yearAge int,
	location types.GeoLocation,
	options BirthChartOptions,
) (TithiPraveshaChart, error) {
	if err := utils.ValidateDate(natalBirthMs); err != nil {
		return TithiPraveshaChart{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return TithiPraveshaChart{}, err
	}
	if yearAge < 1 {
		return TithiPraveshaChart{}, types.Codef(types.ErrInvalidInput,
			"Tithi-Pravesha yearAge must be a positive integer (1 = first cycle); got %d",
			yearAge)
	}

	ayanamsaType := resolveAyanamsa(options.Ayanamsa)

	natalSun, err := astronomy.GetSiderealSunLongitude(ctx, natalBirthMs, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}
	natalMoon, err := astronomy.GetSiderealMoonLongitude(ctx, natalBirthMs, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}
	targetDelta := utils.Normalize360(natalMoon - natalSun)
	natalTithi := computeNatalTithiIndex(natalSun, natalMoon)
	natalSunRashi := int(math.Floor(natalSun / 30))

	solarReturn, err := FindSolarReturn(ctx, natalBirthMs, yearAge, natalSun, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}

	praveshMs, err := findTithiPraveshaInNatalSign(ctx, solarReturn, targetDelta, natalSunRashi, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}

	chart, err := ComputeRashiChart(ctx, praveshMs, location, options)
	if err != nil {
		return TithiPraveshaChart{}, err
	}

	praveshSun, err := astronomy.GetSiderealSunLongitude(ctx, praveshMs, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}
	praveshMoon, err := astronomy.GetSiderealMoonLongitude(ctx, praveshMs, ayanamsaType)
	if err != nil {
		return TithiPraveshaChart{}, err
	}
	praveshTithi := computeNatalTithiIndex(praveshSun, praveshMoon)

	return TithiPraveshaChart{
		PraveshInstant: types.Date(praveshMs),
		NatalTithi:     natalTithi,
		PraveshTithi:   praveshTithi,
		VarshaLagna:    chart.Lagna,
		Planets:        chart.Planets,
		Bhava:          chart.Bhava,
	}, nil
}

func computeNatalTithiIndex(sunLon, moonLon float64) int {
	diff := utils.Normalize360(moonLon - sunLon)
	return min(29, int(math.Floor(diff/12)))
}

func findTithiPraveshaInNatalSign(
	ctx *astronomy.EphemerisCtx,
	solarReturnMs int64,
	targetDelta float64,
	natalSunRashi int,
	ayanamsaType types.AyanamsaType,
) (int64, error) {
	t1, err := findTithiPravesha(ctx, solarReturnMs, targetDelta, ayanamsaType)
	if err != nil {
		return 0, err
	}
	sunAtT1, err := astronomy.GetSiderealSunLongitude(ctx, t1, ayanamsaType)
	if err != nil {
		return 0, err
	}
	if int(math.Floor(sunAtT1/30)) == natalSunRashi {
		return t1, nil
	}

	dir := -1.0
	if t1 < solarReturnMs {
		dir = +1
	}
	t2Approx := int64(float64(t1) + float64(dir*synodicMonthMs)) // FMA barrier
	t2, err := findTithiPravesha(ctx, t2Approx, targetDelta, ayanamsaType)
	if err != nil {
		return 0, err
	}
	sunAtT2, err := astronomy.GetSiderealSunLongitude(ctx, t2, ayanamsaType)
	if err != nil {
		return 0, err
	}
	if int(math.Floor(sunAtT2/30)) == natalSunRashi {
		return t2, nil
	}

	dT1 := abs64ms(t1 - solarReturnMs)
	dT2 := abs64ms(t2 - solarReturnMs)
	if dT1 <= dT2 {
		return t1, nil
	}
	return t2, nil
}

func abs64ms(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

func findTithiPravesha(
	ctx *astronomy.EphemerisCtx,
	centerMs int64,
	targetDelta float64,
	ayanamsaType types.AyanamsaType,
) (int64, error) {
	t := float64(centerMs)
	const tolDeg = 0.0001

	for iter := 0; iter < 25; iter++ {
		t0 := int64(t)
		moon, err := astronomy.GetSiderealMoonLongitude(ctx, t0, ayanamsaType)
		if err != nil {
			return 0, err
		}
		sun, err := astronomy.GetSiderealSunLongitude(ctx, t0, ayanamsaType)
		if err != nil {
			return 0, err
		}
		d := utils.Normalize360(moon - sun)
		phaseDelta := targetDelta - d
		phaseDelta = jsnum.Mod(phaseDelta+540, 360) - 180

		if math.Abs(phaseDelta) < tolDeg {
			break
		}
		t += float64((phaseDelta / moonSunDiffDegPerDay) * 86400_000)
	}

	return int64(jsnum.Round(t)), nil // half-up, not math.Round
}

func ComputeNatalTithiIndexForTest(sunLon, moonLon float64) int {
	return computeNatalTithiIndex(sunLon, moonLon)
}

func FindTithiPraveshaForTest(
	ctx *astronomy.EphemerisCtx, centerMs int64, targetDelta float64, ayanamsaType types.AyanamsaType,
) (int64, error) {
	return findTithiPravesha(ctx, centerMs, targetDelta, ayanamsaType)
}
