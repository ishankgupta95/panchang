package core

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

func ComputeInauspiciousPeriod(
	sunriseMs, sunsetMs int64,
	varaIndex int,
	slotTable [7]int,
) types.UtcWindow {
	dayDurationMs := float64(sunsetMs - sunriseMs)
	slotDurationMs := dayDurationMs / 8
	slotIndex := slotTable[varaIndex]

	start := float64(sunriseMs) + float64(float64(slotIndex)*slotDurationMs)
	startMs := int64(start)
	end := float64(startMs) + slotDurationMs

	return types.UtcWindow{StartMs: startMs, EndMs: int64(end)}
}

func ComputeRahuKalam(sunriseMs, sunsetMs int64, varaIndex int) types.UtcWindow {
	return ComputeInauspiciousPeriod(sunriseMs, sunsetMs, varaIndex, utils.RahuKalamSlots)
}

func ComputeGulikaKalam(sunriseMs, sunsetMs int64, varaIndex int) types.UtcWindow {
	return ComputeInauspiciousPeriod(sunriseMs, sunsetMs, varaIndex, utils.GulikaSlots)
}

func ComputeYamaganda(sunriseMs, sunsetMs int64, varaIndex int) types.UtcWindow {
	return ComputeInauspiciousPeriod(sunriseMs, sunsetMs, varaIndex, utils.YamagandaSlots)
}
