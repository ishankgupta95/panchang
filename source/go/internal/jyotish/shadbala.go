package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

func ComputeShadbala(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.ShadbalaResult, error) {
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.ShadbalaResult{}, err
	}
	chart, err := RashiChartFromBasis(&basis, options)
	if err != nil {
		return types.ShadbalaResult{}, err
	}
	return shadbalaForChart(&chart, &basis)
}

func shadbalaForChart(chart *types.BirthChart, basis *NatalBasis) (types.ShadbalaResult, error) {
	sunriseUtc, err := findSunriseBefore(basis.Ctx, basis.BirthMs, basis.Location)
	if err != nil {
		return types.ShadbalaResult{}, err
	}
	sunsetUtc, err := astronomy.ComputeSunset(basis.Ctx, sunriseUtc, basis.Location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return types.ShadbalaResult{}, err
	}
	nextSunriseUtc, err := astronomy.ComputeSunrise(basis.Ctx, sunsetUtc, basis.Location,
		astronomy.DefaultRiseSetLimitDays)
	if err != nil {
		return types.ShadbalaResult{}, err
	}

	sunPlanet := chart.ByPlanet.Sun
	moonPlanet := chart.ByPlanet.Moon

	var divisionalCharts [len(saptVargas)]types.DivisionalChart
	for i, v := range saptVargas {
		d, err := DivisionalChartFromBasis(basis, v)
		if err != nil {
			return types.ShadbalaResult{}, err
		}
		divisionalCharts[i] = d
	}

	var out types.ShadbalaResult
	for _, v := range types.AllVisibleGrahas {
		placement, _ := chart.ByPlanet.Get(v.Graha())
		sthana := sthanaBala(v, *placement, chart, &divisionalCharts)
		dig := digBala(v, placement.Longitude, chart.Lagna.SiderealLongitude)
		kala := kalaBala(v, basis.BirthMs, sunriseUtc, sunsetUtc, nextSunriseUtc,
			sunPlanet.Longitude, moonPlanet.Longitude)
		chesta := chestaBala(v, *placement, sunPlanet.Longitude)
		naisargika := Naisargika[v.Graha()]
		drik := drikBala(v, chart)
		total := sthana + dig + kala + chesta + naisargika + math.Max(0, drik)
		out.Set(v, types.PlanetShadbala{
			Sthana: sthana, Dig: dig, Kala: kala, Chesta: chesta,
			Naisargika: naisargika, Drik: drik, Total: total,
		})
	}
	return out, nil
}

var uchchaDeg = [types.VisibleGrahaCount]float64{
	types.VisibleSun:     10,
	types.VisibleMoon:    33,
	types.VisibleMars:    298,
	types.VisibleMercury: 165,
	types.VisibleJupiter: 95,
	types.VisibleVenus:   357,
	types.VisibleSaturn:  200,
}

func sthanaBala(
	v types.VisibleGraha,
	placement types.PlanetPlacement,
	chart *types.BirthChart,
	divisionalCharts *[len(saptVargas)]types.DivisionalChart,
) float64 {
	return uchchaBala(v, placement.Longitude) +
		saptavargajaBala(v, chart, divisionalCharts) +
		ojhaYugmaBala(v, chart, divisionalCharts) +
		drekkanaBala(v, placement.DegreeInRashi)
}

func uchchaBala(v types.VisibleGraha, siderealLon float64) float64 {
	arc := math.Abs(jsnum.Mod(siderealLon-uchchaDeg[v]+540, 360) - 180)
	return float64(((180 - arc) / 180) * 60)
}

var saptVirupas = map[Dignity]float64{
	DignityExalted:      45,
	DignityMoolatrikona: 45,
	DignityOwn:          30,
	DignityFriend:       15,
	DignityNeutral:      7.5,
	DignityEnemy:        3.75,
	DignityDebilitated:  1.875,
}

var saptVargas = [6]types.Divisional{
	types.DivisionalD2, types.DivisionalD3, types.DivisionalD7,
	types.DivisionalD9, types.DivisionalD12, types.DivisionalD30,
}

func saptavargajaBala(
	v types.VisibleGraha,
	chart *types.BirthChart,
	divisionalCharts *[len(saptVargas)]types.DivisionalChart,
) float64 {
	placement, _ := chart.ByPlanet.Get(v.Graha())
	total := saptVirupas[mustDignity(v, placement.Rashi.Index)]
	for i := range saptVargas {
		total += saptVirupas[mustDignity(v, vargaRashiOf(&divisionalCharts[i], v))]
	}
	return total
}

func vargaRashiOf(chart *types.DivisionalChart, v types.VisibleGraha) int {
	for _, p := range chart.Planets {
		if p.Planet == v.Graha() {
			return p.Rashi.Index
		}
	}
	panic("jyotish: divisional chart " + string(chart.Divisional) + " has no " + v.String())
}

