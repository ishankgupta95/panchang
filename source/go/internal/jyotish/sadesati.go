package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

const sadeSatiDayMs = 86400_000

const sadeSatiStabilityDays = 90 // Saturn's retrograde amplitude is ~7°, so 90 days absorbs re-crossings

const sadeSatiCoarseStep = 7

const sadeSatiMaxForwardScanDays = 30 * 365 // Saturn's period is ~29.5 years

const sadeSatiMaxBackwardScanDays = 12 * 365 // an arc is at most 7.5 years

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
		next, err := findNextEntry(ctx, asOfMs, arcRashis[0], ayanamsa)
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

	for i := 0; float64(i) < maxIters; i++ {
		currentMs += stepMs
		r, err := saturnRashi(ctx, currentMs, ayanamsa)
		if err != nil {
			return nil, err
		}
		if isInArc(r) {
			outsideRunDays = 0
			lastInsideMs = currentMs
			continue
		}
		outsideRunDays += sadeSatiCoarseStep
		if outsideRunDays >= sadeSatiStabilityDays {
			return refineBoundary(ctx, lastInsideMs, isInArc, forward, ayanamsa)
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

func findNextEntry(
	ctx *astronomy.EphemerisCtx,
	startMs int64,
	targetRashi int,
	ayanamsa types.AyanamsaType,
) (*types.JSDate, error) {
	stepMs := int64(sadeSatiCoarseStep) * sadeSatiDayMs
	ms := startMs
	prevRashi, err := saturnRashi(ctx, ms, ayanamsa)
	if err != nil {
		return nil, err
	}
	maxIters := float64(sadeSatiMaxForwardScanDays) / float64(sadeSatiCoarseStep)

	for i := 0; float64(i) < maxIters; i++ {
		next := ms + stepMs
		r, err := saturnRashi(ctx, next, ayanamsa)
		if err != nil {
			return nil, err
		}
		if r == targetRashi && prevRashi != targetRashi {
			lo := float64(ms) // float64 endpoints for fidelity only; mid never lands fractional
			hi := float64(next)
			for hi-lo > sadeSatiDayMs {
				mid := lo + (hi-lo)/2
				rm, err := saturnRashi(ctx, int64(mid), ayanamsa)
				if err != nil {
					return nil, err
				}
				if rm == targetRashi {
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
