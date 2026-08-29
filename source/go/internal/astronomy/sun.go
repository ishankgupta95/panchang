package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type SunPosition struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Distance  float64 `json:"distance"`
}

// No precession: VSOP87D is already of date; the light-time retardation stands in for aberration.
func GetTropicalSunLongitude(ctx *EphemerisCtx, ms int64) float64 {
	ttDays := TTDaysSinceJ2000(ms)
	retarded := ttDays - (EarthRadiusCoarse(ttDays)*AuKm)/KmPerLightDay
	// Anti-FMA barrier.
	lon := float64(HeliocentricLongitude(Earth, retarded)*radToDeg) + 180
	dpsi, _ := Nutation(ctx, ttDays/36525)
	return utils.Normalize360(lon + (dpsi+VsopToFK5Arcsec)/3600)
}

func GetSunPosition(ctx *EphemerisCtx, ms int64) SunPosition {
	ttDays := TTDaysSinceJ2000(ms)
	retarded := ttDays - (EarthRadiusCoarse(ttDays)*AuKm)/KmPerLightDay
	lon := float64(HeliocentricLongitude(Earth, retarded)*radToDeg) + 180
	lat := -float64(HeliocentricLatitude(Earth, retarded) * radToDeg)
	dpsi, _ := Nutation(ctx, ttDays/36525)
	return SunPosition{
		Longitude: utils.Normalize360(lon + (dpsi+VsopToFK5Arcsec)/3600),
		Latitude:  lat + float64((VsopToFK5LatArcsec/3600)*(math.Cos(lon*degToRad)-math.Sin(lon*degToRad))),
		Distance:  HeliocentricRadius(Earth, retarded),
	}
}

func GetSiderealSunLongitude(ctx *EphemerisCtx, ms int64, ayanamsaType types.AyanamsaType) (float64, error) {
	ayanamsa, err := ComputeAyanamsa(ms, ayanamsaType)
	if err != nil {
		return 0, err
	}
	return utils.Normalize360(GetTropicalSunLongitude(ctx, ms) - ayanamsa), nil
}
