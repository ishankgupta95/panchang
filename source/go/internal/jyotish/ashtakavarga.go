package jyotish

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"

type AshtakavargaOptions struct {
	Reductions bool
}

func ComputeAshtakavarga(chart *types.BirthChart, options AshtakavargaOptions) types.AshtakavargaResult {
	contributorRashi := collectContributorRashis(chart)
	occupied := collectOccupiedRashis(chart)

	var bhinnashtaka types.BhinnashtakaByGraha
	for _, receiver := range AshtakavargaReceivers {
		bhinnashtaka.Set(receiver, bhinnashtakaFor(receiver, contributorRashi))
	}

	grids := make([]types.BhinnashtakaGrid, 0, types.VisibleGrahaCount)
	for _, r := range AshtakavargaReceivers {
		g, _ := bhinnashtaka.Get(r)
		grids = append(grids, g)
	}
	result := types.AshtakavargaResult{
		Sarvashtaka:  sumGrids(grids),
		Bhinnashtaka: bhinnashtaka,
	}

	if options.Reductions {
		var reducedBhinn types.BhinnashtakaByGraha
		reducedGrids := make([]types.BhinnashtakaGrid, 0, types.VisibleGrahaCount)
		for _, receiver := range AshtakavargaReceivers {
			g, _ := bhinnashtaka.Get(receiver)
			r := applyReductions(g, occupied)
			reducedBhinn.Set(receiver, r)
			reducedGrids = append(reducedGrids, r)
		}
		result.Reduced = &types.AshtakavargaReduced{
			Sarvashtaka:  sumGrids(reducedGrids),
			Bhinnashtaka: reducedBhinn,
		}
	}

	return result
}

func collectContributorRashis(chart *types.BirthChart) [ContributorCount]int {
	var out [ContributorCount]int
	var filled [ContributorCount]bool
	out[ContributorLagna] = chart.Lagna.Rashi.Index
	filled[ContributorLagna] = true
	for _, placement := range chart.Planets {
		v, ok := placement.Planet.Visible()
		if !ok {
			continue
		}
		out[AshtakavargaContributor(v)] = placement.Rashi.Index
		filled[AshtakavargaContributor(v)] = true
	}
	for _, c := range AshtakavargaContributors {
		if !filled[c] {
			panic("jyotish: ashtakavarga contributor " + c.String() +
				" is missing from the chart; a partial BirthChart would place its " +
				"bindus from Mesha rather than fail")
		}
	}
	return out
}

func collectOccupiedRashis(chart *types.BirthChart) [12]bool {
	var out [12]bool
	for _, placement := range chart.Planets {
		if _, ok := placement.Planet.Visible(); !ok {
			continue
		}
		out[placement.Rashi.Index] = true
	}
	return out
}

func bhinnashtakaFor(receiver types.VisibleGraha, contributorRashi [ContributorCount]int) types.BhinnashtakaGrid {
	grid := make(types.BhinnashtakaGrid, 12)
	lookup := BeneficOffsets[receiver]
	for _, contributor := range AshtakavargaContributors {
		baseRashi := contributorRashi[contributor]
		for _, offset := range lookup[contributor] {
			target := (baseRashi + offset - 1) % 12
			grid[target]++
		}
	}
	return grid
}

func sumGrids(grids []types.BhinnashtakaGrid) types.BhinnashtakaGrid {
	out := make(types.BhinnashtakaGrid, 12)
	for _, g := range grids {
		for i := 0; i < 12; i++ {
			out[i] += g[i]
		}
	}
	return out
}

func applyReductions(grid types.BhinnashtakaGrid, occupied [12]bool) types.BhinnashtakaGrid {
	stage1 := applyTrikonaSodhana(grid)
	return applyEkadhipatyaSodhana(stage1, occupied)
}

func applyTrikonaSodhana(grid types.BhinnashtakaGrid) types.BhinnashtakaGrid {
	out := make(types.BhinnashtakaGrid, len(grid))
	copy(out, grid)
	for _, triad := range TrikonaTriads {
		m := out[triad[0]]
		if out[triad[1]] < m {
			m = out[triad[1]]
		}
		if out[triad[2]] < m {
			m = out[triad[2]]
		}
		out[triad[0]] -= m
		out[triad[1]] -= m
		out[triad[2]] -= m
	}
	return out
}

func applyEkadhipatyaSodhana(grid types.BhinnashtakaGrid, occupied [12]bool) types.BhinnashtakaGrid {
	out := make(types.BhinnashtakaGrid, len(grid))
	copy(out, grid)
	for _, pair := range EkadhipatyaPairs {
		a, b := pair[0], pair[1]
		aOcc := occupied[a]
		bOcc := occupied[b]

		if out[a] == 0 || out[b] == 0 {
			continue
		}
		if aOcc && bOcc {
			continue
		}

		if !aOcc && !bOcc {
			if out[a] != out[b] {
				m := out[a]
				if out[b] < m {
					m = out[b]
				}
				out[a] = m
				out[b] = m
			} else {
				out[a] = 0
				out[b] = 0
			}
			continue
		}

		occIdx, vacIdx := a, b
		if !aOcc {
			occIdx, vacIdx = b, a
		}
		if out[vacIdx] <= out[occIdx] {
			out[vacIdx] = 0
		} else {
			out[vacIdx] = out[occIdx]
		}
	}
	return out
}
