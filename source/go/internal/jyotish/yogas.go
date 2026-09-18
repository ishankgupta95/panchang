package jyotish

import "github.com/ishankgupta95/panchang/source/go/v5/types"

func ComputeYogas(chart *types.BirthChart, options ComputeYogasOptions) ([]types.Yoga, error) {
	ctx, err := buildYogaContext(chart, options)
	if err != nil {
		return nil, err
	}

	if len(options.Types) > 0 {
		for _, t := range options.Types {
			known := false
			for _, k := range types.AllYogaTypes {
				if k == t {
					known = true
				}
			}
			if !known {
				return nil, types.Codef(types.ErrInvalidInput, "unknown yoga type %q", string(t))
			}
		}
	}
	typeWanted := func(t types.YogaType) bool {
		if len(options.Types) == 0 {
			return true
		}
		for _, want := range options.Types {
			if want == t {
				return true
			}
		}
		return false
	}

	out := make([]types.Yoga, 0, len(YogaCatalog))
	for i := range YogaCatalog {
		rule := &YogaCatalog[i]
		if !typeWanted(rule.Type) {
			continue
		}
		match := rule.Evaluate(&ctx)
		if match == nil {
			continue
		}
		yoga := types.Yoga{Name: rule.Name, Type: rule.Type, Reasons: match.Reasons}
		if match.Bhanga != nil {
			yoga.Bhanga = match.Bhanga
		}
		out = append(out, yoga)
	}
	return out, nil
}

func buildYogaContext(chart *types.BirthChart, options ComputeYogasOptions) (YogaContext, error) {
	var dignity [types.GrahaCount]Dignity
	for _, g := range types.AllGrahas {
		p, ok := chart.ByPlanet.Get(g)
		if !ok {
			return YogaContext{}, types.Codef(types.ErrInvalidInput,
				"chart is missing %s", g)
		}
		d, err := ComputeDignity(g, p.Rashi.Index)
		if err != nil {
			return YogaContext{}, err
		}
		dignity[g] = d
	}

	aspects, err := ComputeAspects(chart, AspectsOptions{NodeAspects: options.NodeAspects})
	if err != nil {
		return YogaContext{}, err
	}

	return YogaContext{
		Chart:        chart,
		Dignity:      dignity,
		Aspects:      aspects,
		Navamsa:      options.Navamsa,
		PlanetByName: chart.ByPlanet,
		LagnaRashi:   chart.Lagna.Rashi.Index,
	}, nil
}
