package jyotish

import (
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

func TestMatchingTablesMatchTypeScript(t *testing.T) {
	g := loadFoundationsGolden(t).Tables

	assertStrings(t, varnaStrings(AllVarnas), g.VarnaOrder, "varna order")
	assertStrings(t, vashyaStrings(AllVashyas), g.VashyaOrder, "vashya order")
	assertStrings(t, yoniStrings(AllYoniAnimals), g.YoniOrder, "yoni order")
	assertStrings(t, ganaStrings(AllGanas), g.GanaOrder, "gana order")
	assertStrings(t, nadiStrings(AllNadis), g.NadiOrder, "nadi order")

	for i, v := range AllVarnas {
		if VarnaRank[v] != g.VarnaRank[i] {
			t.Errorf("VarnaRank[%s] = %d, want %d", v, VarnaRank[v], g.VarnaRank[i])
		}
	}
	assertStrings(t, varnaStrings(RashiVarna[:]), g.RashiVarna, "RashiVarna")
	assertStrings(t, vashyaStrings(RashiVashya[:]), g.RashiVashya, "RashiVashya")
	assertStrings(t, yoniStrings(NakshatraYoni[:]), g.NakshatraYoni, "NakshatraYoni")
	assertStrings(t, ganaStrings(NakshatraGana[:]), g.NakshatraGana, "NakshatraGana")
	assertStrings(t, nadiStrings(NakshatraNadi[:]), g.NakshatraNadi, "NakshatraNadi")

	for i, v := range AllVashyas {
		if VashyaIndex(v) != g.VashyaIndex[i] {
			t.Errorf("VashyaIndex(%s) = %d, want %d", v, VashyaIndex(v), g.VashyaIndex[i])
		}
	}
	for i, y := range AllYoniAnimals {
		if YoniIndex(y) != g.YoniIndex[i] {
			t.Errorf("YoniIndex(%s) = %d, want %d", y, YoniIndex(y), g.YoniIndex[i])
		}
	}
	for i, ga := range AllGanas {
		if GanaIdx(ga) != g.GanaIdx[i] {
			t.Errorf("GanaIdx(%s) = %d, want %d", ga, GanaIdx(ga), g.GanaIdx[i])
		}
	}
	for i, v := range []int{-1, 0, 1} {
		if MaitriIdx(v) != g.MaitriIdx[i] {
			t.Errorf("MaitriIdx(%d) = %d, want %d", v, MaitriIdx(v), g.MaitriIdx[i])
		}
	}

	assertFloatGrid(t, vashyaGrid(), g.VashyaScore, "VashyaScore")
	assertFloatGrid(t, maitriGrid(), g.GrahaMaitriScore, "GrahaMaitriScore")
	assertIntGrid(t, yoniGrid(), g.YoniScore, "YoniScore")
	assertIntGrid(t, naisargikaGrid(), g.NaisargikaMaitri, "NaisargikaMaitri")
	assertIntGrid(t, ganaScoreGrid(), g.GanaScore, "GanaScore")

	if len(g.RashiLord) != 12 {
		t.Fatalf("golden RashiLord has %d entries, want 12", len(g.RashiLord))
	}
	for i, want := range g.RashiLord {
		if int(RashiLord[i]) != want {
			t.Errorf("RashiLord[%d] = %d (%v), want %d", i, int(RashiLord[i]), RashiLord[i], want)
		}
	}

	assertIntsEqual(t, InauspiciousTaraRemainders[:], g.InauspiciousTaraRemainders,
		"InauspiciousTaraRemainders")
	if len(g.BhakootDoshicDistances) != len(BhakootDoshicDistances) {
		t.Fatalf("BhakootDoshicDistances: %d pairs, want %d",
			len(BhakootDoshicDistances), len(g.BhakootDoshicDistances))
	}
	for i, want := range g.BhakootDoshicDistances {
		assertIntsEqual(t, BhakootDoshicDistances[i][:], want, "BhakootDoshicDistances[%d]", i)
	}
}

func TestTableIndexMapsAreTotal(t *testing.T) {
	t.Run("vashya", func(t *testing.T) {
		assertIsPermutation(t, len(AllVashyas), func(i int) (int, bool) {
			v := AllVashyas[i]
			idx, ok := vIndex[v]
			return idx, ok
		}, len(VashyaScore))
	})
	t.Run("yoni", func(t *testing.T) {
		assertIsPermutation(t, len(AllYoniAnimals), func(i int) (int, bool) {
			idx, ok := yIndex[AllYoniAnimals[i]]
			return idx, ok
		}, len(YoniScore))
	})
	t.Run("gana", func(t *testing.T) {
		assertIsPermutation(t, len(AllGanas), func(i int) (int, bool) {
			idx, ok := gIndex[AllGanas[i]]
			return idx, ok
		}, len(GanaScore))
	})

	if len(vIndex) != len(AllVashyas) {
		t.Errorf("vIndex has %d entries, AllVashyas has %d", len(vIndex), len(AllVashyas))
	}
	if len(yIndex) != len(AllYoniAnimals) {
		t.Errorf("yIndex has %d entries, AllYoniAnimals has %d", len(yIndex), len(AllYoniAnimals))
	}
	if len(gIndex) != len(AllGanas) {
		t.Errorf("gIndex has %d entries, AllGanas has %d", len(gIndex), len(AllGanas))
	}
	if len(VarnaRank) != len(AllVarnas) {
		t.Errorf("VarnaRank has %d entries, AllVarnas has %d", len(VarnaRank), len(AllVarnas))
	}
}

func TestYoniScoreConstructionIsFaithful(t *testing.T) {
	sheep, monkey := yIndex[YoniSheep], yIndex[YoniMonkey]
	if YoniScore[sheep][monkey] != 0 || YoniScore[monkey][sheep] != 0 {
		t.Errorf("sheep/monkey scores %d/%d, want 0/0. The enemy entry was overwritten "+
			"by the unfriendly pass, which is exactly what the `== 2` guard prevents",
			YoniScore[sheep][monkey], YoniScore[monkey][sheep])
	}
	inEnemy, inUnfriendly := false, false
	for _, p := range yoniEnemyPairs {
		if (p[0] == YoniSheep && p[1] == YoniMonkey) || (p[0] == YoniMonkey && p[1] == YoniSheep) {
			inEnemy = true
		}
	}
	for _, p := range yoniUnfriendlyPairs {
		if (p[0] == YoniSheep && p[1] == YoniMonkey) || (p[0] == YoniMonkey && p[1] == YoniSheep) {
			inUnfriendly = true
		}
	}
	if !inEnemy || !inUnfriendly {
		t.Errorf("sheep/monkey in enemy list: %v, in unfriendly list: %v. This test's "+
			"whole premise is that it is in BOTH", inEnemy, inUnfriendly)
	}

	for i := range YoniScore {
		for j := range YoniScore[i] {
			if YoniScore[i][j] != YoniScore[j][i] {
				t.Errorf("YoniScore is asymmetric at (%d,%d): %d vs %d",
					i, j, YoniScore[i][j], YoniScore[j][i])
			}
		}
	}
	for i := range YoniScore {
		if YoniScore[i][i] != 4 {
			t.Errorf("YoniScore[%d][%d] = %d, want 4 (same animal)", i, i, YoniScore[i][i])
		}
		for j, v := range YoniScore[i] {
			if v < 0 || v > 4 {
				t.Errorf("YoniScore[%d][%d] = %d, outside the documented 0..4", i, j, v)
			}
		}
	}
	seen := map[int]int{}
	for i := range YoniScore {
		for _, v := range YoniScore[i] {
			seen[v]++
		}
	}
	for _, v := range []int{0, 1, 2, 4} {
		if seen[v] == 0 {
			t.Errorf("no cell scores %d: a construction step produced nothing", v)
		}
	}
	t.Logf("YoniScore cell distribution: %v", seen)
}

func TestGanaScoreIsSymmetric(t *testing.T) {
	for i := range GanaScore {
		for j := range GanaScore[i] {
			if GanaScore[i][j] != GanaScore[j][i] {
				t.Errorf("GanaScore is directional at (%d,%d): %d vs %d. If that is intended, "+
					"this test is the place to say so, but every Deva/Manushya and "+
					"Deva/Rakshasa match changes score with it",
					i, j, GanaScore[i][j], GanaScore[j][i])
			}
		}
	}
	deva, man, rak := GanaIdx(GanaDeva), GanaIdx(GanaManushya), GanaIdx(GanaRakshasa)
	for _, c := range []struct {
		a, b, want int
		label      string
	}{
		{deva, deva, 6, "Deva/Deva"},
		{man, man, 6, "Manushya/Manushya"},
		{rak, rak, 6, "Rakshasa/Rakshasa"},
		{deva, man, 5, "Deva/Manushya"},
		{deva, rak, 1, "Deva/Rakshasa"},
		{man, rak, 0, "Manushya/Rakshasa"},
	} {
		if GanaScore[c.a][c.b] != c.want {
			t.Errorf("%s = %d, want %d", c.label, GanaScore[c.a][c.b], c.want)
		}
	}
	zeros := 0
	for i := range GanaScore {
		for _, v := range GanaScore[i] {
			if v == 0 {
				zeros++
			}
		}
	}
	if zeros != 2 {
		t.Errorf("%d cells score 0, want 2 (Manushya/Rakshasa in both directions)", zeros)
	}
}

func TestNaisargikaMaitriIsWellFormed(t *testing.T) {
	if len(NaisargikaMaitri) != types.VisibleGrahaCount {
		t.Fatalf("NaisargikaMaitri has %d rows, want %d", len(NaisargikaMaitri), types.VisibleGrahaCount)
	}
	counts := map[int]int{}
	for i, row := range NaisargikaMaitri {
		if row[i] != 0 {
			t.Errorf("%v's view of itself is %d, want 0 (neutral): the diagonal is not a "+
				"friendship", types.VisibleGraha(i), row[i])
		}
		for j, v := range row {
			if v < -1 || v > 1 {
				t.Errorf("NaisargikaMaitri[%d][%d] = %d, outside {-1, 0, 1}", i, j, v)
			}
			counts[v]++
		}
	}
	for _, v := range []int{-1, 0, 1} {
		if counts[v] == 0 {
			t.Errorf("no cell holds %d; the matrix has lost a category", v)
		}
	}

	moon, merc := types.VisibleMoon, types.VisibleMercury
	if NaisargikaMaitri[moon][merc] != 1 || NaisargikaMaitri[merc][moon] != -1 {
		t.Errorf("Moon->Mercury = %d, Mercury->Moon = %d; want 1 and -1, the classical "+
			"asymmetric pair", NaisargikaMaitri[moon][merc], NaisargikaMaitri[merc][moon])
	}
}

func TestRashiLordCoversEveryVisibleGraha(t *testing.T) {
	counts := map[types.VisibleGraha]int{}
	for _, lord := range RashiLord {
		if !lord.Valid() {
			t.Fatalf("RashiLord holds an out-of-range value %d", int(lord))
		}
		counts[lord]++
	}
	for _, v := range types.AllVisibleGrahas {
		if counts[v] == 0 {
			t.Errorf("%v lords no rashi", v)
		}
	}
	for v, want := range map[types.VisibleGraha]int{
		types.VisibleSun: 1, types.VisibleMoon: 1, types.VisibleMars: 2,
		types.VisibleMercury: 2, types.VisibleJupiter: 2, types.VisibleVenus: 2,
		types.VisibleSaturn: 2,
	} {
		if counts[v] != want {
			t.Errorf("%v lords %d rashis, want %d", v, counts[v], want)
		}
	}
}

func TestNakshatraClassifierTablesAreBalanced(t *testing.T) {
	nadiCounts := map[Nadi]int{}
	for _, n := range NakshatraNadi {
		nadiCounts[n]++
	}
	for _, n := range AllNadis {
		if nadiCounts[n] != 9 {
			t.Errorf("nadi %q covers %d nakshatras, want 9", n, nadiCounts[n])
		}
	}

	ganaCounts := map[Gana]int{}
	for _, g := range NakshatraGana {
		ganaCounts[g]++
	}
	for _, g := range AllGanas {
		if ganaCounts[g] != 9 {
			t.Errorf("gana %q covers %d nakshatras, want 9", g, ganaCounts[g])
		}
	}

	yoniCounts := map[YoniAnimal]int{}
	for _, y := range NakshatraYoni {
		yoniCounts[y]++
	}
	singles := 0
	for _, y := range AllYoniAnimals {
		switch yoniCounts[y] {
		case 2:
		case 1:
			singles++
		default:
			t.Errorf("yoni %q covers %d nakshatras, want 1 or 2", y, yoniCounts[y])
		}
	}
	if singles != 1 {
		t.Errorf("%d yoni animals cover a single nakshatra, want exactly 1 (27 = 13*2 + 1)", singles)
	}

	varnaCounts := map[Varna]int{}
	for _, v := range RashiVarna {
		varnaCounts[v]++
	}
	for _, v := range AllVarnas {
		if varnaCounts[v] != 3 {
			t.Errorf("varna %q covers %d rashis, want 3 (one element triplicity)", v, varnaCounts[v])
		}
	}
}

func varnaStrings(xs []Varna) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = string(x)
	}
	return out
}
func vashyaStrings(xs []Vashya) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = string(x)
	}
	return out
}
func yoniStrings(xs []YoniAnimal) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = string(x)
	}
	return out
}
func ganaStrings(xs []Gana) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = string(x)
	}
	return out
}
func nadiStrings(xs []Nadi) []string {
	out := make([]string, len(xs))
	for i, x := range xs {
		out[i] = string(x)
	}
	return out
}

