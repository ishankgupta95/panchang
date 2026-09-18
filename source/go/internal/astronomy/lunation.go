package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const elongationRateDegPerDay = 360 / SynodicMonthDays

const phaseToleranceMS = 1

const PhaseAgreementMS = 2 * phaseToleranceMS

func MoonSunElongation(ctx *EphemerisCtx, ms int64) float64 {
	d := GetTropicalMoonLongitude(ctx, ms) - GetTropicalSunLongitude(ctx, ms)
	return jsnum.Mod(jsnum.Mod(d, 360)+360, 360)
}

func signedDelta(a, b float64) float64 {
	d := jsnum.Mod(a-b, 360)
	if d > 180 {
		d -= 360
	}
	if d <= -180 {
		d += 360
	}
	return d
}

func SearchMoonPhase(ctx *EphemerisCtx, targetDegrees float64, startMs int64, limitDays float64) (int64, bool) {
	startF := float64(startMs)
	limitMs := startF + float64(limitDays*dayMS)

	deficit := signedDelta(targetDegrees, MoonSunElongation(ctx, startMs))
	if deficit < 0 {
		deficit += 360
	}
	t := startF + float64((deficit/elongationRateDegPerDay)*dayMS)

	previousT := t - 0.25*dayMS
	previousF := signedDelta(MoonSunElongation(ctx, int64(previousT)), targetDegrees)

	for i := 0; i < 40; i++ {
		f := signedDelta(MoonSunElongation(ctx, int64(t)), targetDegrees)
		if math.Abs(f) < 1e-9 {
			break
		}
		slope := (f - previousF) / (t - previousT)
		var step float64
		if slope == 0 || math.IsNaN(slope) || math.IsInf(slope, 0) {
			step = -f / (elongationRateDegPerDay / dayMS)
		} else {
			step = -f / slope
		}
		capped := math.Max(-2*dayMS, math.Min(2*dayMS, step))
		previousT = t
		previousF = f
		t += capped
		if math.Abs(capped) < phaseToleranceMS {
			break
		}
	}

	if t < startF-phaseToleranceMS || t > limitMs {
		return 0, false
	}
	return int64(math.Max(startF, jsnum.Round(t))), true
}

type QuarterIndex int

const (
	QuarterNew QuarterIndex = iota
	QuarterFirst
	QuarterFull
	QuarterLast
)

type MoonQuarter struct {
	Quarter QuarterIndex
	TimeMs  int64
}

func SearchMoonQuarter(ctx *EphemerisCtx, startMs int64) (MoonQuarter, error) {
	elongation := MoonSunElongation(ctx, startMs)
	q := int(math.Floor(elongation/90)) + 1
	quarter := QuarterIndex(((q % 4) + 4) % 4)
	timeMs, ok := SearchMoonPhase(ctx, float64(quarter)*90, startMs, 12)
	if !ok {
		return MoonQuarter{}, types.Codef(types.ErrSearchDiverged,
			"no lunar quarter found within 12 days of %s", isoString(startMs))
	}
	return MoonQuarter{Quarter: quarter, TimeMs: timeMs}, nil
}

func NextMoonQuarter(ctx *EphemerisCtx, previous MoonQuarter) (MoonQuarter, error) {
	return SearchMoonQuarter(ctx, previous.TimeMs+6*dayMS)
}
