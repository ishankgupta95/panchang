package jyotish

import (
	"math"
	"sort"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var kpVisibleGrahasByIndex = types.AllVisibleGrahas

var kpAllGrahas = types.AllGrahas

func subWidth(lord types.DashaLord) float64 {
	return float64((DashaYears[lord] / 120) * utils.NakshatraSpan)
}

func subLordAtOffset(degInNak float64, starLord types.DashaLord) types.DashaLord {
	starLordIdx := int(starLord)
	cum := 0.0
	for i := 0; i < 9; i++ {
		lord := DashaOrder[(starLordIdx+i)%9]
		cum += subWidth(lord)
		if degInNak < cum {
			return lord
		}
	}
	return DashaOrder[(starLordIdx+8)%9]
}

func ComputeKpSubLord(siderealLongitude float64) KpSubLordInfo {
	lon := utils.Normalize360(siderealLongitude)
	if math.IsNaN(lon) {
		// TypeScript reads NaN indices and undefined sign and star lords here,
		// and its sub lord walk falls through to Saturn.
		return KpSubLordInfo{
			Longitude: lon, Rashi: -1, Nakshatra: -1,
			SignLord: -1, StarLord: -1, SubLord: types.DashaSaturn,
		}
	}
	rashi := int(math.Floor(lon / 30))
	nakIdx := utils.NakshatraOf(lon)
	degInNak := lon - float64(float64(nakIdx)*utils.NakshatraSpan)

	starLord := NakshatraLord[nakIdx]
	subLord := subLordAtOffset(degInNak, starLord)
	signLord := kpVisibleGrahasByIndex[RashiLord[rashi]]

	return KpSubLordInfo{
		Longitude: lon,
		Rashi:     rashi,
		Nakshatra: nakIdx,
		SignLord:  signLord,
		StarLord:  starLord,
		SubLord:   subLord,
	}
}

func ComputeKpCuspalSubLords(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (KpCuspalSubLords, error) {
	if err := utils.ValidateDate(birthMs); err != nil {
		return KpCuspalSubLords{}, err
	}
	if err := utils.ValidateLocation(location); err != nil {
		return KpCuspalSubLords{}, err
	}

	kpOptions := options
	if kpOptions.Ayanamsa == "" {
		kpOptions.Ayanamsa = types.Krishnamurti
	}
	kpOptions.HouseSystem = types.HouseSystemPlacidusKP

	bhava, err := ComputeBhava(ctx, birthMs, location, kpOptions)
	if err != nil {
		return KpCuspalSubLords{}, err
	}

	cusps := make([]KpSubLordInfo, 0, len(bhava.Houses))
	for _, h := range bhava.Houses {
		cusps = append(cusps, ComputeKpSubLord(h.CuspLongitude))
	}
	return KpCuspalSubLords{Cusps: cusps}, nil
}

func ComputeKpSignificators(chart *types.BirthChart) KpSignificators {
	var planetHouse [types.GrahaCount]int
	var haveHouse [types.GrahaCount]bool
	var planetStarLord [types.GrahaCount]types.DashaLord
	var haveStarLord [types.GrahaCount]bool
	for _, p := range chart.Planets {
		if !p.Planet.Valid() {
			continue // TypeScript files it under a key no later step reads
		}
		planetHouse[p.Planet] = p.House
		haveHouse[p.Planet] = true
		if lon := utils.Normalize360(p.Longitude); !math.IsNaN(lon) {
			planetStarLord[p.Planet] = NakshatraLord[utils.NakshatraOf(lon)]
			haveStarLord[p.Planet] = true
		}
	}

	lagnaRashi := chart.Lagna.Rashi.Index
	rashiToHouse := func(rashi int) int { return (rashi-lagnaRashi+12)%12 + 1 }

	var planetOwnedHouses [types.VisibleGrahaCount][]int
	for r := 0; r < 12; r++ {
		owner := kpVisibleGrahasByIndex[RashiLord[r]]
		planetOwnedHouses[owner] = append(planetOwnedHouses[owner], rashiToHouse(r))
	}

	var byPlanet KpByPlanet
	for _, planet := range kpAllGrahas {
		seen := map[int]bool{}

		if haveHouse[planet] {
			seen[planetHouse[planet]] = true
		}

		var slGraha types.Graha
		if haveStarLord[planet] {
			slGraha = planetStarLord[planet].Graha()
			if haveHouse[slGraha] {
				seen[planetHouse[slGraha]] = true
			}
		}

		if v, ok := planet.Visible(); ok {
			for _, h := range planetOwnedHouses[v] {
				seen[h] = true
			}
		}

		if haveStarLord[planet] {
			if v, ok := slGraha.Visible(); ok {
				for _, h := range planetOwnedHouses[v] {
					seen[h] = true
				}
			}
		}

		houses := make([]int, 0, len(seen))
		for h := range seen {
			houses = append(houses, h)
		}
		sort.Ints(houses)
		byPlanet.Set(planet, houses)
	}

	var byHouse KpByHouse
	for h := 1; h <= 12; h++ {
		byHouse.Set(h, []types.Graha{})
	}
	for _, planet := range kpAllGrahas {
		hs, _ := byPlanet.Get(planet)
		for _, h := range hs {
			existing, ok := byHouse.Get(h)
			if !ok {
				continue
			}
			byHouse.Set(h, append(existing, planet))
		}
	}

	return KpSignificators{ByPlanet: byPlanet, ByHouse: byHouse}
}

var SubCumulativeWidthsForTest = func() [9]float64 {
	var out [9]float64
	cum := 0.0
	for i, lord := range DashaOrder {
		cum += subWidth(lord)
		out[i] = cum
	}
	return out
}()
