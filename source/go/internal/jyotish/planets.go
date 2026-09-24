package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var GrahaAbbr = [types.GrahaCount]string{
	types.GrahaSun:     "Su",
	types.GrahaMoon:    "Mo",
	types.GrahaMars:    "Ma",
	types.GrahaMercury: "Me",
	types.GrahaJupiter: "Ju",
	types.GrahaVenus:   "Ve",
	types.GrahaSaturn:  "Sa",
	types.GrahaRahu:    "Ra",
	types.GrahaKetu:    "Ke",
}

func MeanObliquity(t float64) float64 {
	return 23.439291111 -
		float64(0.013004167*t) -
		float64(0.000000164*t*t) +
		float64(0.000000504*t*t*t)
}

func isRetrograde(ctx *astronomy.EphemerisCtx, body astronomy.PlanetBody, ms int64) bool {
	const dt = 3600_000
	lon0 := astronomy.GetTropicalPlanetLongitude(ctx, body, ms-dt)
	lon1 := astronomy.GetTropicalPlanetLongitude(ctx, body, ms+dt)
	delta := lon1 - lon0
	if delta > 180 {
		delta -= 360
	}
	if delta < -180 {
		delta += 360
	}
	return delta < 0
}

func retrogradeDelta(ctx *astronomy.EphemerisCtx, body astronomy.PlanetBody, ms int64) float64 {
	const dt = 3600_000
	lon0 := astronomy.GetTropicalPlanetLongitude(ctx, body, ms-dt)
	lon1 := astronomy.GetTropicalPlanetLongitude(ctx, body, ms+dt)
	delta := lon1 - lon0
	if delta > 180 {
		delta -= 360
	}
	if delta < -180 {
		delta += 360
	}
	return delta
}

func getMeanRahuLongitudeTropical(ms int64) float64 {
	t := (astronomy.DateToJulianDay(ms) - 2451545.0) / 36525.0
	return utils.Normalize360(
		125.0445479 -
			float64(1934.1362891*t) +
			float64(0.0020754*t*t) +
			(t*t*t)/467441 -
			(t*t*t*t)/60616000,
	)
}

func getTrueRahuLongitudeTropical(ms int64) float64 {
	t := (astronomy.DateToJulianDay(ms) - 2451545.0) / 36525.0
	meanOmega := 125.0445479 -
		float64(1934.1362891*t) +
		float64(0.0020754*t*t) +
		(t*t*t)/467441 -
		(t*t*t*t)/60616000

	d := 297.8501921 +
		float64(445267.1114034*t) -
		float64(0.0018819*t*t) +
		(t*t*t)/545868 -
		(t*t*t*t)/113065000
	f := 93.2720950 +
		float64(483202.0175233*t) -
		float64(0.0036539*t*t) -
		(t*t*t)/3526000 +
		(t*t*t*t)/863310000

	argRad := ((float64(2*d) - float64(2*f)) * jsnum.PI) / 180
	correction := -1.4979 * math.Sin(argRad) // math.Sin, not the Cody-Waite astronomy.Sin
	return utils.Normalize360(meanOmega + correction)
}

func buildGrahaPosition(
	planet types.Graha,
	siderealLon float64,
	isRetro bool,
	nakshatraNameFn func(idx int) string,
	rashiNameFn func(idx int) string,
) types.GrahaPosition {
	rashiIndex := int(math.Floor(siderealLon / 30))
	degreeInRashi := siderealLon - float64(float64(rashiIndex)*30) // anti-FMA barrier
	nakIdx := utils.NakshatraOf(siderealLon)
	return types.GrahaPosition{
		Planet:            planet,
		SiderealLongitude: siderealLon,
		Rashi:             types.RashiInfo{Index: rashiIndex, Name: rashiNameFn(rashiIndex)},
		DegreeInRashi:     degreeInRashi,
		Nakshatra:         core.ComputeNakshatraFromLongitude(siderealLon, nakshatraNameFn(nakIdx)),
		IsRetrograde:      isRetro,
	}
}

func identityName(idx int) string { return jsnum.FormatInt(int64(idx)) }

var AllNodeTypes = []NodeType{NodeMean, NodeTrue}

