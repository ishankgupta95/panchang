package core

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeVara(dateUtcMs, sunriseUtcMs int64, varaNames [7]types.VaraName) types.VaraInfo {
	d := dateUtcMs
	if dateUtcMs < sunriseUtcMs {
		d = dateUtcMs - 86_400_000
	}
	index := types.Date(d).UTCDay()
	return types.VaraInfo{
		Index:       index,
		Name:        varaNames[index].Name,
		ShortName:   varaNames[index].Short,
		EnglishName: utils.EnglishDayNames[index],
	}
}
