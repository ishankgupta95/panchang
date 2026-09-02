package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/jsnum"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy/series"
)

const turnArcsec = 1_296_000

const KmPerLightDay = float64(299_792.458) * 86_400

const AuKm float64 = 149_597_870.7

const eps0Arcsec = 84381.406

func MeanObliquityArcsec(t float64) float64 {
	return eps0Arcsec +
		float64((-46.836769+float64((-0.0001831+float64((0.00200340+float64((-0.000000576+float64(-0.0000000434*t))*t))*t))*t))*t)
}

func fundamentalArguments(t float64) [14]float64 {
	var out [14]float64
	out[0] = jsnum.Mod(485868.249036+
		float64((1717915923.2178+float64((31.8792+float64((0.051635+float64(-0.00024470*t))*t))*t))*t),
		turnArcsec) * ArcsecToRad
	out[1] = jsnum.Mod(1287104.79305+
		float64((129596581.0481+float64((-0.5532+float64((0.000136+float64(-0.00001149*t))*t))*t))*t),
		turnArcsec) * ArcsecToRad
	out[2] = jsnum.Mod(335779.526232+
		float64((1739527262.8478+float64((-12.7512+float64((-0.001037+float64(0.00000417*t))*t))*t))*t),
		turnArcsec) * ArcsecToRad
	out[3] = jsnum.Mod(1072260.70369+
		float64((1602961601.2090+float64((-6.3706+float64((0.006593+float64(-0.00003169*t))*t))*t))*t),
		turnArcsec) * ArcsecToRad
	out[4] = jsnum.Mod(450160.398036+
		float64((-6962890.5431+float64((7.4722+float64((0.007702+float64(-0.00005939*t))*t))*t))*t),
		turnArcsec) * ArcsecToRad
	out[5] = 4.402608842 + float64(2608.7903141574*t)
	out[6] = 3.176146697 + float64(1021.3285546211*t)
	out[7] = 1.753470314 + float64(628.3075849991*t)
	out[8] = 6.203480913 + float64(334.0612426700*t)
	out[9] = 0.599546497 + float64(52.9690962641*t)
	out[10] = 0.874016757 + float64(21.3299104960*t)
	out[11] = 5.481293872 + float64(7.4781598567*t)
	out[12] = 5.311886287 + float64(3.8133035638*t)
	out[13] = float64(0.02438175+float64(0.00000538691*t)) * t
	return out
}

const multipleCount = series.NUTATION_MAX_MULTIPLIER + 1

func fillMultipleTables(args [14]float64) (multSin, multCos [14 * multipleCount]float64) {
	for a := 0; a < 14; a++ {
		base := a * multipleCount
		sin1 := Sin(args[a])
		cos1 := Cos(args[a])
		multSin[base] = 0
		multCos[base] = 1
		sinK, cosK := sin1, cos1
		for k := 1; k < multipleCount; k++ {
			multSin[base+k] = sinK
			multCos[base+k] = cosK
			nextSin := float64(sinK*cos1) + float64(cosK*sin1)
			cosK = float64(cosK*cos1) - float64(sinK*sin1)
			sinK = nextSin
		}
	}
	return multSin, multCos
}

func sumNutation(coefficients []float64, multipliers []int8, t float64,
	multSin, multCos *[14 * multipleCount]float64) float64 {
	total := 0.0
	for i, m := 0, 0; i < len(coefficients); i, m = i+3, m+14 {
		argSin := 0.0
		argCos := 1.0
		for k := 0; k < 14; k++ {
			mult := int(multipliers[m+k])
			if mult == 0 {
				continue
			}
			abs := mult
			if abs < 0 {
				abs = -abs
			}
			index := k*multipleCount + abs
			termCos := multCos[index]
			termSin := multSin[index]
			if mult < 0 {
				termSin = -termSin
			}
			nextSin := float64(argSin*termCos) + float64(argCos*termSin)
			argCos = float64(argCos*termCos) - float64(argSin*termSin)
			argSin = nextSin
		}
		value := float64(coefficients[i]*argSin) + float64(coefficients[i+1]*argCos)
		if coefficients[i+2] == 0 {
			total += value
		} else {
			total += float64(value * t)
		}
	}
	return total
}

