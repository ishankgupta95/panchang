package gen

const tMax = 1.5

const probeCount = 100_000

const probeSeed = 20260806

const (
	budgetMoonLon  = 0.4
	budgetMoonLat  = 0.2
	budgetMoonDist = 0.2

	budgetMoonLatCoarse = 20

	budgetMoonDistCoarse = 100

	budgetMoonDistTrack = 5

	budgetSunLon = 0.4
	budgetSunLat = 0.4

	budgetPlanetEarthLon = 0.1
	budgetPlanetEarthLat = 0.1

	budgetPlanetLon = 0.5
	budgetPlanetLat = 0.5

	budgetRadiusAngleArcsec = 0.3

	budgetSunRadiusCoarse = 1e-4

	budgetNutationCut = 500e-6
)

const quantizationBudget = 0.005

const arcsecPerRad = 206264.806

var minGeocentricDistanceAU = map[string]float64{
	"ear": 0.98, "mer": 0.54, "ven": 0.26, "mar": 0.37, "jup": 3.9, "sat": 7.9,
}
