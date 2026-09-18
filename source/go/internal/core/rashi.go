package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func ComputeChandraRashi(siderealMoon float64, nameFn func(index int) string) types.RashiInfo {
	index := int(math.Floor(siderealMoon / 30))
	return types.RashiInfo{Index: index, Name: nameFn(index)}
}

func ComputeSuryaNakshatra(siderealSun float64, nameFn func(index int) string) types.NakshatraIndexInfo {
	index := utils.NakshatraOf(siderealSun)
	return types.NakshatraIndexInfo{Index: index, Name: nameFn(index)}
}
