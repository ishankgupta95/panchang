package jyotish

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func ComputeArudhas(chart *types.BirthChart, lang types.Language) ([]types.Arudha, error) {
	lang = resolveLang(lang)
	lagnaRashi := chart.Lagna.Rashi.Index
	if lagnaRashi < 0 {
		return nil, types.Codef(types.ErrInvalidInput,
			"lagna rashi must be a non-negative integer, got %d", lagnaRashi)
	}

	var planetRashi [types.VisibleGrahaCount]int
	var seen [types.VisibleGrahaCount]bool
	for _, p := range chart.Planets {
		v, ok := p.Planet.Visible()
		if !ok {
			continue
		}
		planetRashi[v] = p.Rashi.Index
		seen[v] = true
	}
	for _, v := range allVisibleGrahas {
		if !seen[v] {
			return nil, types.Codef(types.ErrInvalidInput,
				"chart is missing %s, which the Arudha rule needs to locate a bhava lord", v)
		}
	}

	out := make([]types.Arudha, 0, 12)
	for bhava := 1; bhava <= 12; bhava++ {
		bhavaRashi := (lagnaRashi + bhava - 1) % 12
		bhavaLord := RashiLord[bhavaRashi]
		lordRashi := planetRashi[bhavaLord]

		d := ((lordRashi-bhavaRashi+12)%12 + 1)

		arudhaRashi := (lordRashi + d - 1) % 12

		offsetFromBhava := (arudhaRashi - bhavaRashi + 12) % 12
		if offsetFromBhava == 0 {
			arudhaRashi = (arudhaRashi + 9) % 12 // 10th from the pada
		} else if offsetFromBhava == 6 {
			arudhaRashi = (arudhaRashi + 3) % 12 // 4th from the pada
		}

		arudhaLord := RashiLord[arudhaRashi]

		out = append(out, types.Arudha{
			Bhava:           bhava,
			ArudhaRashi:     arudhaRashi,
			ArudhaRashiName: i18n.ResolveMasaName(arudhaRashi, lang),
			ArudhaLord:      arudhaLord,
		})
	}
	return out, nil
}
