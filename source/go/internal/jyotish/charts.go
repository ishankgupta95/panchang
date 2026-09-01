package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/i18n"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

func ComputeRashiChart(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.BirthChart, error) {
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.BirthChart{}, err
	}
	return RashiChartFromBasis(&basis, options)
}

func RashiChartFromBasis(basis *NatalBasis, options BirthChartOptions) (types.BirthChart, error) {
	bhava, err := BhavaFromBasis(basis, resolveHouseSystem(options.HouseSystem))
	if err != nil {
		return types.BirthChart{}, err
	}
	cusps := make([]float64, 0, len(bhava.Houses))
	for _, h := range bhava.Houses {
		cusps = append(cusps, h.CuspLongitude)
	}

	planets := make([]types.PlanetPlacement, 0, types.GrahaCount)
	for _, e := range GrahaList(basis) {
		planets = append(planets, types.PlanetPlacement{
			Planet:        e.Key,
			Longitude:     e.Pos.SiderealLongitude,
			Rashi:         e.Pos.Rashi,
			DegreeInRashi: e.Pos.DegreeInRashi,
			House:         houseOfLongitude(e.Pos.SiderealLongitude, cusps),
			IsRetrograde:  e.Pos.IsRetrograde,
		})
	}

	return types.BirthChart{
		Divisional: "D1",
		Lagna:      basis.Lagna,
		Bhava:      bhava,
		Planets:    planets,
		ByPlanet:   IndexPlanets(planets),
	}, nil
}

func IndexPlanets(planets []types.PlanetPlacement) types.PlanetsByGraha {
	var byPlanet types.PlanetsByGraha
	for _, p := range planets {
		byPlanet.Set(p.Planet, p)
	}
	return byPlanet
}

func ComputeNavamsa(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.DivisionalChart, error) {
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.DivisionalChart{}, err
	}
	return NavamsaFromBasis(&basis), nil
}

func NavamsaFromBasis(basis *NatalBasis) types.DivisionalChart {
	lang := basis.Lang
	navLagnaLon := navamsaLongitude(basis.Lagna.SiderealLongitude)
	navLagnaRashi := int(math.Floor(navLagnaLon / 30))

	planets := make([]types.PlanetPlacement, 0, types.GrahaCount)
	for _, e := range GrahaList(basis) {
		d9Lon := navamsaLongitude(e.Pos.SiderealLongitude)
		d9Rashi := int(math.Floor(d9Lon / 30))
		planets = append(planets, types.PlanetPlacement{
			Planet:        e.Key,
			Longitude:     d9Lon,
			Rashi:         types.RashiInfo{Index: d9Rashi, Name: i18n.ResolveMasaName(d9Rashi, lang)},
			DegreeInRashi: d9Lon - float64(float64(d9Rashi)*30), // anti-FMA barrier
			House:         ((d9Rashi-navLagnaRashi+12)%12 + 1),
			IsRetrograde:  e.Pos.IsRetrograde,
		})
	}

	return types.DivisionalChart{
		Divisional: types.DivisionalD9,
		LagnaRashi: types.RashiInfo{Index: navLagnaRashi, Name: i18n.ResolveMasaName(navLagnaRashi, lang)},
		Planets:    planets,
	}
}

const navSpan float64 = 30.0 / 9 // 30.0, not 30: integer division would give 3

func navamsaLongitude(siderealLon float64) float64 {
	rashi := int(math.Floor(siderealLon / 30))
	degInRashi := siderealLon - float64(float64(rashi)*30)
	navIdxInRashi := int(math.Floor(degInRashi / navSpan))
	if navIdxInRashi > 8 {
		navIdxInRashi = 8
	}
	startOffset := 4
	switch rashi % 3 {
	case 0:
		startOffset = 0
	case 1:
		startOffset = 8
	}
	navRashi := (rashi + startOffset + navIdxInRashi) % 12
	degInNavRashi := (jsnum.Mod(degInRashi, navSpan) * 30) / navSpan // jsnum.Mod, not math.Remainder
	return utils.Normalize360(float64(float64(navRashi)*30) + degInNavRashi)
}

func houseOfLongitude(lambda float64, cusps []float64) int {
	for i := 0; i < 12; i++ {
		start := cusps[i]
		end := cusps[(i+1)%12]
		if start <= end {
			if lambda >= start && lambda < end {
				return i + 1
			}
		} else {
			if lambda >= start || lambda < end {
				return i + 1
			}
		}
	}
	return 1 // unreachable for a valid partition
}
