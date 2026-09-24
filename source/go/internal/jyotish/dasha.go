package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var DashaYears = [types.DashaLordCount]float64{
	types.DashaKetu:    7,
	types.DashaVenus:   20,
	types.DashaSun:     6,
	types.DashaMoon:    10,
	types.DashaMars:    7,
	types.DashaRahu:    18,
	types.DashaJupiter: 16,
	types.DashaSaturn:  19,
	types.DashaMercury: 17,
}

var DashaOrder = types.AllDashaLords

var NakshatraLord = [27]types.DashaLord{
	types.DashaKetu, types.DashaVenus, types.DashaSun, types.DashaMoon, types.DashaMars,
	types.DashaRahu, types.DashaJupiter, types.DashaSaturn, types.DashaMercury,
	types.DashaKetu, types.DashaVenus, types.DashaSun, types.DashaMoon, types.DashaMars,
	types.DashaRahu, types.DashaJupiter, types.DashaSaturn, types.DashaMercury,
	types.DashaKetu, types.DashaVenus, types.DashaSun, types.DashaMoon, types.DashaMars,
	types.DashaRahu, types.DashaJupiter, types.DashaSaturn, types.DashaMercury,
}

const msPerYear float64 = 365.25 * 24 * 3600 * 1000

// resolveMoonLongitude wraps a finite longitude into [0, 360), so 360 reads as
// 0 and -0.5 as 359.5; it is the identity on [0, 360).
func resolveMoonLongitude(moonSiderealLon float64) (float64, error) {
	if math.IsNaN(moonSiderealLon) || math.IsInf(moonSiderealLon, 0) {
		return 0, types.Codef(types.ErrInvalidInput,
			"moonSiderealLon must be a finite number, got %s", jsnum.FormatFloat(moonSiderealLon))
	}
	return utils.Normalize360(moonSiderealLon), nil
}

func ComputeVimshottariDasha(birthMs int64, moonSiderealLon float64, asOfMs int64) (types.VimshottariDashaResult, error) {
	moonSiderealLon, err := resolveMoonLongitude(moonSiderealLon)
	if err != nil {
		return types.VimshottariDashaResult{}, err
	}
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.VimshottariDashaResult{}, err
	}
	nakIdx := utils.NakshatraOf(moonSiderealLon)
	degInNak := moonSiderealLon - float64(float64(nakIdx)*utils.NakshatraSpan)
	elapsedFraction := degInNak / utils.NakshatraSpan

	startLord := NakshatraLord[nakIdx]
	startLordIdx := int(startLord)
	startLordYears := DashaYears[startLord]

	balanceMs := float64((1 - elapsedFraction) * startLordYears * msPerYear)

	mahaDashas := make([]types.MahaDasha, 0, 9)
	cursor := birthMs

	for i := 0; i < 9; i++ {
		lord := DashaOrder[(startLordIdx+i)%9]
		years := DashaYears[lord]
		fullDurationMs := float64(years * msPerYear)

		startDate := cursor
		var endDate int64
		var antarDashas []types.AntarDasha

		if i == 0 {
			endDate = int64(float64(cursor) + balanceMs)
			virtualStart := int64(float64(birthMs) - (fullDurationMs - balanceMs))
			antarDashas = buildAntarDashas(lord, virtualStart, fullDurationMs, startDate, endDate)
		} else {
			endDate = int64(float64(cursor) + fullDurationMs)
			antarDashas = buildAntarDashas(lord, startDate, fullDurationMs, startDate, endDate)
		}

		mahaDashas = append(mahaDashas, types.MahaDasha{
			Lord: lord, StartDate: types.Date(startDate), EndDate: types.Date(endDate),
			Years: years, AntarDashas: antarDashas,
		})
		cursor = endDate
	}

	idx := currentPeriodIndex(len(mahaDashas), asOfMs, func(i int) (int64, int64) {
		return mahaDashas[i].StartDate.Ms(), mahaDashas[i].EndDate.Ms()
	})
	return types.VimshottariDashaResult{
		CurrentMahaDashaLord: mahaDashas[idx].Lord,
		CurrentIndex:         idx,
		MahaDashas:           mahaDashas,
	}, nil
}

