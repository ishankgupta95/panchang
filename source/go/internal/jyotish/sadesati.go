package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const sadeSatiDayMs = 86400_000

// sadeSatiStabilityDays is how long Saturn must stay outside the arc to end it.
// Its retrograde excursions back across a rashi boundary last 7 to about 240
// days, so only the shorter ones are bridged into one arc; a longer one ends
// the arc, and the return starts a new one.
const sadeSatiStabilityDays = 90

const sadeSatiCoarseStep = 7

const sadeSatiMaxForwardScanDays = 30 * 365 // Saturn's period is ~29.5 years

const sadeSatiMaxBackwardScanDays = 12 * 365 // an arc is at most 7.5 years

// saturnMaxSpeedDegPerDay bounds how fast Saturn's sidereal longitude moves.
// The measured maximum over every instant a scan can reach (1887 to 2132, all
// five ayanamsas, which share one precession rate) is 0.1303 deg/day, so a
// sample d degrees from the nearest rashi boundary where the arc test changes
// keeps its answer for ceil(d / (0.2 * 7)) - 1 more coarse steps. The scans
// below take those steps without evaluating them. Typed, so the product with
// the step rounds as in TypeScript; it only decides how many steps are taken
// unevaluated, never what any of them yields.
const saturnMaxSpeedDegPerDay float64 = 0.2

const saturnMaxDegPerCoarseStep = saturnMaxSpeedDegPerDay * sadeSatiCoarseStep

// arcEdges returns the rashi boundaries, in degrees, at which isInArc changes.
func arcEdges(isInArc func(rashi int) bool) []float64 {
	edges := make([]float64, 0, 2)
	for r := 0; r < 12; r++ {
		if isInArc(r) != isInArc((r+11)%12) {
			edges = append(edges, float64(r*30))
		}
	}
	return edges
}

// steadySteps is how many coarse samples after one at sidereal longitude lon
// are certain to give the same isInArc answer: Saturn cannot move far enough
// in that time to reach any of edges.
func steadySteps(lon float64, edges []float64) int {
	if len(edges) == 0 {
		return 0
	}
	d := 360.0
	for _, e := range edges {
		x := math.Abs(lon - e)
		if x > 180 {
			x = 360 - x
		}
		d = math.Min(d, x)
	}
	n := math.Ceil(d/saturnMaxDegPerCoarseStep) - 1
	if !(n > 0) {
		return 0
	}
	return int(n)
}

func saturnSiderealLongitude(ctx *astronomy.EphemerisCtx, ms int64, ayanamsa types.AyanamsaType) (float64, error) {
	tropical := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetSaturn, ms)
	ay, err := astronomy.ComputeAyanamsa(ms, ayanamsa)
	if err != nil {
		return 0, err
	}
	return utils.Normalize360(tropical - ay), nil
}

func saturnRashi(ctx *astronomy.EphemerisCtx, ms int64, ayanamsa types.AyanamsaType) (int, error) {
	lon, err := saturnSiderealLongitude(ctx, ms, ayanamsa)
	if err != nil {
		return 0, err
	}
	return int(math.Floor(lon / 30)), nil
}

func ComputeSadeSati(
	ctx *astronomy.EphemerisCtx,
	natalMoonRashi int,
	asOfMs int64,
	ayanamsa types.AyanamsaType,
) (types.SadeSatiInfo, error) {
	if natalMoonRashi < 0 || natalMoonRashi >= 12 {
		return types.SadeSatiInfo{}, types.Codef(types.ErrInvalidInput,
			"natalMoonRashi must be integer in [0, 11], got %d", natalMoonRashi)
	}
	if err := utils.ValidateDate(asOfMs); err != nil {
		return types.SadeSatiInfo{}, err
	}
	ayanamsa = resolveAyanamsa(ayanamsa)

	m := natalMoonRashi
	arcRashis := [3]int{(m + 11) % 12, m, (m + 1) % 12}
	isInArc := func(r int) bool {
		return r == arcRashis[0] || r == arcRashis[1] || r == arcRashis[2]
	}

	currentRashi, err := saturnRashi(ctx, asOfMs, ayanamsa)
	if err != nil {
		return types.SadeSatiInfo{}, err
	}
	active := isInArc(currentRashi)

	if !active {
		next, err := findNextEntry(ctx, asOfMs, isInArc, ayanamsa)
		if err != nil {
			return types.SadeSatiInfo{}, err
		}
		return types.SadeSatiInfo{
			Active: false, Phase: nil, CurrentArcStart: nil, CurrentArcEnd: nil,
			NextArcStart: next,
		}, nil
	}

	phase := 3
	switch currentRashi {
	case arcRashis[0]:
		phase = 1
	case arcRashis[1]:
		phase = 2
	}

	start, err := findArcBoundary(ctx, asOfMs, isInArc, false, ayanamsa)
	if err != nil {
		return types.SadeSatiInfo{}, err
	}
	end, err := findArcBoundary(ctx, asOfMs, isInArc, true, ayanamsa)
	if err != nil {
		return types.SadeSatiInfo{}, err
	}
	return types.SadeSatiInfo{
		Active: true, Phase: &phase,
		CurrentArcStart: start, CurrentArcEnd: end, NextArcStart: nil,
	}, nil
}