func mustDignity(v types.VisibleGraha, rashi int) Dignity {
	d, err := ComputeDignity(v.Graha(), rashi)
	if err != nil {
		panic("jyotish: shadbala dignity lookup failed: " + err.Error())
	}
	return d
}

var (
	ojhaOddGainers = [types.VisibleGrahaCount]bool{
		types.VisibleSun: true, types.VisibleMars: true, types.VisibleJupiter: true,
		types.VisibleMercury: true, types.VisibleSaturn: true,
	}
	ojhaEvenGainers = [types.VisibleGrahaCount]bool{
		types.VisibleMoon: true, types.VisibleVenus: true,
	}
)

func ojhaYugmaBala(
	v types.VisibleGraha,
	chart *types.BirthChart,
	divisionalCharts *[len(saptVargas)]types.DivisionalChart,
) float64 {
	placement, _ := chart.ByPlanet.Get(v.Graha())
	d1Rashi := placement.Rashi.Index
	d9Rashi := vargaRashiOf(&divisionalCharts[3], v)
	d1Odd := d1Rashi%2 == 0
	d9Odd := d9Rashi%2 == 0
	total := 0.0
	if ojhaOddGainers[v] {
		if d1Odd {
			total += 15
		}
		if d9Odd {
			total += 15
		}
	} else if ojhaEvenGainers[v] {
		if !d1Odd {
			total += 15
		}
		if !d9Odd {
			total += 15
		}
	}
	return total
}

var drekkanaGroup = [types.VisibleGrahaCount]int{
	types.VisibleSun: 0, types.VisibleMars: 0, types.VisibleJupiter: 0,
	types.VisibleMercury: 1, types.VisibleSaturn: 1,
	types.VisibleMoon: 2, types.VisibleVenus: 2,
}

func drekkanaBala(v types.VisibleGraha, degreeInRashi float64) float64 {
	decanate := int(math.Floor(degreeInRashi / 10))
	if decanate == drekkanaGroup[v] {
		return 15
	}
	return 0
}

var digHouse = [types.VisibleGrahaCount]int{
	types.VisibleSun: 10, types.VisibleMoon: 4, types.VisibleMars: 10,
	types.VisibleMercury: 1, types.VisibleJupiter: 1, types.VisibleVenus: 4,
	types.VisibleSaturn: 7,
}

func digBala(v types.VisibleGraha, planetLon, lagnaLon float64) float64 {
	lagnaRashi := int(math.Floor(lagnaLon / 30))
	dirRashi := (lagnaRashi + digHouse[v] - 1) % 12
	dirCuspLon := float64(dirRashi) * 30
	arc := math.Abs(jsnum.Mod(planetLon-dirCuspLon+540, 360) - 180)
	return float64(((180 - arc) / 180) * 60) // anti-FMA barrier
}

var (
	dayStrong = [types.VisibleGrahaCount]bool{
		types.VisibleSun: true, types.VisibleJupiter: true, types.VisibleVenus: true,
	}
	nightStrong = [types.VisibleGrahaCount]bool{
		types.VisibleMoon: true, types.VisibleMars: true, types.VisibleSaturn: true,
	}
	benefics = [types.GrahaCount]bool{
		types.GrahaMoon: true, types.GrahaMercury: true,
		types.GrahaJupiter: true, types.GrahaVenus: true,
	}
	malefics = [types.GrahaCount]bool{
		types.GrahaSun: true, types.GrahaMars: true, types.GrahaSaturn: true,
	}
)

func kalaBala(
	v types.VisibleGraha,
	birthMs, sunriseUtc, sunsetUtc, nextSunriseUtc int64,
	sunLon, moonLon float64,
) float64 {
	return nathonathaBala(v, birthMs, sunriseUtc, sunsetUtc, nextSunriseUtc) +
		pakshaBala(v, sunLon, moonLon)
}

func nathonathaBala(v types.VisibleGraha, birthMs, sunriseUtc, sunsetUtc, nextSunriseUtc int64) float64 {
	if v == types.VisibleMercury {
		return 60
	}
	isDayBirth := birthMs >= sunriseUtc && birthMs < sunsetUtc
	if isDayBirth {
		dayLen := sunsetUtc - sunriseUtc
		phase := float64(birthMs-sunriseUtc) / float64(dayLen)
		factor := 1 - float64(math.Abs(phase-0.5)*2)
		if dayStrong[v] {
			return float64(factor * 60)
		}
		if nightStrong[v] {
			return float64((1 - factor) * 60)
		}
	} else {
		nightStart := sunsetUtc
		nightLen := nextSunriseUtc - nightStart
		phase := float64(birthMs-nightStart) / float64(nightLen)
		factor := 1 - float64(math.Abs(phase-0.5)*2)
		if nightStrong[v] {
			return float64(factor * 60)
		}
		if dayStrong[v] {
			return float64((1 - factor) * 60)
		}
	}
	return 0
}

