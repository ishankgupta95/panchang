package jyotish

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/core"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
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

// IAU mean obliquity, t in Julian centuries from J2000; FMA-barriered.
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

// Meeus eq. 47.7.
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

// Meeus ch. 47, dominant term only.
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

type NodeType string

const (
	NodeMean NodeType = "mean"
	NodeTrue NodeType = "true"
)

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
	nodeType = resolveNodeType(nodeType)

	ayanamsa, err := astronomy.ComputeAyanamsa(ms, ayanamsaType)
	if err != nil {
		return types.PlanetaryPositions{}, err
	}

	toSidereal := func(tropical float64) float64 {
		return utils.Normalize360(tropical - ayanamsa)
	}

	sunSid, err := astronomy.GetSiderealSunLongitude(ctx, ms, ayanamsaType)
	if err != nil {
		return types.PlanetaryPositions{}, err
	}

	moonSid, err := astronomy.GetSiderealMoonLongitude(ctx, ms, ayanamsaType)
	if err != nil {
		return types.PlanetaryPositions{}, err
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

	marsRetro := isRetrograde(ctx, astronomy.PlanetMars, ms)
	mercRetro := isRetrograde(ctx, astronomy.PlanetMercury, ms)
	jupRetro := isRetrograde(ctx, astronomy.PlanetJupiter, ms)
	venRetro := isRetrograde(ctx, astronomy.PlanetVenus, ms)
	satRetro := isRetrograde(ctx, astronomy.PlanetSaturn, ms)

	g := func(planet types.Graha, sid float64, retro bool) types.GrahaPosition {
		return buildGrahaPosition(planet, sid, retro, nakshatraName, rashiName)
	}

	return types.PlanetaryPositions{
		Sun:     g(types.GrahaSun, sunSid, false),
		Moon:    g(types.GrahaMoon, moonSid, false),
		Mars:    g(types.GrahaMars, toSidereal(marsTrop), marsRetro),
		Mercury: g(types.GrahaMercury, toSidereal(mercTrop), mercRetro),
		Jupiter: g(types.GrahaJupiter, toSidereal(jupTrop), jupRetro),
		Venus:   g(types.GrahaVenus, toSidereal(venTrop), venRetro),
		Saturn:  g(types.GrahaSaturn, toSidereal(satTrop), satRetro),
		Rahu:    g(types.GrahaRahu, toSidereal(rahuTrop), true), // always retrograde
		Ketu:    g(types.GrahaKetu, toSidereal(ketuTrop), true),
	}, nil
}
