package utils

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type SearchPrecision struct {
	ToleranceMs   float64
	MaxIterations int
}

var StandardPrecision = SearchPrecision{ToleranceMs: 30_000, MaxIterations: 15}

// Moon - Sun for tithi and karana, Moon for nakshatra, Moon + Sun for yoga.
type ElementAngle struct {
	AngleAt func(ms int64) float64
	SpanDeg float64
}

func wrapSignedDeg(x float64) float64 {
	m := jsnum.Mod(jsnum.Mod(x, 360)+360, 360)
	if m > 180 {
		return m - 360
	}
	return m
}

// The trailing forward walk keeps the root never-early, which [FindDailyElements] needs.
func secantBoundary(
	loMs, hiMs float64, targetDeg float64, angle ElementAngle, stillBefore func(ms int64) bool,
) (int64, bool) {
	f := func(t float64) float64 {
		// Truncation toward zero, not rounding.
		return wrapSignedDeg(angle.AngleAt(int64(t)) - targetDeg)
	}
	t0, t1 := loMs, hiMs
	f0, f1 := f(t0), f(t1)
	if !(f0 < 0 && f1 >= 0) {
		return 0, false
	}

	for k := 0; k < 8; k++ {
		if f1 == f0 {
			break
		}
		// jsnum.Round, not math.Round: a negative tie breaks toward +Inf in JS.
		next := jsnum.Round(t1 - (f1*(t1-t0))/(f1-f0))
		if math.IsNaN(next) || math.IsInf(next, 0) || next < loMs || next > hiMs {
			return 0, false
		}
		converged := math.Abs(next-t1) <= 1
		t0, f0 = t1, f1
		t1 = next
		f1 = f(t1)
		if converged {
			break
		}
	}

	const stepMs = 25
	t := t1
	for k := 0; k < 8; k++ {
		if !stillBefore(int64(t)) {
			return int64(t), true
		}
		t += stepMs
	}
	return 0, false
}

func SolveElementBoundary(
	loMs, hiMs float64, angle ElementAngle, stillBefore func(ms int64) bool,
) (int64, bool) {
	indexAt := func(ms float64) int {
		return int(math.Floor(jsnum.Mod(jsnum.Mod(angle.AngleAt(int64(ms)), 360)+360, 360) / angle.SpanDeg))
	}
	target := jsnum.Mod(jsnum.Mod(float64(indexAt(loMs)+1)*angle.SpanDeg, 360)+360, 360)
	return secantBoundary(loMs, hiMs, target, angle, stillBefore)
}

func SolveAngleCrossing(
	loMs, hiMs float64, targetDeg float64, angleAt func(ms int64) float64, stillBefore func(ms int64) bool,
) (int64, bool) {
	return secantBoundary(loMs, hiMs, targetDeg,
		ElementAngle{AngleAt: angleAt, SpanDeg: 360}, stillBefore)
}

func FindTransitionTime(
	startMs, maxEndMs int64,
	currentIndex int,
	getIndexAtTime func(ms int64) int,
	maxIterations int,
	toleranceMs float64,
	angle *ElementAngle,
) (int64, error) {
	lo := float64(startMs)
	hi := float64(maxEndMs)

	if getIndexAtTime(int64(hi)) == currentIndex {
		found := false
		for _, ext := range []int64{6, 12, 18, 24} {
			hi = float64(maxEndMs + ext*3600_000)
			if getIndexAtTime(int64(hi)) != currentIndex {
				found = true
				break
			}
		}
		if !found {
			return 0, types.Codef(types.ErrSearchDiverged,
				"Binary search could not find transition for element index %d within 48h+ of %s",
				currentIndex, isoString(startMs))
		}
	}

	if angle != nil {
		target := jsnum.Mod(jsnum.Mod(float64(currentIndex+1)*angle.SpanDeg, 360)+360, 360)
		if solved, ok := secantBoundary(lo, hi, target, *angle,
			func(ms int64) bool { return getIndexAtTime(ms) == currentIndex }); ok {
			return solved, nil
		}
	}

	// Bisect in floats: rounding the midpoint moves the result by up to a ms.
	iterations := 0
	for hi-lo > toleranceMs && iterations < maxIterations {
		mid := lo + (hi-lo)/2
		if getIndexAtTime(int64(mid)) == currentIndex {
			lo = mid
		} else {
			hi = mid
		}
		iterations++
	}

	return int64(hi), nil
}

// `!= currentIndex`, not "the previous element": only `!=` stays monotone across a window holding several elements.
func FindStartTime(
	fromMs int64,
	currentIndex int,
	getIndexAtTime func(ms int64) int,
	maxSearchBackHours float64,
	maxIterations int,
	toleranceMs float64,
	angle *ElementAngle,
) int64 {
	searchStart := int64(float64(fromMs) - maxSearchBackHours*3600_000)

	if getIndexAtTime(searchStart) == currentIndex {
		return searchStart
	}

	lo := float64(searchStart)
	hi := float64(fromMs)

	if angle != nil {
		target := jsnum.Mod(jsnum.Mod(float64(currentIndex)*angle.SpanDeg, 360)+360, 360)
		if solved, ok := secantBoundary(lo, hi, target, *angle,
			func(ms int64) bool { return getIndexAtTime(ms) != currentIndex }); ok {
			return solved
		}
	}

	iterations := 0
	for hi-lo > toleranceMs && iterations < maxIterations {
		mid := lo + (hi-lo)/2
		if getIndexAtTime(int64(mid)) != currentIndex {
			lo = mid
		} else {
			hi = mid
		}
		iterations++
	}

	return int64(hi)
}

func FindDailyElements[T any, D any](
	sunriseMs, nextSunriseMs int64,
	elementAtSunrise T,
	indexOf func(T) int,
	getIndexAtTime func(ms int64) int,
	computeElementAtTime func(ms int64) T,
	searchWindowHours float64,
	precision SearchPrecision,
	maxPerDay int,
	angle *ElementAngle,
	wrap func(elem T, startMs, endMs int64, isActiveAtSunrise bool) D,
) ([]D, error) {
	results := []D{}
	cursor := sunriseMs

	indexAtNextSunrise := getIndexAtTime(nextSunriseMs)

	for cursor < nextSunriseMs {
		var element T
		if len(results) == 0 {
			element = elementAtSunrise
		} else {
			element = computeElementAtTime(cursor)
		}
		index := indexOf(element)

		startTime := cursor
		if len(results) == 0 {
			startTime = FindStartTime(sunriseMs, index, getIndexAtTime,
				36, precision.MaxIterations, precision.ToleranceMs, angle)
		}
		isActiveAtSunrise := len(results) == 0

		if indexAtNextSunrise == index {
			results = append(results, wrap(element, startTime, nextSunriseMs, isActiveAtSunrise))
			break
		}

		searchEnd := int64(float64(cursor) + searchWindowHours*3600_000)
		rawEnd, err := FindTransitionTime(cursor, searchEnd, index, getIndexAtTime,
			precision.MaxIterations, precision.ToleranceMs, angle)
		if err != nil {
			return nil, err
		}
		endTime := rawEnd
		if rawEnd > nextSunriseMs {
			endTime = nextSunriseMs
		}

		results = append(results, wrap(element, startTime, endTime, isActiveAtSunrise))

		if rawEnd >= nextSunriseMs {
			break
		}
		cursor = rawEnd + 1
		if len(results) >= maxPerDay {
			break
		}
	}

	return results, nil
}
