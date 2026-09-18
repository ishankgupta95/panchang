package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type yogasGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Why   string `json:"why"`
	} `json:"_meta"`
	Seed      uint32 `json:"seed"`
	Samples   int    `json:"samples"`
	MsLo      int64  `json:"msLo"`
	MsHi      int64  `json:"msHi"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	Catalog []struct {
		Name types.YogaName `json:"name"`
		Type types.YogaType `json:"type"`
	} `json:"catalog"`
	Types    []types.YogaType `json:"types"`
	Instants []int64          `json:"instants"`
	Sweep    []struct {
		Ms               int64        `json:"ms"`
		Loc              string       `json:"loc"`
		Yogas            []types.Yoga `json:"yogas"`
		YogasWithNavamsa []types.Yoga `json:"yogasWithNavamsa"`
	} `json:"sweep"`
	FilterAt      int64                           `json:"filterAt"`
	ByType        map[types.YogaType][]types.Yoga `json:"byType"`
	TwoTypes      []types.Yoga                    `json:"twoTypes"`
	EmptyFilter   []types.Yoga                    `json:"emptyFilter"`
	NodeAspects59 []types.Yoga                    `json:"nodeAspects59"`
}

func loadYogasGolden(t *testing.T) yogasGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "yogas-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g yogasGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func yogaLoc(g yogasGolden, name string) types.GeoLocation {
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
		}
	}
	panic("unknown location " + name)
}

func compareYogas(t *testing.T, where string, got, want []types.Yoga) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: %d yogas, TypeScript %d\n got  %v\n want %v",
			where, len(got), len(want), yogaNames(got), yogaNames(want))
		return
	}
	for i := range got {
		gy, wy := got[i], want[i]
		if gy.Name != wy.Name || gy.Type != wy.Type {
			t.Errorf("%s[%d]: %s/%s, TypeScript %s/%s", where, i, gy.Name, gy.Type, wy.Name, wy.Type)
			continue
		}
		if !stringsEqual(gy.Reasons, wy.Reasons) {
			t.Errorf("%s/%s: reasons\n got  %q\n want %q", where, gy.Name, gy.Reasons, wy.Reasons)
		}
		if (gy.Bhanga == nil) != (wy.Bhanga == nil) {
			t.Errorf("%s/%s: bhanga present Go=%v TS=%v. Absent and present-but-not-"+
				"applying are different wire shapes: only the five Mahapurusha yogas "+
				"and Gajakesari carry the field at all",
				where, gy.Name, gy.Bhanga != nil, wy.Bhanga != nil)
			continue
		}
		if gy.Bhanga == nil {
			continue
		}
		if gy.Bhanga.Applies != wy.Bhanga.Applies {
			t.Errorf("%s/%s: bhanga.applies %v, TypeScript %v",
				where, gy.Name, gy.Bhanga.Applies, wy.Bhanga.Applies)
		}
		if !stringsEqual(gy.Bhanga.Reasons, wy.Bhanga.Reasons) {
			t.Errorf("%s/%s: bhanga.reasons\n got  %q\n want %q",
				where, gy.Name, gy.Bhanga.Reasons, wy.Bhanga.Reasons)
		}
	}
}

func yogaNames(list []types.Yoga) []types.YogaName {
	out := make([]types.YogaName, 0, len(list))
	for _, y := range list {
		out = append(out, y.Name)
	}
	return out
}

func TestYogaCatalogMatchesTypeScript(t *testing.T) {
	g := loadYogasGolden(t)
	if len(YogaCatalog) != len(g.Catalog) {
		t.Fatalf("Go catalog has %d rules, the golden %d", len(YogaCatalog), len(g.Catalog))
	}
	for i, want := range g.Catalog {
		if YogaCatalog[i].Name != want.Name || YogaCatalog[i].Type != want.Type {
			t.Errorf("catalog[%d] = %s/%s, TypeScript %s/%s",
				i, YogaCatalog[i].Name, YogaCatalog[i].Type, want.Name, want.Type)
		}
		if YogaCatalog[i].Evaluate == nil {
			t.Errorf("catalog[%d] (%s) has a nil Evaluate", i, YogaCatalog[i].Name)
		}
	}
	seen := map[types.YogaName]int{}
	for _, r := range YogaCatalog {
		seen[r.Name]++
	}
	for name, n := range seen {
		if n != 1 {
			t.Errorf("%s appears %d times in the catalog", name, n)
		}
	}
	if len(seen) != len(types.AllYogaNames) {
		t.Errorf("the catalog names %d distinct yogas, AllYogaNames declares %d",
			len(seen), len(types.AllYogaNames))
	}
	for _, name := range types.AllYogaNames {
		if seen[name] == 0 {
			t.Errorf("%s is declared in AllYogaNames but no catalog rule produces it", name)
		}
	}
	for _, r := range YogaCatalog {
		known := false
		for _, k := range types.AllYogaTypes {
			if k == r.Type {
				known = true
			}
		}
		if !known {
			t.Errorf("%s has type %q, which is not in AllYogaTypes", r.Name, r.Type)
		}
	}
}

func TestYogasMatchTypeScript(t *testing.T) {
	g := loadYogasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	withNavamsaExtra := 0
	for _, c := range g.Sweep {
		loc := yogaLoc(g, c.Loc)
		chart, err := ComputeRashiChart(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s: %v", types.Date(c.Ms).ISOString(), err)
		}
		navamsa, err := ComputeNavamsa(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s navamsa: %v", types.Date(c.Ms).ISOString(), err)
		}
		where := types.Date(c.Ms).ISOString() + "/" + c.Loc

		got, err := ComputeYogas(&chart, ComputeYogasOptions{})
		if err != nil {
			t.Fatalf("%s: %v", where, err)
		}
		compareYogas(t, where, got, c.Yogas)

		gotNav, err := ComputeYogas(&chart, ComputeYogasOptions{Navamsa: &navamsa})
		if err != nil {
			t.Fatalf("%s (navamsa): %v", where, err)
		}
		compareYogas(t, where+" navamsa", gotNav, c.YogasWithNavamsa)

		if len(gotNav) < len(got) {
			t.Errorf("%s: supplying the navamsa REMOVED a yoga (%d → %d)",
				where, len(got), len(gotNav))
		}
		if len(gotNav) > len(got) {
			withNavamsaExtra++
			extra := 0
			for _, y := range gotNav {
				if y.Name == types.YogaVargottama {
					extra++
				}
			}
			if extra != len(gotNav)-len(got) {
				t.Errorf("%s: supplying the navamsa added %d yogas but only %d were "+
					"Vargottama; no other rule reads it", where, len(gotNav)-len(got), extra)
			}
		}
	}
	if withNavamsaExtra == 0 {
		t.Error("supplying the navamsa never added a yoga across 400 charts; either " +
			"Vargottama has stopped firing or the D9 chart is not reaching it")
	}
	t.Logf("%d charts compared; the navamsa added Vargottama on %d of them",
		len(g.Sweep), withNavamsaExtra)
}

func TestEveryCatalogRuleFires(t *testing.T) {
	g := loadYogasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	fired := map[types.YogaName]int{}
	bhangaApplied := map[types.YogaName]int{}
	bhangaNotApplied := map[types.YogaName]int{}
	for _, c := range g.Sweep {
		loc := yogaLoc(g, c.Loc)
		chart, err := ComputeRashiChart(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		navamsa, err := ComputeNavamsa(ctx, c.Ms, loc, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		got, err := ComputeYogas(&chart, ComputeYogasOptions{Navamsa: &navamsa})
		if err != nil {
			t.Fatalf("%v", err)
		}
		for _, y := range got {
			fired[y.Name]++
			if y.Bhanga == nil {
				continue
			}
			if y.Bhanga.Applies {
				bhangaApplied[y.Name]++
			} else {
				bhangaNotApplied[y.Name]++
			}
		}
	}
	missing := []types.YogaName{}
	for _, name := range types.AllYogaNames {
		if fired[name] == 0 {
			missing = append(missing, name)
		}
	}
	if len(missing) != 0 {
		t.Errorf("these catalog rules never fired across %d charts: %v. They are "+
			"compared to nothing by the value test, so a rule that stopped matching "+
			"would be invisible", len(g.Sweep), missing)
	}
	if len(bhangaApplied) == 0 {
		t.Error("no bhanga ever applied across the sweep; the cancellation branch of " +
			"the Mahapurusha and Gajakesari rules is untested")
	}
	if len(bhangaNotApplied) == 0 {
		t.Error("every bhanga that appeared also applied; the `applies: false` arm " +
			"(which is a published value and not an absence) is untested")
	}
	t.Logf("all %d catalog rules fired; bhanga applied on %d yoga names and was "+
		"evaluated-but-inactive on %d", len(fired), len(bhangaApplied), len(bhangaNotApplied))
}

func TestYogaTypeFilterMatchesTypeScript(t *testing.T) {
	g := loadYogasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := yogaLoc(g, g.Locations[0].Name)
	chart, err := ComputeRashiChart(ctx, g.FilterAt, loc, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	navamsa, err := ComputeNavamsa(ctx, g.FilterAt, loc, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}

	unfiltered, err := ComputeYogas(&chart, ComputeYogasOptions{Navamsa: &navamsa})
	if err != nil {
		t.Fatal(err)
	}

	totalFiltered := 0
	for _, typ := range g.Types {
		want, ok := g.ByType[typ]
		if !ok {
			t.Errorf("%s: no filtered result in the golden", typ)
			continue
		}
		got, err := ComputeYogas(&chart, ComputeYogasOptions{
			Types: []types.YogaType{typ}, Navamsa: &navamsa,
		})
		if err != nil {
			t.Fatalf("%s: %v", typ, err)
		}
		compareYogas(t, "filter:"+string(typ), got, want)
		for _, y := range got {
			if y.Type != typ {
				t.Errorf("filter:%s returned a %s yoga (%s)", typ, y.Type, y.Name)
			}
		}
		totalFiltered += len(got)
	}
	if totalFiltered != len(unfiltered) {
		t.Errorf("the eight per-type filters returned %d yogas in total but the "+
			"unfiltered call returned %d; the types must partition the catalog",
			totalFiltered, len(unfiltered))
	}

	got2, err := ComputeYogas(&chart, ComputeYogasOptions{
		Types: []types.YogaType{types.YogaRaja, types.YogaDhana}, Navamsa: &navamsa,
	})
	if err != nil {
		t.Fatal(err)
	}
	compareYogas(t, "filter:raja+dhana", got2, g.TwoTypes)

	gotEmpty, err := ComputeYogas(&chart, ComputeYogasOptions{
		Types: []types.YogaType{}, Navamsa: &navamsa,
	})
	if err != nil {
		t.Fatal(err)
	}
	compareYogas(t, "filter:empty", gotEmpty, g.EmptyFilter)
	if len(gotEmpty) != len(unfiltered) {
		t.Errorf("an empty Types slice returned %d yogas and no filter returned %d; "+
			"`options.types && options.types.length > 0` makes the two identical",
			len(gotEmpty), len(unfiltered))
	}

	got59, err := ComputeYogas(&chart, ComputeYogasOptions{
		Navamsa: &navamsa, NodeAspects: NodeAspects5And9,
	})
	if err != nil {
		t.Fatal(err)
	}
	compareYogas(t, "nodeAspects:5-and-9", got59, g.NodeAspects59)
}

func TestYogaTypeFilterRejectsUnknown(t *testing.T) {
	ctx := astronomy.NewEphemerisCtx()
	chart, err := ComputeRashiChart(ctx, types.DateUTC(2025, 0, 14).Ms(),
		lagnaTestPune, BirthChartOptions{})
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []types.YogaType{"Raja", "kingship", "mahapurush"} {
		_, err := ComputeYogas(&chart, ComputeYogasOptions{Types: []types.YogaType{bad}})
		var pe *types.PanchangError
		if !errors.As(err, &pe) {
			t.Errorf("yoga type %q: err = %v, want a PanchangError", bad, err)
			continue
		}
		if pe.Code != types.ErrInvalidInput {
			t.Errorf("yoga type %q: code %s, want %s", bad, pe.Code, types.ErrInvalidInput)
		}
	}
	for _, typ := range types.AllYogaTypes {
		if _, err := ComputeYogas(&chart, ComputeYogasOptions{
			Types: []types.YogaType{typ},
		}); err != nil {
			t.Errorf("yoga type %q: %v", typ, err)
		}
	}
}

func TestCatalogRashiLordsAgreeWithMatchingTables(t *testing.T) {
	for rashi := 0; rashi < 12; rashi++ {
		if rashiLords[rashi] != RashiLord[rashi] {
			t.Errorf("rashi %d: the catalog says %s, matchingTables says %s",
				rashi, rashiLords[rashi], RashiLord[rashi])
		}
	}
	counts := map[types.VisibleGraha]int{}
	for _, l := range rashiLords {
		counts[l]++
	}
	if counts[types.VisibleSun] != 1 || counts[types.VisibleMoon] != 1 {
		t.Errorf("the luminaries rule %d and %d signs; each rules exactly one",
			counts[types.VisibleSun], counts[types.VisibleMoon])
	}
	for _, v := range []types.VisibleGraha{
		types.VisibleMars, types.VisibleMercury, types.VisibleJupiter,
		types.VisibleVenus, types.VisibleSaturn,
	} {
		if counts[v] != 2 {
			t.Errorf("%s rules %d signs; the five non-luminaries rule two each", v, counts[v])
		}
	}
}

func TestCatalogExaltationAgreesWithDignity(t *testing.T) {
	for _, v := range types.AllVisibleGrahas {
		if got, want := exaltationRashi[v], exaltation[v.Graha()]; got != want {
			t.Errorf("%s: the catalog says exaltation rashi %d, dignity.go says %d",
				v, got, want)
		}
	}
	seen := map[int]types.VisibleGraha{}
	for _, v := range types.AllVisibleGrahas {
		r := exaltationRashi[v]
		if prev, dup := seen[r]; dup {
			t.Errorf("rashi %d is the exaltation of both %s and %s", r, prev, v)
		}
		seen[r] = v
	}
}

func TestCatalogBeneficsAgreeWithShadbala(t *testing.T) {
	var inCatalog [types.GrahaCount]bool
	for _, v := range naturalBenefics {
		inCatalog[v.Graha()] = true
	}
	for _, v := range types.AllVisibleGrahas {
		g := v.Graha()
		if inCatalog[g] != benefics[g] {
			t.Errorf("%s: the catalog calls it benefic=%v, shadbala.go says %v",
				v, inCatalog[g], benefics[g])
		}
		if benefics[g] == malefics[g] {
			t.Errorf("%s is in %s of shadbala's benefic/malefic sets; they partition "+
				"the seven", v, map[bool]string{true: "both", false: "neither"}[benefics[g]])
		}
	}
}

func TestCombustionThresholdsAgree(t *testing.T) {
	justInside := types.PlanetPlacement{Longitude: 10 - 1e-9}
	justOutside := types.PlanetPlacement{Longitude: 10 + 1e-9}
	if chestaBala(types.VisibleMars, justInside, 0) != 15 {
		t.Error("chestaBala does not report combustion just inside 10 deg")
	}
	if chestaBala(types.VisibleMars, justOutside, 0) != 30 {
		t.Error("chestaBala reports combustion just outside 10 deg")
	}
	if jupiterCombustionArcDeg != 10 {
		t.Errorf("the Gajakesari combustion arc is %d deg and Chesta Bala's is 10; "+
			"yogasCatalog.ts documents them as deliberately equal",
			jupiterCombustionArcDeg)
	}
}

func TestUpachayaHousesExcludeTheTwelfth(t *testing.T) {
	has := func(h int) bool { return inHouses4(upachayaHouses, h) }
	if has(12) {
		t.Error("the 12th is in the upachaya set; it is a vyaya house and the " +
			"classical quartet is 3, 6, 10, 11")
	}
	if !has(10) {
		t.Error("the 10th is not in the upachaya set; that is the cell the rejected " +
			"revision replaced with the 12th")
	}
	for _, h := range []int{3, 6, 10, 11} {
		if !has(h) {
			t.Errorf("house %d is not in the upachaya set", h)
		}
	}
	overlap := 0
	for _, h := range upachayaHouses {
		if inHouses3(dusthanaHouses, h) {
			overlap++
		}
	}
	if overlap != 1 {
		t.Errorf("%d houses are both upachaya and dusthana; only the 6th is", overlap)
	}
}

func TestYogaStructuralInvariants(t *testing.T) {
	g := loadYogasGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	bhangaCarriers := map[types.YogaName]bool{}
	for _, c := range g.Sweep {
		chart, err := ComputeRashiChart(ctx, c.Ms, yogaLoc(g, c.Loc), BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		navamsa, err := ComputeNavamsa(ctx, c.Ms, yogaLoc(g, c.Loc), BirthChartOptions{})
		if err != nil {
			t.Fatalf("%v", err)
		}
		got, err := ComputeYogas(&chart, ComputeYogasOptions{Navamsa: &navamsa})
		if err != nil {
			t.Fatalf("%v", err)
		}
		catalogPos := map[types.YogaName]int{}
		for i, r := range YogaCatalog {
			catalogPos[r.Name] = i
		}
		prev := -1
		for _, y := range got {
			pos, ok := catalogPos[y.Name]
			if !ok {
				t.Errorf("%s is not a catalog rule", y.Name)
				continue
			}
			if pos <= prev {
				t.Errorf("results are not in catalog order: %s at position %d follows %d",
					y.Name, pos, prev)
			}
			prev = pos
			if len(y.Reasons) == 0 {
				t.Errorf("%s matched with no reasons", y.Name)
			}
			for _, r := range y.Reasons {
				if r == "" {
					t.Errorf("%s has an empty reason string", y.Name)
				}
			}
			if y.Type != YogaCatalog[pos].Type {
				t.Errorf("%s published type %s, the catalog says %s",
					y.Name, y.Type, YogaCatalog[pos].Type)
			}
			if y.Bhanga != nil {
				bhangaCarriers[y.Name] = true
				if y.Bhanga.Applies != (len(y.Bhanga.Reasons) > 0) {
					t.Errorf("%s: bhanga.applies is %v but it has %d reasons; the flag "+
						"is exactly `reasons.length > 0`", y.Name, y.Bhanga.Applies,
						len(y.Bhanga.Reasons))
				}
			}
		}
	}
	want := map[types.YogaName]bool{
		types.YogaRuchaka: true, types.YogaBhadra: true, types.YogaHamsa: true,
		types.YogaMalavya: true, types.YogaSasha: true, types.YogaGajakesari: true,
	}
	for name := range bhangaCarriers {
		if !want[name] {
			t.Errorf("%s carries a bhanga annotation; only the five Mahapurusha yogas "+
				"and Gajakesari do", name)
		}
	}
	if len(bhangaCarriers) == 0 {
		t.Error("no yoga in the sweep carried a bhanga annotation")
	}
	t.Logf("%d yoga names carried a bhanga annotation across %d charts",
		len(bhangaCarriers), len(g.Sweep))
}
