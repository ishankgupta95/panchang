package astronomy

import (
	"encoding/json"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
)

type horizonsPositions struct {
	Comment   string    `json:"_comment"`
	Source    string    `json:"source"`
	Ephemeris string    `json:"ephemeris"`
	Frame     string    `json:"frame"`
	TimeScale string    `json:"timeScale"`
	JdTt      []float64 `json:"jdTt"`
	Positions map[string][]struct {
		Elon float64 `json:"elon"`
		Elat float64 `json:"elat"`
	} `json:"positions"`
}

func loadHorizonsPositions(t *testing.T) horizonsPositions {
	t.Helper()
	b, err := repopath.ReadTestData("reference", "horizons-positions.json")
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f horizonsPositions
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	if len(f.JdTt) < 250 {
		t.Fatalf("fixture has %d epochs, expected 250", len(f.JdTt))
	}
	if f.TimeScale != "TT" {
		t.Fatalf("fixture timeScale is %q; the epoch inversion below assumes TT", f.TimeScale)
	}
	return f
}

func angularDelta(a, b float64) float64 {
	d := math.Mod(a-b, 360)
	if d > 180 {
		d -= 360
	}
	if d <= -180 {
		d += 360
	}
	return d
}

func msForTt(jdTt float64) int64 {
	ttDays := jdTt - 2451545.0
	ms := ttDays*86_400_000 + float64(j2000NoonMS)
	for i := 0; i < 3; i++ {
		ms += (ttDays - TTDaysSinceJ2000(int64(ms))) * 86_400_000
	}
	return int64(ms)
}

type errorCurve struct {
	max, mean, bias float64
	worstYear       int
}

func measureCurve(f horizonsPositions, body string, longitudeAt func(ms int64) float64) errorCurve {
	truth := f.Positions[body]
	var sumAbs, sumSigned, max, worst float64
	for i, jd := range f.JdTt {
		err := angularDelta(longitudeAt(msForTt(jd)), truth[i].Elon) * 3600
		sumAbs += math.Abs(err)
		sumSigned += err
		if math.Abs(err) > max {
			max, worst = math.Abs(err), jd
		}
	}
	n := float64(len(f.JdTt))
	return errorCurve{
		max: max, mean: sumAbs / n, bias: sumSigned / n,
		worstYear: int(math.Round(2000 + (worst-2451545.0)/365.25)),
	}
}

var ownMaxArcsec = map[string]float64{
	"Sun": 0.5, "Moon": 1.6,
	"Mercury": 0.7, "Venus": 1.5, "Mars": 2.0, "Jupiter": 1.2, "Saturn": 1.2,
}

func TestTier0SunAndMoon(t *testing.T) {
	f := loadHorizonsPositions(t)
	ctx := NewEphemerisCtx()
	for _, c := range []struct {
		name string
		at   func(ms int64) float64
	}{
		{"Sun", func(ms int64) float64 { return GetTropicalSunLongitude(ctx, ms) }},
		{"Moon", func(ms int64) float64 { return GetTropicalMoonLongitude(ctx, ms) }},
	} {
		curve := measureCurve(f, c.name, c.at)
		if curve.max > ownMaxArcsec[c.name] {
			t.Errorf("%s: max %.4f″ (worst ~%d), mean %.4f″, bias %.4f″, ceiling %.1f″",
				c.name, curve.max, curve.worstYear, curve.mean, curve.bias, ownMaxArcsec[c.name])
		}
		t.Logf("%-8s max %.4f″ (worst ~%d), mean %.4f″, bias %+.4f″, ceiling %.1f″",
			c.name, curve.max, curve.worstYear, curve.mean, curve.bias, ownMaxArcsec[c.name])
	}
}

func TestTier0Planets(t *testing.T) {
	f := loadHorizonsPositions(t)
	ctx := NewEphemerisCtx()
	for _, c := range []struct {
		name string
		body PlanetBody
	}{
		{"Mercury", PlanetMercury}, {"Venus", PlanetVenus}, {"Mars", PlanetMars},
		{"Jupiter", PlanetJupiter}, {"Saturn", PlanetSaturn},
	} {
		body := c.body
		curve := measureCurve(f, c.name, func(ms int64) float64 {
			return GetTropicalPlanetLongitude(ctx, body, ms)
		})
		if curve.max > ownMaxArcsec[c.name] {
			t.Errorf("%s: max %.4f″ (worst ~%d), mean %.4f″, bias %.4f″, ceiling %.1f″",
				c.name, curve.max, curve.worstYear, curve.mean, curve.bias, ownMaxArcsec[c.name])
		}
		t.Logf("%-8s max %.4f″ (worst ~%d), mean %.4f″, bias %+.4f″, ceiling %.1f″",
			c.name, curve.max, curve.worstYear, curve.mean, curve.bias, ownMaxArcsec[c.name])
	}
}

func TestTier0LatitudeIsAlsoBounded(t *testing.T) {
	f := loadHorizonsPositions(t)
	ctx := NewEphemerisCtx()
	bounds := map[string]float64{"Sun": 1.5, "Moon": 2.0}
	for name, bound := range bounds {
		truth := f.Positions[name]
		worst := 0.0
		for i, jd := range f.JdTt {
			ms := msForTt(jd)
			var lat float64
			if name == "Sun" {
				lat = GetSunPosition(ctx, ms).Latitude
			} else {
				lat = GetMoonPosition(ctx, ms).Latitude
			}
			if d := math.Abs(lat-truth[i].Elat) * 3600; d > worst {
				worst = d
			}
		}
		if worst > bound {
			t.Errorf("%s latitude: worst |Δ| %.4f″, bound %.1f″", name, worst, bound)
		}
		t.Logf("%-8s latitude worst |Δ| %.4f″ (bound %.1f″)", name, worst, bound)
	}
}