func vashyaGrid() [][]float64 {
	out := make([][]float64, len(VashyaScore))
	for i := range VashyaScore {
		out[i] = VashyaScore[i][:]
	}
	return out
}
func maitriGrid() [][]float64 {
	out := make([][]float64, len(GrahaMaitriScore))
	for i := range GrahaMaitriScore {
		out[i] = GrahaMaitriScore[i][:]
	}
	return out
}
func yoniGrid() [][]int {
	out := make([][]int, len(YoniScore))
	for i := range YoniScore {
		out[i] = YoniScore[i][:]
	}
	return out
}
func naisargikaGrid() [][]int {
	out := make([][]int, len(NaisargikaMaitri))
	for i := range NaisargikaMaitri {
		out[i] = NaisargikaMaitri[i][:]
	}
	return out
}
func ganaScoreGrid() [][]int {
	out := make([][]int, len(GanaScore))
	for i := range GanaScore {
		out[i] = GanaScore[i][:]
	}
	return out
}

func assertStrings(t *testing.T, got, want []string, what string) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: %d entries, want %d", what, len(got), len(want))
		return
	}
	for i := range got {
		if got[i] != want[i] {
			t.Errorf("%s[%d] = %q, want %q", what, i, got[i], want[i])
		}
	}
}

func assertIntGrid(t *testing.T, got, want [][]int, what string) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: %d rows, want %d", what, len(got), len(want))
		return
	}
	for i := range got {
		assertIntsEqual(t, got[i], want[i], "%s row %d", what, i)
	}
}

