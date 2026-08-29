package astronomy

import (
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

var solar = RiseSetKind{Body: RiseSetSun}

// 2 covers polar cases where the next sunrise is more than a day off.
const DefaultRiseSetLimitDays = 2

func ComputeSunrise(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, err
	}
	result, ok := ResolveEvent(ctx, solar, +1, searchFromMs, location, limitDays)
	if !ok {
		return 0, types.Codef(types.ErrNoSunrise,
			"No sunrise found within %d days for (%v°, %v°) near %s. "+
				"This location may be experiencing midnight sun or polar night.",
			limitDays, location.Latitude, location.Longitude, isoString(searchFromMs))
	}
	return result, nil
}

func ComputeSunset(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, err
	}
	result, ok := ResolveEvent(ctx, solar, -1, searchFromMs, location, limitDays)
	if !ok {
		return 0, types.Codef(types.ErrNoSunset,
			"No sunset found within %d days for (%v°, %v°) near %s.",
			limitDays, location.Latitude, location.Longitude, isoString(searchFromMs))
	}
	return result, nil
}

func isoString(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02T15:04:05.000Z")
}
