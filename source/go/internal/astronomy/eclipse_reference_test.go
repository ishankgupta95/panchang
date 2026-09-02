package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"
)

func referenceToEquatorial(ctx *EphemerisCtx, lonDeg, latDeg, distance, t float64) [3]float64 {
	_, deps := Nutation(ctx, t)
	eps := (MeanObliquityArcsec(t) + deps) * ArcsecToRad
	lon := lonDeg * degToRad
	lat := latDeg * degToRad
	x := distance * math.Cos(lat) * math.Cos(lon)
	y := distance * math.Cos(lat) * math.Sin(lon)
	z := distance * math.Sin(lat)
	return [3]float64{
		x,
		float64(math.Cos(eps)*y) - float64(math.Sin(eps)*z),
		float64(math.Sin(eps)*y) + float64(math.Cos(eps)*z),
	}
}

func scanMinimum(f func(ms float64) float64, fromMs, toMs, stepMs float64) float64 {
	sweep := func(lo, hi, step, seed float64) float64 {
		bestMs := seed
		bestValue := f(seed)
		for ms := lo; ms <= hi; ms += step {
			if value := f(ms); value < bestValue {
				bestValue, bestMs = value, ms
			}
		}
		return bestMs
	}
	coarse := sweep(fromMs, toMs, stepMs, fromMs)
	second := sweep(coarse-stepMs, coarse+stepMs, 1000, coarse)
	return sweep(second-1000, second+1000, 1, second)
}

func shadowAxisGamma(ctx *EphemerisCtx, ms float64) float64 {
	msi := int64(ms)
	t := TTDaysSinceJ2000(msi) / 36525
	sun := GetSunPosition(ctx, msi)
	moon := GetMoonPosition(ctx, msi)
	s := referenceToEquatorial(ctx, sun.Longitude, sun.Latitude, sun.Distance, t)
	m := referenceToEquatorial(ctx, moon.Longitude, moon.Latitude, moon.Distance/AuKm, t)

	dx, dy, dz := m[0]-s[0], m[1]-s[1], m[2]-s[2]
	length := jsnum.Hypot3(dx, dy, dz)
	ux, uy, uz := dx/length, dy/length, dz/length

	along := float64(m[0]*ux) + float64(m[1]*uy) + float64(m[2]*uz)
	px := m[0] - float64(along*ux)
	py := m[1] - float64(along*uy)
	pz := m[2] - float64(along*uz)

	nz := 1 - uz*uz
	nx, ny := -uz*ux, -uz*uy
	nLength := jsnum.Hypot3(nx, ny, nz)

	distanceAu := jsnum.Hypot3(px, py, pz)
	signed := (float64(px*nx) + float64(py*ny) + float64(pz*nz)) / nLength
	return (jsSign(signed) * distanceAu * AuKm) / EarthEquatorialRadiusKm
}

func jsSign(x float64) float64 {
	if math.IsNaN(x) {
		return math.NaN()
	}
	if x > 0 {
		return 1
	}
	if x < 0 {
		return -1
	}
	return x
}
