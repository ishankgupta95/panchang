package jyotish

import (
	"encoding/json"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

// Compared bit-exactly: these three leaves have no floating-point path.

type foundationsGolden struct {
	Meta struct {
		Claim  string `json:"claim"`
		Sample string `json:"sample"`
	} `json:"_meta"`
	Dignity []struct {
		Graha   string `json:"graha"`
		Rashi   int    `json:"rashi"`
		Dignity string `json:"dignity"`
	} `json:"dignity"`
	Aspects []struct {
		Chart       int              `json:"chart"`
		NodeAspects string           `json:"nodeAspects"`
		Houses      map[string]int   `json:"houses"`
		Result      map[string][]int `json:"result"`
	} `json:"aspects"`
	AspectsDefault map[string][]int `json:"aspectsDefault"`
	Tables         struct {
		VarnaOrder                 []string    `json:"varnaOrder"`
		VarnaRank                  []int       `json:"varnaRank"`
		RashiVarna                 []string    `json:"rashiVarna"`
		VashyaOrder                []string    `json:"vashyaOrder"`
		VashyaIndex                []int       `json:"vashyaIndex"`
		RashiVashya                []string    `json:"rashiVashya"`
		VashyaScore                [][]float64 `json:"vashyaScore"`
		YoniOrder                  []string    `json:"yoniOrder"`
		YoniIndex                  []int       `json:"yoniIndex"`
		NakshatraYoni              []string    `json:"nakshatraYoni"`
		YoniScore                  [][]int     `json:"yoniScore"`
		RashiLord                  []int       `json:"rashiLord"`
		NaisargikaMaitri           [][]int     `json:"naisargikaMaitri"`
		GrahaMaitriScore           [][]float64 `json:"grahaMaitriScore"`
		MaitriIdx                  []int       `json:"maitriIdx"`
		GanaOrder                  []string    `json:"ganaOrder"`
		GanaIdx                    []int       `json:"ganaIdx"`
		NakshatraGana              []string    `json:"nakshatraGana"`
		GanaScore                  [][]int     `json:"ganaScore"`
		NadiOrder                  []string    `json:"nadiOrder"`
		NakshatraNadi              []string    `json:"nakshatraNadi"`
		InauspiciousTaraRemainders []int       `json:"inauspiciousTaraRemainders"`
		BhakootDoshicDistances     [][]int     `json:"bhakootDoshicDistances"`
	} `json:"tables"`
}

func loadFoundationsGolden(t *testing.T) foundationsGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "foundations-golden.json")
	if err != nil {
		t.Fatalf("read foundations golden: %v", err)
	}
	var g foundationsGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse foundations golden: %v", err)
	}
	return g
}

func grahaByName(t *testing.T, name string) types.Graha {
	t.Helper()
	for _, g := range types.AllGrahas {
		if g.String() == name {
			return g
		}
	}
	t.Fatalf("golden names a graha the enum does not have: %q", name)
	return 0
}

func TestDignityMatchesTypeScript(t *testing.T) {
	g := loadFoundationsGolden(t)
	if len(g.Dignity) != 9*12 {
		t.Fatalf("golden has %d dignity cases, want 108: the sweep is no longer exhaustive",
			len(g.Dignity))
	}

	seen := map[Dignity]int{}
	covered := map[[2]int]bool{}
	for _, c := range g.Dignity {
		graha := grahaByName(t, c.Graha)
		got, err := ComputeDignity(graha, c.Rashi)
		if err != nil {
			t.Fatalf("%s in rashi %d: %v", c.Graha, c.Rashi, err)
		}
		if string(got) != c.Dignity {
			t.Errorf("%s in rashi %d: got %q, want %q", c.Graha, c.Rashi, got, c.Dignity)
		}
		seen[got]++
		covered[[2]int{int(graha), c.Rashi}] = true
	}

	if len(covered) != 9*12 {
		t.Errorf("only %d distinct (graha, rashi) pairs covered, want 108", len(covered))
	}
	for _, d := range AllDignities {
		if seen[d] == 0 {
			t.Errorf("dignity %q never produced over the whole domain: either the "+
				"category is unreachable or a table is wrong", d)
		}
	}
	t.Logf("dignity distribution over all 108 pairs: %v", seen)
}

func TestDignityRejectsOutOfRange(t *testing.T) {
	for _, rashi := range []int{-1, 12, 100} {
		if _, err := ComputeDignity(types.GrahaSun, rashi); err == nil {
			t.Errorf("rashi %d accepted", rashi)
		}
	}
	for _, graha := range []types.Graha{-1, types.GrahaCount} {
		if _, err := ComputeDignity(graha, 0); err == nil {
			t.Errorf("graha %d accepted", int(graha))
		}
	}
	if _, err := ComputeDignity(types.GrahaSun, 0); err != nil {
		t.Errorf("a valid call errored: %v", err)
	}
}

