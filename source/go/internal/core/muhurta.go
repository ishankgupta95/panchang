package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Abhijit is held inauspicious on Wednesday.
func ComputeAbhijitMuhurta(sunriseMs, sunsetMs int64, varaIndex *int) (types.UtcWindow, bool) {
	if varaIndex != nil && *varaIndex == 3 {
		return types.UtcWindow{}, false
	}

	dayDurationMs := float64(sunsetMs - sunriseMs)
	muhurtaDurationMs := dayDurationMs / 15

	// FMA barrier; the end measures from the truncated start.
	startMs := int64(float64(sunriseMs) + float64(7*muhurtaDurationMs))
	return types.UtcWindow{
		StartMs: startMs,
		EndMs:   int64(float64(startMs) + muhurtaDurationMs),
	}, true
}

func ComputeBrahmaMuhurta(sunriseMs, sunsetMs int64) types.UtcWindow {
	dayDurationMs := float64(sunsetMs - sunriseMs)
	muhurtaDurationMs := dayDurationMs / 30

	endMs := int64(float64(sunriseMs) - muhurtaDurationMs)
	return types.UtcWindow{
		StartMs: int64(float64(endMs) - muhurtaDurationMs),
		EndMs:   endMs,
	}
}

func ComputeVijayaMuhurta(sunriseMs, sunsetMs int64) types.UtcWindow {
	dayDurationMs := float64(sunsetMs - sunriseMs)
	muhurtaDurationMs := dayDurationMs / 15
	startMs := int64(float64(sunriseMs) + float64(10*muhurtaDurationMs))
	return types.UtcWindow{
		StartMs: startMs,
		EndMs:   int64(float64(startMs) + muhurtaDurationMs),
	}
}

func ComputeGodhuliMuhurta(sunsetMs int64) types.UtcWindow {
	const halfMs = 24 * 60_000
	return types.UtcWindow{StartMs: sunsetMs - halfMs, EndMs: sunsetMs + halfMs}
}

func ComputeNishitaMuhurta(sunsetMs, nextSunriseMs int64) types.UtcWindow {
	nightDurationMs := float64(nextSunriseMs - sunsetMs)
	muhurtaDurationMs := nightDurationMs / 15
	startMs := int64(float64(sunsetMs) + float64(7*muhurtaDurationMs))
	return types.UtcWindow{
		StartMs: startMs,
		EndMs:   int64(float64(startMs) + muhurtaDurationMs),
	}
}

func ComputeAmritKalaWindows(
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon LongitudeAt,
) []types.UtcWindow {
	return CollectNakshatraOffsetWindows(sunriseUtcMs, nextSunriseUtcMs, getMoon,
		func(nakshatraIndex int, nakshatraStartMs, nakshatraEndMs int64) []types.UtcWindow {
			ghatikaMs := float64(nakshatraEndMs-nakshatraStartMs) / 60
			// The start stays a float here; the end measures from it before truncating.
			startMs := float64(nakshatraStartMs) +
				float64(float64(AmritKalaOffsetGhatikas[nakshatraIndex])*ghatikaMs)
			return []types.UtcWindow{{
				StartMs: int64(startMs),
				EndMs:   int64(startMs + float64(4*ghatikaMs)),
			}}
		})
}

// noonMs stays a float: the mean is fractional on an odd sum.
func ComputeMadhyahna(sunriseMs, sunsetMs int64) types.UtcWindow {
	const halfMs = 24 * 60_000
	noonMs := float64(sunriseMs+sunsetMs) / 2
	return types.UtcWindow{
		StartMs: int64(noonMs - halfMs),
		EndMs:   int64(noonMs + halfMs),
	}
}

// Three NIGHTTIME ghatikas ending at sunrise; the asymmetry is the reference almanac's convention.
func ComputePratahSandhya(sunriseMs, sunsetMs, nextSunriseMs int64) types.UtcWindow {
	widthMs := float64(nextSunriseMs-sunsetMs) / 10
	return types.UtcWindow{
		StartMs: int64(float64(sunriseMs) - widthMs),
		EndMs:   sunriseMs,
	}
}

func ComputeSayahnaSandhya(sunsetMs, nextSunriseMs int64) types.UtcWindow {
	widthMs := float64(nextSunriseMs-sunsetMs) / 10
	return types.UtcWindow{
		StartMs: sunsetMs,
		EndMs:   int64(float64(sunsetMs) + widthMs),
	}
}

// Elapsed ghatikas from the nakshatra's start to its Amrit Kala window, recovered from the reference almanac.
var AmritKalaOffsetGhatikas = [27]int{
	42, // 0  Ashwini
	48, // 1  Bharani
	54, // 2  Krittika
	52, // 3  Rohini
	38, // 4  Mrigashira
	35, // 5  Ardra
	54, // 6  Punarvasu
	44, // 7  Pushya
	56, // 8  Ashlesha
	54, // 9  Magha
	44, // 10 Purva Phalguni
	42, // 11 Uttara Phalguni
	45, // 12 Hasta
	44, // 13 Chitra
	38, // 14 Swati
	38, // 15 Vishakha
	34, // 16 Anuradha
	38, // 17 Jyeshtha
	44, // 18 Mula
	48, // 19 Purva Ashadha
	44, // 20 Uttara Ashadha
	34, // 21 Shravana
	34, // 22 Dhanishtha
	42, // 23 Shatabhisha
	40, // 24 Purva Bhadrapada
	48, // 25 Uttara Bhadrapada
	54, // 26 Revati
}
