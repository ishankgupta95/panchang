package astronomy

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

const maxCacheEntries = 20_000

var eventCache = store.New[string, []float64](maxCacheEntries, store.DefaultStripes, store.HashString)

type RiseSetKind struct {
	Body RiseSetBody
}

func canonicalDayEventsShared(
	ctx *EphemerisCtx, kind RiseSetKind, direction int,
	location types.GeoLocation, dayIndex int64,
) []float64 {
	key := string(kind.Body) + "|" + jsnum.FormatInt(int64(direction)) + "|" +
		jsnum.FormatFloat(location.Latitude) + "|" +
		jsnum.FormatFloat(location.Longitude) + "|" +
		jsnum.FormatFloat(location.Elevation) + "|" +
		jsnum.FormatInt(dayIndex)
	events, _ := eventCache.GetOrBuild(key, func() []float64 {
		return append([]float64(nil), dayEventsShared(ctx, kind.Body, direction, location, dayIndex)...)
	})
	return events
}

func clearRiseSetEventCache() {
	eventCache.Clear()
}

func CanonicalDayEvents(
	ctx *EphemerisCtx, kind RiseSetKind, direction int,
	location types.GeoLocation, dayIndex int64,
) []float64 {
	return append([]float64(nil), canonicalDayEventsShared(ctx, kind, direction, location, dayIndex)...)
}

func ResolveEvent(
	ctx *EphemerisCtx, kind RiseSetKind, direction int,
	searchFromMs int64, location types.GeoLocation, limitDays int,
) (int64, bool) {
	fromMs := float64(searchFromMs)
	limitMs := fromMs + float64(float64(limitDays)*dayMS)
	startDay := floorDivInt(searchFromMs, dayMS)

	for i := 0; i <= limitDays+1; i++ {
		for _, event := range canonicalDayEventsShared(ctx, kind, direction, location, startDay+int64(i)) {
			if event >= fromMs {
				if event <= limitMs {
					return int64(event), true
				}
				return 0, false
			}
		}
	}
	return 0, false
}
