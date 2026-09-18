package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func ComputeDivisionalChart(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	divisional types.Divisional,
	options BirthChartOptions,
) (types.DivisionalChart, error) {
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.DivisionalChart{}, err
	}
	return DivisionalChartFromBasis(&basis, divisional)
}

func DivisionalChartFromBasis(basis *NatalBasis, divisional types.Divisional) (types.DivisionalChart, error) {
	if divisional == types.DivisionalD9 {
		return NavamsaFromBasis(basis), nil
	}

	lang := basis.Lang
	transform, err := transformFor(divisional)
	if err != nil {
		return types.DivisionalChart{}, err
	}
	divLagnaLon := transform(basis.Lagna.SiderealLongitude)
	divLagnaRashi := int(math.Floor(divLagnaLon / 30))

	planets := make([]types.PlanetPlacement, 0, types.GrahaCount)
	for _, e := range GrahaList(basis) {
		dLon := transform(e.Pos.SiderealLongitude)
		dRashi := int(math.Floor(dLon / 30))
		planets = append(planets, types.PlanetPlacement{
			Planet:        e.Key,
			Longitude:     dLon,
			Rashi:         types.RashiInfo{Index: dRashi, Name: i18n.ResolveMasaName(dRashi, lang)},
			DegreeInRashi: dLon - float64(float64(dRashi)*30), // anti-FMA barrier
			House:         ((dRashi-divLagnaRashi+12)%12 + 1),
			IsRetrograde:  e.Pos.IsRetrograde,
		})
	}

	return types.DivisionalChart{
		Divisional: divisional,
		LagnaRashi: types.RashiInfo{Index: divLagnaRashi, Name: i18n.ResolveMasaName(divLagnaRashi, lang)},
		Planets:    planets,
	}, nil
}

func transformFor(divisional types.Divisional) (func(float64) float64, error) {
	switch divisional {
	case types.DivisionalD2:
		return horaLongitude, nil
	case types.DivisionalD3:
		return drekkanaLongitude, nil
	case types.DivisionalD7:
		return saptamsaLongitude, nil
	case types.DivisionalD10:
		return dasamsaLongitude, nil
	case types.DivisionalD12:
		return dwadasamsaLongitude, nil
	case types.DivisionalD30:
		return trimsamsaLongitude, nil
	case types.DivisionalD9:
		return nil, types.Codef(types.ErrInvalidInput,
			"transformFor: D9 has no longitude transform here; DivisionalChartFromBasis "+
				"routes it to NavamsaFromBasis")
	}
	return nil, types.Codef(types.ErrInvalidInput,
		"unknown divisional %q; expected one of D2, D3, D7, D9, D10, D12, D30", string(divisional))
}

func horaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	isOddSign := rashi%2 == 0 // Aries (0) is the 1st sign → odd
	isFirstHalf := degInRashi < 15
	goesToSun := isOddSign == isFirstHalf
	targetRashi := 3 // Cancer
	if goesToSun {
		targetRashi = 4 // Leo
	}
	degInHalf := degInRashi
	if !isFirstHalf {
		degInHalf = degInRashi - 15
	}
	degInTargetRashi := float64((degInHalf / 15) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}

const drekkanaSpan float64 = 10

var drekkanaOffsets = [3]int{0, 4, 8}

func drekkanaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	idx := int(math.Floor(degInRashi / drekkanaSpan))
	if idx > 2 {
		idx = 2
	}
	targetRashi := (rashi + drekkanaOffsets[idx]) % 12
	degInSeg := degInRashi - float64(float64(idx)*drekkanaSpan)
	degInTargetRashi := float64((degInSeg / drekkanaSpan) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}

const saptamsaSpan float64 = 30.0 / 7 // 30.0, not 30: integer division would give 4

func saptamsaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	idx := int(math.Floor(degInRashi / saptamsaSpan))
	if idx > 6 {
		idx = 6
	}
	startOffset := 6 // even signs start from the 7th
	if rashi%2 == 0 {
		startOffset = 0
	}
	targetRashi := (rashi + startOffset + idx) % 12
	degInSeg := degInRashi - float64(float64(idx)*saptamsaSpan)
	degInTargetRashi := float64((degInSeg / saptamsaSpan) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}

const dasamsaSpan float64 = 3

func dasamsaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	idx := int(math.Floor(degInRashi / dasamsaSpan))
	if idx > 9 {
		idx = 9
	}
	startOffset := 8 // even signs start from the 9th
	if rashi%2 == 0 {
		startOffset = 0
	}
	targetRashi := (rashi + startOffset + idx) % 12
	degInSeg := degInRashi - float64(float64(idx)*dasamsaSpan)
	degInTargetRashi := float64((degInSeg / dasamsaSpan) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}

const dwadasamsaSpan float64 = 30.0 / 12 // 30.0, not 30: integer division would give 2

func dwadasamsaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	idx := int(math.Floor(degInRashi / dwadasamsaSpan))
	if idx > 11 {
		idx = 11
	}
	targetRashi := (rashi + idx) % 12
	degInSeg := degInRashi - float64(float64(idx)*dwadasamsaSpan)
	degInTargetRashi := float64((degInSeg / dwadasamsaSpan) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}

var (
	trimsaOddBoundaries = [6]float64{0, 5, 10, 18, 25, 30}
	trimsaOddRashis     = [5]int{
		0,
		10,
		8,
		2,
		6,
	}
	trimsaEvenBoundaries = [6]float64{0, 5, 12, 20, 25, 30}
	trimsaEvenRashis     = [5]int{
		1,
		5,
		11,
		9,
		7,
	}
)

func trimsamsaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	isOdd := rashi%2 == 0
	boundaries := trimsaEvenBoundaries
	rashis := trimsaEvenRashis
	if isOdd {
		boundaries = trimsaOddBoundaries
		rashis = trimsaOddRashis
	}
	segIdx := 4
	for i := 0; i < 5; i++ {
		if degInRashi < boundaries[i+1] {
			segIdx = i
			break
		}
	}
	targetRashi := rashis[segIdx]
	segStart := boundaries[segIdx]
	segWidth := boundaries[segIdx+1] - segStart
	degInSeg := degInRashi - segStart
	degInTargetRashi := float64((degInSeg / segWidth) * 30) // anti-FMA barrier
	return utils.Normalize360(float64(float64(targetRashi)*30) + degInTargetRashi)
}
