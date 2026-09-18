package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var gowriQuality = [8]types.ChoghadiyaQuality{
	types.QualityAuspicious,   // 0 Udyog  (Uthi: Good)
	types.QualityAuspicious,   // 1 Amrit  (Amirdha: Best)
	types.QualityInauspicious, // 2 Roga   (Rogam: Evil)
	types.QualityAuspicious,   // 3 Laabh  (Laabam: Gain)
	types.QualityAuspicious,   // 4 Shubh  (Sugam: Good)
	types.QualityInauspicious, // 5 Kaal   (Visham: Bad)
	types.QualityAuspicious,   // 6 Dhan   (Dhanam: Wealth)
	types.QualityInauspicious, // 7 Chal   (Soram: Bad)
}

var gowriDayGrid = [7][8]int{
	{0, 1, 2, 3, 6, 4, 7, 5}, // Sun
	{1, 5, 2, 3, 6, 4, 7, 0}, // Mon
	{2, 3, 6, 4, 7, 0, 5, 1}, // Tue
	{3, 6, 4, 7, 5, 0, 1, 2}, // Wed
	{6, 4, 7, 0, 1, 5, 2, 3}, // Thu
	{4, 7, 0, 5, 1, 2, 3, 6}, // Fri
	{7, 0, 5, 1, 2, 3, 6, 4}, // Sat
}

var gowriNightGrid = [7][8]int{
	{6, 4, 7, 5, 0, 1, 2, 3}, // Sun
	{4, 7, 0, 1, 5, 2, 3, 6}, // Mon
	{7, 0, 5, 1, 2, 3, 6, 4}, // Tue
	{0, 1, 2, 3, 6, 4, 7, 5}, // Wed
	{1, 5, 2, 3, 6, 4, 7, 0}, // Thu
	{2, 3, 6, 4, 7, 0, 5, 1}, // Fri
	{3, 6, 4, 7, 0, 5, 1, 7}, // Sat: Chal (7) twice, no Roga; verbatim from the source
}

func buildGowriSlots(
	referenceMs int64,
	durationMs float64,
	grid [8]int,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
) []types.UnlocalizedGowriSlot {
	return utils.BuildEqualSlots(referenceMs, durationMs, 8,
		func(i int, startMs, endMs int64) types.UnlocalizedGowriSlot {
			idx := grid[i]
			quality := gowriQuality[idx]
			return types.UnlocalizedGowriSlot{
				StartMs: startMs, EndMs: endMs,
				Index: idx, Name: nameFn(idx),
				Quality: quality, QualityName: qualityNameFn(quality),
			}
		})
}

func ComputeGowriPanchangam(
	sunriseMs, sunsetMs, nextSunriseMs int64,
	varaIndex int,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
) types.UnlocalizedGowriInfo {
	dayMs := float64(sunsetMs - sunriseMs)
	nightMs := float64(nextSunriseMs - sunsetMs)

	return types.UnlocalizedGowriInfo{
		Day:   buildGowriSlots(sunriseMs, dayMs, gowriDayGrid[varaIndex], nameFn, qualityNameFn),
		Night: buildGowriSlots(sunsetMs, nightMs, gowriNightGrid[varaIndex], nameFn, qualityNameFn),
	}
}
