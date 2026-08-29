package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"sort"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type vargasGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Why   string `json:"why"`
	} `json:"_meta"`
	Seed         uint32              `json:"seed"`
	MsLo         int64               `json:"msLo"`
	MsHi         int64               `json:"msHi"`
	ChartSamples int                 `json:"chartSamples"`
	Divisionals  []types.Divisional  `json:"divisionals"`
	HouseSystems []types.HouseSystem `json:"houseSystems"`
	Spans        struct {
		NavSpan              float64   `json:"NAV_SPAN"`
		DrekkanaSpan         float64   `json:"DREKKANA_SPAN"`
		SaptamsaSpan         float64   `json:"SAPTAMSA_SPAN"`
		DasamsaSpan          float64   `json:"DASAMSA_SPAN"`
		DwadasamsaSpan       float64   `json:"DWADASAMSA_SPAN"`
		TrimsaOddBoundaries  []float64 `json:"TRIMSA_ODD_BOUNDARIES"`
		TrimsaEvenBoundaries []float64 `json:"TRIMSA_EVEN_BOUNDARIES"`
		TrimsaOddRashis      []int     `json:"TRIMSA_ODD_RASHIS"`
		TrimsaEvenRashis     []int     `json:"TRIMSA_EVEN_RASHIS"`
	} `json:"spans"`
	Longitudes       []float64            `json:"longitudes"`
	CaseCount        int                  `json:"caseCount"`
	TransformValues  map[string][]float64 `json:"transformValues"`
	TransformDigests map[string]string    `json:"transformDigests"`
	Events           []struct {
		Name string `json:"name"`
		Ms   int64  `json:"ms"`
		Loc  struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"loc"`
	} `json:"events"`
	Bhava []struct {
		Name    string `json:"name"`
		Ms      int64  `json:"ms"`
		Systems map[string]struct {
			OK    bool              `json:"ok"`
			Code  *string           `json:"code"`
			Chart *types.BhavaChart `json:"chart"`
		} `json:"systems"`
	} `json:"bhava"`
	RashiCharts []struct {
		Name    string `json:"name"`
		Ms      int64  `json:"ms"`
		Systems map[string]struct {
			OK    bool              `json:"ok"`
			Code  *string           `json:"code"`
			Chart *types.BirthChart `json:"chart"`
		} `json:"systems"`
	} `json:"rashiCharts"`
	VargaCharts []struct {
		Name    string                           `json:"name"`
		Ms      int64                            `json:"ms"`
		Charts  map[string]types.DivisionalChart `json:"charts"`
		Navamsa types.DivisionalChart            `json:"navamsa"`
	} `json:"vargaCharts"`
	ChartInstants         []int64              `json:"chartInstants"`
	HouseDigest           string               `json:"houseDigest"`
	VargaRashiDigests     map[string]string    `json:"vargaRashiDigests"`
	IndexedSample         types.PlanetsByGraha `json:"indexedSample"`
	PlacidusLatitudeSweep []struct {
		Latitude float64 `json:"latitude"`
		OK       bool    `json:"ok"`
		Code     *string `json:"code"`
	} `json:"placidusLatitudeSweep"`
}

func loadVargasGolden(t *testing.T) vargasGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "vargas-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g vargasGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Longitudes) == 0 || len(g.VargaCharts) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func goVargaTransforms() map[string]func(float64) float64 {
	return map[string]func(float64) float64{
		"D2":  horaLongitude,
		"D3":  drekkanaLongitude,
		"D7":  saptamsaLongitude,
		"D9":  navamsaLongitude,
		"D10": dasamsaLongitude,
		"D12": dwadasamsaLongitude,
		"D30": trimsamsaLongitude,
	}
}

func TestVargaSpansAreNotIntegerDivision(t *testing.T) {
	g := loadVargasGolden(t)
	for _, c := range []struct {
		name       string
		got, want  float64
		intVersion float64
		harm       string
	}{
		{"NAV_SPAN", navSpan, g.Spans.NavSpan, 3,
			"every navamsa boundary 0.33° out; a graha near one lands in the wrong D9 sign"},
		{"DREKKANA_SPAN", drekkanaSpan, g.Spans.DrekkanaSpan, 10, ""},
		{"SAPTAMSA_SPAN", saptamsaSpan, g.Spans.SaptamsaSpan, 4,
			"six of seven saptamsa boundaries up to 1.7° out"},
		{"DASAMSA_SPAN", dasamsaSpan, g.Spans.DasamsaSpan, 3, ""},
		{"DWADASAMSA_SPAN", dwadasamsaSpan, g.Spans.DwadasamsaSpan, 2,
			"fifteen 2° segments where the varga has twelve; the clamp pins the last three onto the twelfth"},
	} {
		if c.got != c.want {
			t.Errorf("%s = %v, TypeScript %v", c.name, c.got, c.want)
		}
		if c.harm != "" && c.intVersion == c.want {
			t.Errorf("%s: the table's integer-division value %v is the CORRECT value; "+
				"the check below would fire on a correct constant", c.name, c.intVersion)
		}
		if c.harm != "" && c.got == c.intVersion {
			t.Errorf("%s is exactly %v: `30 / N` has become integer division "+
				"(docs/porting.md §1.7). Consequence: %s", c.name, c.intVersion, c.harm)
		}
	}
	for _, c := range []struct {
		name string
		got  []float64
		want []float64
	}{
		{"TRIMSA_ODD_BOUNDARIES", trimsaOddBoundaries[:], g.Spans.TrimsaOddBoundaries},
		{"TRIMSA_EVEN_BOUNDARIES", trimsaEvenBoundaries[:], g.Spans.TrimsaEvenBoundaries},
	} {
		if len(c.got) != len(c.want) {
			t.Fatalf("%s has %d entries, TypeScript %d", c.name, len(c.got), len(c.want))
		}
		for i := range c.got {
			if c.got[i] != c.want[i] {
				t.Errorf("%s[%d] = %v, TypeScript %v", c.name, i, c.got[i], c.want[i])
			}
		}
	}
	for _, c := range []struct {
		name string
		got  []int
		want []int
	}{
		{"TRIMSA_ODD_RASHIS", trimsaOddRashis[:], g.Spans.TrimsaOddRashis},
		{"TRIMSA_EVEN_RASHIS", trimsaEvenRashis[:], g.Spans.TrimsaEvenRashis},
	} {
		if len(c.got) != len(c.want) {
			t.Fatalf("%s has %d entries, TypeScript %d", c.name, len(c.got), len(c.want))
		}
		for i := range c.got {
			if c.got[i] != c.want[i] {
				t.Errorf("%s[%d] = %d, TypeScript %d", c.name, i, c.got[i], c.want[i])
			}
		}
	}
}

func TestVargaTransformsAreBitIdentical(t *testing.T) {
	g := loadVargasGolden(t)
	transforms := goVargaTransforms()
	if len(transforms) != len(g.TransformDigests) {
		t.Fatalf("Go has %d transforms, the golden has %d", len(transforms), len(g.TransformDigests))
	}
	if g.CaseCount <= 0 || g.CaseCount > len(g.Longitudes) {
		t.Fatalf("caseCount %d is not a prefix of %d longitudes", g.CaseCount, len(g.Longitudes))
	}

	names := make([]string, 0, len(transforms))
	for n := range transforms {
		names = append(names, n)
	}
	sort.Strings(names)

	for _, name := range names {
		fn := transforms[name]
		want, ok := g.TransformValues[name]
		if !ok {
			t.Errorf("%s: in the Go map, not in the golden", name)
			continue
		}
		if len(want) != g.CaseCount {
			t.Fatalf("%s: golden has %d explicit values for a caseCount of %d",
				name, len(want), g.CaseCount)
		}
		bad := 0
		for i := 0; i < g.CaseCount; i++ {
			lon := g.Longitudes[i]
			got := fn(lon)
			if got != want[i] {
				bad++
				if bad <= 4 {
					t.Errorf("%s(%v) = %v, TypeScript %v (Δ %g). This path has no "+
						"transcendental in it, so a divergence is a mistyped span "+
						"(docs/porting.md §1.7) or a transcription slip, not rounding",
						name, lon, got, want[i], got-want[i])
				}
			}
		}
		if bad > 0 {
			t.Errorf("%s: %d of %d boundary-neighbour longitudes diverged", name, bad, g.CaseCount)
		}
		gen := func(_ int, yield func(int64)) {
			for i := range g.Longitudes {
				yield(int64(i))
			}
		}
		digest := chartDigest(len(g.Longitudes), gen, func(i int64) float64 { return fn(g.Longitudes[i]) })
		if digest != g.TransformDigests[name] {
			t.Errorf("%s: digest %s, golden %s over %d longitudes",
				name, digest, g.TransformDigests[name], len(g.Longitudes))
		}
	}
	t.Logf("%d transforms bit-identical over %d longitudes (%d compared value by value)",
		len(names), len(g.Longitudes), g.CaseCount)
}

func TestVargaTransformsAreTotalAndOnTarget(t *testing.T) {
	g := loadVargasGolden(t)
	// D2 reaches Cancer, Leo and, at four engineered longitudes, Virgo; D30 skips the luminaries.
	wantSigns := map[string]int{"D2": 3, "D3": 12, "D7": 12, "D9": 12, "D10": 12, "D12": 12, "D30": 10}
	for name, fn := range goVargaTransforms() {
		seen := map[int]bool{}
		for _, lon := range g.Longitudes {
			out := fn(lon)
			if !(out >= 0 && out < 360) {
				t.Fatalf("%s(%v) = %v, outside [0, 360)", name, lon, out)
			}
			if math.Signbit(out) {
				t.Fatalf("%s(%v) returned -0 (docs/porting.md §1.8)", name, lon)
			}
			seen[int(math.Floor(out/30))] = true
		}
		if len(seen) != wantSigns[name] {
			t.Errorf("%s reaches %d target signs over the whole zodiac, want %d. A "+
				"transform stuck on fewer signs is what a degenerate span produces, "+
				"and a range check alone cannot see it", name, len(seen), wantSigns[name])
		}
	}
	seen30 := map[int]bool{}
	for _, lon := range g.Longitudes {
		seen30[int(math.Floor(trimsamsaLongitude(lon)/30))] = true
	}
	if seen30[3] || seen30[4] {
		t.Error("D30 reached Cancer or Leo; the trimsamsa scheme has no Sun or Moon " +
			"segment, so those two signs must be unreachable")
	}
	seen2 := map[int]int{}
	for _, lon := range g.Longitudes {
		seen2[int(math.Floor(horaLongitude(lon)/30))]++
	}
	if seen2[3] == 0 || seen2[4] == 0 {
		t.Errorf("D2 reached Cancer %d times and Leo %d times; both must be populated",
			seen2[3], seen2[4])
	}
}

// One ULP below a 15° sub-boundary the scaled remainder rounds up; the TypeScript does the same.
func TestD2CanOverflowIntoVirgo(t *testing.T) {
	g := loadVargasGolden(t)
	overflow, onGrid := 0, 0
	for i, lon := range g.Longitudes {
		if int(math.Floor(horaLongitude(lon)/30)) == 5 {
			overflow++
			if i >= g.CaseCount {
				onGrid++
			}
		}
	}
	if overflow == 0 {
		t.Error("D2 never overflowed into Virgo. Either the sweep stopped reaching " +
			"the 15° sub-boundary neighbours, or one of the two languages gained a " +
			"clamp the other does not have. The transform digest distinguishes them")
	}
	if onGrid != 0 {
		t.Errorf("%d of the overflows came from the uniform 0.05° grid rather than "+
			"from an engineered ULP neighbour. That would make the artefact reachable "+
			"from ordinary inputs and it would stop being theoretical", onGrid)
	}
	t.Logf("D2 overflows into Virgo at %d of %d longitudes, all engineered ULP "+
		"neighbours of a 15° sub-boundary (0 of %d uniform-grid points)",
		overflow, len(g.Longitudes), len(g.Longitudes)-g.CaseCount)
}

func TestBhavaMatchesTypeScript(t *testing.T) {
	g := loadVargasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked, errArms := 0, 0
	for i, ev := range g.Bhava {
		geo := types.GeoLocation{Latitude: g.Events[i].Loc.Latitude, Longitude: g.Events[i].Loc.Longitude}
		for _, hs := range g.HouseSystems {
			arm, ok := ev.Systems[string(hs)]
			if !ok {
				t.Errorf("%s: golden has no %s arm", ev.Name, hs)
				continue
			}
			got, err := ComputeBhava(ctx, ev.Ms, geo, BirthChartOptions{HouseSystem: hs})
			if !arm.OK {
				errArms++
				if err == nil {
					t.Errorf("%s/%s: TypeScript threw %v, Go returned a chart",
						ev.Name, hs, derefOr(arm.Code, "<no code>"))
					continue
				}
				var pe *types.PanchangError
				if !errors.As(err, &pe) || arm.Code == nil || string(pe.Code) != *arm.Code {
					t.Errorf("%s/%s: Go error %v, TypeScript code %v",
						ev.Name, hs, err, derefOr(arm.Code, "<nil>"))
				}
				continue
			}
			if err != nil {
				t.Fatalf("%s/%s: %v", ev.Name, hs, err)
			}
			checked++
			if d := compareBhava(t, ev.Name+"/"+string(hs), got, *arm.Chart); d > worst {
				worst = d
			}
		}
	}
	if checked == 0 {
		t.Fatal("no bhava charts were compared")
	}
	t.Logf("%d bhava charts compared (%d error arms); worst |Δ| = %g deg", checked, errArms, worst)
}

func compareBhava(t *testing.T, where string, got, want types.BhavaChart) float64 {
	t.Helper()
	if got.System != want.System {
		t.Errorf("%s: system %q, TypeScript %q", where, got.System, want.System)
	}
	worst := angleDelta(got.AscendantLongitude, want.AscendantLongitude)
	if worst > chartAngleBound {
		t.Errorf("%s: ascendantLongitude %v vs %v", where, got.AscendantLongitude, want.AscendantLongitude)
	}
	if d := angleDelta(got.MCLongitude, want.MCLongitude); d > chartAngleBound {
		t.Errorf("%s: mcLongitude %v vs %v", where, got.MCLongitude, want.MCLongitude)
	} else if d > worst {
		worst = d
	}
	if len(got.Houses) != len(want.Houses) {
		t.Fatalf("%s: %d houses, TypeScript %d", where, len(got.Houses), len(want.Houses))
	}
	for i := range got.Houses {
		gh, wh := got.Houses[i], want.Houses[i]
		if gh.House != wh.House {
			t.Errorf("%s: houses[%d].house = %d, TypeScript %d", where, i, gh.House, wh.House)
		}
		if gh.Rashi != wh.Rashi {
			t.Errorf("%s: houses[%d].rashi = %+v, TypeScript %+v", where, i, gh.Rashi, wh.Rashi)
		}
		if d := angleDelta(gh.CuspLongitude, wh.CuspLongitude); d > chartAngleBound {
			t.Errorf("%s: houses[%d].cuspLongitude = %v, TypeScript %v",
				where, i, gh.CuspLongitude, wh.CuspLongitude)
		} else if d > worst {
			worst = d
		}
		if d := math.Abs(gh.DegreeInRashi - wh.DegreeInRashi); d > chartAngleBound {
			t.Errorf("%s: houses[%d].degreeInRashi = %v, TypeScript %v",
				where, i, gh.DegreeInRashi, wh.DegreeInRashi)
		} else if d > worst {
			worst = d
		}
	}
	return worst
}

func TestRashiChartMatchesTypeScript(t *testing.T) {
	g := loadVargasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked := 0
	for i, ev := range g.RashiCharts {
		geo := types.GeoLocation{Latitude: g.Events[i].Loc.Latitude, Longitude: g.Events[i].Loc.Longitude}
		for _, hs := range g.HouseSystems {
			arm := ev.Systems[string(hs)]
			got, err := ComputeRashiChart(ctx, ev.Ms, geo, BirthChartOptions{HouseSystem: hs})
			if !arm.OK {
				if err == nil {
					t.Errorf("%s/%s: TypeScript threw, Go did not", ev.Name, hs)
				}
				continue
			}
			if err != nil {
				t.Fatalf("%s/%s: %v", ev.Name, hs, err)
			}
			checked++
			where := ev.Name + "/" + string(hs)
			if got.Divisional != arm.Chart.Divisional || got.Divisional != "D1" {
				t.Errorf("%s: divisional %q, TypeScript %q", where, got.Divisional, arm.Chart.Divisional)
			}
			compareLagna(t, where+" lagna", got.Lagna, arm.Chart.Lagna)
			if d := compareBhava(t, where+" bhava", got.Bhava, arm.Chart.Bhava); d > worst {
				worst = d
			}
			if d := comparePlacements(t, where, got.Planets, arm.Chart.Planets); d > worst {
				worst = d
			}
			for _, graha := range types.AllGrahas {
				gp, _ := got.ByPlanet.Get(graha)
				wp, _ := arm.Chart.ByPlanet.Get(graha)
				if d := comparePlacement(t, where+" byPlanet."+graha.String(), *gp, *wp); d > worst {
					worst = d
				}
			}
		}
	}
	if checked == 0 {
		t.Fatal("no rashi charts were compared")
	}
	t.Logf("%d D1 charts compared; worst |Δ| = %g deg", checked, worst)
}

func comparePlacements(t *testing.T, where string, got, want []types.PlanetPlacement) float64 {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d placements, TypeScript %d", where, len(got), len(want))
	}
	worst := 0.0
	for i := range got {
		if d := comparePlacement(t, where+" planets["+itoa(i)+"]", got[i], want[i]); d > worst {
			worst = d
		}
	}
	return worst
}

func comparePlacement(t *testing.T, where string, got, want types.PlanetPlacement) float64 {
	t.Helper()
	if got.Planet != want.Planet {
		t.Errorf("%s: planet %s, TypeScript %s", where, got.Planet, want.Planet)
	}
	if got.House != want.House {
		t.Errorf("%s: house %d, TypeScript %d. A house number is an invariant "+
			"(docs/validation-tiers.md), and houseOfLongitude is a chain of comparisons that "+
			"can only disagree if a graha sits within ~1e-13 deg of a cusp",
			where, got.House, want.House)
	}
	if got.Rashi != want.Rashi {
		t.Errorf("%s: rashi %+v, TypeScript %+v", where, got.Rashi, want.Rashi)
	}
	if got.IsRetrograde != want.IsRetrograde {
		t.Errorf("%s: isRetrograde %v, TypeScript %v", where, got.IsRetrograde, want.IsRetrograde)
	}
	worst := angleDelta(got.Longitude, want.Longitude)
	if worst > chartAngleBound {
		t.Errorf("%s: longitude %v vs %v", where, got.Longitude, want.Longitude)
	}
	if d := math.Abs(got.DegreeInRashi - want.DegreeInRashi); d > chartAngleBound {
		t.Errorf("%s: degreeInRashi %v vs %v", where, got.DegreeInRashi, want.DegreeInRashi)
	} else if d > worst {
		worst = d
	}
	return worst
}

func TestDivisionalChartsMatchTypeScript(t *testing.T) {
	g := loadVargasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	worst := 0.0
	checked := 0
	for i, ev := range g.VargaCharts {
		geo := types.GeoLocation{Latitude: g.Events[i].Loc.Latitude, Longitude: g.Events[i].Loc.Longitude}
		for _, d := range g.Divisionals {
			want, ok := ev.Charts[string(d)]
			if !ok {
				t.Errorf("%s: golden has no %s chart", ev.Name, d)
				continue
			}
			got, err := ComputeDivisionalChart(ctx, ev.Ms, geo, d, BirthChartOptions{})
			if err != nil {
				t.Fatalf("%s/%s: %v", ev.Name, d, err)
			}
			checked++
			if w := compareDivisional(t, ev.Name+"/"+string(d), got, want); w > worst {
				worst = w
			}
		}
		nav, err := ComputeNavamsa(ctx, ev.Ms, geo, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s navamsa: %v", ev.Name, err)
		}
		compareDivisional(t, ev.Name+"/navamsa", nav, ev.Navamsa)
		viaDivisional, err := ComputeDivisionalChart(ctx, ev.Ms, geo, types.DivisionalD9, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s D9: %v", ev.Name, err)
		}
		if nav.LagnaRashi != viaDivisional.LagnaRashi {
			t.Errorf("%s: ComputeNavamsa and ComputeDivisionalChart(D9) disagree on the "+
				"lagna rashi (%+v vs %+v)", ev.Name, nav.LagnaRashi, viaDivisional.LagnaRashi)
		}
		for k := range nav.Planets {
			if nav.Planets[k] != viaDivisional.Planets[k] {
				t.Errorf("%s: the two D9 doors disagree on planets[%d]", ev.Name, k)
			}
		}
	}
	if checked == 0 {
		t.Fatal("no divisional charts were compared")
	}
	t.Logf("%d divisional charts compared; worst |Δ| = %g deg", checked, worst)
}

func compareDivisional(t *testing.T, where string, got, want types.DivisionalChart) float64 {
	t.Helper()
	if got.Divisional != want.Divisional {
		t.Errorf("%s: divisional %q, TypeScript %q", where, got.Divisional, want.Divisional)
	}
	if got.LagnaRashi != want.LagnaRashi {
		t.Errorf("%s: lagnaRashi %+v, TypeScript %+v", where, got.LagnaRashi, want.LagnaRashi)
	}
	return comparePlacements(t, where, got.Planets, want.Planets)
}

func TestChartInvariantDigests(t *testing.T) {
	g := loadVargasGolden(t)
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	gen := func(_ int, yield func(int64)) {
		for _, ms := range g.ChartInstants {
			yield(ms)
		}
	}
	ctx := astronomy.NewEphemerisCtx()

	got := chartDigest(len(g.ChartInstants), gen, func(ms int64) float64 {
		c, err := ComputeRashiChart(ctx, ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s: %v", types.Date(ms).ISOString(), err)
		}
		acc := 0.0
		for _, p := range c.Planets {
			acc = acc*13 + float64(p.House)
		}
		return acc
	})
	if got != g.HouseDigest {
		t.Errorf("house-number digest %s, golden %s over %d instants: a house number "+
			"is an invariant with zero tolerance", got, g.HouseDigest, len(g.ChartInstants))
	}

	for _, d := range g.Divisionals {
		want, ok := g.VargaRashiDigests[string(d)]
		if !ok {
			t.Errorf("%s: no digest in the golden", d)
			continue
		}
		got := chartDigest(len(g.ChartInstants), gen, func(ms int64) float64 {
			c, err := ComputeDivisionalChart(ctx, ms, pune, d, BirthChartOptions{})
			if err != nil {
				t.Fatalf("%s %s: %v", d, types.Date(ms).ISOString(), err)
			}
			acc := float64(c.LagnaRashi.Index)
			for _, p := range c.Planets {
				acc = acc*13 + float64(p.Rashi.Index)
			}
			return acc
		})
		if got != want {
			t.Errorf("%s rashi-index digest %s, golden %s over %d instants",
				d, got, want, len(g.ChartInstants))
		}
	}
	t.Logf("%d house assignments and %d varga placements bit-identical",
		len(g.ChartInstants)*types.GrahaCount,
		len(g.ChartInstants)*len(g.Divisionals)*(types.GrahaCount+1))
}

func TestIndexPlanetsMatchesTypeScript(t *testing.T) {
	g := loadVargasGolden(t)
	ev := g.Events[2]
	chart, err := ComputeRashiChart(astronomy.NewEphemerisCtx(), ev.Ms,
		types.GeoLocation{Latitude: ev.Loc.Latitude, Longitude: ev.Loc.Longitude}, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	indexed := IndexPlanets(chart.Planets)
	for _, graha := range types.AllGrahas {
		gp, _ := indexed.Get(graha)
		wp, _ := g.IndexedSample.Get(graha)
		comparePlacement(t, "indexPlanets "+graha.String(), *gp, *wp)
	}
}

func TestPlacidusCircumpolarBoundaryMatchesTypeScript(t *testing.T) {
	g := loadVargasGolden(t)
	if len(g.PlacidusLatitudeSweep) == 0 {
		t.Fatal("the golden carries no Placidus latitude sweep")
	}
	ctx := astronomy.NewEphemerisCtx()
	ms := types.DateUTC(2025, 0, 14).Ms() + 6*3600_000
	okCount, errCount := 0, 0
	firstFailure := -1.0
	for _, c := range g.PlacidusLatitudeSweep {
		_, err := ComputeBhava(ctx, ms,
			types.GeoLocation{Latitude: c.Latitude, Longitude: 77.209},
			BirthChartOptions{HouseSystem: types.HouseSystemPlacidusKP})
		if c.OK {
			okCount++
			if err != nil {
				t.Errorf("latitude %v: TypeScript succeeded, Go returned %v", c.Latitude, err)
			}
			continue
		}
		errCount++
		if firstFailure < 0 {
			firstFailure = c.Latitude
		}
		if err == nil {
			t.Errorf("latitude %v: TypeScript threw %s, Go returned a chart",
				c.Latitude, derefOr(c.Code, "<no code>"))
			continue
		}
		var pe *types.PanchangError
		if !errors.As(err, &pe) {
			t.Errorf("latitude %v: Go error %v is not a PanchangError", c.Latitude, err)
			continue
		}
		if c.Code == nil || string(pe.Code) != *c.Code {
			t.Errorf("latitude %v: Go code %s, TypeScript %s",
				c.Latitude, pe.Code, derefOr(c.Code, "<nil>"))
		}
		if pe.Code == types.ErrCircumpolar && !errors.Is(err, types.ErrCircumpolarSentinel) {
			t.Errorf("latitude %v: errors.Is against ErrCircumpolarSentinel failed", c.Latitude)
		}
	}
	if okCount == 0 || errCount == 0 {
		t.Fatalf("the latitude sweep produced %d successes and %d failures; it must "+
			"straddle the boundary to say anything about it", okCount, errCount)
	}
	t.Logf("Placidus defined at %d latitudes, undefined at %d; first failure at %v°N",
		okCount, errCount, firstFailure)
}

func derefOr(p *string, fallback string) string {
	if p == nil {
		return fallback
	}
	return *p
}