func Nutation(ctx *EphemerisCtx, t float64) (dpsi, deps float64) {
	for i := 0; i < ctx.nutMemoLive; i++ {
		if ctx.nutMemoT[i] == t {
			return ctx.nutMemoPsi[i], ctx.nutMemoEps[i]
		}
	}
	args := fundamentalArguments(t)
	multSin, multCos := fillMultipleTables(args)
	dpsi = sumNutation(series.NUTATION_PSI, series.NUTATION_PSI_ARGS, t, &multSin, &multCos)
	deps = sumNutation(series.NUTATION_EPS, series.NUTATION_EPS_ARGS, t, &multSin, &multCos)

	ctx.nutMemoT[ctx.nutMemoNext] = t
	ctx.nutMemoPsi[ctx.nutMemoNext] = dpsi
	ctx.nutMemoEps[ctx.nutMemoNext] = deps
	ctx.nutMemoNext = (ctx.nutMemoNext + 1) % nutationMemoSize
	if ctx.nutMemoLive < nutationMemoSize {
		ctx.nutMemoLive++
	}
	return dpsi, deps
}

const (
	elpP0 = 0.10180391e-4
	elpP1 = 0.47020439e-6
	elpP2 = -0.5417367e-9
	elpP3 = -0.2507948e-11
	elpP4 = 0.463486e-14

	elpQ0 = -0.113469002e-3
	elpQ1 = 0.12372674e-6
	elpQ2 = 0.1265417e-8
	elpQ3 = -0.1371808e-11
	elpQ4 = -0.320334e-14
)

func ElpToEclipticOfDate(lon, lat, dist, t float64) [3]float64 {
	cl := dist * math.Cos(lat)
	x0 := cl * math.Cos(lon)
	y0 := cl * math.Sin(lon)
	z0 := dist * math.Sin(lat)

	pw := float64(elpP0+float64((elpP1+float64((elpP2+float64((elpP3+float64(elpP4*t))*t))*t))*t)) * t
	qw := float64(elpQ0+float64((elpQ1+float64((elpQ2+float64((elpQ3+float64(elpQ4*t))*t))*t))*t)) * t
	ra := 2 * math.Sqrt(1-float64(pw*pw)-float64(qw*qw))
	pwqw := 2 * pw * qw
	pw2 := 1 - float64(2*pw*pw)
	qw2 := 1 - float64(2*qw*qw)
	pw *= ra
	qw *= ra
	x := float64(pw2*x0) + float64(pwqw*y0) + float64(pw*z0)
	y := float64(pwqw*x0) + float64(qw2*y0) - float64(qw*z0)
	z := -float64(pw*x0) + float64(qw*y0) + float64((pw2+qw2-1)*z0)

	c := math.Cos(eps0Arcsec * ArcsecToRad)
	s := math.Sin(eps0Arcsec * ArcsecToRad)
	ty := float64(c*y) - float64(s*z)
	z = float64(s*y) + float64(c*z)
	y = ty

	zeta := float64(2306.083227+float64((0.2988499+float64((0.01801828+float64((-0.000005971+float64(-0.0000003173*t))*t))*t))*t)) * t
	zA := float64(2306.077181+float64((1.0927348+float64((0.01826837+float64((-0.000028596+float64(-0.0000002904*t))*t))*t))*t)) * t
	theta := float64(2004.191903+float64((-0.4294934+float64((-0.04182264+float64((-0.000007089+float64(-0.0000001274*t))*t))*t))*t)) * t

	c, s = math.Cos(zeta*ArcsecToRad), math.Sin(zeta*ArcsecToRad)
	tx := float64(c*x) - float64(s*y)
	y = float64(s*x) + float64(c*y)
	x = tx

	c, s = math.Cos(theta*ArcsecToRad), math.Sin(theta*ArcsecToRad)
	tx = float64(c*x) - float64(s*z)
	z = float64(s*x) + float64(c*z)
	x = tx

	c, s = math.Cos(zA*ArcsecToRad), math.Sin(zA*ArcsecToRad)
	tx = float64(c*x) - float64(s*y)
	y = float64(s*x) + float64(c*y)
	x = tx

	eps := MeanObliquityArcsec(t) * ArcsecToRad
	c, s = math.Cos(eps), math.Sin(eps)
	ty = float64(c*y) + float64(s*z)
	z = -float64(s*y) + float64(c*z)

	return [3]float64{x, ty, z}
}

const VsopToFK5Arcsec float64 = -0.09033

const VsopToFK5LatArcsec float64 = 0.03916
