package jyotish

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"reflect"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type chartRulesGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Why   string `json:"why"`
	} `json:"_meta"`
	Seed         uint32 `json:"seed"`
	MsLo         int64  `json:"msLo"`
	MsHi         int64  `json:"msHi"`
	ChartSamples int    `json:"chartSamples"`
	Tables       struct {
		Contributors      []string                    `json:"contributors"`
		Receivers         []string                    `json:"receivers"`
		BeneficOffsets    map[string]map[string][]int `json:"beneficOffsets"`
		BhinnashtakaTotal map[string]int              `json:"bhinnashtakaTotal"`
		SarvashtakaTotal  int                         `json:"sarvashtakaTotal"`
		EkadhipatyaPairs  [][]int                     `json:"ekadhipatyaPairs"`
		TrikonaTriads     [][]int                     `json:"trikonaTriads"`
	} `json:"tables"`
	Events []struct {
		Name string `json:"name"`
		Ms   int64  `json:"ms"`
		Loc  struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"loc"`
	} `json:"events"`
	PerEvent []struct {
		Name                string                   `json:"name"`
		Ms                  int64                    `json:"ms"`
		Ashtakavarga        types.AshtakavargaResult `json:"ashtakavarga"`
		AshtakavargaReduced types.AshtakavargaResult `json:"ashtakavargaReduced"`
		Karakas7            types.JaiminiKarakas     `json:"karakas7"`
		Karakas8            types.Jaimini8Karakas    `json:"karakas8"`
		Argala              []types.ArgalaPerBhava   `json:"argala"`
		ArgalaTrikona       []types.ArgalaPerBhava   `json:"argalaTrikona"`
		ArudhasEn           []types.Arudha           `json:"arudhasEn"`
		ArudhasHi           []types.Arudha           `json:"arudhasHi"`
		Mangal              types.MangalDoshaInfo    `json:"mangal"`
		KaalSarp            types.KaalSarpDoshaInfo  `json:"kaalSarp"`
		Pitru               types.PitruDoshaInfo     `json:"pitru"`
	} `json:"perEvent"`
	Pairs []struct {
		Label         string                    `json:"label"`
		Compatibility types.MangalCompatibility `json:"compatibility"`
	} `json:"pairs"`
	ChartInstants []int64 `json:"chartInstants"`
	Digests       struct {
		Sarvashtaka        string `json:"sarvashtaka"`
		SarvashtakaReduced string `json:"sarvashtakaReduced"`
		ArudhaRashis       string `json:"arudhaRashis"`
		ArgalaCounts       string `json:"argalaCounts"`
		DoshaFlags         string `json:"doshaFlags"`
	} `json:"digests"`
	BhinnashtakaSweep []struct {
		Rashi int              `json:"rashi"`
		Grids map[string][]int `json:"grids"`
	} `json:"bhinnashtakaSweep"`
	SodhanaGrids       [][]int   `json:"sodhanaGrids"`
	SodhanaOccupancies [][]int   `json:"sodhanaOccupancies"`
	TrikonaResults     [][]int   `json:"trikonaResults"`
	EkadhipatyaResults [][][]int `json:"ekadhipatyaResults"`
}

func loadChartRulesGolden(t *testing.T) chartRulesGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "chartrules-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g chartRulesGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.PerEvent) == 0 || len(g.SodhanaGrids) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func rulesChart(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64, lat, lon float64) types.BirthChart {
	t.Helper()
	c, err := ComputeRashiChart(ctx, ms, types.GeoLocation{Latitude: lat, Longitude: lon}, BirthChartOptions{})
	if err != nil {
		t.Fatalf("ComputeRashiChart(%s): %v", types.Date(ms).ISOString(), err)
	}
	return c
}

func TestAshtakavargaTablesMatchTypeScript(t *testing.T) {
	g := loadChartRulesGolden(t)
	tb := g.Tables

	if len(tb.Contributors) != ContributorCount {
		t.Fatalf("golden has %d contributors, Go has %d", len(tb.Contributors), ContributorCount)
	}
	for i, name := range tb.Contributors {
		if got := AshtakavargaContributors[i].String(); got != name {
			t.Errorf("contributor %d is %q, TypeScript %q", i, got, name)
		}
	}
	if len(tb.Receivers) != types.VisibleGrahaCount {
		t.Fatalf("golden has %d receivers, Go has %d", len(tb.Receivers), types.VisibleGrahaCount)
	}
	for i, name := range tb.Receivers {
		if got := AshtakavargaReceivers[i].String(); got != name {
			t.Errorf("receiver %d is %q, TypeScript %q", i, got, name)
		}
	}

	cells := 0
	for _, receiver := range AshtakavargaReceivers {
		row, ok := tb.BeneficOffsets[receiver.String()]
		if !ok {
			t.Errorf("%s: no row in the golden", receiver)
			continue
		}
		for _, contributor := range AshtakavargaContributors {
			want, ok := row[contributor.String()]
			if !ok {
				t.Errorf("%s/%s: no cell in the golden", receiver, contributor)
				continue
			}
			got := BeneficOffsets[receiver][contributor]
			if !reflect.DeepEqual(got, want) {
				t.Errorf("BeneficOffsets[%s][%s] = %v, TypeScript %v", receiver, contributor, got, want)
			}
			cells += len(got)
		}
		if want, ok := tb.BhinnashtakaTotal[receiver.String()]; !ok {
			t.Errorf("%s: no total in the golden", receiver)
		} else if BhinnashtakaTotal[receiver] != want {
			t.Errorf("BhinnashtakaTotal[%s] = %d, TypeScript %d",
				receiver, BhinnashtakaTotal[receiver], want)
		}
	}
	if SarvashtakaTotal != tb.SarvashtakaTotal {
		t.Errorf("SarvashtakaTotal = %d, TypeScript %d", SarvashtakaTotal, tb.SarvashtakaTotal)
	}
	if cells != SarvashtakaTotal {
		t.Errorf("the 56 offset lists hold %d entries in total; the Sarvashtaka checksum "+
			"is %d and the two are the same number by construction", cells, SarvashtakaTotal)
	}

	for i, want := range tb.EkadhipatyaPairs {
		if EkadhipatyaPairs[i][0] != want[0] || EkadhipatyaPairs[i][1] != want[1] {
			t.Errorf("EkadhipatyaPairs[%d] = %v, TypeScript %v", i, EkadhipatyaPairs[i], want)
		}
	}
	for i, want := range tb.TrikonaTriads {
		for k := 0; k < 3; k++ {
			if TrikonaTriads[i][k] != want[k] {
				t.Errorf("TrikonaTriads[%d] = %v, TypeScript %v", i, TrikonaTriads[i], want)
			}
		}
	}
}

func TestBhinnashtakaTotalsAreDerivable(t *testing.T) {
	grand := 0
	for _, receiver := range AshtakavargaReceivers {
		sum := 0
		for _, contributor := range AshtakavargaContributors {
			offsets := BeneficOffsets[receiver][contributor]
			if len(offsets) == 0 {
				t.Errorf("BeneficOffsets[%s][%s] is empty; every contributor donates "+
					"at least one bindu to every receiver", receiver, contributor)
			}
			for _, o := range offsets {
				if o < 1 || o > 12 {
					t.Errorf("BeneficOffsets[%s][%s] contains %d, outside 1..12",
						receiver, contributor, o)
				}
			}
			for i := 1; i < len(offsets); i++ {
				if offsets[i] <= offsets[i-1] {
					t.Errorf("BeneficOffsets[%s][%s] is not strictly ascending at %d: %v",
						receiver, contributor, i, offsets)
				}
			}
			sum += len(offsets)
		}
		if sum != BhinnashtakaTotal[receiver] {
			t.Errorf("%s: the offset lists hold %d entries but BhinnashtakaTotal says %d",
				receiver, sum, BhinnashtakaTotal[receiver])
		}
		grand += sum
	}
	if grand != SarvashtakaTotal {
		t.Errorf("the table sums to %d; SarvashtakaTotal says %d", grand, SarvashtakaTotal)
	}
	if grand != 337 {
		t.Errorf("the table sums to %d; both `ashtakavargaTables.ts` and "+
			"`types/jyotish.ts` say 337, and the sum is the arbiter", grand)
	}
	t.Logf("the 56 offset lists sum to %d, matching SarvashtakaTotal and both "+
		"TypeScript records (the 47/336 pair has since been corrected)", grand)
}

func TestAshtakavargaGridsAreInvariant(t *testing.T) {
	g := loadChartRulesGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	seenCell := map[int]bool{}
	for _, ms := range g.ChartInstants {
		chart := rulesChart(t, ctx, ms, 18.5204, 73.8567)
		av := ComputeAshtakavarga(&chart, AshtakavargaOptions{Reductions: true})

		grand := 0
		for _, receiver := range AshtakavargaReceivers {
			grid, _ := av.Bhinnashtaka.Get(receiver)
			if len(grid) != 12 {
				t.Fatalf("%s: %d cells", receiver, len(grid))
			}
			sum := 0
			for _, v := range grid {
				if v < 0 || v > 8 {
					t.Errorf("%s: a cell holds %d, outside 0..8 (there are 8 contributors)", receiver, v)
				}
				seenCell[v] = true
				sum += v
			}
			if sum != BhinnashtakaTotal[receiver] {
				t.Errorf("%s at %s: grid totals %d, want %d. This is invariant of the "+
					"planets' placement", receiver, types.Date(ms).ISOString(), sum,
					BhinnashtakaTotal[receiver])
			}
			grand += sum
		}
		if grand != SarvashtakaTotal {
			t.Errorf("%s: Sarvashtaka totals %d, want %d", types.Date(ms).ISOString(), grand, SarvashtakaTotal)
		}
		sarva := 0
		for _, v := range av.Sarvashtaka {
			if v < 0 || v > 56 {
				t.Errorf("a Sarvashtaka cell holds %d, outside 0..56", v)
			}
			sarva += v
		}
		if sarva != SarvashtakaTotal {
			t.Errorf("the published Sarvashtaka sums to %d, want %d", sarva, SarvashtakaTotal)
		}
		for _, receiver := range AshtakavargaReceivers {
			raw, _ := av.Bhinnashtaka.Get(receiver)
			red, _ := av.Reduced.Bhinnashtaka.Get(receiver)
			for i := range raw {
				if red[i] > raw[i] {
					t.Errorf("%s cell %d: reduced %d exceeds unreduced %d. A Sodhana "+
						"only ever subtracts", receiver, i, red[i], raw[i])
				}
				if red[i] < 0 {
					t.Errorf("%s cell %d: reduced to %d", receiver, i, red[i])
				}
			}
		}
	}
	if len(seenCell) < 6 {
		t.Errorf("the sweep produced only %d distinct cell values; the range checks "+
			"above are near-vacuous on a sample that flat", len(seenCell))
	}
}

func TestChartRulesMatchTypeScript(t *testing.T) {
	g := loadChartRulesGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	for i, ev := range g.PerEvent {
		loc := g.Events[i].Loc
		chart := rulesChart(t, ctx, ev.Ms, loc.Latitude, loc.Longitude)
		where := ev.Name

		gotAv := ComputeAshtakavarga(&chart, AshtakavargaOptions{})
		if gotAv.Reduced != nil {
			t.Errorf("%s: reductions were not requested but the Reduced block is "+
				"populated; the TypeScript omits the key entirely there", where)
		}
		compareAshtakavarga(t, where, gotAv, ev.Ashtakavarga)
		gotAvR := ComputeAshtakavarga(&chart, AshtakavargaOptions{Reductions: true})
		if gotAvR.Reduced == nil {
			t.Fatalf("%s: reductions were requested and the Reduced block is nil", where)
		}
		compareAshtakavarga(t, where+" reduced", gotAvR, ev.AshtakavargaReduced)

		k7, err := ComputeJaiminiKarakas(&chart)
		if err != nil {
			t.Fatalf("%s karakas7: %v", where, err)
		}
		if k7 != ev.Karakas7 {
			t.Errorf("%s: karakas7 %+v, TypeScript %+v", where, k7, ev.Karakas7)
		}
		k8, err := ComputeJaimini8Karakas(&chart)
		if err != nil {
			t.Fatalf("%s karakas8: %v", where, err)
		}
		if k8 != ev.Karakas8 {
			t.Errorf("%s: karakas8 %+v, TypeScript %+v", where, k8, ev.Karakas8)
		}

		compareArgala(t, where, ComputeArgala(&chart), ev.Argala, false)
		compareArgala(t, where+" trikona", ComputeArgalaWithTrikonargala(&chart), ev.ArgalaTrikona, true)

		for _, arm := range []struct {
			lang types.Language
			want []types.Arudha
		}{{types.LanguageEn, ev.ArudhasEn}, {types.LanguageHi, ev.ArudhasHi}} {
			got, err := ComputeArudhas(&chart, arm.lang)
			if err != nil {
				t.Fatalf("%s arudhas/%s: %v", where, arm.lang, err)
			}
			if len(got) != len(arm.want) {
				t.Fatalf("%s arudhas/%s: %d entries, TypeScript %d", where, arm.lang, len(got), len(arm.want))
			}
			for k := range got {
				if got[k] != arm.want[k] {
					t.Errorf("%s arudhas/%s[%d] = %+v, TypeScript %+v",
						where, arm.lang, k, got[k], arm.want[k])
				}
			}
		}

		gotM := ComputeMangalDosha(&chart)
		compareMangal(t, where, gotM, ev.Mangal)

		gotK := ComputeKaalSarp(&chart)
		if gotK.Afflicted != ev.KaalSarp.Afflicted || gotK.Partial != ev.KaalSarp.Partial ||
			gotK.RahuHouse != ev.KaalSarp.RahuHouse || gotK.KetuHouse != ev.KaalSarp.KetuHouse {
			t.Errorf("%s kaalSarp: %+v, TypeScript %+v", where, gotK, ev.KaalSarp)
		}
		if !subtypeEq(gotK.Subtype, ev.KaalSarp.Subtype) {
			t.Errorf("%s kaalSarp subtype: %v, TypeScript %v",
				where, derefSubtype(gotK.Subtype), derefSubtype(ev.KaalSarp.Subtype))
		}

		gotP := ComputePitruDosha(&chart)
		if gotP.Afflicted != ev.Pitru.Afflicted || !reflect.DeepEqual(gotP.Reasons, ev.Pitru.Reasons) {
			t.Errorf("%s pitru: %+v, TypeScript %+v", where, gotP, ev.Pitru)
		}
	}

	for i, p := range g.Pairs {
		a := g.Events[i]
		b := g.Events[(i+1)%len(g.Events)]
		ca := rulesChart(t, ctx, a.Ms, a.Loc.Latitude, a.Loc.Longitude)
		cb := rulesChart(t, ctx, b.Ms, b.Loc.Latitude, b.Loc.Longitude)
		got := ComputeMangalCompatibility(&ca, &cb)
		if got.Afflicted != p.Compatibility.Afflicted {
			t.Errorf("%s: afflicted %v, TypeScript %v", p.Label, got.Afflicted, p.Compatibility.Afflicted)
		}
		if got.Description != p.Compatibility.Description {
			t.Errorf("%s: description %q, TypeScript %q", p.Label, got.Description, p.Compatibility.Description)
		}
		if !reflect.DeepEqual(got.Cancellations, p.Compatibility.Cancellations) {
			t.Errorf("%s: cancellations %v, TypeScript %v",
				p.Label, got.Cancellations, p.Compatibility.Cancellations)
		}
		compareMangal(t, p.Label+" boy", got.Boy, p.Compatibility.Boy)
		compareMangal(t, p.Label+" girl", got.Girl, p.Compatibility.Girl)
	}
}

func compareAshtakavarga(t *testing.T, where string, got, want types.AshtakavargaResult) {
	t.Helper()
	if !reflect.DeepEqual([]int(got.Sarvashtaka), []int(want.Sarvashtaka)) {
		t.Errorf("%s: sarvashtaka %v, TypeScript %v", where, got.Sarvashtaka, want.Sarvashtaka)
	}
	for _, r := range AshtakavargaReceivers {
		g1, _ := got.Bhinnashtaka.Get(r)
		w1, _ := want.Bhinnashtaka.Get(r)
		if !reflect.DeepEqual([]int(g1), []int(w1)) {
			t.Errorf("%s: bhinnashtaka[%s] %v, TypeScript %v", where, r, g1, w1)
		}
	}
	if (got.Reduced == nil) != (want.Reduced == nil) {
		t.Errorf("%s: reduced present=%v, TypeScript present=%v",
			where, got.Reduced != nil, want.Reduced != nil)
		return
	}
	if got.Reduced == nil {
		return
	}
	if !reflect.DeepEqual([]int(got.Reduced.Sarvashtaka), []int(want.Reduced.Sarvashtaka)) {
		t.Errorf("%s: reduced sarvashtaka %v, TypeScript %v",
			where, got.Reduced.Sarvashtaka, want.Reduced.Sarvashtaka)
	}
	for _, r := range AshtakavargaReceivers {
		g1, _ := got.Reduced.Bhinnashtaka.Get(r)
		w1, _ := want.Reduced.Bhinnashtaka.Get(r)
		if !reflect.DeepEqual([]int(g1), []int(w1)) {
			t.Errorf("%s: reduced bhinnashtaka[%s] %v, TypeScript %v", where, r, g1, w1)
		}
	}
}

func compareArgala(t *testing.T, where string, got, want []types.ArgalaPerBhava, wantTrikona bool) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: %d entries, TypeScript %d", where, len(got), len(want))
	}
	for i := range got {
		if got[i].Bhava != want[i].Bhava {
			t.Errorf("%s[%d]: bhava %d, TypeScript %d", where, i, got[i].Bhava, want[i].Bhava)
		}
		comparePlacements(t, where+" argala", got[i].Argala, want[i].Argala)
		comparePlacements(t, where+" virodhargala", got[i].Virodhargala, want[i].Virodhargala)
		if (got[i].Trikona != nil) != wantTrikona || (want[i].Trikona != nil) != wantTrikona {
			t.Errorf("%s[%d]: trikona present Go=%v TS=%v, want %v",
				where, i, got[i].Trikona != nil, want[i].Trikona != nil, wantTrikona)
			continue
		}
		if !wantTrikona {
			continue
		}
		comparePlacements(t, where+" trikona.sources", got[i].Trikona.Sources, want[i].Trikona.Sources)
		comparePlacements(t, where+" trikona.virodhakas", got[i].Trikona.Virodhakas, want[i].Trikona.Virodhakas)
	}
}

func compareMangal(t *testing.T, where string, got, want types.MangalDoshaInfo) {
	t.Helper()
	if got.Afflicted != want.Afflicted || got.Severity != want.Severity {
		t.Errorf("%s: afflicted/severity %v/%s, TypeScript %v/%s",
			where, got.Afflicted, got.Severity, want.Afflicted, want.Severity)
	}
	if got.FromLagna != want.FromLagna || got.FromMoon != want.FromMoon || got.FromVenus != want.FromVenus {
		t.Errorf("%s: references %+v/%+v/%+v, TypeScript %+v/%+v/%+v", where,
			got.FromLagna, got.FromMoon, got.FromVenus,
			want.FromLagna, want.FromMoon, want.FromVenus)
	}
	if !reflect.DeepEqual(got.Cancellations, want.Cancellations) {
		t.Errorf("%s: cancellations %q, TypeScript %q. These are published strings, "+
			"so they are compared exactly", where, got.Cancellations, want.Cancellations)
	}
}

func subtypeEq(a, b *types.KaalSarpSubtype) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func derefSubtype(p *types.KaalSarpSubtype) string {
	if p == nil {
		return "<nil>"
	}
	return string(*p)
}

func TestSodhanaReductionsMatchTypeScript(t *testing.T) {
	g := loadChartRulesGolden(t)
	if len(g.TrikonaResults) != len(g.SodhanaGrids) {
		t.Fatalf("%d trikona results for %d grids", len(g.TrikonaResults), len(g.SodhanaGrids))
	}
	for i, grid := range g.SodhanaGrids {
		in := make(types.BhinnashtakaGrid, len(grid))
		copy(in, grid)
		got := applyTrikonaSodhana(in)
		if !reflect.DeepEqual([]int(got), g.TrikonaResults[i]) {
			t.Errorf("trikona grid %d %v → %v, TypeScript %v", i, grid, got, g.TrikonaResults[i])
		}
		if !reflect.DeepEqual([]int(in), grid) {
			t.Errorf("trikona grid %d: the input was mutated (%v → %v)", i, grid, in)
		}

		for j, occ := range g.SodhanaOccupancies {
			var mask [12]bool
			for _, r := range occ {
				mask[r] = true
			}
			in2 := make(types.BhinnashtakaGrid, len(grid))
			copy(in2, grid)
			got2 := applyEkadhipatyaSodhana(in2, mask)
			want2 := g.EkadhipatyaResults[i][j]
			if !reflect.DeepEqual([]int(got2), want2) {
				t.Errorf("ekadhipatya grid %d occ %d %v (occ %v) → %v, TypeScript %v",
					i, j, grid, occ, got2, want2)
			}
			if !reflect.DeepEqual([]int(in2), grid) {
				t.Errorf("ekadhipatya grid %d occ %d: the input was mutated", i, j)
			}
		}
	}
	t.Logf("%d grids × %d occupancy masks compared for both Sodhanas",
		len(g.SodhanaGrids), len(g.SodhanaOccupancies))
}

func TestSodhanaBranchesAreAllReached(t *testing.T) {
	g := loadChartRulesGolden(t)
	counts := map[string]int{}
	for _, grid := range g.SodhanaGrids {
		for _, occ := range g.SodhanaOccupancies {
			var mask [12]bool
			for _, r := range occ {
				mask[r] = true
			}
			for _, pair := range EkadhipatyaPairs {
				a, b := pair[0], pair[1]
				switch {
				case grid[a] == 0 || grid[b] == 0:
					counts["rule1-zero"]++
				case mask[a] && mask[b]:
					counts["rule2-both-occupied"]++
				case !mask[a] && !mask[b]:
					if grid[a] != grid[b] {
						counts["rule4-both-vacant-unequal"]++
					} else {
						counts["rule4-both-vacant-equal"]++
					}
				default:
					occIdx, vacIdx := a, b
					if !mask[a] {
						occIdx, vacIdx = b, a
					}
					if grid[vacIdx] <= grid[occIdx] {
						counts["rule3-vacant-not-greater"]++
					} else {
						counts["rule3-vacant-greater"]++
					}
				}
			}
		}
	}
	for _, branch := range []string{
		"rule1-zero", "rule2-both-occupied",
		"rule3-vacant-not-greater", "rule3-vacant-greater",
		"rule4-both-vacant-unequal", "rule4-both-vacant-equal",
	} {
		if counts[branch] == 0 {
			t.Errorf("branch %q was never reached by the engineered sweep; the "+
				"comparison against the TypeScript proves nothing about it", branch)
		}
	}
	zeroTriads, nonZeroTriads := 0, 0
	for _, grid := range g.SodhanaGrids {
		for _, triad := range TrikonaTriads {
			if grid[triad[0]] == 0 || grid[triad[1]] == 0 || grid[triad[2]] == 0 {
				zeroTriads++
			} else {
				nonZeroTriads++
			}
		}
	}
	if zeroTriads == 0 || nonZeroTriads == 0 {
		t.Errorf("Trikona reached %d triads containing a zero and %d without; AV-1 was "+
			"a bug in the former, so both must appear", zeroTriads, nonZeroTriads)
	}
	t.Logf("Ekadhipatya branch counts: %v; Trikona triads with/without a zero: %d/%d",
		counts, zeroTriads, nonZeroTriads)
}

func TestBhinnashtakaSweepMatchesTypeScript(t *testing.T) {
	g := loadChartRulesGolden(t)
	if len(g.BhinnashtakaSweep) != 12 {
		t.Fatalf("golden has %d sweep entries, want 12", len(g.BhinnashtakaSweep))
	}
	for _, entry := range g.BhinnashtakaSweep {
		var contributorRashi [ContributorCount]int
		for _, c := range AshtakavargaContributors {
			contributorRashi[c] = entry.Rashi
		}
		for _, receiver := range AshtakavargaReceivers {
			want, ok := entry.Grids[receiver.String()]
			if !ok {
				t.Errorf("rashi %d: no %s grid in the golden", entry.Rashi, receiver)
				continue
			}
			got := bhinnashtakaFor(receiver, contributorRashi)
			if !reflect.DeepEqual([]int(got), want) {
				t.Errorf("rashi %d, %s: %v, TypeScript %v", entry.Rashi, receiver, got, want)
			}
		}
	}
}

func TestChartRuleDigests(t *testing.T) {
	g := loadChartRulesGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	gen := func(_ int, yield func(int64)) {
		for _, ms := range g.ChartInstants {
			yield(ms)
		}
	}
	chartAt := func(ms int64) types.BirthChart {
		c, err := ComputeRashiChart(ctx, ms, pune, BirthChartOptions{})
		if err != nil {
			t.Fatalf("%s: %v", types.Date(ms).ISOString(), err)
		}
		return c
	}

	const digestMod = 1_000_003
	fold := func(values []int, radix int) float64 {
		acc := 0
		for _, v := range values {
			acc = (acc*radix + v) % digestMod
		}
		return float64(acc)
	}
	lens := func(entries []types.ArgalaPerBhava) []int {
		out := make([]int, 0, len(entries))
		for _, e := range entries {
			out = append(out, len(e.Argala)*10+len(e.Virodhargala))
		}
		return out
	}

	for _, c := range []struct {
		name string
		want string
		fn   func(int64) float64
	}{
		{"sarvashtaka", g.Digests.Sarvashtaka, func(ms int64) float64 {
			chart := chartAt(ms)
			return fold(ComputeAshtakavarga(&chart, AshtakavargaOptions{}).Sarvashtaka, 61)
		}},
		{"sarvashtakaReduced", g.Digests.SarvashtakaReduced, func(ms int64) float64 {
			chart := chartAt(ms)
			return fold(ComputeAshtakavarga(&chart, AshtakavargaOptions{Reductions: true}).Reduced.Sarvashtaka, 61)
		}},
		{"arudhaRashis", g.Digests.ArudhaRashis, func(ms int64) float64 {
			chart := chartAt(ms)
			ar, err := ComputeArudhas(&chart, types.LanguageEn)
			if err != nil {
				t.Fatalf("%v", err)
			}
			rashis := make([]int, 0, len(ar))
			for _, a := range ar {
				rashis = append(rashis, a.ArudhaRashi)
			}
			return fold(rashis, 13)
		}},
		{"argalaCounts", g.Digests.ArgalaCounts, func(ms int64) float64 {
			chart := chartAt(ms)
			return fold(lens(ComputeArgala(&chart)), 23)
		}},
		{"doshaFlags", g.Digests.DoshaFlags, func(ms int64) float64 {
			chart := chartAt(ms)
			m := ComputeMangalDosha(&chart)
			k := ComputeKaalSarp(&chart)
			p := ComputePitruDosha(&chart)
			b := func(v bool) float64 {
				if v {
					return 1
				}
				return 0
			}
			return ((b(m.Afflicted)*2+b(k.Afflicted))*2 + b(p.Afflicted)) +
				8*b(k.Partial) + 16*float64(k.RahuHouse) + 256*float64(len(p.Reasons))
		}},
	} {
		got := chartDigest(len(g.ChartInstants), gen, c.fn)
		if got != c.want {
			t.Errorf("%s digest %s, golden %s over %d instants. Every leaf on this "+
				"path is an integer derived from a rashi or house index, so this is a "+
				"port defect and not rounding", c.name, got, c.want, len(g.ChartInstants))
		}
	}
	t.Logf("5 integer digests bit-identical over %d instants", len(g.ChartInstants))
}
