package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/store"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const maxCacheEntries = 20_000

var eventCache = store.New[riseSetKey, []float64](maxCacheEntries, store.DefaultStripes, hashRiseSetKey)

// riseSetKey holds the parts of the TypeScript's rise/set cache keys,
// body|direction|lat|lon|elev|dayIndex for events and body|lat|lon|elev|dayIndex
// for scans (direction 0), without formatting five numbers per lookup. Two keys
// are equal exactly when the TypeScript strings are: jsnum.FormatFloat spells
// -0 as 0 and every NaN alike and is otherwise one to one, and jsnum.FormatInt
// spells two integers alike only when they are the same double.
type riseSetKey struct {
	body           RiseSetBody
	direction      int
	lat, lon, elev uint64
	day            uint64
}

func numberKey(v float64) uint64 {
	switch {
	case v == 0:
		return 0
	case v != v:
		return math.Float64bits(math.NaN())
	}
	return math.Float64bits(v)
}

func newRiseSetKey(body RiseSetBody, direction int, location types.GeoLocation, dayIndex int64) riseSetKey {
	return riseSetKey{
		body:      body,
		direction: direction,
		lat:       numberKey(location.Latitude),
		lon:       numberKey(location.Longitude),
		elev:      numberKey(location.Elevation),
		day:       numberKey(float64(dayIndex)),
	}
}

func hashRiseSetKey(k riseSetKey) uint64 {
	h := store.HashString(string(k.body)) ^ uint64(k.direction)
	for _, v := range [...]uint64{k.lat, k.lon, k.elev, k.day} {
		h = store.HashMix(h, v)
	}
	return h
}

type RiseSetKind struct {
	Body RiseSetBody
}

func canonicalDayEventsShared(
	ctx *EphemerisCtx, kind RiseSetKind, direction int,
	location types.GeoLocation, dayIndex int64,
) []float64 {
	key := newRiseSetKey(kind.Body, direction, location, dayIndex)
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

// maxSolvableMs is 2^52: past it a float64 cannot split a millisecond, so the
// root refinement could never reach its tolerance.
const maxSolvableMs = 1 << 52

// ResolveEvent reports [types.ErrInvalidDate] before scanning a day that
// reaches 2^52 ms from 1970, where the solver would never return.
func ResolveEvent(
	ctx *EphemerisCtx, kind RiseSetKind, direction int,
	searchFromMs int64, location types.GeoLocation, limitDays int,
) (int64, bool, error) {
	fromMs := float64(searchFromMs)
	limitMs := fromMs + float64(float64(limitDays)*dayMS)
	startDay := floorDivInt(searchFromMs, dayMS)

	for i := 0; i <= limitDays+1; i++ {
		day := float64(startDay + int64(i))
		if day*dayMS < -maxSolvableMs || (day+1)*dayMS > maxSolvableMs {
			return 0, false, types.Codef(types.ErrInvalidDate,
				"Date must be within 2^52 ms of 1970 for the rise and set solver, got %s",
				types.JSDate(searchFromMs).ISOString())
		}
		for _, event := range canonicalDayEventsShared(ctx, kind, direction, location, startDay+int64(i)) {
			if event >= fromMs {
				if event <= limitMs {
					return int64(event), true, nil
				}
				return 0, false, nil
			}
		}
	}
	return 0, false, nil
}
