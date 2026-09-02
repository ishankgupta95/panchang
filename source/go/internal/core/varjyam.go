package core

import (
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

const maxVarjyamNakshatras = 3

const (
	nakshatraLookbackHours    = 30
	nakshatraLookforwardHours = 30
)

const (
	varjyamBracketMs      = 120_000
	varjyamMaxBracketIter = 30
)

type SpellsOf func(nakshatraIndex int, nakshatraStartMs, nakshatraEndMs int64) []types.UtcWindow

func ComputeVarjyamWindows(
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon LongitudeAt,
) []types.UtcWindow {
	return CollectNakshatraOffsetWindows(sunriseUtcMs, nextSunriseUtcMs, getMoon, varjyamSpellsFromBoundaries)
}

func ComputeVarjyam(
	currentNakshatraIndex int,
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon LongitudeAt,
) (types.UtcWindow, bool, error) {
	if err := utils.AssertNakshatraIndex(currentNakshatraIndex, "currentNakshatraIndex"); err != nil {
		return types.UtcWindow{}, false, err
	}
	for _, w := range varjyamSpellsForNakshatra(currentNakshatraIndex, sunriseUtcMs, getMoon) {
		if w.EndMs > sunriseUtcMs && w.StartMs < nextSunriseUtcMs {
			return w, true, nil
		}
	}
	return types.UtcWindow{}, false, nil
}

func varjyamSpellsForNakshatra(nakshatraIndex int, referenceMs int64, getMoon LongitudeAt) []types.UtcWindow {
	getIndex := func(ms int64) int { return GetNakshatraIndexAtTime(ms, getMoon) }
	angle := utils.ElementAngle{AngleAt: getMoon, SpanDeg: utils.NakshatraSpan}

	startMs, ok := findNakshatraStart(referenceMs, nakshatraIndex, getIndex, angle)
	if !ok {
		return nil
	}
	endMs, ok := findNakshatraEnd(referenceMs, nakshatraIndex, getIndex, angle)
	if !ok {
		return nil
	}
	return varjyamSpellsFromBoundaries(nakshatraIndex, startMs, endMs)
}

func CollectNakshatraOffsetWindows(
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon LongitudeAt,
	spellsOf SpellsOf,
) []types.UtcWindow {
	getIndex := func(ms int64) int { return GetNakshatraIndexAtTime(ms, getMoon) }
	angle := utils.ElementAngle{AngleAt: getMoon, SpanDeg: utils.NakshatraSpan}

	out := make([]types.UtcWindow, 0, 2)
	referenceMs := sunriseUtcMs
	var knownStartMs int64
	haveKnownStart := false
	for i := 0; i < maxVarjyamNakshatras; i++ {
		nakIdx := getIndex(referenceMs)
		startMs, startOK := knownStartMs, haveKnownStart
		if !startOK {
			startMs, startOK = findNakshatraStart(referenceMs, nakIdx, getIndex, angle)
		}
		endMs, endOK := findNakshatraEnd(referenceMs, nakIdx, getIndex, angle)
		if !startOK || !endOK {
			break
		}

		for _, w := range spellsOf(nakIdx, startMs, endMs) {
			if w.StartMs >= sunriseUtcMs && w.StartMs < nextSunriseUtcMs {
				out = append(out, w)
			}
		}

		nextRef := endMs + 60_000
		if nextRef >= nextSunriseUtcMs {
			break
		}
		referenceMs = nextRef
		knownStartMs, haveKnownStart = endMs, true
	}
	sort.SliceStable(out, func(a, b int) bool { return out[a].StartMs < out[b].StartMs })
	return out
}

func varjyamSpellsFromBoundaries(nakshatraIndex int, nakshatraStartMs, nakshatraEndMs int64) []types.UtcWindow {
	nakshatraDurationMs := float64(nakshatraEndMs - nakshatraStartMs)
	ghatikaMs := nakshatraDurationMs / 60

	offsets := []int{utils.VarjyamOffsetGhatikas[nakshatraIndex]}
	if second, ok := utils.VarjyamSecondOffsetGhatikas[nakshatraIndex]; ok {
		offsets = append(offsets, second)
	}
	sort.Ints(offsets)

	out := make([]types.UtcWindow, 0, len(offsets))
	for _, offsetGhatikas := range offsets {
		startMs := int64(float64(nakshatraStartMs) + float64(float64(offsetGhatikas)*ghatikaMs))
		out = append(out, types.UtcWindow{
			StartMs: startMs,
			EndMs:   int64(float64(startMs) + float64(4*ghatikaMs)),
		})
	}
	return out
}

func findNakshatraStart(
	sunriseUtcMs int64,
	currentIndex int,
	getIndexAt func(ms int64) int,
	angle utils.ElementAngle,
) (int64, bool) {
	const lookbackMs = nakshatraLookbackHours * 3600_000
	lo := sunriseUtcMs - lookbackMs
	hi := sunriseUtcMs

	if getIndexAt(lo) == currentIndex {
		return 0, false
	}

	for i := 0; i < varjyamMaxBracketIter && hi-lo > varjyamBracketMs; i++ {
		mid := floorDiv2(lo + hi)
		if getIndexAt(mid) == currentIndex {
			hi = mid
		} else {
			lo = mid
		}
	}
	if solved, ok := utils.SolveElementBoundary(float64(lo), float64(hi), angle,
		func(ms int64) bool { return getIndexAt(ms) != currentIndex }); ok {
		return solved, true
	}
	return hi, true
}

func findNakshatraEnd(
	sunriseUtcMs int64,
	currentIndex int,
	getIndexAt func(ms int64) int,
	angle utils.ElementAngle,
) (int64, bool) {
	const lookforwardMs = nakshatraLookforwardHours * 3600_000
	lo := sunriseUtcMs
	hi := sunriseUtcMs + lookforwardMs

	if getIndexAt(hi) == currentIndex {
		return 0, false
	}

	for i := 0; i < varjyamMaxBracketIter && hi-lo > varjyamBracketMs; i++ {
		mid := floorDiv2(lo + hi)
		if getIndexAt(mid) == currentIndex {
			lo = mid
		} else {
			hi = mid
		}
	}
	if solved, ok := utils.SolveElementBoundary(float64(lo), float64(hi), angle,
		func(ms int64) bool { return getIndexAt(ms) == currentIndex }); ok {
		return solved, true
	}
	return hi, true
}
