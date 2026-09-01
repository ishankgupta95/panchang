package jyotish

import (
	"math"
	"sort"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

var kpVisibleGrahasByIndex = types.AllVisibleGrahas

var kpAllGrahas = types.AllGrahas

type KpSubLordInfo struct {
	Longitude float64            `json:"longitude"`
	Rashi     int                `json:"rashi"`
	Nakshatra int                `json:"nakshatra"`
	SignLord  types.VisibleGraha `json:"signLord"`
	StarLord  types.DashaLord    `json:"starLord"`
	SubLord   types.DashaLord    `json:"subLord"`
}

type KpCuspalSubLords struct {
	Cusps []KpSubLordInfo `json:"cusps"`
}

type KpByPlanet struct {
	Sun     []int `json:"Sun"`
	Moon    []int `json:"Moon"`
	Mars    []int `json:"Mars"`
	Mercury []int `json:"Mercury"`
	Jupiter []int `json:"Jupiter"`
	Venus   []int `json:"Venus"`
	Saturn  []int `json:"Saturn"`
	Rahu    []int `json:"Rahu"`
	Ketu    []int `json:"Ketu"`
}

func (b *KpByPlanet) field(g types.Graha) *[]int {
	switch g {
	case types.GrahaSun:
		return &b.Sun
	case types.GrahaMoon:
		return &b.Moon
	case types.GrahaMars:
		return &b.Mars
	case types.GrahaMercury:
		return &b.Mercury
	case types.GrahaJupiter:
		return &b.Jupiter
	case types.GrahaVenus:
		return &b.Venus
	case types.GrahaSaturn:
		return &b.Saturn
	case types.GrahaRahu:
		return &b.Rahu
	case types.GrahaKetu:
		return &b.Ketu
	}
	return nil
}

func (b *KpByPlanet) Get(g types.Graha) ([]int, bool) {
	f := b.field(g)
	if f == nil {
		return nil, false
	}
	return *f, true
}

func (b *KpByPlanet) Set(g types.Graha, houses []int) bool {
	f := b.field(g)
	if f == nil {
		return false
	}
	*f = houses
	return true
}

type KpByHouse struct {
	H1  []types.Graha `json:"1"`
	H2  []types.Graha `json:"2"`
	H3  []types.Graha `json:"3"`
	H4  []types.Graha `json:"4"`
	H5  []types.Graha `json:"5"`
	H6  []types.Graha `json:"6"`
	H7  []types.Graha `json:"7"`
	H8  []types.Graha `json:"8"`
	H9  []types.Graha `json:"9"`
	H10 []types.Graha `json:"10"`
	H11 []types.Graha `json:"11"`
	H12 []types.Graha `json:"12"`
}

func (b *KpByHouse) field(house int) *[]types.Graha {
	switch house {
	case 1:
		return &b.H1
	case 2:
		return &b.H2
	case 3:
		return &b.H3
	case 4:
		return &b.H4
	case 5:
		return &b.H5
	case 6:
		return &b.H6
	case 7:
		return &b.H7
	case 8:
		return &b.H8
	case 9:
		return &b.H9
	case 10:
		return &b.H10
	case 11:
		return &b.H11
	case 12:
		return &b.H12
	}
	return nil
}

func (b *KpByHouse) Get(house int) ([]types.Graha, bool) {
	f := b.field(house)
	if f == nil {
		return nil, false
	}
	return *f, true
}

type KpSignificators struct {
	ByPlanet KpByPlanet `json:"byPlanet"`
	ByHouse  KpByHouse  `json:"byHouse"`
}

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
		planetHouse[p.Planet] = p.House
		haveHouse[p.Planet] = true
		nakIdx := utils.NakshatraOf(p.Longitude)
		planetStarLord[p.Planet] = NakshatraLord[nakIdx]
		haveStarLord[p.Planet] = true
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
		*byHouse.field(h) = []types.Graha{}
	}
	for _, planet := range kpAllGrahas {
		hs, _ := byPlanet.Get(planet)
		for _, h := range hs {
			f := byHouse.field(h)
			if f == nil {
				continue
			}
			*f = append(*f, planet)
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
