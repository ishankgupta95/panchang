package astronomy

import "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"

// ELP2000-82B: the Moon in ELP's own frame; frame.go carries it to the equinox of date.
// The Sin here and the float64(...) barriers are load-bearing.

func sumQuartic(s []float64, t float64) float64 {
	sum := 0.0
	for i := 0; i < len(s); i += 6 {
		phase := s[i+1] + float64(t*(s[i+2]+float64(t*(s[i+3]+float64(t*(s[i+4]+float64(t*s[i+5])))))))
		sum += float64(s[i] * Sin(phase))
	}
	return sum
}

func sumLinear(s []float64, t float64) float64 {
	t2 := t * t
	sum := 0.0
	for i := 0; i < len(s); i += 4 {
		value := float64(s[i] * Sin(s[i+1]+float64(t*s[i+2])))
		switch s[i+3] {
		case 0:
			sum += value
		case 1:
			sum += float64(value * t)
		default:
			sum += float64(value * t2)
		}
	}
	return sum
}

func MoonElpLongitude(t float64) float64 {
	periodic := sumQuartic(series.MOON_LONGITUDE_QUARTIC, t) + sumLinear(series.MOON_LONGITUDE_LINEAR, t)
	w := series.MOON_MEAN_LONGITUDE
	return float64(periodic*ArcsecToRad) + w[0] +
		float64(t*(w[1]+float64(t*(w[2]+float64(t*(w[3]+float64(t*w[4])))))))
}

func MoonElpLatitude(t float64) float64 {
	return (sumQuartic(series.MOON_LATITUDE_QUARTIC, t) + sumLinear(series.MOON_LATITUDE_LINEAR, t)) * ArcsecToRad
}

// 19″, enough for the frame rotation.
func MoonElpLatitudeCoarse(t float64) float64 {
	return (sumQuartic(series.MOON_LATITUDE_COARSE_QUARTIC, t) +
		sumLinear(series.MOON_LATITUDE_COARSE_LINEAR, t)) * ArcsecToRad
}

func MoonElpDistance(t float64) float64 {
	return sumQuartic(series.MOON_DISTANCE_QUARTIC, t) + sumLinear(series.MOON_DISTANCE_LINEAR, t)
}

// 5 km, the rise/set track's tier.
func MoonElpDistanceTrack(t float64) float64 {
	return sumQuartic(series.MOON_DISTANCE_TRACK_QUARTIC, t) + sumLinear(series.MOON_DISTANCE_TRACK_LINEAR, t)
}

// 89 km, light-time only.
func MoonElpDistanceCoarse(t float64) float64 {
	return sumQuartic(series.MOON_DISTANCE_COARSE_QUARTIC, t) + sumLinear(series.MOON_DISTANCE_COARSE_LINEAR, t)
}
