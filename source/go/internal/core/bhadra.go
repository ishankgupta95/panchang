package core

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

const karanaCycleLength = 60

func IsVishtiKarana(karanaIndex int) bool {
	if karanaIndex <= 0 || karanaIndex >= 57 {
		return false
	}
	return (karanaIndex-1)%7 == 6
}

var vasaByRashi = [12]types.BhadraLocation{
	types.BhadraHeaven, // 0  Mesha
	types.BhadraHeaven, // 1  Vrishabha
	types.BhadraHeaven, // 2  Mithuna
	types.BhadraEarth,  // 3  Karka
	types.BhadraEarth,  // 4  Simha
	types.BhadraPaatal, // 5  Kanya
	types.BhadraPaatal, // 6  Tula
	types.BhadraHeaven, // 7  Vrischika
	types.BhadraPaatal, // 8  Dhanu
	types.BhadraPaatal, // 9  Makara
	types.BhadraEarth,  // 10 Kumbha
	types.BhadraEarth,  // 11 Meena
}

func BhadraVasaForRashi(rashiIndex int) types.BhadraLocation {
	return vasaByRashi[((rashiIndex%12)+12)%12]
}

const bhadraRashiSpan = 30

func ComputeBhadraKaal(
	sunriseUtcMs, nextSunriseUtcMs int64,
	getMoon, getSun LongitudeAt,
	locationNameFn func(key types.BhadraLocation) string,
) (types.UnlocalizedBhadraInfo, bool) {
	karanaAt := func(ms int64) int { return GetKaranaIndexAtTime(ms, getMoon, getSun) }
	dayLengthMs := float64(nextSunriseUtcMs - sunriseUtcMs)

	sunriseKarana := karanaAt(sunriseUtcMs)

	if !IsVishtiKarana(sunriseKarana) {
		nextSunriseKarana := karanaAt(nextSunriseUtcMs)
		traversesVishti := false
		k := sunriseKarana
		for step := 0; step < karanaCycleLength+2; step++ {
			if k == nextSunriseKarana {
				break
			}
			k = (k + 1) % karanaCycleLength
			if IsVishtiKarana(k) {
				traversesVishti = true
				break
			}
		}
		if !traversesVishti {
			return types.UnlocalizedBhadraInfo{}, false
		}
	}

	var vishtiSampleMs int64
	haveSample := false
	vishtiKaranaIndex := -1

	if IsVishtiKarana(sunriseKarana) {
		vishtiSampleMs, haveSample = sunriseUtcMs, true
		vishtiKaranaIndex = sunriseKarana
	} else {
		const sampleCount = 24
		for i := 1; i <= sampleCount; i++ {
			t := int64(float64(sunriseUtcMs) + dayLengthMs*float64(i)/sampleCount)
			k := karanaAt(t)
			if IsVishtiKarana(k) {
				vishtiSampleMs, haveSample = t, true
				vishtiKaranaIndex = k
				break
			}
		}
	}

	if !haveSample || vishtiKaranaIndex < 0 {
		return types.UnlocalizedBhadraInfo{}, false
	}

	const bracketMs = 120_000
	const maxBracketIters = 30
	angle := utils.ElementAngle{
		AngleAt: func(ms int64) float64 { return getMoon(ms) - getSun(ms) },
		SpanDeg: 360.0 / karanaCycleLength,
	}

	var startMs int64
	{
		searchStart := vishtiSampleMs - 18*3600_000
		if karanaAt(searchStart) == vishtiKaranaIndex {
			startMs = searchStart
		} else {
			lo, hi := float64(searchStart), float64(vishtiSampleMs)
			for i := 0; i < maxBracketIters && hi-lo > bracketMs; i++ {
				mid := (lo + hi) / 2
				if karanaAt(int64(mid)) == vishtiKaranaIndex {
					hi = mid
				} else {
					lo = mid
				}
			}
			solved, ok := utils.SolveElementBoundary(lo, hi, angle,
				func(ms int64) bool { return karanaAt(ms) != vishtiKaranaIndex })
			if ok {
				startMs = solved
			} else {
				startMs = int64(hi)
			}
		}
	}

	var endMs int64
	{
		searchEnd := vishtiSampleMs + 18*3600_000
		if karanaAt(searchEnd) == vishtiKaranaIndex {
			endMs = searchEnd
		} else {
			lo, hi := float64(vishtiSampleMs), float64(searchEnd)
			for i := 0; i < maxBracketIters && hi-lo > bracketMs; i++ {
				mid := (lo + hi) / 2
				if karanaAt(int64(mid)) == vishtiKaranaIndex {
					lo = mid
				} else {
					hi = mid
				}
			}
			solved, ok := utils.SolveElementBoundary(lo, hi, angle,
				func(ms int64) bool { return karanaAt(ms) == vishtiKaranaIndex })
			if ok {
				endMs = solved
			} else {
				endMs = int64(hi)
			}
		}
	}

	rashiAt := func(ms int64) int {
		return int(math.Floor(utils.Normalize360(getMoon(ms))/bhadraRashiSpan)) % 12
	}
	rashiAngle := utils.ElementAngle{AngleAt: getMoon, SpanDeg: bhadraRashiSpan}

	vasa := make([]types.UnlocalizedBhadraVasaSegment, 0, 2)
	segStartMs := startMs
	segRashi := rashiAt(startMs)
	for rashiAt(endMs) != segRashi {
		lo, hi := float64(segStartMs), float64(endMs)
		for i := 0; i < maxBracketIters && hi-lo > bracketMs; i++ {
			mid := (lo + hi) / 2
			if rashiAt(int64(mid)) == segRashi {
				lo = mid
			} else {
				hi = mid
			}
		}
		crossMs := int64(hi)
		if solved, ok := utils.SolveElementBoundary(lo, hi, rashiAngle,
			func(ms int64) bool { return rashiAt(ms) == segRashi }); ok {
			crossMs = solved
		}
		segLocation := BhadraVasaForRashi(segRashi)
		vasa = append(vasa, types.UnlocalizedBhadraVasaSegment{
			StartMs:      segStartMs,
			EndMs:        crossMs,
			Location:     segLocation,
			LocationName: locationNameFn(segLocation),
		})
		segStartMs = crossMs
		segRashi = (segRashi + 1) % 12
	}
	lastLocation := BhadraVasaForRashi(segRashi)
	vasa = append(vasa, types.UnlocalizedBhadraVasaSegment{
		StartMs:      segStartMs,
		EndMs:        endMs,
		Location:     lastLocation,
		LocationName: locationNameFn(lastLocation),
	})

	location := vasa[0].Location
	return types.UnlocalizedBhadraInfo{
		StartMs:      startMs,
		EndMs:        endMs,
		Location:     location,
		LocationName: locationNameFn(location),
		Vasa:         vasa,
		IsActive:     IsVishtiKarana(sunriseKarana),
	}, true
}
