package jyotish

import (
	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type BirthChartOptions struct {
	Ayanamsa    types.AyanamsaType
	Language    types.Language
	HouseSystem types.HouseSystem
	NodeType    NodeType
}

type NatalBasis struct {
	Ctx          *astronomy.EphemerisCtx
	BirthMs      int64
	Location     types.GeoLocation
	AyanamsaType types.AyanamsaType
	Lang         types.Language
	NodeType     NodeType
	Lagna        types.LagnaInfo
	Positions    types.PlanetaryPositions
}

func ComputeNatalBasis(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (NatalBasis, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return NatalBasis{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return NatalBasis{}, err
	}

	ayanamsaType := resolveAyanamsa(options.Ayanamsa)
	lang := resolveLang(options.Language)
	nodeType := resolveNodeType(options.NodeType)

	lagna, err := ComputeLagna(ctx, birthMs, location, ayanamsaType, lang)
	if err != nil {
		return NatalBasis{}, err
	}
	positions, err := ComputePlanetaryPositions(ctx, birthMs, ayanamsaType,
		func(idx int) string { return i18n.ResolveNakshatraName(idx, lang) },
		func(idx int) string { return i18n.ResolveMasaName(idx, lang) },
		nodeType,
	)
	if err != nil {
		return NatalBasis{}, err
	}

	return NatalBasis{
		Ctx:          ctx,
		BirthMs:      birthMs,
		Location:     location,
		AyanamsaType: ayanamsaType,
		Lang:         lang,
		NodeType:     nodeType,
		Lagna:        lagna,
		Positions:    positions,
	}, nil
}

type GrahaEntry struct {
	Key types.Graha
	Pos *types.GrahaPosition
}

func GrahaList(basis *NatalBasis) []GrahaEntry {
	out := make([]GrahaEntry, 0, types.GrahaCount)
	for _, g := range types.AllGrahas {
		pos, ok := basis.Positions.Get(g)
		if !ok {
			panic("jyotish: AllGrahas contains a graha PlanetaryPositions.Get rejects")
		}
		out = append(out, GrahaEntry{Key: g, Pos: pos})
	}
	return out
}
