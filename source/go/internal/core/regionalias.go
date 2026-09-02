package core

import (
	"sync"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

var legacyRegionAliases = map[types.FestivalRegion]types.FestivalRegion{
	types.LegacyRegionTamil:      types.RegionTamilNadu,
	types.LegacyRegionBengal:     types.RegionWestBengal,
	types.LegacyRegionNorthIndia: types.RegionAll,
}

var regionWarnOnce sync.Map

type RegionAliasWarner func(message string)

func ResolveRegionAlias(region types.FestivalRegion, warn RegionAliasWarner) types.FestivalRegion {
	if region == "" {
		return types.RegionAll
	}
	canonical, isLegacy := legacyRegionAliases[region]
	if !isLegacy {
		return region
	}
	if warn != nil {
		once, _ := regionWarnOnce.LoadOrStore(region, &sync.Once{})
		once.(*sync.Once).Do(func() {
			warn("[panchang-ts] FestivalRegion '" + string(region) +
				"' is deprecated; use '" + string(canonical) + "'. " +
				"Legacy value will be removed in v3.")
		})
	}
	return canonical
}

func ResetRegionAliasWarnings() {
	regionWarnOnce.Range(func(k, _ any) bool {
		regionWarnOnce.Delete(k)
		return true
	})
}
