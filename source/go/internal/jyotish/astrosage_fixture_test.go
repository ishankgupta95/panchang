package jyotish

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

const (
	lagnaDegreeTol  = 1.0
	planetDegreeTol = 0.5
)

var astrosageRashi = [12]string{
	"Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
	"Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena",
}

type astrosagePlacement struct {
	Rashi     string  `json:"rashi"`
	Degree    float64 `json:"degree"`
	Nakshatra string  `json:"nakshatra"`
}

type astrosageChart struct {
	Name      string             `json:"name"`
	Source    string             `json:"_source"`
	DateLocal string             `json:"dateLocal"`
	Tzh       float64            `json:"tzh"`
	Lat       float64            `json:"lat"`
	Lon       float64            `json:"lon"`
	Lagna     astrosagePlacement `json:"lagna"`
	Sun       astrosagePlacement `json:"sun"`
	Moon      astrosagePlacement `json:"moon"`
	Mars      astrosagePlacement `json:"mars"`
	Mercury   astrosagePlacement `json:"mercury"`
	Jupiter   astrosagePlacement `json:"jupiter"`
	Venus     astrosagePlacement `json:"venus"`
	Saturn    astrosagePlacement `json:"saturn"`
	Rahu      astrosagePlacement `json:"rahu"`
	Ketu      astrosagePlacement `json:"ketu"`
}

type astrosageFile struct {
	Meta struct {
		Source      string `json:"source"`
		Ayanamsa    string `json:"ayanamsa"`
		RashiNaming string `json:"rashi_naming"`
		Rule        string `json:"rule"`
	} `json:"_meta"`
	Charts []astrosageChart `json:"charts"`
}

func loadAstrosage(t *testing.T) astrosageFile {
	t.Helper()
	raw, err := repopath.ReadTestData("charts", "astrosage-charts.json")
	if err != nil {
		t.Fatalf("reading astrosage-charts.json: %v", err)
	}
	var f astrosageFile
	if err := json.Unmarshal(raw, &f); err != nil {
		t.Fatalf("parsing astrosage-charts.json: %v", err)
	}
	if len(f.Charts) != 21 {
		t.Fatalf("fixture holds %d charts, want the 21 R-tier ones", len(f.Charts))
	}
	return f
}

func astrosageRashiIndex(t *testing.T, name string) int {
	t.Helper()
	for i, n := range astrosageRashi {
		if n == name {
			return i
		}
	}
	t.Fatalf("unknown rashi name %q", name)
	return -1
}

func astrosageBirthMs(t *testing.T, dateLocal string, tzh float64) int64 {
	t.Helper()
	datePart, timePart, ok := strings.Cut(dateLocal, "T")
	if !ok {
		t.Fatalf("dateLocal %q has no T separator", dateLocal)
	}
	dp := strings.Split(datePart, "-")
	tp := strings.Split(timePart, ":")
	if len(dp) != 3 || len(tp) != 3 {
		t.Fatalf("dateLocal %q is not YYYY-MM-DDTHH:MM:SS", dateLocal)
	}
	n := func(s string) int {
		v, err := strconv.Atoi(s)
		if err != nil {
			t.Fatalf("dateLocal %q: %v", dateLocal, err)
		}
		return v
	}
	base := types.DateUTC(n(dp[0]), n(dp[1])-1, n(dp[2])).Ms()
	base += int64(n(tp[0]))*3_600_000 + int64(n(tp[1]))*60_000 + int64(n(tp[2]))*1000
	return base - int64(math.Round(tzh*3_600_000))
}

func TestAstrosageFixtureNamingIsTheDeclaredOne(t *testing.T) {
	f := loadAstrosage(t)
	seen := 0
	for _, part := range strings.Split(f.Meta.RashiNaming, ",") {
		name, idx, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok {
			t.Fatalf("rashi_naming entry %q is not name=index", part)
		}
		i, err := strconv.Atoi(strings.TrimSpace(idx))
		if err != nil {
			t.Fatalf("rashi_naming entry %q: %v", part, err)
		}
		if i < 0 || i >= len(astrosageRashi) {
			t.Fatalf("rashi_naming entry %q is out of range", part)
		}
		if got := astrosageRashi[i]; got != strings.TrimSpace(name) {
			t.Errorf("rashi %d: fixture declares %q, this test uses %q", i, name, got)
		}
		seen++
	}
	if seen != 12 {
		t.Errorf("rashi_naming declared %d signs, want 12", seen)
	}
	if !strings.EqualFold(f.Meta.Ayanamsa, "Lahiri") {
		t.Errorf("fixture ayanamsa is %q; this test computes with lahiri", f.Meta.Ayanamsa)
	}
	if !strings.Contains(f.Meta.Rule, "Library output is NOT a source") {
		t.Errorf("fixture _meta.rule no longer states the no-self-seeding rule: %q", f.Meta.Rule)
	}
}

