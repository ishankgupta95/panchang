package astronomy

import (
	"math"
	"sync"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
)

func earthRectDirect(ttDays float64) [3]float64 {
	tau := Millennia(ttDays)
	lon := EvaluateVsop(series.EAR_L_PRECISE, tau)
	lat := EvaluateVsop(series.EAR_B_PRECISE, tau)
	r := EvaluateVsop(series.EAR_R, tau)
	cosLat := r * math.Cos(lat)
	return [3]float64{cosLat * math.Cos(lon), cosLat * math.Sin(lon), r * math.Sin(lat)}
}

func TestEarthRectAtJ2000(t *testing.T) {
	ctx := NewEphemerisCtx()
	got := EarthRect(ctx, 0)
	if got == [3]float64{} {
		t.Fatal("EarthRect at J2000 returned the zero vector: an unwritten memo slot matched")
	}
	want := earthRectDirect(0)
	if got != want {
		t.Fatalf("EarthRect(0) = %v, direct evaluation gives %v", got, want)
	}
	if d := math.Hypot(math.Hypot(got[0], got[1]), got[2]); d < 0.98 || d > 1.02 {
		t.Fatalf("Earth is %v AU from the Sun at J2000", d)
	}
}

func TestEarthRectMemoHitEqualsMiss(t *testing.T) {
	ctx := NewEphemerisCtx()
	for _, ttDays := range []float64{0, 1, -1, 9131.5, -36524.25, 1e-9} {
		miss := EarthRect(ctx, ttDays)
		hit := EarthRect(ctx, ttDays)
		if miss != hit {
			t.Errorf("ttDays=%v: miss %v, hit %v", ttDays, miss, hit)
		}
		if want := earthRectDirect(ttDays); miss != want {
			t.Errorf("ttDays=%v: memoised %v, direct %v", ttDays, miss, want)
		}
	}
}

func TestEarthRectMemoEviction(t *testing.T) {
	ctx := NewEphemerisCtx()
	epochs := []float64{0, 1, 2, 3, 4, 5, 0, 1}
	for _, e := range epochs {
		if got, want := EarthRect(ctx, e), earthRectDirect(e); got != want {
			t.Fatalf("ttDays=%v after eviction: %v, want %v", e, got, want)
		}
	}
	if ctx.earthMemoLive != earthMemoSize {
		t.Errorf("memo live count is %d after %d inserts, want %d", ctx.earthMemoLive, len(epochs), earthMemoSize)
	}
}

func TestEphemerisCtxIsPerRequest(t *testing.T) {
	epochs := []float64{0, 1000.25, -2000.5, 3, 4, 5}
	want := make([][3]float64, len(epochs))
	for i, e := range epochs {
		want[i] = earthRectDirect(e)
	}

	const workers = 16
	var wg sync.WaitGroup
	errs := make([]string, workers)
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			ctx := NewEphemerisCtx()
			for pass := 0; pass < 50; pass++ {
				for i, e := range epochs {
					if got := EarthRect(ctx, e); got != want[i] {
						errs[w] = "EarthRect diverged under concurrency"
						return
					}
				}
			}
		}(w)
	}
	wg.Wait()
	for w, e := range errs {
		if e != "" {
			t.Errorf("worker %d: %s", w, e)
		}
	}
}

func TestVsopSeriesTableTotality(t *testing.T) {
	names := map[VsopBody]string{
		Earth: "Earth", Mercury: "Mercury", Venus: "Venus",
		Mars: "Mars", Jupiter: "Jupiter", Saturn: "Saturn",
	}
	if len(names) != int(numVsopBodies) {
		t.Fatalf("%d named bodies, %d in the enum", len(names), numVsopBodies)
	}
	for body := VsopBody(0); body < numVsopBodies; body++ {
		for v, s := range vsopSeriesTable[body] {
			if len(s) == 0 {
				t.Errorf("%s variable %d has no terms", names[body], v)
			}
			if len(s)%4 != 0 {
				t.Errorf("%s variable %d: %d values is not a multiple of the stride 4", names[body], v, len(s))
			}
		}
	}
}

func TestHeliocentricRectAgreesWithSpherical(t *testing.T) {
	for _, ttDays := range []float64{0, 3652.5, -18262.5, 36525} {
		for body := VsopBody(0); body < numVsopBodies; body++ {
			rect := HeliocentricRect(body, ttDays)
			lon := HeliocentricLongitude(body, ttDays)
			lat := HeliocentricLatitude(body, ttDays)
			r := HeliocentricRadius(body, ttDays)
			gotR := math.Sqrt(rect[0]*rect[0] + rect[1]*rect[1] + rect[2]*rect[2])
			if math.Abs(gotR-r) > 1e-12*math.Abs(r) {
				t.Errorf("body %d at %v: |rect| = %v, radius = %v", body, ttDays, gotR, r)
			}
			gotLat := math.Asin(rect[2] / gotR)
			if math.Abs(gotLat-lat) > 1e-12 {
				t.Errorf("body %d at %v: rect latitude %v, series %v", body, ttDays, gotLat, lat)
			}
			gotLon := math.Atan2(rect[1], rect[0])
			d := math.Mod(gotLon-lon, 2*math.Pi)
			if d > math.Pi {
				d -= 2 * math.Pi
			} else if d < -math.Pi {
				d += 2 * math.Pi
			}
			if math.Abs(d) > 1e-12 {
				t.Errorf("body %d at %v: rect longitude off by %v rad", body, ttDays, d)
			}
		}
	}
}

func TestEvaluateVsopEmpty(t *testing.T) {
	if got := EvaluateVsop(nil, 0.5); got != 0 {
		t.Errorf("EvaluateVsop(nil) = %v, want 0", got)
	}
	if got := EvaluateVsop([]float64{}, 0.5); got != 0 {
		t.Errorf("EvaluateVsop(empty) = %v, want 0", got)
	}
}

func TestEvaluateVsopPowerDispatch(t *testing.T) {
	const tau = 0.37
	for power := 0; power <= 5; power++ {
		s := []float64{2.5, 0.25, 1.5, float64(power)}
		want := 2.5 * Cos(0.25+1.5*tau) * math.Pow(tau, float64(power))
		got := EvaluateVsop(s, tau)
		if math.Abs(got-want) > 1e-15*math.Abs(want) {
			t.Errorf("power %d: got %v, want %v", power, got, want)
		}
	}
}
