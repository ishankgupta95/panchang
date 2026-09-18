// Package jyotish computes charts and everything read off them: lagna and bhava
// cusps, divisional charts, planetary strengths, aspects, arudhas, yogas, the
// dasha systems, and horoscope matching.
package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/types"

var argalaOffsets = [3]int{1, 3, 10} // argala houses 2, 4 and 11, 0-based

var virodhargalaOffsets = [3]int{2, 9, 11} // virodhargala houses 3, 10 and 12, 0-based

const (
	trikonaSourceOffset    = 4 // the 5th from the bhava
	trikonaVirodhakaOffset = 8 // the 9th from the bhava
)

func containsOffset(list [3]int, v int) bool {
	return list[0] == v || list[1] == v || list[2] == v
}

func ComputeArgala(chart *types.BirthChart) []types.ArgalaPerBhava {
	return computeArgala(chart, false)
}

func ComputeArgalaWithTrikonargala(chart *types.BirthChart) []types.ArgalaPerBhava {
	return computeArgala(chart, true)
}

func computeArgala(chart *types.BirthChart, includeTrikona bool) []types.ArgalaPerBhava {
	planets := chart.Planets

	out := make([]types.ArgalaPerBhava, 0, 12)
	for bhava := 1; bhava <= 12; bhava++ {
		argala := make([]types.PlanetPlacement, 0, len(planets))
		virodhargala := make([]types.PlanetPlacement, 0, len(planets))
		trikonaSources := make([]types.PlanetPlacement, 0, len(planets))
		trikonaVirodhakas := make([]types.PlanetPlacement, 0, len(planets))

		for _, p := range planets {
			offset := ((p.House - bhava) + 12) % 12
			if containsOffset(argalaOffsets, offset) {
				argala = append(argala, p)
			} else if containsOffset(virodhargalaOffsets, offset) {
				virodhargala = append(virodhargala, p)
			}

			if includeTrikona {
				isFifth := offset == trikonaSourceOffset
				isNinth := offset == trikonaVirodhakaOffset
				if isFifth || isNinth {
					isKetu := p.Planet == types.GrahaKetu
					if (isFifth && !isKetu) || (isNinth && isKetu) {
						trikonaSources = append(trikonaSources, p)
					} else {
						trikonaVirodhakas = append(trikonaVirodhakas, p)
					}
				}
			}
		}

		entry := types.ArgalaPerBhava{Bhava: bhava, Argala: argala, Virodhargala: virodhargala}
		if includeTrikona {
			entry.Trikona = &types.ArgalaTrikona{
				Sources: trikonaSources, Virodhakas: trikonaVirodhakas,
			}
		}
		out = append(out, entry)
	}
	return out
}
