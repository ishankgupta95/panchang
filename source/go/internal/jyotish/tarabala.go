package jyotish

import (
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

var taraEnglishNames = [9]string{
	"Janma",
	"Sampat",
	"Vipat",
	"Kshema",
	"Pratyari",
	"Sadhaka",
	"Vadha",
	"Mitra",
	"Ati-Mitra",
}

var inauspiciousTaras = [9]bool{2: true, 4: true, 6: true}

func ComputeTarabala(
	janmaNakshatraIndex, transitNakshatraIndex int,
	lang types.Language,
) (types.TarabalaInfo, error) {
	if err := utils.AssertNakshatraIndex(janmaNakshatraIndex, "janmaNakshatraIndex"); err != nil {
		return types.TarabalaInfo{}, err
	}
	if err := utils.AssertNakshatraIndex(transitNakshatraIndex, "transitNakshatraIndex"); err != nil {
		return types.TarabalaInfo{}, err
	}

	taraIndex := (transitNakshatraIndex - janmaNakshatraIndex + utils.TotalNakshatras) % 9
	quality := types.TarabalaAuspicious
	if inauspiciousTaras[taraIndex] {
		quality = types.TarabalaInauspicious
	}

	return types.TarabalaInfo{
		TaraIndex:   taraIndex,
		EnglishName: taraEnglishNames[taraIndex],
		Name:        i18n.GetTranslations(lang).Tarabala(taraIndex),
		Quality:     quality,
	}, nil
}
