package astronomy

import (
	"time"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var solar = RiseSetKind{Body: RiseSetSun}

const DefaultRiseSetLimitDays = 2

func ComputeSunrise(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, err
	}
	result, ok, err := ResolveEvent(ctx, solar, +1, searchFromMs, location, limitDays)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, types.Codef(types.ErrNoSunrise,
			"No sunrise found within %d days for (%s°, %s°) near %s. "+
				"This location may be experiencing midnight sun or polar night.",
			limitDays, jsnum.FormatFloat(location.Latitude), jsnum.FormatFloat(location.Longitude),
			types.JSDate(searchFromMs).ISOString())
	}
	return result, nil
}

func ComputeSunset(ctx *EphemerisCtx, searchFromMs int64, location types.GeoLocation, limitDays int) (int64, error) {
	if err := utils.ValidateLocation(location); err != nil {
		return 0, err
	}
	result, ok, err := ResolveEvent(ctx, solar, -1, searchFromMs, location, limitDays)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, types.Codef(types.ErrNoSunset,
			"No sunset found within %d days for (%s°, %s°) near %s.",
			limitDays, jsnum.FormatFloat(location.Latitude), jsnum.FormatFloat(location.Longitude),
			types.JSDate(searchFromMs).ISOString())
	}
	return result, nil
}

func isoString(ms int64) string {
	return time.UnixMilli(ms).UTC().Format("2006-01-02T15:04:05.000Z")
}
