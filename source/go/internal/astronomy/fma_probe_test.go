package astronomy

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
)

func sumQuarticFused(s []float64, t float64) float64 {
	sum := 0.0
	for i := 0; i < len(s); i += 6 {
		phase := s[i+1] + t*(s[i+2]+t*(s[i+3]+t*(s[i+4]+t*s[i+5])))
		sum += s[i] * Sin(phase)
	}
	return sum
}

func sumLinearFused(s []float64, t float64) float64 {
	t2 := t * t
	sum := 0.0
	for i := 0; i < len(s); i += 4 {
		value := s[i] * Sin(s[i+1]+t*s[i+2])
		switch s[i+3] {
		case 0:
			sum += value
		case 1:
			sum += value * t
		default:
			sum += value * t2
		}
	}
	return sum
}

func moonElpLongitudeFused(t float64) float64 {
	periodic := sumQuarticFused(series.MOON_LONGITUDE_QUARTIC, t) +
		sumLinearFused(series.MOON_LONGITUDE_LINEAR, t)
	w := series.MOON_MEAN_LONGITUDE
	return periodic*ArcsecToRad + w[0] + t*(w[1]+t*(w[2]+t*(w[3]+t*w[4])))
}

func evaluateVsopFused(s []float64, tau float64) float64 {
	tau2 := tau * tau
	tau3 := tau2 * tau
	sum := 0.0
	for i := 0; i < len(s); i += 4 {
		value := s[i] * Cos(s[i+1]+s[i+2]*tau)
		switch s[i+3] {
		case 0:
			sum += value
		case 1:
			sum += value * tau
		case 2:
			sum += value * tau2
		case 3:
			sum += value * tau3
		default:
			sum += value * math.Pow(tau, s[i+3])
		}
	}
	return sum
}

var fusedProbes = []struct {
	name           string
	unit           string
	perUnit        float64
	shipped, fused func(float64) float64
}{
	{"moonElpLongitude", "arcsec", 1 / ArcsecToRad, MoonElpLongitude, moonElpLongitudeFused},
	{"moonElpLatitude", "arcsec", 1 / ArcsecToRad, MoonElpLatitude, func(tt float64) float64 {
		return (sumQuarticFused(series.MOON_LATITUDE_QUARTIC, tt) +
			sumLinearFused(series.MOON_LATITUDE_LINEAR, tt)) * ArcsecToRad
	}},
	{"moonElpDistance", "km", 1, MoonElpDistance, func(tt float64) float64 {
		return sumQuarticFused(series.MOON_DISTANCE_QUARTIC, tt) +
			sumLinearFused(series.MOON_DISTANCE_LINEAR, tt)
	}},
	{"heliocentricLongitude:earth", "arcsec", 1 / ArcsecToRad,
		func(tt float64) float64 { return HeliocentricLongitude(Earth, tt*36525) },
		func(tt float64) float64 { return evaluateVsopFused(series.EAR_L, Millennia(tt*36525)) }},
	{"heliocentricRadius:saturn", "AU", 1,
		func(tt float64) float64 { return HeliocentricRadius(Saturn, tt*36525) },
		func(tt float64) float64 { return evaluateVsopFused(series.SAT_R, Millennia(tt*36525)) }},
}

func TestFMABarriersAreLoadBearing(t *testing.T) {
	g := loadEphemerisGolden(t)
	samples, digests := g.sample()
	diverged := 0
	for _, p := range fusedProbes {
		if ephemerisDigest(p.fused, g.Seed, samples, g.TMaxCenturies) != digests[p.name] {
			diverged++
		}
	}
	if diverged == 0 {
		t.Logf("no unbarriered evaluator diverged: this build does not contract multiply-add, " +
			"so the barriers in elp.go and vsop87.go buy nothing here. They are still load-bearing " +
			"on a fusing target, so re-measure there before removing them.")
		return
	}
	t.Logf("%d of %d unbarriered evaluators diverge from the TypeScript; the barriers are load-bearing here",
		diverged, len(fusedProbes))
}

func TestFMADivergenceMagnitude(t *testing.T) {
	g := loadEphemerisGolden(t)
	samples, _ := g.sample()
	for _, p := range fusedProbes {
		worst := 0.0
		uniform(g.Seed, samples, g.TMaxCenturies, func(tt float64) {
			if d := math.Abs(p.shipped(tt) - p.fused(tt)); d > worst {
				worst = d
			}
		})
		t.Logf("%-30s contraction moves the answer by up to %.4g %s (over %d epochs)",
			p.name, worst*p.perUnit, p.unit, samples)
	}
}

func BenchmarkMoonElpLongitudeFused(b *testing.B) {
	t := 0.0
	for i := 0; i < b.N; i++ {
		t += 1e-7
		sinkFloat += moonElpLongitudeFused(t)
	}
}

func BenchmarkEvaluateVsopEarthLFused(b *testing.B) {
	tau := 0.0
	for i := 0; i < b.N; i++ {
		tau += 1e-8
		sinkFloat += evaluateVsopFused(series.EAR_L, tau)
	}
}