func ComputeVimshottariDashaFromBirth(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	ayanamsaType types.AyanamsaType,
	asOfMs int64,
) (types.VimshottariDashaResult, error) {
	moonSid, err := astronomy.GetSiderealMoonLongitude(ctx, birthMs, resolveAyanamsa(ayanamsaType))
	if err != nil {
		return types.VimshottariDashaResult{}, err
	}
	return ComputeVimshottariDasha(birthMs, moonSid, asOfMs)
}

func ComputeVimshottariPratyantar(antardasha types.AntarDasha) ([]types.PratyantarDasha, error) {
	if !antardasha.Lord.Valid() {
		return nil, types.Codef(types.ErrInvalidInput,
			"Invalid antardasha lord: %s", antardasha.Lord)
	}
	startMs := antardasha.StartDate.Ms()
	endMs := antardasha.EndDate.Ms()
	return buildPratyantars(int(antardasha.Lord), float64(endMs-startMs), float64(startMs), startMs, endMs), nil
}

func ComputeVimshottariPratyantarIn(mahaDasha types.MahaDasha, antardasha types.AntarDasha) ([]types.PratyantarDasha, error) {
	if !antardasha.Lord.Valid() {
		return nil, types.Codef(types.ErrInvalidInput,
			"Invalid antardasha lord: %s", antardasha.Lord)
	}
	if !mahaDasha.Lord.Valid() {
		return nil, types.Codef(types.ErrInvalidInput,
			"Invalid mahadasha lord: %s", mahaDasha.Lord)
	}
	startMs := antardasha.StartDate.Ms()
	endMs := antardasha.EndDate.Ms()
	spanMs := float64(endMs - startMs)
	mahaFullMs := float64(DashaYears[mahaDasha.Lord] * msPerYear)
	fullMs := float64((DashaYears[antardasha.Lord] / 120) * mahaFullMs)
	splitMs := spanMs
	if fullMs-spanMs > 1 {
		splitMs = fullMs
	}
	return buildPratyantars(int(antardasha.Lord), splitMs, float64(endMs)-splitMs, startMs, endMs), nil
}

func buildPratyantars(lordIdx int, fullMs, virtualStartMs float64, clipStartMs, endMs int64) []types.PratyantarDasha {
	var lords [9]types.DashaLord
	var lengthsMs [9]float64
	for i := 0; i < 9; i++ {
		subLord := DashaOrder[(lordIdx+i)%9]
		lords[i] = subLord
		lengthsMs[i] = float64((DashaYears[subLord] / 120) * fullMs)
	}
	spans := tileSubPeriods(lengthsMs[:], virtualStartMs, clipStartMs, endMs)
	out := make([]types.PratyantarDasha, 0, len(spans))
	for _, p := range spans {
		out = append(out, types.PratyantarDasha{
			Lord: lords[p.index], StartDate: types.Date(p.start), EndDate: types.Date(p.end),
		})
	}
	return out
}

type subPeriod struct {
	index      int
	start, end int64
}

func tileSubPeriods(lengthsMs []float64, virtualStartMs float64, clipStartMs, endMs int64) []subPeriod {
	out := make([]subPeriod, 0, len(lengthsMs))
	last := len(lengthsMs) - 1
	cursor := virtualStartMs
	for i, length := range lengthsMs {
		start := cursor
		cursor = cursor + length
		end := cursor
		if i == last {
			end = float64(endMs)
		}
		if end <= float64(clipStartMs) {
			continue
		}
		if start < float64(clipStartMs) {
			start = float64(clipStartMs)
		}
		out = append(out, subPeriod{index: i, start: int64(start), end: int64(end)})
	}
	return out
}