func TestOwnRashisAndRashiLordAgree(t *testing.T) {
	fromLord := map[types.Graha][]int{}
	for rashi, lord := range RashiLord {
		g := lord.Graha()
		fromLord[g] = append(fromLord[g], rashi)
	}
	for _, g := range types.AllGrahas {
		want := fromLord[g]
		got := ownRashis[g]
		if len(got) != len(want) {
			t.Errorf("%v owns %v per dignity.go but %v per RashiLord", g, got, want)
			continue
		}
		for i := range got {
			if got[i] != want[i] {
				t.Errorf("%v owns %v per dignity.go but %v per RashiLord", g, got, want)
				break
			}
		}
	}
	total := 0
	for _, g := range types.AllGrahas {
		if g.IsNode() && len(ownRashis[g]) != 0 {
			t.Errorf("%v owns %v; the nodes rule no rashi in the Parashara scheme", g, ownRashis[g])
		}
		total += len(ownRashis[g])
	}
	if total != 12 {
		t.Errorf("the own-rashi lists cover %d signs in total, want 12", total)
	}
}

func TestDignitySafetyNetIsUnreachable(t *testing.T) {
	checked := 0
	for rashi, lord := range RashiLord {
		g := lord.Graha()
		d, err := ComputeDignity(g, rashi)
		if err != nil {
			t.Fatalf("%v in rashi %d: %v", g, rashi, err)
		}
		switch d {
		case DignityExalted, DignityMoolatrikona, DignityOwn:
		default:
			t.Errorf("%v lords rashi %d but got dignity %q: the friendship branch was "+
				"reached, so the safety net above it is live after all", g, rashi, d)
		}
		checked++
	}
	if checked != 12 {
		t.Errorf("checked %d rashis, want 12", checked)
	}
}

func TestAspectsMatchTypeScript(t *testing.T) {
	g := loadFoundationsGolden(t)
	if len(g.Aspects) != 24 {
		t.Fatalf("golden has %d aspect charts, want 24 (12 charts x 2 conventions)",
			len(g.Aspects))
	}

	covered := map[[2]int]bool{}
	for _, c := range g.Aspects {
		chart := chartFromHouses(t, c.Houses)
		got, err := ComputeAspects(chart, AspectsOptions{NodeAspects: NodeAspects(c.NodeAspects)})
		if err != nil {
			t.Fatalf("chart %d (%s): %v", c.Chart, c.NodeAspects, err)
		}
		for _, graha := range types.AllGrahas {
			want, ok := c.Result[graha.String()]
			if !ok {
				t.Fatalf("golden chart %d has no entry for %v", c.Chart, graha)
			}
			gotHouses, _ := got.ForGraha(graha)
			assertIntsEqual(t, gotHouses, want,
				"chart %d (%s) %v from house %d", c.Chart, c.NodeAspects, graha, c.Houses[graha.String()])
			covered[[2]int{int(graha), c.Houses[graha.String()]}] = true
		}
	}
	if len(covered) != 9*12 {
		t.Errorf("covered %d (graha, house) pairs, want 108", len(covered))
	}

	def := chartFromHousesSlice(t, func(i int) int { return i + 1 })
	got, err := ComputeAspects(def, AspectsOptions{})
	if err != nil {
		t.Fatalf("default-options call: %v", err)
	}
	for _, graha := range types.AllGrahas {
		gotHouses, _ := got.ForGraha(graha)
		assertIntsEqual(t, gotHouses, g.AspectsDefault[graha.String()],
			"default options, %v", graha)
	}
}

func TestAspectsDefaultEqualsSevenOnly(t *testing.T) {
	chart := chartFromHousesSlice(t, func(i int) int { return (i*5)%12 + 1 })
	a, err := ComputeAspects(chart, AspectsOptions{})
	if err != nil {
		t.Fatal(err)
	}
	b, err := ComputeAspects(chart, AspectsOptions{NodeAspects: NodeAspects7Only})
	if err != nil {
		t.Fatal(err)
	}
	for _, g := range types.AllGrahas {
		x, _ := a.ForGraha(g)
		y, _ := b.ForGraha(g)
		assertIntsEqual(t, x, y, "default vs explicit 7-only, %v", g)
	}

	c, err := ComputeAspects(chart, AspectsOptions{NodeAspects: NodeAspects5And9})
	if err != nil {
		t.Fatal(err)
	}
	differed := 0
	for _, g := range types.AllGrahas {
		x, _ := a.ForGraha(g)
		y, _ := c.ForGraha(g)
		if len(x) != len(y) {
			differed++
			if !g.IsNode() {
				t.Errorf("%v is not a node but its aspects changed with nodeAspects", g)
			}
		}
	}
	if differed != 2 {
		t.Errorf("%d grahas changed under 5-and-9, want exactly 2 (Rahu and Ketu)", differed)
	}
}