func pakshaBala(v types.VisibleGraha, sunLon, moonLon float64) float64 {
	sepFromSun := utils.Normalize360(moonLon - sunLon)
	arc := sepFromSun
	if sepFromSun > 180 {
		arc = 360 - sepFromSun
	}
	beneficBala := float64((arc / 180) * 60) // anti-FMA barrier
	g := v.Graha()
	if benefics[g] {
		return beneficBala
	}
	if malefics[g] {
		return 60 - beneficBala
	}
	return 0
}

func chestaBala(v types.VisibleGraha, placement types.PlanetPlacement, sunLon float64) float64 {
	if v == types.VisibleSun || v == types.VisibleMoon {
		return 30
	}
	if placement.IsRetrograde {
		return 60
	}
	angularDistance := math.Abs(jsnum.Mod(placement.Longitude-sunLon+540, 360) - 180)
	if angularDistance <= 10 {
		return 15
	}
	return 30
}

var Naisargika = [types.GrahaCount]float64{
	types.GrahaSun:     60.00,
	types.GrahaMoon:    51.43,
	types.GrahaVenus:   42.86,
	types.GrahaJupiter: 34.29,
	types.GrahaMercury: 25.71,
	types.GrahaMars:    17.14,
	types.GrahaSaturn:  8.57,
	types.GrahaRahu:    0,
	types.GrahaKetu:    0,
}

var aspectWeights = [12]float64{
	6: 1,
	3: 0.5,
	7: 0.5,
	4: 0.75,
	8: 0.75,
	2: 0.25,
	9: 0.25,
}

var specialAspects = [types.GrahaCount][12]bool{
	types.GrahaMars:    {3: true, 7: true},
	types.GrahaJupiter: {4: true, 8: true},
	types.GrahaSaturn:  {2: true, 9: true},
}

func drikBala(v types.VisibleGraha, chart *types.BirthChart) float64 {
	target, _ := chart.ByPlanet.Get(v.Graha())
	net := 0.0
	for _, aspector := range chart.Planets {
		if aspector.Planet == v.Graha() {
			continue
		}
		if _, ok := aspector.Planet.Visible(); !ok {
			continue
		}
		offset := (target.House - aspector.House + 12) % 12
		if offset == 0 {
			continue
		}
		if offset != 6 && !specialAspects[aspector.Planet][offset] {
			continue
		}
		sign := -1.0
		if benefics[aspector.Planet] {
			sign = 1
		}
		net += float64(sign * aspectWeights[offset] * 60)
	}
	return net
}

var bhavaDikValues = [12]float64{
	60,
	40,
	20,
	0,
	5,
	10,
	15,
	20,
	25,
	30,
	40,
	50,
}

func ComputeBhavaBala(
	ctx *astronomy.EphemerisCtx,
	birthMs int64,
	location types.GeoLocation,
	options BirthChartOptions,
) (types.BhavaBalaResult, error) {
	basis, err := ComputeNatalBasis(ctx, birthMs, location, options)
	if err != nil {
		return types.BhavaBalaResult{}, err
	}
	chart, err := RashiChartFromBasis(&basis, options)
	if err != nil {
		return types.BhavaBalaResult{}, err
	}
	shadbala, err := shadbalaForChart(&chart, &basis)
	if err != nil {
		return types.BhavaBalaResult{}, err
	}

	houses := make([]types.BhavaBalaPerHouse, 0, 12)
	for i := 0; i < 12; i++ {
		bhavaNumber := i + 1
		cuspRashi := chart.Bhava.Houses[i].Rashi.Index
		lordBala, _ := shadbala.Get(RashiLord[cuspRashi])
		bhavadhipati := lordBala.Total

		dik := bhavaDikValues[i]

		drikRaw := 0.0
		for _, aspector := range chart.Planets {
			if _, ok := aspector.Planet.Visible(); !ok {
				continue
			}
			offset := (bhavaNumber - aspector.House + 12) % 12
			if offset == 0 {
				continue
			}
			if offset != 6 && !specialAspects[aspector.Planet][offset] {
				continue
			}
			sign := -1.0
			if benefics[aspector.Planet] {
				sign = 1
			}
			drikRaw += float64(sign * aspectWeights[offset] * 60) // anti-FMA barrier
		}
		drik := math.Max(0, drikRaw)

		sthana := 0.0
		for _, p := range chart.Planets {
			if _, ok := p.Planet.Visible(); !ok {
				continue
			}
			if p.House != bhavaNumber {
				continue
			}
			sign := -1.0
			if benefics[p.Planet] {
				sign = 1
			}
			sthana += float64(sign * Naisargika[p.Planet]) // anti-FMA barrier
		}

		houses = append(houses, types.BhavaBalaPerHouse{
			Bhavadhipati: bhavadhipati, Dik: dik, Drik: drik, Sthana: sthana,
			Total: bhavadhipati + dik + drik + sthana,
		})
	}

	return types.BhavaBalaResult{Houses: houses}, nil
}