func resolveNodeType(n NodeType) NodeType {
	if n == "" {
		return NodeMean
	}
	return n
}

func ComputePlanetaryPositions(
	ctx *astronomy.EphemerisCtx,
	ms int64,
	ayanamsaType types.AyanamsaType,
	nakshatraName func(idx int) string,
	rashiName func(idx int) string,
	nodeType NodeType,
) (types.PlanetaryPositions, error) {
	if nakshatraName == nil {
		nakshatraName = identityName
	}
	if rashiName == nil {
		rashiName = identityName
	}
	lon, err := siderealGrahaLongitudes(ctx, ms, ayanamsaType, nodeType)
	if err != nil {
		return types.PlanetaryPositions{}, err
	}

	marsRetro := isRetrograde(ctx, astronomy.PlanetMars, ms)
	mercRetro := isRetrograde(ctx, astronomy.PlanetMercury, ms)
	jupRetro := isRetrograde(ctx, astronomy.PlanetJupiter, ms)
	venRetro := isRetrograde(ctx, astronomy.PlanetVenus, ms)
	satRetro := isRetrograde(ctx, astronomy.PlanetSaturn, ms)

	g := func(planet types.Graha, retro bool) types.GrahaPosition {
		return buildGrahaPosition(planet, lon[planet], retro, nakshatraName, rashiName)
	}

	return types.PlanetaryPositions{
		Sun:     g(types.GrahaSun, false),
		Moon:    g(types.GrahaMoon, false),
		Mars:    g(types.GrahaMars, marsRetro),
		Mercury: g(types.GrahaMercury, mercRetro),
		Jupiter: g(types.GrahaJupiter, jupRetro),
		Venus:   g(types.GrahaVenus, venRetro),
		Saturn:  g(types.GrahaSaturn, satRetro),
		Rahu:    g(types.GrahaRahu, true), // always retrograde
		Ketu:    g(types.GrahaKetu, true),
	}, nil
}

// siderealGrahaLongitudes is the nine sidereal longitudes ComputePlanetaryPositions
// publishes, indexed by Graha, without its retrograde probes.
func siderealGrahaLongitudes(
	ctx *astronomy.EphemerisCtx,
	ms int64,
	ayanamsaType types.AyanamsaType,
	nodeType NodeType,
) ([types.GrahaCount]float64, error) {
	var lon [types.GrahaCount]float64
	nodeType = resolveNodeType(nodeType)

	ayanamsa, err := astronomy.ComputeAyanamsa(ms, ayanamsaType)
	if err != nil {
		return lon, err
	}

	toSidereal := func(tropical float64) float64 {
		return utils.Normalize360(tropical - ayanamsa)
	}

	sunSid, err := astronomy.GetSiderealSunLongitude(ctx, ms, ayanamsaType)
	if err != nil {
		return lon, err
	}

	moonSid, err := astronomy.GetSiderealMoonLongitude(ctx, ms, ayanamsaType)
	if err != nil {
		return lon, err
	}

	marsTrop := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetMars, ms)
	mercTrop := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetMercury, ms)
	jupTrop := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetJupiter, ms)
	venTrop := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetVenus, ms)
	satTrop := astronomy.GetTropicalPlanetLongitude(ctx, astronomy.PlanetSaturn, ms)

	var rahuTrop float64
	if nodeType == NodeTrue {
		rahuTrop = getTrueRahuLongitudeTropical(ms)
	} else {
		rahuTrop = getMeanRahuLongitudeTropical(ms)
	}
	ketuTrop := utils.Normalize360(rahuTrop + 180)

	lon[types.GrahaSun] = sunSid
	lon[types.GrahaMoon] = moonSid
	lon[types.GrahaMars] = toSidereal(marsTrop)
	lon[types.GrahaMercury] = toSidereal(mercTrop)
	lon[types.GrahaJupiter] = toSidereal(jupTrop)
	lon[types.GrahaVenus] = toSidereal(venTrop)
	lon[types.GrahaSaturn] = toSidereal(satTrop)
	lon[types.GrahaRahu] = toSidereal(rahuTrop)
	lon[types.GrahaKetu] = toSidereal(ketuTrop)
	return lon, nil
}
