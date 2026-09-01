package core

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeNakshatraFromLongitude(siderealMoon float64, name string) types.NakshatraInfo {
	index := utils.NakshatraOf(siderealMoon)
	degreesInNakshatra := math.Max(siderealMoon-float64(float64(index)*utils.NakshatraSpan), 0)
	pada := int(math.Floor(degreesInNakshatra/utils.NakshatraPadaSpan)) + 1
	if pada > 4 {
		pada = 4
	}
	completionPercentage := (degreesInNakshatra / utils.NakshatraSpan) * 100
	return types.NakshatraInfo{
		Index:                index,
		Name:                 name,
		Pada:                 pada,
		DegreesInNakshatra:   jsnum.Round(degreesInNakshatra*10000) / 10000,
		CompletionPercentage: jsnum.Round(completionPercentage*100) / 100,
		EndTime:              nil,
	}
}

func GetNakshatraIndexAtTime(ms int64, getCachedMoon LongitudeAt) int {
	return utils.NakshatraOf(getCachedMoon(ms))
}
