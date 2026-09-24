package astronomy

import (
	"context"
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var quarterToPhase = [4]MoonPhaseName{
	MoonPhaseNew, MoonPhaseFirstQuarter, MoonPhaseFull, MoonPhaseLastQuarter,
}

func ComputeMoonPhasesInRange(ctx context.Context, eph *EphemerisCtx, startMs, endMs int64) ([]MoonPhaseEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
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

	mq, err := SearchMoonQuarter(eph, startMs-31*24*3600_000)
	if err != nil {
		return nil, err
	}
	maxSteps := int(math.Ceil(float64(endMs-startMs)/(24*3600_000)/6)) + 60
	for step := 0; step < maxSteps; step++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		ms := mq.TimeMs
		if ms > endMs {
			break
		}
		if ms >= startMs {
			out = append(out, MoonPhaseEvent{Phase: quarterToPhase[mq.Quarter], TimeMs: types.Date(ms)})
		}
		mq, err = NextMoonQuarter(eph, mq)
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

func ComputeMoonPhasesForYear(ctx context.Context, eph *EphemerisCtx, year int, options MoonPhasesForYearOptions) ([]MoonPhaseEvent, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	startUtc, endUtc, err := utils.LocalYearWindow(year, options.Timezone)
	if err != nil {
		return nil, err
	}
	if err := utils.ValidateLocalYearWindow(year, startUtc, endUtc); err != nil {
		return nil, err
	}
	return ComputeMoonPhasesInRange(ctx, eph, utils.ClampToSupported(startUtc), utils.ClampToSupported(endUtc))
}

func GetMoonPhasesInRange(ctx context.Context, eph *EphemerisCtx, startMs, endMs int64) ([]MoonPhaseEvent, error) {
	return ComputeMoonPhasesInRange(ctx, eph, startMs, endMs)
}
