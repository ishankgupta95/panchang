package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type durMuhurtaOrdinal struct {
	ordinal int
	segment types.DayNightSegment
}

var durMuhurtaOrdinals = [7][]durMuhurtaOrdinal{
	{{13, types.SegmentDay}},                         // Sunday
	{{8, types.SegmentDay}, {11, types.SegmentDay}},  // Monday
	{{3, types.SegmentDay}, {6, types.SegmentNight}}, // Tuesday
	{{7, types.SegmentDay}},                          // Wednesday
	{{5, types.SegmentDay}, {11, types.SegmentDay}},  // Thursday
	{{3, types.SegmentDay}, {8, types.SegmentDay}},   // Friday
	{{0, types.SegmentDay}, {1, types.SegmentDay}},   // Saturday
}

func ComputeDurMuhurta(
	sunriseMs, sunsetMs, nextSunriseMs int64,
	varaIndex int,
) []types.UnlocalizedDurMuhurtaPeriod {
	dayMuhurtaMs := float64(sunsetMs-sunriseMs) / 15
	nightMuhurtaMs := float64(nextSunriseMs-sunsetMs) / 15

	rows := durMuhurtaOrdinals[varaIndex]
	out := make([]types.UnlocalizedDurMuhurtaPeriod, 0, len(rows))
	for _, r := range rows {
		baseMs, muhurtaMs := float64(sunriseMs), dayMuhurtaMs
		if r.segment == types.SegmentNight {
			baseMs, muhurtaMs = float64(sunsetMs), nightMuhurtaMs
		}
		out = append(out, types.UnlocalizedDurMuhurtaPeriod{
			StartMs: int64(baseMs + float64(float64(r.ordinal)*muhurtaMs)),
			EndMs:   int64(baseMs + float64(float64(r.ordinal+1)*muhurtaMs)),
			Segment: r.segment,
		})
	}
	return out
}
