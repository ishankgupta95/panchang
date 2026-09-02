package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type MoonPhaseName string

const (
	MoonPhaseNew          MoonPhaseName = "new"
	MoonPhaseFirstQuarter MoonPhaseName = "first_quarter"
	MoonPhaseFull         MoonPhaseName = "full"
	MoonPhaseLastQuarter  MoonPhaseName = "last_quarter"
)

type MoonPhaseEvent struct {
	Phase  MoonPhaseName `json:"phase"`
	TimeMs types.JSDate  `json:"time"`
}

var quarterToPhase = [4]MoonPhaseName{
	MoonPhaseNew, MoonPhaseFirstQuarter, MoonPhaseFull, MoonPhaseLastQuarter,
}

func ComputeMoonPhasesInRange(ctx *EphemerisCtx, startMs, endMs int64) ([]MoonPhaseEvent, error) {
	if err := utils.ValidateDate(startMs); err != nil {
		return nil, err
	}
	if err := utils.ValidateDate(endMs); err != nil {
		return nil, err
	}
	if startMs > endMs {
		return nil, types.Codef(types.ErrInvalidInput,
			"start (%s) must be <= end (%s)", isoString(startMs), isoString(endMs))
	}

	out := []MoonPhaseEvent{}

	mq, err := SearchMoonQuarter(ctx, startMs-31*24*3600_000)
	if err != nil {
		return nil, err
	}
	maxSteps := int(math.Ceil(float64(endMs-startMs)/(24*3600_000)/6)) + 60
	for step := 0; step < maxSteps; step++ {
		ms := mq.TimeMs
		if ms > endMs {
			break
		}
		if ms >= startMs {
			out = append(out, MoonPhaseEvent{Phase: quarterToPhase[mq.Quarter], TimeMs: types.Date(ms)})
		}
		mq, err = NextMoonQuarter(ctx, mq)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

type MoonPhasesForYearOptions struct {
	Timezone types.Timezone `json:"timezone"`
}

func ComputeMoonPhasesForYear(ctx *EphemerisCtx, year int, options MoonPhasesForYearOptions) ([]MoonPhaseEvent, error) {
	offset, err := utils.ResolveUtcOffset(options.Timezone, utcMS(year, 6, 1))
	if err != nil {
		return nil, err
	}
	startUtc := utcMS(year, 0, 1) - int64(offset)*60_000
	endUtc := utcMS(year, 11, 31) + 23*3600_000 + 59*60_000 + 59*1000 + 999 - int64(offset)*60_000
	return ComputeMoonPhasesInRange(ctx, startUtc, endUtc)
}

func GetMoonPhasesInRange(ctx *EphemerisCtx, startMs, endMs int64) ([]MoonPhaseEvent, error) {
	return ComputeMoonPhasesInRange(ctx, startMs, endMs)
}