func assertFloatGrid(t *testing.T, got, want [][]float64, what string) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: %d rows, want %d", what, len(got), len(want))
		return
	}
	for i := range got {
		if len(got[i]) != len(want[i]) {
			t.Errorf("%s row %d: %d cells, want %d", what, i, len(got[i]), len(want[i]))
			continue
		}
		for j := range got[i] {
			if got[i][j] != want[i][j] {
				t.Errorf("%s[%d][%d] = %v, want %v", what, i, j, got[i][j], want[i][j])
			}
		}
	}
}

func assertIsPermutation(t *testing.T, n int, idx func(int) (int, bool), dim int) {
	t.Helper()
	if dim != n {
		t.Errorf("score matrix is %dx%d but the domain has %d members", dim, dim, n)
	}
	seen := make([]int, n)
	for i := 0; i < n; i++ {
		v, ok := idx(i)
		if !ok {
			t.Errorf("member %d has no index: a map entry is missing, and the lookup "+
				"would silently return 0", i)
			continue
		}
		if v < 0 || v >= n {
			t.Errorf("member %d maps to %d, outside [0,%d)", i, v, n)
			continue
		}
		seen[v]++
	}
	for v, c := range seen {
		if c != 1 {
			t.Errorf("index %d is produced %d times, want exactly 1", v, c)
		}
	}
}
