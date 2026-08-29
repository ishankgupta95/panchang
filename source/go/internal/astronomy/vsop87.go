package astronomy

import (
	"math"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
)

type VsopBody int

const (
	Earth VsopBody = iota
	Mercury
	Venus
	Mars
	Jupiter
	Saturn
	numVsopBodies
)

var vsopSeriesTable = [numVsopBodies][3][]float64{
	Earth:   {series.EAR_L, series.EAR_B, series.EAR_R},
	Mercury: {series.MER_L, series.MER_B, series.MER_R},
	Venus:   {series.VEN_L, series.VEN_B, series.VEN_R},
	Mars:    {series.MAR_L, series.MAR_B, series.MAR_R},
	Jupiter: {series.JUP_L, series.JUP_B, series.JUP_R},
	Saturn:  {series.SAT_L, series.SAT_B, series.SAT_R},
}

func EvaluateVsop(s []float64, tau float64) float64 {
	tau2 := tau * tau
	tau3 := tau2 * tau
	sum := 0.0
	for i := 0; i < len(s); i += 4 {
		// Anti-FMA barrier.
		value := float64(s[i] * Cos(s[i+1]+float64(s[i+2]*tau)))
		switch s[i+3] {
		case 0:
			sum += value
		case 1:
			sum += float64(value * tau)
		case 2:
			sum += float64(value * tau2)
		case 3:
			sum += float64(value * tau3)
		default:
			sum += float64(value * math.Pow(tau, s[i+3]))
		}
	}
	return sum
}

func Millennia(ttDays float64) float64 { return ttDays / 365250 }

func HeliocentricLongitude(body VsopBody, ttDays float64) float64 {
	return EvaluateVsop(vsopSeriesTable[body][0], Millennia(ttDays))
}

func HeliocentricLatitude(body VsopBody, ttDays float64) float64 {
	return EvaluateVsop(vsopSeriesTable[body][1], Millennia(ttDays))
}

func HeliocentricRadius(body VsopBody, ttDays float64) float64 {
	return EvaluateVsop(vsopSeriesTable[body][2], Millennia(ttDays))
}

// 8e-5 AU, enough only for the Sun's light-time.
func EarthRadiusCoarse(ttDays float64) float64 {
	return EvaluateVsop(series.EAR_R_COARSE, Millennia(ttDays))
}

func HeliocentricRect(body VsopBody, ttDays float64) [3]float64 {
	tau := Millennia(ttDays)
	s := vsopSeriesTable[body]
	lon := EvaluateVsop(s[0], tau)
	lat := EvaluateVsop(s[1], tau)
	r := EvaluateVsop(s[2], tau)
	cosLat := r * math.Cos(lat)
	return [3]float64{cosLat * math.Cos(lon), cosLat * math.Sin(lon), r * math.Sin(lat)}
}

func EarthRect(ctx *EphemerisCtx, ttDays float64) [3]float64 {
	// Only the filled prefix: an unwritten slot holds 0.0, which is J2000 exactly.
	for i := 0; i < ctx.earthMemoLive; i++ {
		if ctx.earthMemoKey[i] == ttDays {
			return ctx.earthMemoVal[i]
		}
	}
	tau := Millennia(ttDays)
	lon := EvaluateVsop(series.EAR_L_PRECISE, tau)
	lat := EvaluateVsop(series.EAR_B_PRECISE, tau)
	r := EvaluateVsop(series.EAR_R, tau)
	cosLat := r * math.Cos(lat)
	out := [3]float64{cosLat * math.Cos(lon), cosLat * math.Sin(lon), r * math.Sin(lat)}

	ctx.earthMemoKey[ctx.earthMemoNext] = ttDays
	ctx.earthMemoVal[ctx.earthMemoNext] = out
	ctx.earthMemoNext = (ctx.earthMemoNext + 1) % earthMemoSize
	if ctx.earthMemoLive < earthMemoSize {
		ctx.earthMemoLive++
	}
	return out
}
