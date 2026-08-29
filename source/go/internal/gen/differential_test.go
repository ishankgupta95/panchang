package gen

import (
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy/series"
)

func differentialProbeCount() int {
	if os.Getenv("GEN_FULL") != "" {
		return probeCount
	}
	return 2_000
}

func requireSources(t *testing.T) string {
	t.Helper()
	dir := sourceDir(t)
	if _, err := os.Stat(filepath.Join(dir, "vsop87d.txt.gz")); err != nil {
		t.Skipf("ephemeris sources absent (%v); this test reads the published tables", err)
	}
	return dir
}

func TestElpTruncationWithinBudget(t *testing.T) {
	dir := requireSources(t)
	tables, err := readElp2000(dir)
	if err != nil {
		t.Fatalf("readElp2000: %v", err)
	}
	canonical := canonicalElp(tables)
	ts := probesN(probeSeed, differentialProbeCount())

	reference := func(iv int, tt float64) float64 {
		sum := 0.0
		for _, q := range canonical[iv] {
			sum += evalElpTerm(q, tt)
		}
		return sum
	}

	cases := []struct {
		name         string
		iv           int
		budget       float64
		unit         string
		shipped      func(float64) float64
		toSeriesUnit float64
	}{
		{"longitude", 1, budgetMoonLon, "″", nil, 1},
		{"latitude", 2, budgetMoonLat, "″", astronomy.MoonElpLatitude, 1 / astronomy.ArcsecToRad},
		{"latitude-coarse", 2, budgetMoonLatCoarse, "″", astronomy.MoonElpLatitudeCoarse, 1 / astronomy.ArcsecToRad},
		{"distance", 3, budgetMoonDist, " km", astronomy.MoonElpDistance, 1},
		{"distance-track", 3, budgetMoonDistTrack, " km", astronomy.MoonElpDistanceTrack, 1},
		{"distance-coarse", 3, budgetMoonDistCoarse, " km", astronomy.MoonElpDistanceCoarse, 1},
	}
	// Subtract the *emitted* W1, not elpConst's, or its rounding is charged to the budget.
	cases[0].shipped = func(tt float64) float64 {
		w := series.MOON_MEAN_LONGITUDE
		mean := w[0] + tt*(w[1]+tt*(w[2]+tt*(w[3]+tt*w[4])))
		return astronomy.MoonElpLongitude(tt) - mean
	}
	cases[0].toSeriesUnit = 1 / astronomy.ArcsecToRad

	for _, c := range cases {
		worst, worstAt := 0.0, 0.0
		for _, tt := range ts {
			d := math.Abs(c.shipped(tt)*c.toSeriesUnit - reference(c.iv, tt))
			if d > worst {
				worst, worstAt = d, tt
			}
		}
		if worst > c.budget {
			t.Errorf("Moon %s: worst |Δ| %.4g%s at t=%v, budget %v%s",
				c.name, worst, c.unit, worstAt, c.budget, c.unit)
		}
		t.Logf("Moon %-16s worst |Δ| %.4g%s (budget %v%s) over %d probes",
			c.name, worst, c.unit, c.budget, c.unit, len(ts))
	}
}

func TestVsopTruncationWithinBudget(t *testing.T) {
	dir := requireSources(t)
	vsop, err := readVsop87d(dir)
	if err != nil {
		t.Fatalf("readVsop87d: %v", err)
	}
	ts := probesN(probeSeed, differentialProbeCount())

	// τ = t/10: the probes are centuries, VSOP millennia.
	reference := func(body string, variable int, tt float64) float64 {
		tau := tt / 10
		s := vsop[body]
		total := 0.0
		powers := s[variable]
		for power := 0; power < len(powers); power++ {
			sum := 0.0
			for _, term := range powers[power] {
				sum += term.A * math.Cos(term.B+term.C*tau)
			}
			total += sum * ipow(tau, power)
		}
		return total
	}

	bodies := map[string]astronomy.VsopBody{
		"ear": astronomy.Earth, "mer": astronomy.Mercury, "ven": astronomy.Venus,
		"mar": astronomy.Mars, "jup": astronomy.Jupiter, "sat": astronomy.Saturn,
	}
	for _, body := range vsopBodies {
		lonBudget, latBudget := budgetPlanetLon, budgetPlanetLat
		if body == "ear" {
			lonBudget, latBudget = budgetSunLon, budgetSunLat
		}
		radiusBudget := (budgetRadiusAngleArcsec / arcsecPerRad) * minGeocentricDistanceAU[body]

		for _, v := range []struct {
			variable int
			label    string
			budget   float64
			isAngle  bool
			shipped  func(float64) float64
		}{
			{1, "L", lonBudget, true, func(tt float64) float64 {
				return astronomy.HeliocentricLongitude(bodies[body], tt*36525)
			}},
			{2, "B", latBudget, true, func(tt float64) float64 {
				return astronomy.HeliocentricLatitude(bodies[body], tt*36525)
			}},
			{3, "R", radiusBudget, false, func(tt float64) float64 {
				return astronomy.HeliocentricRadius(bodies[body], tt*36525)
			}},
		} {
			budget := v.budget
			unit := " AU"
			scale := 1.0
			if v.isAngle {
				budget = v.budget / arcsecPerRad
				unit = "″"
				scale = arcsecPerRad
			}
			worst, worstAt := 0.0, 0.0
			for _, tt := range ts {
				d := math.Abs(v.shipped(tt) - reference(body, v.variable, tt))
				if d > worst {
					worst, worstAt = d, tt
				}
			}
			if worst > budget {
				t.Errorf("%s %s: worst |Δ| %.4g%s at t=%v, budget %.4g%s",
					body, v.label, worst*scale, unit, worstAt, budget*scale, unit)
			}
			t.Logf("%s %s worst |Δ| %.4g%s (budget %.4g%s)", body, v.label, worst*scale, unit, budget*scale, unit)
		}
	}
}

func TestEarthCoarseRadiusWithinBudget(t *testing.T) {
	dir := requireSources(t)
	vsop, err := readVsop87d(dir)
	if err != nil {
		t.Fatalf("readVsop87d: %v", err)
	}
	ts := probesN(probeSeed, differentialProbeCount())
	worst := 0.0
	for _, tt := range ts {
		tau := tt / 10
		total := 0.0
		powers := vsop["ear"][3]
		for power := 0; power < len(powers); power++ {
			sum := 0.0
			for _, term := range powers[power] {
				sum += term.A * math.Cos(term.B+term.C*tau)
			}
			total += sum * ipow(tau, power)
		}
		if d := math.Abs(astronomy.EarthRadiusCoarse(tt*36525) - total); d > worst {
			worst = d
		}
	}
	// The coarse budget is against the full series, itself within budget, so the bound is the sum.
	bound := budgetSunRadiusCoarse + (budgetRadiusAngleArcsec/arcsecPerRad)*minGeocentricDistanceAU["ear"]
	if worst > bound {
		t.Errorf("EarthRadiusCoarse: worst |Δ| %.4g AU, bound %.4g AU", worst, bound)
	}
	t.Logf("EarthRadiusCoarse worst |Δ| %.4g AU (bound %.4g AU)", worst, bound)
}
