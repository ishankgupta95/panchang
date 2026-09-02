package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

func ComputeKaranaFromLongitudes(siderealMoon, siderealSun float64, name string) types.KaranaInfo {
	angle := utils.Normalize360(siderealMoon - siderealSun)
	index := int(math.Floor(angle / utils.KaranaSpan))
	elapsed := angle - float64(float64(index)*utils.KaranaSpan) // anti-FMA barrier
	completionPercentage := (elapsed / utils.KaranaSpan) * 100
	return types.KaranaInfo{
		Index:                index,
		Name:                 name,
		Type:                 GetKaranaType(index),
		CompletionPercentage: jsnum.Round(completionPercentage*100) / 100,
		EndTime:              nil,
	}
}

func GetKaranaType(index int) types.KaranaType {
	if index == 0 || index >= 57 {
		return types.KaranaFixed
	}
	return types.KaranaMovable
}

func GetKaranaIndexAtTime(ms int64, getCachedMoon, getCachedSun LongitudeAt) int {
	angle := utils.Normalize360(getCachedMoon(ms) - getCachedSun(ms))
	return int(math.Floor(angle / utils.KaranaSpan))
}

func GetKaranaIndex(siderealMoon, siderealSun float64) int {
	return int(math.Floor(utils.Normalize360(siderealMoon-siderealSun) / utils.KaranaSpan))
}