func TestAstrosageLagnaMatchesRTier(t *testing.T) {
	f := loadAstrosage(t)
	worst, worstName := 0.0, ""
	for _, c := range f.Charts {
		ms := astrosageBirthMs(t, c.DateLocal, c.Tzh)
		loc := types.GeoLocation{Latitude: c.Lat, Longitude: c.Lon}
		lagna, err := ComputeLagna(astronomy.NewEphemerisCtx(), ms, loc, types.Lahiri, types.LanguageEn)
		if err != nil {
			t.Fatalf("%s: ComputeLagna: %v", c.Name, err)
		}
		want := astrosageRashiIndex(t, c.Lagna.Rashi)
		if lagna.Rashi.Index != want {
			t.Errorf("%s lagna rashi: got %d (%s), want %d (%s). An index is an invariant",
				c.Name, lagna.Rashi.Index, lagna.Rashi.Name, want, c.Lagna.Rashi)
			continue
		}
		d := math.Abs(lagna.DegreeInRashi - c.Lagna.Degree)
		if d > worst {
			worst, worstName = d, c.Name
		}
		if d > lagnaDegreeTol {
			t.Errorf("%s lagna degree: got %.4f°, AstroSage %.4f°, drift %.4f° > %.1f°",
				c.Name, lagna.DegreeInRashi, c.Lagna.Degree, d, lagnaDegreeTol)
		}
	}
	t.Logf("21 charts: every lagna rashi exact; worst degree drift %.4f° at %s (bound %.1f°)",
		worst, worstName, lagnaDegreeTol)
}

func TestAstrosagePlanetsMatchRTier(t *testing.T) {
	f := loadAstrosage(t)
	worst, worstWhere := 0.0, ""
	compared := 0
	for _, c := range f.Charts {
		ms := astrosageBirthMs(t, c.DateLocal, c.Tzh)
		loc := types.GeoLocation{Latitude: c.Lat, Longitude: c.Lon}
		chart, err := ComputeRashiChart(astronomy.NewEphemerisCtx(), ms, loc,
			BirthChartOptions{Ayanamsa: types.Lahiri})
		if err != nil {
			t.Fatalf("%s: ComputeRashiChart: %v", c.Name, err)
		}
		for _, p := range []struct {
			graha types.Graha
			exp   astrosagePlacement
		}{
			{types.GrahaSun, c.Sun}, {types.GrahaMoon, c.Moon}, {types.GrahaMars, c.Mars},
			{types.GrahaMercury, c.Mercury}, {types.GrahaJupiter, c.Jupiter},
			{types.GrahaVenus, c.Venus}, {types.GrahaSaturn, c.Saturn},
			{types.GrahaRahu, c.Rahu}, {types.GrahaKetu, c.Ketu},
		} {
			lib, ok := chart.ByPlanet.Get(p.graha)
			if !ok {
				t.Fatalf("%s: chart has no %v", c.Name, p.graha)
			}
			compared++
			want := astrosageRashiIndex(t, p.exp.Rashi)
			if lib.Rashi.Index != want {
				t.Errorf("%s / %v rashi: got %d (%s), want %d (%s). An index is an invariant",
					c.Name, p.graha, lib.Rashi.Index, lib.Rashi.Name, want, p.exp.Rashi)
				continue
			}
			d := math.Abs(lib.DegreeInRashi - p.exp.Degree)
			if d > worst {
				worst, worstWhere = d, fmt.Sprintf("%s/%v", c.Name, p.graha)
			}
			if d > planetDegreeTol {
				t.Errorf("%s / %v degree: got %.4f°, AstroSage %.4f°, drift %.4f° > %.1f°",
					c.Name, p.graha, lib.DegreeInRashi, p.exp.Degree, d, planetDegreeTol)
			}
		}
	}
	if compared != 21*9 {
		t.Errorf("compared %d placements, want %d (21 charts × 9 grahas)", compared, 21*9)
	}
	t.Logf("%d placements: every rashi exact; worst degree drift %.4f° at %s (bound %.1f°)",
		compared, worst, worstWhere, planetDegreeTol)
}