func buildAntarDashas(mahaLord types.DashaLord, mahaVirtualStart int64, mahaFullDurationMs float64, clipStartMs, mahaEndMs int64) []types.AntarDasha {
	mahaIdx := int(mahaLord)
	var lords [9]types.DashaLord
	var lengthsMs [9]float64
	for i := 0; i < 9; i++ {
		antarLord := DashaOrder[(mahaIdx+i)%9]
		lords[i] = antarLord
		lengthsMs[i] = float64((DashaYears[antarLord] / 120) * mahaFullDurationMs)
	}
	spans := tileSubPeriods(lengthsMs[:], float64(mahaVirtualStart), clipStartMs, mahaEndMs)
	antarDashas := make([]types.AntarDasha, 0, len(spans))
	for _, p := range spans {
		antarDashas = append(antarDashas, types.AntarDasha{
			Lord: lords[p.index], StartDate: types.Date(p.start), EndDate: types.Date(p.end),
		})
	}
	return antarDashas
}

var AshtottariOrder = [8]types.DashaLord{
	types.DashaSun, types.DashaMoon, types.DashaMars, types.DashaMercury,
	types.DashaSaturn, types.DashaJupiter, types.DashaRahu, types.DashaVenus,
}

var AshtottariYears = [types.DashaLordCount]float64{
	types.DashaSun: 6, types.DashaMoon: 15, types.DashaMars: 8, types.DashaMercury: 17,
	types.DashaSaturn: 10, types.DashaJupiter: 19, types.DashaRahu: 12, types.DashaVenus: 21,
}

const ashtottariTotalYears float64 = 108

var AshtottariNakshatraGroups = [8][]int{
	{5, 6, 7, 8},
	{9, 10, 11},
	{12, 13, 14, 15},
	{16, 17, 18},
	{19, 20, 21},
	{22, 23, 24},
	{25, 26, 0, 1},
	{2, 3, 4},
}

func ComputeAshtottariDasha(birthMs int64, moonSiderealLon float64, asOfMs int64) (types.VimshottariDashaResult, error) {
	moonSiderealLon, err := resolveMoonLongitude(moonSiderealLon)
	if err != nil {
		return types.VimshottariDashaResult{}, err
	}
	if err := utils.ValidateDate(birthMs); err != nil {
		return types.VimshottariDashaResult{}, err
	}
	nakIdx := utils.NakshatraOf(moonSiderealLon)
	degInNak := moonSiderealLon - float64(float64(nakIdx)*utils.NakshatraSpan)
	elapsedInNak := degInNak / utils.NakshatraSpan

	lordIdx, posInGroup := -1, -1
	for gi, group := range AshtottariNakshatraGroups {
		for pi, n := range group {
			if n == nakIdx {
				lordIdx, posInGroup = gi, pi
			}
		}
	}
	if lordIdx < 0 {
		return types.VimshottariDashaResult{}, types.Codef(types.ErrInvalidInput,
			"nakshatra %d belongs to no Ashtottari group", nakIdx)
	}
	group := AshtottariNakshatraGroups[lordIdx]
	startLord := AshtottariOrder[lordIdx]
	elapsedInLord := (float64(posInGroup) + elapsedInNak) / float64(len(group))
	balanceMs := float64((1 - elapsedInLord) * AshtottariYears[startLord] * msPerYear)

	mahaDashas := make([]types.MahaDasha, 0, 8)
	cursor := birthMs
	for i := 0; i < 8; i++ {
		lord := AshtottariOrder[(lordIdx+i)%8]
		years := AshtottariYears[lord]
		fullDurationMs := float64(years * msPerYear)
		durationMs := fullDurationMs
		if i == 0 {
			durationMs = balanceMs
		}
		startDate := cursor
		endDate := int64(float64(cursor) + durationMs)
		virtualStart := startDate
		if i == 0 {
			virtualStart = int64(float64(birthMs) - (fullDurationMs - balanceMs))
		}
		mahaDashas = append(mahaDashas, types.MahaDasha{
			Lord: lord, StartDate: types.Date(startDate), EndDate: types.Date(endDate),
			Years: years, AntarDashas: buildAshtottariAntarDashas(lord, virtualStart, fullDurationMs, startDate, endDate),
		})
		cursor = endDate
	}

	idx := currentPeriodIndex(len(mahaDashas), asOfMs, func(i int) (int64, int64) {
		return mahaDashas[i].StartDate.Ms(), mahaDashas[i].EndDate.Ms()
	})
	return types.VimshottariDashaResult{
		CurrentMahaDashaLord: mahaDashas[idx].Lord,
		CurrentIndex:         idx,
		MahaDashas:           mahaDashas,
	}, nil
}

