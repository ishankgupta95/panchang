package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

var doGhatiQuality = [30]types.ChoghadiyaQuality{
	types.QualityInauspicious, //  0 Rudra
	types.QualityInauspicious, //  1 Uraga
	types.QualityAuspicious,   //  2 Mitra
	types.QualityInauspicious, //  3 Pitara
	types.QualityAuspicious,   //  4 Vasu
	types.QualityAuspicious,   //  5 Ambu
	types.QualityAuspicious,   //  6 Vishwedeva
	types.QualityAuspicious,   //  7 Vidhi
	types.QualityAuspicious,   //  8 Brahma
	types.QualityAuspicious,   //  9 Indra
	types.QualityInauspicious, // 10 Indragni
	types.QualityInauspicious, // 11 Daitya
	types.QualityAuspicious,   // 12 Varuna
	types.QualityAuspicious,   // 13 Aryama
	types.QualityInauspicious, // 14 Bhaga
	types.QualityInauspicious, // 15 Ishwara
	types.QualityInauspicious, // 16 Ajaikapada
	types.QualityAuspicious,   // 17 Ahirbudhnya
	types.QualityAuspicious,   // 18 Pusha
	types.QualityAuspicious,   // 19 Ashwini
	types.QualityInauspicious, // 20 Yama
	types.QualityInauspicious, // 21 Agni
	types.QualityAuspicious,   // 22 Brahma
	types.QualityAuspicious,   // 23 Chandra
	types.QualityAuspicious,   // 24 Aditi
	types.QualityAuspicious,   // 25 Brihaspati
	types.QualityAuspicious,   // 26 Vishnu
	types.QualityAuspicious,   // 27 Surya
	types.QualityAuspicious,   // 28 Tvashta
	types.QualityAuspicious,   // 29 Samirana
}

func buildDoGhatiSlots(
	referenceMs int64,
	durationMs float64,
	indexBase int,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
) []types.UnlocalizedDoGhatiSlot {
	return utils.BuildEqualSlots(referenceMs, durationMs, 15,
		func(i int, startMs, endMs int64) types.UnlocalizedDoGhatiSlot {
			idx := indexBase + i
			quality := doGhatiQuality[idx]
			return types.UnlocalizedDoGhatiSlot{
				StartMs: startMs, EndMs: endMs,
				Index: idx, Name: nameFn(idx),
				Quality: quality, QualityName: qualityNameFn(quality),
			}
		})
}

func ComputeDoGhati(
	sunriseMs, sunsetMs, nextSunriseMs int64,
	nameFn func(index int) string,
	qualityNameFn func(quality types.ChoghadiyaQuality) string,
) types.UnlocalizedDoGhatiInfo {
	dayMs := float64(sunsetMs - sunriseMs)
	nightMs := float64(nextSunriseMs - sunsetMs)

	return types.UnlocalizedDoGhatiInfo{
		Day:   buildDoGhatiSlots(sunriseMs, dayMs, 0, nameFn, qualityNameFn),
		Night: buildDoGhatiSlots(sunsetMs, nightMs, 15, nameFn, qualityNameFn),
	}
}
