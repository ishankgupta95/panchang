package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeSpecialYogas(
	varaIndex, tithiIndex, nakshatraIndex, suryaNakshatraIndex int,
	nameResolver func(t types.SpecialYogaType) string,
) ([]types.SpecialYogaInfo, error) {
	if err := utils.AssertVaraIndex(varaIndex, ""); err != nil {
		return nil, err
	}
	if err := utils.AssertTithiIndex(tithiIndex, ""); err != nil {
		return nil, err
	}
	if err := utils.AssertNakshatraIndex(nakshatraIndex, ""); err != nil {
		return nil, err
	}
	if err := utils.AssertNakshatraIndex(suryaNakshatraIndex, "suryaNakshatraIndex"); err != nil {
		return nil, err
	}

	// Non-nil so it marshals as [].
	results := make([]types.SpecialYogaInfo, 0, 2)
	add := func(t types.SpecialYogaType) {
		results = append(results, types.SpecialYogaInfo{Name: nameResolver(t), Type: t})
	}

	tithiNumber := (tithiIndex % 15) + 1

	if amritSiddhiTable[varaIndex] == nakshatraIndex {
		add(types.YogaAmritSiddhi)
	}

	if sarvarthaSiddhiTable[varaIndex][nakshatraIndex] {
		add(types.YogaSarvarthaSiddhi)
	}

	if varaIndex == 0 && nakshatraIndex == 7 {
		add(types.YogaRaviPushya)
	}

	if varaIndex == 4 && nakshatraIndex == 7 {
		add(types.YogaGuruPushya)
	}

	if pushkarVaras[varaIndex] && pushkarBhadraTithis[tithiNumber] && dwipushkarNakshatras[nakshatraIndex] {
		add(types.YogaDwipushkar)
	}

	if pushkarVaras[varaIndex] && pushkarBhadraTithis[tithiNumber] && tripushkarNakshatras[nakshatraIndex] {
		add(types.YogaTripushkar)
	}

	if row := jwalamukhiTable[tithiNumber]; row != nil && row[nakshatraIndex] {
		add(types.YogaJwalamukhi)
	}

	moonNak28 := to28(nakshatraIndex)
	sunNak28 := to28(suryaNakshatraIndex)
	distance28 := ((moonNak28 - sunNak28 + 28) % 28) + 1
	if aadalDistances[distance28] {
		add(types.YogaAadal)
	}
	if vidaalDistances[distance28] {
		add(types.YogaVidaal)
	}

	distance27 := ((nakshatraIndex - suryaNakshatraIndex + utils.TotalNakshatras) % utils.TotalNakshatras) + 1
	if raviDistances[distance27] {
		add(types.YogaRavi)
	}

	return results, nil
}
