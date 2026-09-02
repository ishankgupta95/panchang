package astronomy

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy/series"
)

func TestSumQuarticMatchesDefinition(t *testing.T) {
	s := []float64{
		2.0, 0.1, 0.2, 0.3, 0.4, 0.5,
		-3.0, 1.1, -1.2, 1.3, -1.4, 1.5,
	}
	const tt = 0.75
	want := 0.0
	for i := 0; i < len(s); i += 6 {
		phase := s[i+1] + tt*(s[i+2]+tt*(s[i+3]+tt*(s[i+4]+tt*s[i+5])))
		want += s[i] * Sin(phase)
	}
	if got := sumQuartic(s, tt); math.Abs(got-want) > 1e-14*math.Abs(want) {
		t.Errorf("sumQuartic = %v, want %v", got, want)
	}
	if got := sumQuartic(nil, tt); got != 0 {
		t.Errorf("sumQuartic(nil) = %v, want 0", got)
	}
}

func TestSumLinearPowerDispatch(t *testing.T) {
	const tt = 0.75
	for _, power := range []float64{0, 1, 2} {
		s := []float64{2.0, 0.25, 1.5, power}
		base := 2.0 * Sin(0.25+tt*1.5)
		want := base
		switch power {
		case 1:
			want = base * tt
		case 2:
			want = base * (tt * tt)
		}
		if got := sumLinear(s, tt); math.Abs(got-want) > 1e-14*math.Abs(want) {
			t.Errorf("power %v: sumLinear = %v, want %v", power, got, want)
		}
	}
	if got := sumLinear(nil, tt); got != 0 {
		t.Errorf("sumLinear(nil) = %v, want 0", got)
	}
}

func TestElpAccessorsAreTiered(t *testing.T) {
	epochs := []float64{-1.5, -0.5, 0, 0.37, 1.0, 1.5}
	for _, tt := range epochs {
		lat := MoonElpLatitude(tt) / ArcsecToRad
		latCoarse := MoonElpLatitudeCoarse(tt) / ArcsecToRad
		if d := math.Abs(lat - latCoarse); d > 20 {
			t.Errorf("t=%v: coarse latitude is %v″ from the full series, budget 20″", tt, d)
		}

		dist := MoonElpDistance(tt)
		if d := math.Abs(dist - MoonElpDistanceTrack(tt)); d > 5 {
			t.Errorf("t=%v: track distance is %v km from the full series, budget 5 km", tt, d)
		}
		if d := math.Abs(dist - MoonElpDistanceCoarse(tt)); d > 100 {
			t.Errorf("t=%v: coarse distance is %v km from the full series, budget 100 km", tt, d)
		}
		for name, v := range map[string]float64{
			"full": dist, "track": MoonElpDistanceTrack(tt), "coarse": MoonElpDistanceCoarse(tt),
		} {
			if v < 350_000 || v > 410_000 {
				t.Errorf("t=%v: %s distance is %v km", tt, name, v)
			}
		}
	}
}

func TestMoonElpLongitudeIncludesW1(t *testing.T) {
	for _, tt := range []float64{-1.5, 0, 0.37, 1.5} {
		w := series.MOON_MEAN_LONGITUDE
		periodic := float64((sumQuartic(series.MOON_LONGITUDE_QUARTIC, tt) +
			sumLinear(series.MOON_LONGITUDE_LINEAR, tt)) * ArcsecToRad)
		want := periodic + w[0] +
			float64(tt*(w[1]+float64(tt*(w[2]+float64(tt*(w[3]+float64(tt*w[4])))))))
		if got := MoonElpLongitude(tt); got != want {
			t.Errorf("t=%v: MoonElpLongitude = %v, transcribed form gives %v", tt, got, want)
		}
		if math.Abs(periodic) > 0.2 {
			t.Errorf("t=%v: periodic part is %v rad, so the arcsecond conversion looks wrong", tt, periodic)
		}
	}
}

func BenchmarkMoonElpLongitude(b *testing.B) {
	t := 0.0
	for i := 0; i < b.N; i++ {
		t += 1e-7
		sinkFloat += MoonElpLongitude(t)
	}
}

func BenchmarkEvaluateVsopEarthL(b *testing.B) {
	tau := 0.0
	for i := 0; i < b.N; i++ {
		tau += 1e-8
		sinkFloat += EvaluateVsop(series.EAR_L, tau)
	}
}