func buildAshtottariAntarDashas(mahaLord types.DashaLord, mahaVirtualStart int64, mahaFullDurationMs float64, clipStartMs, mahaEndMs int64) []types.AntarDasha {
	mahaIdx := 0
	for i, l := range AshtottariOrder {
		if l == mahaLord {
			mahaIdx = i
		}
	}
	var lords [8]types.DashaLord
	var lengthsMs [8]float64
	for i := 0; i < 8; i++ {
		antarLord := AshtottariOrder[(mahaIdx+i)%8]
		lords[i] = antarLord
		lengthsMs[i] = float64((AshtottariYears[antarLord] / ashtottariTotalYears) * mahaFullDurationMs)
	}
	spans := tileSubPeriods(lengthsMs[:], float64(mahaVirtualStart), clipStartMs, mahaEndMs)
	out := make([]types.AntarDasha, 0, len(spans))
	for _, p := range spans {
		out = append(out, types.AntarDasha{
			Lord: lords[p.index], StartDate: types.Date(p.start), EndDate: types.Date(p.end),
		})
	}
	return out
}

var YoginiOrder = [8]YoginiName{
	YoginiMangala, YoginiPingala, YoginiDhanya, YoginiBhramari,
	YoginiBhadrika, YoginiUlka, YoginiSiddha, YoginiSankata,
}

var YoginiYears = [8]float64{1, 2, 3, 4, 5, 6, 7, 8}

var YoginiPlanet = [8]types.DashaLord{
	types.DashaMoon,
	types.DashaSun,
	types.DashaJupiter,
	types.DashaMars,
	types.DashaMercury,
	types.DashaSaturn,
	types.DashaVenus,
	types.DashaRahu,
}

const yoginiTotalYears float64 = 36

func ComputeYoginiDasha(birthMs int64, moonSiderealLon float64, asOfMs int64) (YoginiDashaResult, error) {
	moonSiderealLon, err := resolveMoonLongitude(moonSiderealLon)
	if err != nil {
		return YoginiDashaResult{}, err
	}
	if err := utils.ValidateDate(birthMs); err != nil {
		return YoginiDashaResult{}, err
	}
	nakIdx := utils.NakshatraOf(moonSiderealLon)
	degInNak := moonSiderealLon - float64(float64(nakIdx)*utils.NakshatraSpan)
	elapsedFraction := degInNak / utils.NakshatraSpan

	startYoginiIdx := (nakIdx + 3) % 8
	balanceMs := float64((1 - elapsedFraction) * YoginiYears[startYoginiIdx] * msPerYear)

	mahaDashas := make([]YoginiMahaDasha, 0, 8)
	cursor := birthMs
	for i := 0; i < 8; i++ {
		idx := (startYoginiIdx + i) % 8
		fullDurationMs := float64(YoginiYears[idx] * msPerYear)
		durationMs := fullDurationMs
		if i == 0 {
			durationMs = balanceMs
		}
		startDate := cursor
		endDate := int64(float64(cursor) + durationMs)
		virtualStart := startDate
		if i == 0 {
			virtualStart = int64(float64(birthMs) - (fullDurationMs - balanceMs))
		}
		mahaDashas = append(mahaDashas, YoginiMahaDasha{
			Yogini: YoginiOrder[idx], Lord: YoginiPlanet[idx],
			StartDate: types.Date(startDate), EndDate: types.Date(endDate),
			Years:       YoginiYears[idx],
			AntarDashas: buildYoginiAntarDashas(YoginiOrder[idx], virtualStart, fullDurationMs, startDate, endDate),
		})
		cursor = endDate
	}

	idx := currentPeriodIndex(len(mahaDashas), asOfMs, func(i int) (int64, int64) {
		return mahaDashas[i].StartDate.Ms(), mahaDashas[i].EndDate.Ms()
	})
	return YoginiDashaResult{
		CurrentYogini: mahaDashas[idx].Yogini,
		CurrentIndex:  idx,
		MahaDashas:    mahaDashas,
	}, nil
}