func TestAspectsRejectMalformedInput(t *testing.T) {
	full := chartFromHousesSlice(t, func(i int) int { return i + 1 })

	if _, err := ComputeAspects(full, AspectsOptions{NodeAspects: "9-only"}); err == nil {
		t.Error("an unrecognised nodeAspects was accepted; TypeScript rejects it at compile time " +
			"and Go cannot, so the check has to be here")
	}

	short := &types.BirthChart{Planets: full.Planets[:8]}
	if _, err := ComputeAspects(short, AspectsOptions{}); err == nil {
		t.Error("a chart missing Ketu was accepted; it would publish a null key where " +
			"the TypeScript publishes none, which is a shape divergence")
	}

	dup := &types.BirthChart{Planets: append(append([]types.PlanetPlacement{}, full.Planets...), full.Planets[0])}
	if _, err := ComputeAspects(dup, AspectsOptions{}); err == nil {
		t.Error("a chart with a duplicated graha was accepted")
	}

	bad := &types.BirthChart{Planets: append([]types.PlanetPlacement{}, full.Planets...)}
	bad.Planets[0].Planet = types.Graha(42)
	if _, err := ComputeAspects(bad, AspectsOptions{}); err == nil {
		t.Error("a chart with an out-of-range graha was accepted")
	}
}

func TestUniversalSeventhAspectHolds(t *testing.T) {
	for _, conv := range []NodeAspects{NodeAspects7Only, NodeAspects5And9} {
		for house := 1; house <= 12; house++ {
			chart := chartFromHousesSlice(t, func(int) int { return house })
			got, err := ComputeAspects(chart, AspectsOptions{NodeAspects: conv})
			if err != nil {
				t.Fatal(err)
			}
			want := (house-1+6)%12 + 1
			for _, g := range types.AllGrahas {
				houses, _ := got.ForGraha(g)
				if !containsInt(houses, want) {
					t.Errorf("%s: %v in house %d does not aspect house %d (got %v)",
						conv, g, house, want, houses)
				}
				for i := 1; i < len(houses); i++ {
					if houses[i] <= houses[i-1] {
						t.Errorf("%s: %v in house %d gave %v, not strictly ascending",
							conv, g, house, houses)
						break
					}
				}
				if containsInt(houses, house) {
					t.Errorf("%s: %v in house %d aspects its own house (%v)", conv, g, house, houses)
				}
				for _, h := range houses {
					if h < 1 || h > 12 {
						t.Errorf("%s: %v in house %d produced house %d, out of [1,12]",
							conv, g, house, h)
					}
				}
			}
		}
	}
}

func TestAspectCountsAreTheClassicalOnes(t *testing.T) {
	chart := chartFromHousesSlice(t, func(i int) int { return i + 1 })
	for _, tc := range []struct {
		conv NodeAspects
		want map[types.Graha]int
	}{
		{NodeAspects7Only, map[types.Graha]int{
			types.GrahaSun: 1, types.GrahaMoon: 1, types.GrahaMars: 3,
			types.GrahaMercury: 1, types.GrahaJupiter: 3, types.GrahaVenus: 1,
			types.GrahaSaturn: 3, types.GrahaRahu: 1, types.GrahaKetu: 1,
		}},
		{NodeAspects5And9, map[types.Graha]int{
			types.GrahaSun: 1, types.GrahaMoon: 1, types.GrahaMars: 3,
			types.GrahaMercury: 1, types.GrahaJupiter: 3, types.GrahaVenus: 1,
			types.GrahaSaturn: 3, types.GrahaRahu: 3, types.GrahaKetu: 3,
		}},
	} {
		got, err := ComputeAspects(chart, AspectsOptions{NodeAspects: tc.conv})
		if err != nil {
			t.Fatal(err)
		}
		for g, want := range tc.want {
			houses, _ := got.ForGraha(g)
			if len(houses) != want {
				t.Errorf("%s: %v aspects %d houses (%v), want %d", tc.conv, g, len(houses), houses, want)
			}
		}
	}
}

func chartFromHouses(t *testing.T, houses map[string]int) *types.BirthChart {
	t.Helper()
	planets := make([]types.PlanetPlacement, 0, types.GrahaCount)
	for _, g := range types.AllGrahas {
		h, ok := houses[g.String()]
		if !ok {
			t.Fatalf("golden chart has no house for %v", g)
		}
		planets = append(planets, types.PlanetPlacement{Planet: g, House: h})
	}
	return &types.BirthChart{Planets: planets}
}

func chartFromHousesSlice(t *testing.T, house func(i int) int) *types.BirthChart {
	t.Helper()
	planets := make([]types.PlanetPlacement, 0, types.GrahaCount)
	for i, g := range types.AllGrahas {
		planets = append(planets, types.PlanetPlacement{Planet: g, House: house(i)})
	}
	return &types.BirthChart{Planets: planets}
}

func containsInt(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

func assertIntsEqual(t *testing.T, got, want []int, format string, args ...any) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf(format+": got %v, want %v", append(args, got, want)...)
		return
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf(format+": got %v, want %v", append(args, got, want)...)
			return
		}
	}
}
