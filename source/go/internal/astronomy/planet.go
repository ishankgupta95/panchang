package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
)

type PlanetBody VsopBody

const (
	PlanetMercury = PlanetBody(Mercury)
	PlanetVenus   = PlanetBody(Venus)
	PlanetMars    = PlanetBody(Mars)
	PlanetJupiter = PlanetBody(Jupiter)
	PlanetSaturn  = PlanetBody(Saturn)
)

var AllPlanetBodies = []PlanetBody{
	PlanetMercury, PlanetVenus, PlanetMars, PlanetJupiter, PlanetSaturn,
}

type PlanetPosition struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Distance  float64 `json:"distance"`
}

func GetPlanetPosition(ctx *EphemerisCtx, body PlanetBody, ms int64) PlanetPosition {
	ttDays := TTDaysSinceJ2000(ms)

	series := VsopBody(body)
	earth := EarthRect(ctx, ttDays)

	lightDays := 0.0
	for pass := 0; pass < 2; pass++ {
		planet := HeliocentricRect(series, ttDays-lightDays)
		dx := planet[0] - earth[0]
		dy := planet[1] - earth[1]
		dz := planet[2] - earth[2]
		lightDays = (math.Sqrt(float64(dx*dx)+float64(dy*dy)+float64(dz*dz)) * AuKm) / KmPerLightDay
	}

	retarded := ttDays - lightDays
	earth = EarthRect(ctx, retarded)
	planet := HeliocentricRect(series, retarded)
	x := planet[0] - earth[0]
	y := planet[1] - earth[1]
	z := planet[2] - earth[2]
	distance := math.Sqrt(float64(x*x) + float64(y*y) + float64(z*z))

	dpsi, _ := Nutation(ctx, ttDays/36525)
	return PlanetPosition{
		Longitude: utils.Normalize360(float64(math.Atan2(y, x)*radToDeg) + (dpsi+VsopToFK5Arcsec)/3600),
		Latitude:  math.Asin(z/distance) * radToDeg,
		Distance:  distance,
	}
}

func GetTropicalPlanetLongitude(ctx *EphemerisCtx, body PlanetBody, ms int64) float64 {
	return GetPlanetPosition(ctx, body, ms).Longitude
}
