package astronomy

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var lunar = RiseSetKind{Body: RiseSetMoon}

func GetMoonrise(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, bool, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, false, err
	}
	ms, ok := ResolveEvent(ctx, lunar, +1, searchFromMs, location, limitDays)
	return ms, ok, nil
}

func GetMoonset(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, bool, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, false, err
	}
	ms, ok := ResolveEvent(ctx, lunar, -1, searchFromMs, location, limitDays)
	return ms, ok, nil
}
