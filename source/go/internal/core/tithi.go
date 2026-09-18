package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func ComputeTithiFromLongitudes(
	siderealMoon, siderealSun float64,
	name, paksha string,
) types.TithiInfo {
	angle := utils.Normalize360(siderealMoon - siderealSun)
	index := int(math.Floor(angle / utils.TithiSpan))
	elapsed := angle - float64(float64(index)*utils.TithiSpan)
	completionPercentage := (elapsed / utils.TithiSpan) * 100
	number := index - 14
	if index < 15 {
		number = index + 1
	}
	return types.TithiInfo{
		Index:                index,
		Name:                 name,
		Paksha:               paksha,
		Number:               number,
		CompletionPercentage: jsnum.Round(completionPercentage*100) / 100,
		EndTime:              nil,
	}
}

func GetTithiIndexAtTime(ms int64, getCachedMoon, getCachedSun LongitudeAt) int {
	angle := utils.Normalize360(getCachedMoon(ms) - getCachedSun(ms))
	return int(math.Floor(angle / utils.TithiSpan))
}

func GetTithiIndexFromLons(siderealMoon, siderealSun float64) int {
	return int(math.Floor(utils.Normalize360(siderealMoon-siderealSun) / utils.TithiSpan))
}
