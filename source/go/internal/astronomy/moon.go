package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type MoonPosition struct {
	Longitude float64 `json:"longitude"`
	Latitude  float64 `json:"latitude"`
	Distance  float64 `json:"distance"`
}

func retardedCenturies(ttDays float64) float64 {
	return (ttDays - MoonElpDistanceCoarse(ttDays/36525)/KmPerLightDay) / 36525
}

func GetTropicalMoonLongitude(ctx *EphemerisCtx, ms int64) float64 {
	ttDays := TTDaysSinceJ2000(ms)
	t := retardedCenturies(ttDays)
	rotated := ElpToEclipticOfDate(MoonElpLongitude(t), MoonElpLatitudeCoarse(t), 1, t)
	lon := float64(math.Atan2(rotated[1], rotated[0]) * radToDeg)
	dpsi, _ := Nutation(ctx, ttDays/36525)
	return utils.Normalize360(lon + dpsi/3600)
}

func GetMoonPosition(ctx *EphemerisCtx, ms int64) MoonPosition {
	return moonPositionWith(ctx, ms, MoonElpLatitude, MoonElpDistance)
}

func GetMoonPositionForTrack(ctx *EphemerisCtx, ms int64) MoonPosition {
	return moonPositionWith(ctx, ms, MoonElpLatitude, MoonElpDistanceTrack)
}

func moonPositionWith(
	ctx *EphemerisCtx, ms int64,
	latitudeAt func(t float64) float64, distanceAt func(t float64) float64,
) MoonPosition {
	ttDays := TTDaysSinceJ2000(ms)
	t := retardedCenturies(ttDays)
	distance := distanceAt(t)
	rotated := ElpToEclipticOfDate(MoonElpLongitude(t), latitudeAt(t), distance, t)
	x, y, z := rotated[0], rotated[1], rotated[2]
	dpsi, _ := Nutation(ctx, ttDays/36525)
	return MoonPosition{
		Longitude: utils.Normalize360(float64(math.Atan2(y, x)*radToDeg) + dpsi/3600),
		Latitude:  math.Asin(z/distance) * radToDeg,
		Distance:  distance,
	}
}

func GetSiderealMoonLongitude(ctx *EphemerisCtx, ms int64, ayanamsaType types.AyanamsaType) (float64, error) {
	ayanamsa, err := ComputeAyanamsa(ms, ayanamsaType)
	if err != nil {
		return 0, err
	}
	return utils.Normalize360(GetTropicalMoonLongitude(ctx, ms) - ayanamsa), nil
}