func buildYoginiAntarDashas(mahaYogini YoginiName, mahaVirtualStart int64, mahaFullDurationMs float64, clipStartMs, mahaEndMs int64) []YoginiAntarDasha {
	mahaIdx := 0
	for i, y := range YoginiOrder {
		if y == mahaYogini {
			mahaIdx = i
		}
	}
	var lengthsMs [8]float64
	for i := 0; i < 8; i++ {
		lengthsMs[i] = float64((YoginiYears[(mahaIdx+i)%8] / yoginiTotalYears) * mahaFullDurationMs)
	}
	spans := tileSubPeriods(lengthsMs[:], float64(mahaVirtualStart), clipStartMs, mahaEndMs)
	out := make([]YoginiAntarDasha, 0, len(spans))
	for _, p := range spans {
		idx := (mahaIdx + p.index) % 8
		out = append(out, YoginiAntarDasha{
			Yogini: YoginiOrder[idx], Lord: YoginiPlanet[idx],
			StartDate: types.Date(p.start), EndDate: types.Date(p.end),
		})
	}
	return out
}

var CharaRashiYears = [12]float64{
	9,
	8,
	7,
	9,
	8,
	7,
	9,
	8,
	7,
	9,
	8,
	7,
}

var charaRashiLord = [12]types.DashaLord{
	types.DashaMars,
	types.DashaVenus,
	types.DashaMercury,
	types.DashaMoon,
	types.DashaSun,
	types.DashaMercury,
	types.DashaVenus,
	types.DashaMars,
	types.DashaJupiter,
	types.DashaSaturn,
	types.DashaSaturn,
	types.DashaJupiter,
}

func ComputeCharaDasha(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsa types.AyanamsaType,
	asOfMs int64,
) (CharaDashaResult, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return CharaDashaResult{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return CharaDashaResult{}, err
	}

	lagna, err := ComputeLagna(ctx, birthMs, location, resolveAyanamsa(ayanamsa), types.LanguageEn)
	if err != nil {
		return CharaDashaResult{}, err
	}
	startRashi := lagna.Rashi.Index

	mahaDashas := make([]CharaMahaDasha, 0, 12)
	cursor := birthMs
	for i := 0; i < 12; i++ {
		rashi := (startRashi + i) % 12
		years := CharaRashiYears[rashi]
		startDate := cursor
		endDate := int64(float64(cursor) + float64(years*msPerYear))
		mahaDashas = append(mahaDashas, CharaMahaDasha{
			Rashi: rashi, Lord: charaRashiLord[rashi],
			StartDate: types.Date(startDate), EndDate: types.Date(endDate), Years: years,
		})
		cursor = endDate
	}

	idx := currentPeriodIndex(len(mahaDashas), asOfMs, func(i int) (int64, int64) {
		return mahaDashas[i].StartDate.Ms(), mahaDashas[i].EndDate.Ms()
	})
	return CharaDashaResult{
		CurrentIndex: idx, CurrentRashi: mahaDashas[idx].Rashi, MahaDashas: mahaDashas,
	}, nil
}

var VishamaPadaRashis = [12]bool{0: true, 1: true, 2: true, 6: true, 7: true, 8: true}

var SamaPadaRashis = [12]bool{3: true, 4: true, 5: true, 9: true, 10: true, 11: true}

func ComputeNarayanDasha(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsa types.AyanamsaType,
	asOfMs int64,
) (NarayanDashaResult, error) {
	return narayanDasha(ctx, birthMs, location, ayanamsa, asOfMs, false)
}

