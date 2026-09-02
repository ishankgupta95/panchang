package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

func ComputePanchakaRahita(
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon LongitudeAt,
) []types.UtcWindow {
	inPanchakaAt := func(ms int64) bool { return getMoon(ms) >= 300 }

	startInP := inPanchakaAt(sunriseUtcMs)
	endInP := inPanchakaAt(nextSunriseUtcMs)

	if startInP == endInP {
		if startInP {
			return []types.UtcWindow{}
		}
		return []types.UtcWindow{{StartMs: sunriseUtcMs, EndMs: nextSunriseUtcMs}}
	}

	targetDeg := 300.0
	if startInP {
		targetDeg = 0
	}
	crossing := bisectPanchakaBoundary(sunriseUtcMs, nextSunriseUtcMs, inPanchakaAt, targetDeg, getMoon)
	if startInP {
		return []types.UtcWindow{{StartMs: crossing, EndMs: nextSunriseUtcMs}}
	}
	return []types.UtcWindow{{StartMs: sunriseUtcMs, EndMs: crossing}}
}

func bisectPanchakaBoundary(
	loUtcMs, hiUtcMs int64,
	predicate func(ms int64) bool,
	targetDeg float64,
	getMoon LongitudeAt,
) int64 {
	const bracketMs = 120_000
	const maxIters = 30
	startState := predicate(loUtcMs)
	lo, hi := loUtcMs, hiUtcMs

	for i := 0; i < maxIters && hi-lo > bracketMs; i++ {
		mid := floorDiv2(lo + hi)
		if predicate(mid) == startState {
			lo = mid
		} else {
			hi = mid
		}
	}
	if solved, ok := utils.SolveAngleCrossing(float64(lo), float64(hi), targetDeg, getMoon,
		func(ms int64) bool { return predicate(ms) == startState }); ok {
		return solved
	}
	return hi
}

func floorDiv2(n int64) int64 {
	q := n / 2
	if n%2 != 0 && n < 0 {
		q--
	}
	return q
}
