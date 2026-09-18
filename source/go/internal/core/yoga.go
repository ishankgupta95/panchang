package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func ComputeYogaFromLongitudes(siderealMoon, siderealSun float64, name string) types.YogaInfo {
	angle := utils.Normalize360(siderealSun + siderealMoon)
	index := int(math.Floor(angle / utils.YogaSpan))
	elapsed := angle - float64(float64(index)*utils.YogaSpan) // anti-FMA barrier
	completionPercentage := (elapsed / utils.YogaSpan) * 100
	return types.YogaInfo{
		Index:                index,
		Name:                 name,
		CompletionPercentage: jsnum.Round(completionPercentage*100) / 100,
		EndTime:              nil,
	}
}

func GetYogaIndexAtTime(ms int64, getCachedMoon, getCachedSun LongitudeAt) int {
	angle := utils.Normalize360(getCachedSun(ms) + getCachedMoon(ms))
	return int(math.Floor(angle / utils.YogaSpan))
}

func GetYogaIndex(siderealMoon, siderealSun float64) int {
	return int(math.Floor(utils.Normalize360(siderealSun+siderealMoon) / utils.YogaSpan))
}