func ComputeNarayanDashaVariable(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsa types.AyanamsaType,
	asOfMs int64,
) (NarayanDashaResult, error) {
	return narayanDasha(ctx, birthMs, location, ayanamsa, asOfMs, true)
}

func narayanDasha(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	ayanamsa types.AyanamsaType,
	asOfMs int64,
	variable bool,
) (NarayanDashaResult, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return NarayanDashaResult{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return NarayanDashaResult{}, err
	}
	ayanamsa = resolveAyanamsa(ayanamsa)

	lagna, err := ComputeLagna(ctx, birthMs, location, ayanamsa, types.LanguageEn)
	if err != nil {
		return NarayanDashaResult{}, err
	}
	startingRashi := lagna.Rashi.Index
	direction := NarayanBackward
	if VishamaPadaRashis[startingRashi] {
		direction = NarayanForward
	}

	durationFor := func(rashi int) float64 { return CharaRashiYears[rashi] }
	if variable {
		durationFor, err = buildVariableDurationFn(ctx, birthMs, ayanamsa)
		if err != nil {
			return NarayanDashaResult{}, err
		}
	}

	mahaDashas := make([]NarayanMahaDasha, 0, 12)
	cursor := birthMs
	for i := 0; i < 12; i++ {
		rashi := (startingRashi + i) % 12
		if direction == NarayanBackward {
			rashi = (startingRashi - i + 12) % 12
		}
		years := durationFor(rashi)
		startDate := cursor
		endDate := int64(float64(cursor) + float64(years*msPerYear))
		mahaDashas = append(mahaDashas, NarayanMahaDasha{
			Rashi: rashi, Lord: charaRashiLord[rashi],
			StartDate: types.Date(startDate), EndDate: types.Date(endDate), Years: years,
		})
		cursor = endDate
	}

	idx := currentPeriodIndex(len(mahaDashas), asOfMs, func(i int) (int64, int64) {
		return mahaDashas[i].StartDate.Ms(), mahaDashas[i].EndDate.Ms()
	})
	return NarayanDashaResult{
		Direction: direction, StartingRashi: startingRashi,
		CurrentIndex: idx, CurrentRashi: mahaDashas[idx].Rashi, MahaDashas: mahaDashas,
	}, nil
}

var narayanExaltationRashi = [types.GrahaCount]int{
	types.GrahaSun: 0, types.GrahaMoon: 1, types.GrahaMars: 9, types.GrahaMercury: 5,
	types.GrahaJupiter: 3, types.GrahaVenus: 11, types.GrahaSaturn: 6,
	types.GrahaRahu: 2, types.GrahaKetu: 8,
}

var narayanDebilitationRashi = [types.GrahaCount]int{
	types.GrahaSun: 6, types.GrahaMoon: 7, types.GrahaMars: 3, types.GrahaMercury: 11,
	types.GrahaJupiter: 9, types.GrahaVenus: 5, types.GrahaSaturn: 0,
	types.GrahaRahu: 8, types.GrahaKetu: 2,
}

var rashiPrimaryLord = [12]types.Graha{
	types.GrahaMars, types.GrahaVenus, types.GrahaMercury, types.GrahaMoon,
	types.GrahaSun, types.GrahaMercury, types.GrahaVenus, types.GrahaMars,
	types.GrahaJupiter, types.GrahaSaturn, types.GrahaSaturn, types.GrahaJupiter,
}

var rashiModality = [12]int{0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2}

func rasiDrishti(aspectingRashi, targetRashi int) bool {
	if aspectingRashi == targetRashi {
		return false
	}
	if (aspectingRashi+1)%12 == targetRashi || (targetRashi+1)%12 == aspectingRashi {
		return false
	}
	aMod := rashiModality[aspectingRashi]
	tMod := rashiModality[targetRashi]
	switch aMod {
	case 2:
		return tMod == 2
	case 0:
		return tMod == 1
	case 1:
		return tMod == 0
	}
	return false
}

