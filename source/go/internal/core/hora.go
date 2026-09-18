package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var horaDayFirst = utils.VaraChaldeanStart

func buildHoras(
	referenceMs int64,
	durationMs float64,
	firstPlanetIndex int,
	nameFn func(planetIndex int) string,
	count int,
) []types.UnlocalizedHoraSlot {
	return utils.BuildEqualSlots(referenceMs, durationMs, count,
		func(i int, startMs, endMs int64) types.UnlocalizedHoraSlot {
			planetIndex := (firstPlanetIndex + i) % 7
			return types.UnlocalizedHoraSlot{
				StartMs: startMs, EndMs: endMs,
				PlanetIndex: planetIndex, Planet: nameFn(planetIndex),
			}
		})
}

func ComputeHora(
	sunriseMs, sunsetMs, nextSunriseMs int64,
	varaIndex int,
	nameFn func(planetIndex int) string,
) types.UnlocalizedHoraInfo {
	dayMs := float64(sunsetMs - sunriseMs)
	nightMs := float64(nextSunriseMs - sunsetMs)
	firstDay := horaDayFirst[varaIndex]
	firstNight := (firstDay + 12) % 7

	return types.UnlocalizedHoraInfo{
		Day:   buildHoras(sunriseMs, dayMs, firstDay, nameFn, 12),
		Night: buildHoras(sunsetMs, nightMs, firstNight, nameFn, 12),
	}
}
