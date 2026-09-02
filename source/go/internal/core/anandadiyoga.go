package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeAnandadiYoga(varaIndex, nakshatraIndex int, lang types.Language) (types.AnandadiYogaInfo, error) {
	if err := utils.AssertVaraIndex(varaIndex, ""); err != nil {
		return types.AnandadiYogaInfo{}, err
	}
	if err := utils.AssertNakshatraIndex(nakshatraIndex, ""); err != nil {
		return types.AnandadiYogaInfo{}, err
	}

	index := utils.AnandadiTable[varaIndex][nakshatraIndex]
	return types.AnandadiYogaInfo{
		Index:   index,
		Name:    i18n.ResolveAnandadiYogaName(index, lang),
		Quality: utils.AnandadiQuality[index],
	}, nil
}
