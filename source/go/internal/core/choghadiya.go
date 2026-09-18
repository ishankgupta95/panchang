package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var choghadiyaQuality = [7]types.ChoghadiyaQuality{
	types.QualityInauspicious, // 0 Udveg  (Sun)
	types.QualityNeutral,      // 1 Char   (Venus)
	types.QualityAuspicious,   // 2 Labh   (Mercury)
	types.QualityAuspicious,   // 3 Amrit  (Moon)
	types.QualityInauspicious, // 4 Kaal   (Saturn)
	types.QualityAuspicious,   // 5 Shubh  (Jupiter)
	types.QualityInauspicious, // 6 Rog    (Mars)
}

var choghadiyaDayStartIndex = utils.VaraChaldeanStart

var choghadiyaNightSequence = [7]int{0, 5, 3, 1, 6, 4, 2}

var choghadiyaNightStartPos = [7]int{1, 3, 5, 0, 2, 4, 6}

func buildChoghadiyaSlots(
	referenceMs int64,
	durationMs float64,
	indexFor func(i int) int,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
	count int,
) []types.UnlocalizedChoghadiyaSlot {
	return utils.BuildEqualSlots(referenceMs, durationMs, count,
		func(i int, startMs, endMs int64) types.UnlocalizedChoghadiyaSlot {
			idx := indexFor(i)
			quality := choghadiyaQuality[idx]
			return types.UnlocalizedChoghadiyaSlot{
				StartMs: startMs, EndMs: endMs,
				Index: idx, Name: nameFn(idx),
				Quality: quality, QualityName: qualityNameFn(quality),
			}
		})
}

func ComputeChoghadiya(
	sunriseMs, sunsetMs, nextSunriseMs int64,
	varaIndex int,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
) types.UnlocalizedChoghadiyaInfo {
	dayMs := float64(sunsetMs - sunriseMs)
	nightMs := float64(nextSunriseMs - sunsetMs)

	dayStart := choghadiyaDayStartIndex[varaIndex]
	nightPos := choghadiyaNightStartPos[varaIndex]

	return types.UnlocalizedChoghadiyaInfo{
		Day: buildChoghadiyaSlots(sunriseMs, dayMs,
			func(i int) int { return (dayStart + i) % 7 }, nameFn, qualityNameFn, 8),
		Night: buildChoghadiyaSlots(sunsetMs, nightMs,
			func(i int) int { return choghadiyaNightSequence[(nightPos+i)%7] }, nameFn, qualityNameFn, 8),
	}
}
