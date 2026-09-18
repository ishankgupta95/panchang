package astronomy

import "github.com/ishankgupta95/panchang/source/go/v5/types"

type HorizonBody int

const (
	HorizonSun HorizonBody = iota
	HorizonMoon
)

func BodyAltitudeDegrees(ctx *EphemerisCtx, ms int64, location types.GeoLocation, body HorizonBody) float64 {
	ttDays := TTDaysSinceJ2000(ms)
	utDays := float64(ms-j2000NoonMS) / 86_400_000
	t := ttDays / 36525

	var bodyVec [3]float64
	if body == HorizonSun {
		position := GetSunPosition(ctx, ms)
		bodyVec = EclipticToEquatorial(ctx, position.Longitude, position.Latitude, position.Distance, t)
	} else {
		position := GetMoonPosition(ctx, ms)
		bodyVec = EclipticToEquatorial(ctx, position.Longitude, position.Latitude, position.Distance/AuKm, t)
	}

	gast := GastDegrees(ctx, ttDays, utDays)
	observer := ObserverVector(location.Latitude, location.Longitude, location.Elevation, gast)
	topocentric := [3]float64{
		bodyVec[0] - observer[0],
		bodyVec[1] - observer[1],
		bodyVec[2] - observer[2],
	}

	geometric := AltitudeDegrees(topocentric, location.Latitude, location.Longitude, gast)
	return geometric + RefractionDegrees(geometric)
}

func SunAltitudeDegrees(ctx *EphemerisCtx, ms int64, location types.GeoLocation) float64 {
	return BodyAltitudeDegrees(ctx, ms, location, HorizonSun)
}

func IsSunAboveHorizon(ctx *EphemerisCtx, ms int64, location types.GeoLocation) bool {
	return SunAltitudeDegrees(ctx, ms, location) > 0
}
