package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/jsnum"
)

const EarthEquatorialRadiusKm = 6378.1366

const earthFlattening float64 = 0.996647180302104

const EarthFlatteningSquared = earthFlattening * earthFlattening

const SunRadiusAU = 695700.0 / AuKm

const MoonRadiusKm = 1738.1

const RefractionNearHorizonDeg = 34.0 / 60

func GastDegrees(ctx *EphemerisCtx, ttDays, utDays float64) float64 {
	theta := float64(360 * jsnum.Mod(jsnum.Mod(0.7790572732640+float64(0.00273781191135448*utDays), 1)+jsnum.Mod(utDays, 1), 1))

	t := ttDays / 36525
	dpsi, deps := Nutation(ctx, t)
	trueObliquity := (MeanObliquityArcsec(t) + deps) * ArcsecToRad
	eqeq := float64(dpsi * math.Cos(trueObliquity))
	precession := 0.014506 +
		float64((4612.156534+float64((1.3915817+float64((-0.00000044+float64((-0.000029956+float64(-0.0000000368*t))*t))*t))*t))*t)

	gast := jsnum.Mod(theta+(eqeq+precession)/3600, 360)
	if gast < 0 {
		return gast + 360
	}
	return gast
}

func ObserverVector(latitudeDeg, longitudeDeg, elevationM, gastDeg float64) [3]float64 {
	phi := latitudeDeg * degToRad
	sinPhi := math.Sin(phi)
	cosPhi := math.Cos(phi)
	c := 1 / jsnum.Hypot2(cosPhi, earthFlattening*sinPhi)
	s := EarthFlatteningSquared * c
	heightKm := elevationM / 1000
	ach := float64(EarthEquatorialRadiusKm*c) + heightKm
	ash := float64(EarthEquatorialRadiusKm*s) + heightKm
	local := (gastDeg + longitudeDeg) * degToRad
	return [3]float64{
		(ach * cosPhi * math.Cos(local)) / AuKm,
		(ach * cosPhi * math.Sin(local)) / AuKm,
		(ash * sinPhi) / AuKm,
	}
}

func EclipticToEquatorial(ctx *EphemerisCtx, lonDeg, latDeg, distance, t float64) [3]float64 {
	_, deps := Nutation(ctx, t)
	eps := (MeanObliquityArcsec(t) + deps) * ArcsecToRad
	lon := lonDeg * degToRad
	lat := latDeg * degToRad
	cosLat := math.Cos(lat)
	x := distance * cosLat * math.Cos(lon)
	y := distance * cosLat * math.Sin(lon)
	z := distance * math.Sin(lat)
	cosEps := math.Cos(eps)
	sinEps := math.Sin(eps)
	return [3]float64{
		x,
		float64(cosEps*y) - float64(sinEps*z),
		float64(sinEps*y) + float64(cosEps*z),
	}
}

func AltitudeDegrees(vec [3]float64, latitudeDeg, longitudeDeg, gastDeg float64) float64 {
	phi := latitudeDeg * degToRad
	local := (gastDeg + longitudeDeg) * degToRad
	cosPhi := math.Cos(phi)
	zx := cosPhi * math.Cos(local)
	zy := cosPhi * math.Sin(local)
	zz := math.Sin(phi)
	length := jsnum.Hypot3(vec[0], vec[1], vec[2])
	if length == 0 {
		return 0
	}
	dot := (float64(vec[0]*zx) + float64(vec[1]*zy) + float64(vec[2]*zz)) / length
	return math.Asin(math.Max(-1, math.Min(1, dot))) * radToDeg
}

func GreenwichApparentSiderealDegrees(ctx *EphemerisCtx, ms int64) float64 {
	return GastDegrees(ctx, TTDaysSinceJ2000(ms), float64(ms-j2000NoonMS)/86_400_000)
}

func RefractionDegrees(geometricAltitudeDeg float64) float64 {
	if geometricAltitudeDeg < -90 || geometricAltitudeDeg > 90 {
		return 0
	}
	clamped := math.Max(geometricAltitudeDeg, -1)
	refraction := 1.02 / math.Tan((clamped+10.3/(clamped+5.11))*degToRad) / 60
	if geometricAltitudeDeg < -1 {
		refraction *= (geometricAltitudeDeg + 90) / 89
	}
	return refraction
}
