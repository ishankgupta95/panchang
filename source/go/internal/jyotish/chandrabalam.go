package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var strongHouses = [13]bool{1: true, 3: true, 6: true, 7: true, 10: true, 11: true}

func ComputeChandraBalam(
	janmaRashiIndex, transitMoonRashiIndex int,
	lang types.Language,
) (types.ChandraBalamInfo, error) {
	if janmaRashiIndex < 0 || janmaRashiIndex > 11 {
		return types.ChandraBalamInfo{}, types.Codef(types.ErrInvalidInput,
			"janmaRashiIndex must be integer in [0, 11], got %d", janmaRashiIndex)
	}
	if transitMoonRashiIndex < 0 || transitMoonRashiIndex > 11 {
		return types.ChandraBalamInfo{}, types.Codef(types.ErrInvalidInput,
			"transitMoonRashiIndex must be integer in [0, 11], got %d", transitMoonRashiIndex)
	}

	house := ((transitMoonRashiIndex - janmaRashiIndex + 12) % 12) + 1
	quality := types.ChandraBalamWeak
	englishName := "Ashubha"
	if strongHouses[house] {
		quality = types.ChandraBalamStrong
		englishName = "Shubha"
	}
	t := i18n.GetTranslations(lang)
	name := t.ChandraBalamNames.Ashubha
	if quality == types.ChandraBalamStrong {
		name = t.ChandraBalamNames.Shubha
	}

	return types.ChandraBalamInfo{
		House:       house,
		Quality:     quality,
		EnglishName: englishName,
		Name:        name,
	}, nil
}
