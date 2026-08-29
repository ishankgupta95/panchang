package jyotish

import (
	"sort"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Houses each graha aspects beyond the universal 7th (BPHS Ch. 26), 0-based.
var specialOffsets = [types.GrahaCount][]int{
	types.GrahaSun:     {},
	types.GrahaMoon:    {},
	types.GrahaMars:    {3, 7},
	types.GrahaMercury: {},
	types.GrahaJupiter: {4, 8},
	types.GrahaVenus:   {},
	types.GrahaSaturn:  {2, 9},
	types.GrahaRahu:    {},
	types.GrahaKetu:    {},
}

// Rahu/Ketu 5th and 9th (BV Raman, KP; not BPHS).
var node59Offsets = [2]int{4, 8}

type NodeAspects string

const (
	NodeAspects7Only NodeAspects = "7-only"
	NodeAspects5And9 NodeAspects = "5-and-9"
)

type AspectsOptions struct {
	NodeAspects NodeAspects
}

func (o AspectsOptions) resolve() (NodeAspects, error) {
	switch o.NodeAspects {
	case "":
		return NodeAspects7Only, nil
	case NodeAspects7Only, NodeAspects5And9:
		return o.NodeAspects, nil
	}
	return "", types.NewPanchangError(
		`nodeAspects must be "7-only" or "5-and-9", got "`+string(o.NodeAspects)+`"`,
		types.ErrInvalidInput)
}

func ComputeAspects(chart *types.BirthChart, options AspectsOptions) (types.AspectMap, error) {
	nodeAspects, err := options.resolve()
	if err != nil {
		return types.AspectMap{}, err
	}

	var out types.AspectMap
	var seen [types.GrahaCount]int
	for i := range chart.Planets {
		p := &chart.Planets[i]
		if !p.Planet.Valid() {
			return types.AspectMap{}, types.NewPanchangError(
				"chart carries an out-of-range graha: "+itoa(int(p.Planet)),
				types.ErrInvalidInput)
		}
		seen[p.Planet]++
		out.SetForGraha(p.Planet, housesAspected(p, nodeAspects))
	}
	for _, g := range types.AllGrahas {
		if seen[g] != 1 {
			return types.AspectMap{}, types.NewPanchangError(
				"chart must carry each graha exactly once; "+g.String()+" appears "+
					itoa(seen[g])+" times", types.ErrInvalidInput)
		}
	}
	return out, nil
}

func housesAspected(planet *types.PlanetPlacement, nodeAspects NodeAspects) []int {
	offsets := make([]int, 0, 5)
	offsets = append(offsets, 6) // universal 7th

	offsets = append(offsets, specialOffsets[planet.Planet]...)

	if nodeAspects == NodeAspects5And9 && planet.Planet.IsNode() {
		offsets = append(offsets, node59Offsets[:]...)
	}

	houses := make([]int, 0, len(offsets))
	var present [13]bool
	for _, o := range offsets {
		h := (planet.House-1+o)%12 + 1
		if h >= 1 && h <= 12 && !present[h] {
			present[h] = true
			houses = append(houses, h)
		}
	}
	sort.Ints(houses)
	return houses
}
