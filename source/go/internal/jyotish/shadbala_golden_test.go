package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

const (
	// far below the 1.875 V exact quantum
	shadbalaBound = 1e-9
)

type shadbalaGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Why   string `json:"why"`
	} `json:"_meta"`
	Seed           uint32    `json:"seed"`
	Samples        int       `json:"samples"`
	MsLo           int64     `json:"msLo"`
	MsHi           int64     `json:"msHi"`
	BhavaDikValues []float64 `json:"bhavaDikValues"`
	Events         []struct {
		Name string `json:"name"`
		Ms   int64  `json:"ms"`
		Loc  struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"loc"`
	} `json:"events"`
	PerEvent []struct {
		Name      string                `json:"name"`
		Ms        int64                 `json:"ms"`
		OK        bool                  `json:"ok"`
		Code      *string               `json:"code"`
		Shadbala  types.ShadbalaResult  `json:"shadbala"`
		BhavaBala types.BhavaBalaResult `json:"bhavaBala"`
	} `json:"perEvent"`
	Instants []int64 `json:"instants"`
	Sweep    []struct {
		Ms        int64                 `json:"ms"`
		Shadbala  types.ShadbalaResult  `json:"shadbala"`
		BhavaBala types.BhavaBalaResult `json:"bhavaBala"`
	} `json:"sweep"`
	Ojha []struct {
		Rashi  int                `json:"rashi"`
		Values map[string]float64 `json:"values"`
	} `json:"ojha"`
}

func loadShadbalaGolden(t *testing.T) shadbalaGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "shadbala-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g shadbalaGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func compareShadbala(t *testing.T, where string, got, want types.PlanetShadbala) float64 {
	t.Helper()
	if got.Naisargika != want.Naisargika {
		t.Errorf("%s: naisargika %v, TypeScript %v: this is a table lookup and "+
			"must be bit-identical", where, got.Naisargika, want.Naisargika)
	}
	if got.Drik != want.Drik {
		t.Errorf("%s: drik %v, TypeScript %v: Drik Bala reads only house offsets "+
			"and fixed weights; no longitude reaches it, so it must be "+
			"bit-identical", where, got.Drik, want.Drik)
	}
	if got.Chesta != want.Chesta {
		t.Errorf("%s: chesta %v, TypeScript %v: Chesta publishes one of {15, 30, "+
			"60} chosen by a comparison, so it is exact unless a planet sits "+
			"within ~1e-13 deg of 10 deg from the Sun (see TestChestaCombustMargin)",
			where, got.Chesta, want.Chesta)
	}
	worst := 0.0
	for _, c := range []struct {
		name      string
		got, want float64
	}{
		{"sthana", got.Sthana, want.Sthana},
		{"dig", got.Dig, want.Dig},
		{"kala", got.Kala, want.Kala},
		{"total", got.Total, want.Total},
	} {
		d := math.Abs(c.got - c.want)
		if d > shadbalaBound {
			t.Errorf("%s: %s %v vs %v, |Δ| = %g V > %g", where, c.name, c.got, c.want, d, shadbalaBound)
		}
		if d > worst {
			worst = d
		}
	}
	return worst
}

func compareBhavaBala(t *testing.T, where string, got, want types.BhavaBalaResult) float64 {
	t.Helper()
	if len(got.Houses) != len(want.Houses) {
		t.Fatalf("%s: %d houses, TypeScript %d", where, len(got.Houses), len(want.Houses))
	}
	worst := 0.0
	for i := range got.Houses {
		gh, wh := got.Houses[i], want.Houses[i]
		if gh.Dik != wh.Dik {
			t.Errorf("%s house %d: dik %v, TypeScript %v: a fixed table", where, i+1, gh.Dik, wh.Dik)
		}
		if gh.Sthana != wh.Sthana {
			t.Errorf("%s house %d: sthana %v, TypeScript %v: a signed sum of "+
				"Naisargika constants", where, i+1, gh.Sthana, wh.Sthana)
		}
		if gh.Drik != wh.Drik {
			t.Errorf("%s house %d: drik %v, TypeScript %v: house offsets and "+
				"fixed weights only", where, i+1, gh.Drik, wh.Drik)
		}
		for _, c := range []struct {
			name      string
			got, want float64
		}{
			{"bhavadhipati", gh.Bhavadhipati, wh.Bhavadhipati},
			{"total", gh.Total, wh.Total},
		} {
			d := math.Abs(c.got - c.want)
			if d > shadbalaBound {
				t.Errorf("%s house %d: %s %v vs %v, |Δ| = %g V", where, i+1, c.name, c.got, c.want, d)
			}
			if d > worst {
				worst = d
			}
		}
	}
	return worst
}

func TestShadbalaMatchesTypeScript(t *testing.T) {
	g := loadShadbalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked, errArms := 0, 0

	for i, ev := range g.PerEvent {
		loc := types.GeoLocation{Latitude: g.Events[i].Loc.Latitude, Longitude: g.Events[i].Loc.Longitude}
		gotS, err := ComputeShadbala(ctx, ev.Ms, loc, BirthChartOptions{})
		if !ev.OK {
			errArms++
			if err == nil {
				t.Errorf("%s: TypeScript threw %v, Go returned a result", ev.Name,
					derefOr(ev.Code, "<no code>"))
				continue
			}
			var pe *types.PanchangError
			if !errors.As(err, &pe) || ev.Code == nil || string(pe.Code) != *ev.Code {
				t.Errorf("%s: Go error %v, TypeScript code %v", ev.Name, err, derefOr(ev.Code, "<nil>"))
			}
			continue
		}
		if err != nil {
			t.Fatalf("%s: %v", ev.Name, err)
		}
		checked++
		for _, v := range types.AllVisibleGrahas {
			gp, _ := gotS.Get(v)
			wp, _ := ev.Shadbala.Get(v)
			if d := compareShadbala(t, ev.Name+"/"+v.String(), gp, wp); d > worst {
				worst = d
			}
		}
		gotB, err := ComputeBhavaBala(ctx, ev.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s bhavaBala: %v", ev.Name, err)
		}
		if d := compareBhavaBala(t, ev.Name, gotB, ev.BhavaBala); d > worst {
			worst = d
		}
	}

	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	for _, c := range g.Sweep {
		when := types.Date(c.Ms).ISOString()
		gotS, err := ComputeShadbala(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s: %v", when, err)
		}
		checked++
		for _, v := range types.AllVisibleGrahas {
			gp, _ := gotS.Get(v)
			wp, _ := c.Shadbala.Get(v)
			if d := compareShadbala(t, when+"/"+v.String(), gp, wp); d > worst {
				worst = d
			}
		}
		gotB, err := ComputeBhavaBala(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s bhavaBala: %v", when, err)
		}
		if d := compareBhavaBala(t, when, gotB, c.BhavaBala); d > worst {
			worst = d
		}
	}

	if checked == 0 {
		t.Fatal("no Shadbala results were compared")
	}
	t.Logf("%d charts compared (%d error arms); worst bounded |Δ| = %g V "+
		"(predicted <= ~1e-12, bound %g)", checked, errArms, worst, shadbalaBound)
}

func TestShadbalaExactAndBoundedSplitIsReal(t *testing.T) {
	g := loadShadbalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	exactAgreed, boundedDiffered := 0, 0
	for _, c := range g.Sweep {
		got, err := ComputeShadbala(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		for _, v := range types.AllVisibleGrahas {
			gp, _ := got.Get(v)
			wp, _ := c.Shadbala.Get(v)
			if gp.Naisargika == wp.Naisargika && gp.Drik == wp.Drik && gp.Chesta == wp.Chesta {
				exactAgreed++
			}
			for _, pair := range [][2]float64{{gp.Sthana, wp.Sthana}, {gp.Dig, wp.Dig}, {gp.Kala, wp.Kala}} {
				if pair[0] != pair[1] {
					boundedDiffered++
				}
			}
		}
	}
	if exactAgreed == 0 {
		t.Fatal("the exact half never agreed: the comparison is not running")
	}
	if boundedDiffered == 0 {
		t.Errorf("not one of the %d bounded sub-bala values differed from the "+
			"TypeScript across the sweep. Either they are in fact exact (in which "+
			"case this file's classification is wrong and should be tightened) or "+
			"the sweep is not reaching them", len(g.Sweep)*types.VisibleGrahaCount*3)
	}
	t.Logf("%d exact triples agreed; %d of %d bounded values differ (as classified)",
		exactAgreed, boundedDiffered, len(g.Sweep)*types.VisibleGrahaCount*3)
}

func TestOjhaYugmaMatchesTypeScript(t *testing.T) {
	g := loadShadbalaGolden(t)
	if len(g.Ojha) != 12 {
		t.Fatalf("golden has %d ojha entries, want 12", len(g.Ojha))
	}
	for _, entry := range g.Ojha {
		chart := syntheticAllInOneRashi(entry.Rashi)
		var divisionals [len(saptVargas)]types.DivisionalChart
		divisionals[3] = syntheticDivisional(entry.Rashi) // index 3 is D9
		for _, v := range types.AllVisibleGrahas {
			want, ok := entry.Values[v.String()]
			if !ok {
				t.Errorf("rashi %d: no %s value in the golden", entry.Rashi, v)
				continue
			}
			got := ojhaYugmaBala(v, &chart, &divisionals)
			if got != want {
				t.Errorf("rashi %d, %s: ojhaYugma %v, TypeScript %v", entry.Rashi, v, got, want)
			}
		}
	}
}

func syntheticAllInOneRashi(rashi int) types.BirthChart {
	var chart types.BirthChart
	for _, gr := range types.AllGrahas {
		chart.ByPlanet.Set(gr, types.PlanetPlacement{
			Planet: gr, Rashi: types.RashiInfo{Index: rashi},
		})
	}
	return chart
}

func syntheticDivisional(rashi int) types.DivisionalChart {
	planets := make([]types.PlanetPlacement, 0, types.VisibleGrahaCount)
	for _, v := range types.AllVisibleGrahas {
		planets = append(planets, types.PlanetPlacement{
			Planet: v.Graha(), Rashi: types.RashiInfo{Index: rashi},
		})
	}
	return types.DivisionalChart{Divisional: types.DivisionalD9, Planets: planets}
}

func TestOjhaYugmaGroupsAreNotTheDrekkanaTriple(t *testing.T) {
	for _, v := range types.AllVisibleGrahas {
		odd, even := ojhaOddGainers[v], ojhaEvenGainers[v]
		if odd == even {
			t.Errorf("%s is in %s Ojha groups; the two must partition the seven",
				v, map[bool]string{true: "both", false: "neither"}[odd])
		}
	}
	for _, v := range []types.VisibleGraha{types.VisibleMoon, types.VisibleVenus} {
		if !ojhaEvenGainers[v] {
			t.Errorf("%s must be an even-sign gainer: only the two female grahas are", v)
		}
	}
	for _, v := range []types.VisibleGraha{types.VisibleMercury, types.VisibleSaturn} {
		if !ojhaOddGainers[v] {
			t.Errorf("%s is an EVEN-sign gainer. That is the recorded mistranslation: "+
				"the two neuters gain in ODD signs, and grouping them with the female "+
				"grahas flips 30 V whenever the D1 and D9 parities agree", v)
		}
		if drekkanaGroup[v] != 1 {
			t.Errorf("%s is in Drekkana group %d, want 1 (Eunuch)", v, drekkanaGroup[v])
		}
	}
	oddCount := 0
	for _, v := range types.AllVisibleGrahas {
		if ojhaOddGainers[v] {
			oddCount++
		}
	}
	if oddCount != 5 {
		t.Errorf("%d grahas gain in odd signs, want 5 (Sun, Mars, Jupiter, Mercury, Saturn)", oddCount)
	}
	groupSizes := [3]int{}
	for _, v := range types.AllVisibleGrahas {
		groupSizes[drekkanaGroup[v]]++
	}
	if groupSizes != [3]int{3, 2, 2} {
		t.Errorf("Drekkana groups are %v, want [3 2 2] (Male / Eunuch / Female)", groupSizes)
	}
}

func TestSaptVirupasIsTotal(t *testing.T) {
	if len(saptVirupas) != len(AllDignities) {
		t.Errorf("saptVirupas has %d entries and there are %d dignities",
			len(saptVirupas), len(AllDignities))
	}
	for _, d := range AllDignities {
		v, ok := saptVirupas[d]
		if !ok {
			t.Errorf("saptVirupas has no entry for %q; the lookup would return 0 and "+
				"drop up to 45 V per varga", d)
			continue
		}
		if v <= 0 {
			t.Errorf("saptVirupas[%q] = %v; every dignity carries a positive virupa", d, v)
		}
	}
	prev := math.Inf(1)
	for _, d := range AllDignities {
		v := saptVirupas[d]
		if v > prev {
			t.Errorf("saptVirupas[%q] = %v exceeds the previous dignity's %v; the table "+
				"must be non-increasing over AllDignities, which is declared "+
				"strongest-first", d, v, prev)
		}
		prev = v
	}
}

func TestNaisargikaIsThePublishedRounding(t *testing.T) {
	ranked := []types.Graha{
		types.GrahaSun, types.GrahaMoon, types.GrahaVenus, types.GrahaJupiter,
		types.GrahaMercury, types.GrahaMars, types.GrahaSaturn,
	}
	for i, gr := range ranked {
		k := 7 - i
		exact := 60 * float64(k) / 7
		got := Naisargika[gr]
		if math.Abs(got-exact) > 0.005 {
			t.Errorf("Naisargika[%s] = %v, more than 0.005 from 60*%d/7 = %v", gr, got, k, exact)
		}
		if k != 7 && got == exact {
			t.Errorf("Naisargika[%s] = %v is exactly 60*%d/7. The table holds the "+
				"PUBLISHED two-decimal rounding, and recomputing it breaks the "+
				"bit-identity this leaf is held to", gr, got, k)
		}
	}
	for i := 1; i < len(ranked); i++ {
		if Naisargika[ranked[i]] >= Naisargika[ranked[i-1]] {
			t.Errorf("Naisargika is not strictly decreasing at %s", ranked[i])
		}
	}
	for _, gr := range []types.Graha{types.GrahaRahu, types.GrahaKetu} {
		if Naisargika[gr] != 0 {
			t.Errorf("Naisargika[%s] = %v, want 0", gr, Naisargika[gr])
		}
	}
}

func TestBhavaDikIsPiecewiseLinearBetweenTheCardinals(t *testing.T) {
	g := loadShadbalaGolden(t)
	if len(g.BhavaDikValues) != 12 {
		t.Fatalf("golden has %d dik values, want 12", len(g.BhavaDikValues))
	}
	for i, want := range g.BhavaDikValues {
		if bhavaDikValues[i] != want {
			t.Errorf("bhavaDikValues[%d] = %v, TypeScript %v", i, bhavaDikValues[i], want)
		}
	}
	anchors := map[int]float64{0: 60, 3: 0, 6: 15, 9: 30}
	for i, want := range anchors {
		if bhavaDikValues[i] != want {
			t.Errorf("cardinal bhava %d = %v, want %v", i+1, bhavaDikValues[i], want)
		}
	}
	for _, run := range [][2]int{{0, 3}, {3, 6}, {6, 9}, {9, 12}} {
		from, to := run[0], run[1]
		a := bhavaDikValues[from]
		b := bhavaDikValues[to%12]
		step := (b - a) / 3
		for k := 1; k < 3; k++ {
			want := a + float64(k)*step
			if got := bhavaDikValues[(from+k)%12]; math.Abs(got-want) > 1e-12 {
				t.Errorf("bhava %d = %v; linear interpolation from bhava %d (%v) to "+
					"bhava %d (%v) gives %v", (from+k)%12+1, got, from+1, a, to%12+1, b, want)
			}
		}
	}
}

func TestChestaCombustMargin(t *testing.T) {
	g := loadShadbalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	closest, closestWhere := math.Inf(1), ""
	combust, direct, retro := 0, 0, 0
	for _, c := range g.Sweep {
		chart, err := ComputeRashiChart(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		sunLon := chart.ByPlanet.Sun.Longitude
		for _, v := range []types.VisibleGraha{
			types.VisibleMars, types.VisibleMercury, types.VisibleJupiter,
			types.VisibleVenus, types.VisibleSaturn,
		} {
			p, _ := chart.ByPlanet.Get(v.Graha())
			if p.IsRetrograde {
				retro++
				continue
			}
			d := math.Abs(jsnumMod(p.Longitude-sunLon+540, 360) - 180)
			if d <= 10 {
				combust++
			} else {
				direct++
			}
			if gap := math.Abs(d - 10); gap < closest {
				closest, closestWhere = gap, types.Date(c.Ms).ISOString()+" "+v.String()
			}
		}
	}
	const divergence = 1.7e-13
	if closest <= divergence*1e3 {
		t.Errorf("the closest approach to the 10 deg combustion threshold is %g deg "+
			"at %s, only %.1fx the Go-vs-TS longitude divergence of %g. The Chesta "+
			"equality is no longer safely determined; investigate rather than "+
			"relaxing it", closest, closestWhere, closest/divergence, divergence)
	}
	if combust == 0 || direct == 0 || retro == 0 {
		t.Errorf("Chesta outcomes over the sweep: %d combust, %d direct, %d retrograde. "+
			"All three must occur or the comparison covers only some branches",
			combust, direct, retro)
	}
	t.Logf("closest approach to the 10 deg threshold: %g deg at %s (margin %.3g x); "+
		"%d combust / %d direct / %d retrograde", closest, closestWhere, closest/divergence,
		combust, direct, retro)
}

func jsnumMod(x, y float64) float64 { return math.Mod(x, y) }

func TestShadbalaStructuralInvariants(t *testing.T) {
	g := loadShadbalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	negDrik := 0
	for _, c := range g.Sweep {
		s, err := ComputeShadbala(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		for _, v := range types.AllVisibleGrahas {
			p, _ := s.Get(v)
			where := types.Date(c.Ms).ISOString() + "/" + v.String()
			// derived from the components, never a quoted literal
			sthanaMin := 0.0 + 7*saptVirupas[DignityDebilitated] + 0 + 0
			sthanaMax := 60.0 + 7*saptVirupas[DignityExalted] + 2*15 + 15
			if p.Sthana < sthanaMin-shadbalaBound || p.Sthana > sthanaMax+shadbalaBound {
				t.Errorf("%s: sthana %v outside [%v, %v]", where, p.Sthana, sthanaMin, sthanaMax)
			}
			if p.Dig < 0-shadbalaBound || p.Dig > 60+shadbalaBound {
				t.Errorf("%s: dig %v outside [0, 60]", where, p.Dig)
			}
			if p.Kala < 0-shadbalaBound || p.Kala > 120+shadbalaBound {
				t.Errorf("%s: kala %v outside [0, 120]", where, p.Kala)
			}
			if p.Chesta != 15 && p.Chesta != 30 && p.Chesta != 60 {
				t.Errorf("%s: chesta %v is not one of {15, 30, 60}", where, p.Chesta)
			}
			if p.Naisargika != Naisargika[v.Graha()] {
				t.Errorf("%s: naisargika %v, table says %v", where, p.Naisargika, Naisargika[v.Graha()])
			}
			if p.Drik < 0 {
				negDrik++
			}
			want := p.Sthana + p.Dig + p.Kala + p.Chesta + p.Naisargika + math.Max(0, p.Drik)
			if math.Abs(p.Total-want) > 1e-12 {
				t.Errorf("%s: total %v but the components sum to %v", where, p.Total, want)
			}
			if p.Total < 0 {
				t.Errorf("%s: total %v is negative", where, p.Total)
			}
		}
	}
	if negDrik == 0 {
		t.Error("drik never went negative across the sweep, so the max(0, drik) in " +
			"`total` (the one place the raw and clamped values differ) is untested")
	}
	t.Logf("%d negative drik values across the sweep exercised the clamp in `total`", negDrik)
}

func TestBhavaBalaStructuralInvariants(t *testing.T) {
	g := loadShadbalaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	negSthana, negBhavadhipati := 0, 0
	for _, c := range g.Sweep {
		b, err := ComputeBhavaBala(ctx, c.Ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		if len(b.Houses) != 12 {
			t.Fatalf("%d houses, want 12", len(b.Houses))
		}
		for i, h := range b.Houses {
			where := types.Date(c.Ms).ISOString() + " bhava " + itoa(i+1)
			if h.Dik != bhavaDikValues[i] {
				t.Errorf("%s: dik %v, table says %v", where, h.Dik, bhavaDikValues[i])
			}
			if h.Drik < 0 {
				t.Errorf("%s: drik %v is negative; the bhava form is clamped", where, h.Drik)
			}
			if h.Bhavadhipati <= 0 {
				negBhavadhipati++
				t.Errorf("%s: bhavadhipati %v; it is a lord's total Shadbala and is "+
					"always positive", where, h.Bhavadhipati)
			}
			if h.Sthana < 0 {
				negSthana++
			}
			want := h.Bhavadhipati + h.Dik + h.Drik + h.Sthana
			if math.Abs(h.Total-want) > 1e-12 {
				t.Errorf("%s: total %v but the components sum to %v", where, h.Total, want)
			}
		}
	}
	if negSthana == 0 {
		t.Error("bhava sthana never went negative; malefics subtract there and the " +
			"signed sum is the one leaf in this shape that can go below zero, so a " +
			"sweep that never reaches it is not exercising the sign")
	}
	t.Logf("%d negative bhava sthana values exercised the malefic branch; "+
		"%d non-positive bhavadhipati values (0 since the sunrise-frame fix landed)",
		negSthana, negBhavadhipati)
}

func TestNathonathaFrameContainsEveryBirth(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	locs := []struct {
		name string
		loc  types.GeoLocation
	}{
		{"Pune", types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}},
		{"London", types.GeoLocation{Latitude: 51.5074, Longitude: -0.1278}},
		{"Sydney", types.GeoLocation{Latitude: -33.8688, Longitude: 151.2093}},
	}
	base := types.DateUTC(2025, 0, 1).Ms()
	const steps = 200
	const stepMs = int64(37 * 60_000 * 19) // walks every hour of the day

	for _, l := range locs {
		dayBirths, nightBirths := 0, 0
		lo, hi := math.Inf(1), math.Inf(-1)
		for i := 0; i < steps; i++ {
			ms := base + int64(i)*stepMs
			sunrise, err := findSunriseBefore(ctx, ms, l.loc)
			if err != nil {
				continue
			}
			sunset, err := astronomy.ComputeSunset(ctx, sunrise, l.loc, astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				continue
			}
			nextSunrise, err := astronomy.ComputeSunrise(ctx, sunset, l.loc, astronomy.DefaultRiseSetLimitDays)
			if err != nil {
				continue
			}
			when := types.Date(ms).ISOString()

			switch {
			case ms >= sunrise && ms < sunset:
				dayBirths++
			case ms >= sunset && ms < nextSunrise:
				nightBirths++
			default:
				t.Errorf("%s %s: the birth is outside the frame findSunriseBefore "+
					"produced (sunrise %s, sunset %s, next %s). That is exactly the "+
					"defect the sunrise-frame fix removed, returning", l.name, when,
					types.Date(sunrise).ISOString(), types.Date(sunset).ISOString(),
					types.Date(nextSunrise).ISOString())
				continue
			}

			s, err := ComputeShadbala(ctx, ms, l.loc, BirthChartOptions{})
			if err != nil {
				continue
			}
			for _, v := range types.AllVisibleGrahas {
				p, _ := s.Get(v)
				lo = math.Min(lo, p.Kala)
				hi = math.Max(hi, p.Kala)
				if p.Kala < 0 || p.Kala > 120 {
					t.Errorf("%s %s/%s: kala %v outside [0, 120]: Nathonatha is at most "+
						"60 V and Paksha at most 60 V, so this can only mean the frame "+
						"has come unstuck again", l.name, when, v, p.Kala)
				}
				if p.Total < 0 {
					t.Errorf("%s %s/%s: total %v is negative", l.name, when, v, p.Total)
				}
			}
		}
		if dayBirths == 0 || nightBirths == 0 {
			t.Fatalf("%s: %d day births and %d night births; both are needed or the "+
				"range assertion above is only covering the easy half",
				l.name, dayBirths, nightBirths)
		}
		frac := float64(nightBirths) / float64(dayBirths+nightBirths)
		if frac < 0.3 || frac > 0.7 {
			t.Errorf("%s: %.1f%% night births; a sweep walking every hour should be "+
				"near half, and a large move means the frame changed", l.name, frac*100)
		}
		t.Logf("%s: %d day + %d night births, all inside their own frame; "+
			"kala spans [%.2f, %.2f] V within the documented [0, 120]",
			l.name, dayBirths, nightBirths, lo, hi)
	}
}
