package core

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeChandraRashi(siderealMoon float64, nameFn func(index int) string) types.RashiInfo {
	index := int(math.Floor(siderealMoon / 30))
	return types.RashiInfo{Index: index, Name: nameFn(index)}
}

func ComputeSuryaNakshatra(siderealSun float64, nameFn func(index int) string) types.NakshatraIndexInfo {
	index := utils.NakshatraOf(siderealSun)
	return types.NakshatraIndexInfo{Index: index, Name: nameFn(index)}
}
