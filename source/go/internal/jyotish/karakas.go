package jyotish

import (
	"sort"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var karakaGrahas7 = types.AllVisibleGrahas

var karakaGrahas7Required = func() []types.Graha {
	out := make([]types.Graha, len(karakaGrahas7))
	for i, v := range karakaGrahas7 {
		out[i] = v.Graha()
	}
	return out
}()

// Rahu last, so it loses every tie.
var karakaGrahas8 = [8]types.Graha{
	types.GrahaSun, types.GrahaMoon, types.GrahaMars, types.GrahaMercury,
	types.GrahaJupiter, types.GrahaVenus, types.GrahaSaturn, types.GrahaRahu,
}

type rankedGraha struct {
	graha  types.Graha
	degree float64
}

// Stable, never sort.Slice: the tie-break rests on input order.
func sortKarakasStable(ranked []rankedGraha) {
	sort.SliceStable(ranked, func(i, j int) bool {
		return ranked[i].degree > ranked[j].degree
	})
}

// BPHS Ch. 32; Ketu is in neither variant.
func ComputeJaiminiKarakas(chart *types.BirthChart) (types.JaiminiKarakas, error) {
	byPlanet, err := karakaPlanetIndex(chart, karakaGrahas7Required)
	if err != nil {
		return types.JaiminiKarakas{}, err
	}
	ranked := make([]rankedGraha, 0, len(karakaGrahas7))
	for _, v := range karakaGrahas7 {
		g := v.Graha()
		ranked = append(ranked, rankedGraha{graha: g, degree: byPlanet[g].DegreeInRashi})
	}
	sortKarakasStable(ranked)

	var result types.JaiminiKarakas
	for i := range types.AllKarakaNames {
		result.SetRank(i, ranked[i].graha)
	}
	return result, nil
}

// Jaimini, Upadesa Sutras 1.10.
func ComputeJaimini8Karakas(chart *types.BirthChart) (types.Jaimini8Karakas, error) {
	byPlanet, err := karakaPlanetIndex(chart, karakaGrahas8[:])
	if err != nil {
		return types.Jaimini8Karakas{}, err
	}
	ranked := make([]rankedGraha, 0, len(karakaGrahas8))
	for _, g := range karakaGrahas8 {
		degree := byPlanet[g].DegreeInRashi
		if g == types.GrahaRahu {
			degree = 30 - degree // permanently retrograde: measured from the upper boundary
		}
		ranked = append(ranked, rankedGraha{graha: g, degree: degree})
	}
	sortKarakasStable(ranked)

	var result types.Jaimini8Karakas
	for i := range types.AllKaraka8Names {
		result.SetRank(i, ranked[i].graha)
	}
	return result, nil
}

// Absence must error: a zero placement reads as degree 0 and takes Darakaraka.
func karakaPlanetIndex(chart *types.BirthChart, required []types.Graha) ([types.GrahaCount]types.PlanetPlacement, error) {
	var out [types.GrahaCount]types.PlanetPlacement
	var seen [types.GrahaCount]bool
	for _, p := range chart.Planets {
		if !p.Planet.Valid() {
			return out, types.Codef(types.ErrInvalidInput,
				"chart contains an out-of-range graha %d", int(p.Planet))
		}
		out[p.Planet] = p
		seen[p.Planet] = true
	}
	for _, g := range required {
		if !seen[g] {
			return out, types.Codef(types.ErrInvalidInput,
				"chart is missing %s, which the Karaka ranking needs", g)
		}
	}
	return out, nil
}