func inclusiveSignCount(src, dst int, anti bool) int {
	if anti {
		return ((src-dst+12)%12 + 1)
	}
	return ((dst-src+12)%12 + 1)
}

func planetsInRashi(planetRashi *[types.GrahaCount]int, rashi int) int {
	n := 0
	for _, r := range planetRashi {
		if r == rashi {
			n++
		}
	}
	return n
}

func countMJLAspectFactors(rashi int, planetRashi *[types.GrahaCount]int) int {
	factors := 0
	if rasiDrishti(planetRashi[types.GrahaMercury], rashi) {
		factors++
	}
	if rasiDrishti(planetRashi[types.GrahaJupiter], rashi) {
		factors++
	}
	if rasiDrishti(planetRashi[rashiPrimaryLord[rashi]], rashi) {
		factors++
	}
	return factors
}

func compareRashiStrength(rashiA, rashiB int, planetRashi *[types.GrahaCount]int) int {
	pa := planetsInRashi(planetRashi, rashiA)
	pb := planetsInRashi(planetRashi, rashiB)
	if pa > pb {
		return 1
	}
	if pa < pb {
		return -1
	}
	fa := countMJLAspectFactors(rashiA, planetRashi)
	fb := countMJLAspectFactors(rashiB, planetRashi)
	if fa > fb {
		return 1
	}
	if fa < fb {
		return -1
	}
	return 0
}

// buildVariableDurationFn reads each graha's rashi as the birth chart gives it
// (mean node), from the longitudes alone: the chart's retrograde probes, lagna
// and houses do not reach a rashi, and every error they could raise has been
// raised by narayanDasha's own lagna before this runs.
func buildVariableDurationFn(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	ayanamsa types.AyanamsaType,
) (func(int) float64, error) {
	lon, err := siderealGrahaLongitudes(ctx, birthMs, ayanamsa, NodeMean)
	if err != nil {
		return nil, err
	}
	var planetRashi [types.GrahaCount]int
	for g, l := range lon {
		planetRashi[g] = int(math.Floor(l / 30))
	}

	baseAndAdjust := func(rashi int, lord types.Graha, lordRashi int) float64 {
		anti := !VishamaPadaRashis[rashi]
		years := 12
		if lordRashi != rashi {
			years = inclusiveSignCount(rashi, lordRashi, anti) - 1
		}
		if narayanExaltationRashi[lord] == lordRashi {
			years++
		} else if narayanDebilitationRashi[lord] == lordRashi {
			years--
		}
		if years > 12 {
			years = 12
		}
		if years < 0 {
			years = 0
		}
		return float64(years)
	}

	return func(rashi int) float64 {
		if rashi == 7 || rashi == 10 {
			lordA, lordB := types.GrahaMars, types.GrahaKetu
			if rashi == 10 {
				lordA, lordB = types.GrahaSaturn, types.GrahaRahu
			}
			ra := planetRashi[lordA]
			rb := planetRashi[lordB]

			switch {
			case ra == rashi && rb == rashi:
				return 12
			case ra == rb:
				return baseAndAdjust(rashi, lordA, ra)
			case ra == rashi:
				return baseAndAdjust(rashi, lordB, rb)
			case rb == rashi:
				return baseAndAdjust(rashi, lordA, ra)
			}

			cmp := compareRashiStrength(ra, rb, &planetRashi)
			if cmp > 0 {
				return baseAndAdjust(rashi, lordA, ra)
			}
			if cmp < 0 {
				return baseAndAdjust(rashi, lordB, rb)
			}
			return baseAndAdjust(rashi, lordA, ra)
		}

		lord := rashiPrimaryLord[rashi]
		return baseAndAdjust(rashi, lord, planetRashi[lord])
	}, nil
}

func currentPeriodIndex(n int, asOfMs int64, bounds func(int) (int64, int64)) int {
	for i := 0; i < n; i++ {
		start, end := bounds(i)
		if asOfMs >= start && asOfMs < end {
			return i
		}
	}
	return 0
}
