package gen

// Julian centuries; 1.5 covers 1850-2150.
const tMax = 1.5

const probeCount = 100_000

// Pinned: changing it changes every term count in the shipped series.
const probeSeed = 20260806

// Arcseconds, except distances in km and budgetSunRadiusCoarse in AU.
const (
	budgetMoonLon  = 0.4
	budgetMoonLat  = 0.2
	budgetMoonDist = 0.2

	// Frame rotation only: 20″ of latitude costs <0.005″ of longitude.
	budgetMoonLatCoarse = 20

	// Light-time only: 100 km is 0.0002″ of longitude.
	budgetMoonDistCoarse = 100

	// Rise/set only: 5 km moves moonrise by 0.003 s.
	budgetMoonDistTrack = 5

	budgetSunLon = 0.4
	budgetSunLat = 0.4

	// Tighter: planet − Earth amplifies Earth's error by r_E / Δ.
	budgetPlanetEarthLon = 0.1
	budgetPlanetEarthLat = 0.1

	budgetPlanetLon = 0.5
	budgetPlanetLat = 0.5

	// Stated as the angle it costs, δR / Δ: a fixed AU budget is too tight for Saturn.
	budgetRadiusAngleArcsec = 0.3

	// AU, light-time only: 1e-4 AU is 0.002″ of longitude.
	budgetSunRadiusCoarse = 1e-4

	budgetNutationCut = 500e-6
)

const quantizationBudget = 0.005

// Deliberately this literal, not 180*3600/π (206264.80624709636).
const arcsecPerRad = 206264.806

// Earth's entry is its heliocentric radius, not a geocentric distance.
var minGeocentricDistanceAU = map[string]float64{
	"ear": 0.98, "mer": 0.54, "ven": 0.26, "mar": 0.37, "jup": 3.9, "sat": 7.9,
}