func findArcBoundary(
	ctx *astronomy.EphemerisCtx,
	startMs int64,
	isInArc func(rashi int) bool,
	forward bool,
	ayanamsa types.AyanamsaType,
) (*types.JSDate, error) {
	stepDays := sadeSatiCoarseStep
	scanDays := sadeSatiMaxForwardScanDays
	if !forward {
		stepDays = -sadeSatiCoarseStep
		scanDays = sadeSatiMaxBackwardScanDays
	}
	stepMs := int64(stepDays) * sadeSatiDayMs
	maxIters := float64(scanDays) / float64(sadeSatiCoarseStep) // int would drop the final iteration

	currentMs := startMs
	lastInsideMs := startMs
	outsideRunDays := 0
	edges := arcEdges(isInArc)

	for i := 0; float64(i) < maxIters; i++ {
		currentMs += stepMs
		lon, err := saturnSiderealLongitude(ctx, currentMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		inside := isInArc(int(math.Floor(lon / 30)))
		// This sample and the steady ones after it share one answer; the
		// steady ones are stepped through without being evaluated.
		for steady := steadySteps(lon, edges); ; steady-- {
			if inside {
				outsideRunDays = 0
				lastInsideMs = currentMs
			} else {
				outsideRunDays += sadeSatiCoarseStep
				if outsideRunDays >= sadeSatiStabilityDays {
					return refineBoundary(ctx, lastInsideMs, isInArc, forward, ayanamsa)
				}
			}
			if steady == 0 || !(float64(i+1) < maxIters) {
				break
			}
			i++
			currentMs += stepMs
		}
	}
	return nil, nil
}

func refineBoundary(
	ctx *astronomy.EphemerisCtx,
	lastInsideMs int64,
	isInArc func(rashi int) bool,
	forward bool,
	ayanamsa types.AyanamsaType,
) (*types.JSDate, error) {
	stepMs := int64(sadeSatiDayMs)
	if !forward {
		stepMs = -sadeSatiDayMs
	}
	ms := lastInsideMs
	for i := 0; i < sadeSatiCoarseStep*2; i++ {
		next := ms + stepMs
		r, err := saturnRashi(ctx, next, ayanamsa)
		if err != nil {
			return nil, err
		}
		if !isInArc(r) {
			if forward {
				return jsDatePtr(next), nil
			}
			return jsDatePtr(ms), nil
		}
		ms = next
	}
	return jsDatePtr(ms), nil
}

// findNextEntry finds the next entry into any arc rashi, so a retrograde return
// into the 2nd from the Moon counts.
func findNextEntry(
	ctx *astronomy.EphemerisCtx,
	startMs int64,
	isInArc func(rashi int) bool,
	ayanamsa types.AyanamsaType,
) (*types.JSDate, error) {
	stepMs := int64(sadeSatiCoarseStep) * sadeSatiDayMs
	ms := startMs
	lon, err := saturnSiderealLongitude(ctx, ms, ayanamsa)
	if err != nil {
		return nil, err
	}
	prevRashi := int(math.Floor(lon / 30))
	maxIters := float64(sadeSatiMaxForwardScanDays) / float64(sadeSatiCoarseStep)
	edges := arcEdges(isInArc)
	// A steady sample answers isInArc as prevRashi does, so it can be neither
	// an entry nor change what prevRashi answers: it is stepped over.
	steady := steadySteps(lon, edges)

	for i := 0; float64(i) < maxIters; i++ {
		next := ms + stepMs
		if steady > 0 {
			steady--
			ms = next
			continue
		}
		lon, err := saturnSiderealLongitude(ctx, next, ayanamsa)
		if err != nil {
			return nil, err
		}
		r := int(math.Floor(lon / 30))
		steady = steadySteps(lon, edges)
		if isInArc(r) && !isInArc(prevRashi) {
			lo := float64(ms) // float64 endpoints for fidelity only; mid never lands fractional
			hi := float64(next)
			for hi-lo > sadeSatiDayMs {
				mid := lo + (hi-lo)/2
				rm, err := saturnRashi(ctx, int64(mid), ayanamsa)
				if err != nil {
					return nil, err
				}
				if isInArc(rm) {
					hi = mid
				} else {
					lo = mid
				}
			}
			return jsDatePtr(int64(hi)), nil
		}
		ms = next
		prevRashi = r
	}
	return nil, nil
}

func jsDatePtr(ms int64) *types.JSDate {
	d := types.Date(ms)
	return &d
}
