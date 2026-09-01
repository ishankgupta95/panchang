package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func altitudeExcessReference(ctx *EphemerisCtx, body RiseSetBody, ms float64, observer types.GeoLocation) float64 {
	msi := int64(ms)
	ttDays := TTDaysSinceJ2000(msi)
	utDays := (ms - float64(j2000NoonMS)) / dayMS
	t := ttDays / 36525

	var lonDeg, latDeg, distAu, radiusAu float64
	if body == RiseSetSun {
		p := GetSunPosition(ctx, msi)
		lonDeg, latDeg, distAu = p.Longitude, p.Latitude, p.Distance
		radiusAu = SunRadiusAU
	} else {
		p := GetMoonPosition(ctx, msi)
		lonDeg, latDeg, distAu = p.Longitude, p.Latitude, p.Distance/AuKm
		radiusAu = moonRadiusAU
	}

	_, deps := Nutation(ctx, t)
	eps := (MeanObliquityArcsec(t) + deps) * ArcsecToRad
	lon := lonDeg * degToRad
	lat := latDeg * degToRad
	cosLat := distAu * math.Cos(lat)
	ex := cosLat * math.Cos(lon)
	ey := cosLat * math.Sin(lon)
	ez := distAu * math.Sin(lat)
	bodyVec := [3]float64{
		ex,
		float64(math.Cos(eps)*ey) - float64(math.Sin(eps)*ez),
		float64(math.Sin(eps)*ey) + float64(math.Cos(eps)*ez),
	}

	gast := GastDegrees(ctx, ttDays, utDays)
	obs := ObserverVector(observer.Latitude, observer.Longitude, observer.Elevation, gast)
	topo := [3]float64{bodyVec[0] - obs[0], bodyVec[1] - obs[1], bodyVec[2] - obs[2]}
	distance := jsnum.Hypot3(topo[0], topo[1], topo[2])
	return AltitudeDegrees(topo, observer.Latitude, observer.Longitude, gast) +
		math.Asin(radiusAu/distance)*radToDeg +
		RefractionNearHorizonDeg
}

func dayEventsReference(ctx *EphemerisCtx, body RiseSetBody, direction int, observer types.GeoLocation, dayIndex int64) []float64 {
	dayStart := float64(dayIndex * dayMS)
	dayEnd := dayStart + dayMS
	const step = 30_000
	f := func(ms float64) float64 {
		return float64(direction) * altitudeExcessReference(ctx, body, ms, observer)
	}

	var events []float64
	prevMs := dayStart
	prevF := f(prevMs)
	for ms := dayStart + step; ms <= dayEnd; ms += step {
		value := f(ms)
		if prevF < 0 && value >= 0 {
			lo, hi, fLo := prevMs, ms, prevF
			for hi-lo > 1 {
				mid := (lo + hi) / 2
				fMid := f(mid)
				if (fLo < 0) == (fMid < 0) {
					lo, fLo = mid, fMid
				} else {
					hi = mid
				}
			}
			root := (lo + hi) / 2
			if root >= dayStart && root < dayEnd {
				events = append(events, root)
			}
		}
		prevMs = ms
		prevF = value
	}
	return events
}
