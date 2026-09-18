package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/repopath"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

type matchingGolden struct {
	Meta struct {
		Claim string `json:"claim"`
		Why   string `json:"why"`
	} `json:"_meta"`
	Seed       uint32 `json:"seed"`
	DomainSize int    `json:"domainSize"`
	Tables     struct {
		NakshatraRajju              []string `json:"nakshatraRajju"`
		VedhaPairs                  [][]int  `json:"vedhaPairs"`
		VedhaOf                     []*int   `json:"vedhaOf"`
		MahendraAuspiciousDistances []int    `json:"mahendraAuspiciousDistances"`
		DinaAuspiciousRemainders    []int    `json:"dinaAuspiciousRemainders"`
		RashiDoshicDistances        [][]int  `json:"rashiDoshicDistances"`
	} `json:"tables"`
	Results []struct {
		Label string `json:"label"`
		Boy   struct {
			Rashi         int  `json:"rashi"`
			Nakshatra     int  `json:"nakshatra"`
			LagnaRashi    *int `json:"lagnaRashi"`
			NavamsaRashi  *int `json:"navamsaRashi"`
			NakshatraPada *int `json:"nakshatraPada"`
		} `json:"boy"`
		Girl struct {
			Rashi         int  `json:"rashi"`
			Nakshatra     int  `json:"nakshatra"`
			LagnaRashi    *int `json:"lagnaRashi"`
			NavamsaRashi  *int `json:"navamsaRashi"`
			NakshatraPada *int `json:"nakshatraPada"`
		} `json:"girl"`
		Ashtakoot     AshtakootResult     `json:"ashtakoot"`
		AshtakootGana AshtakootResult     `json:"ashtakootGana"`
		PathuPorutham PathuPoruthamResult `json:"pathuPorutham"`
	} `json:"results"`
	DomainDigests struct {
		AshtakootTotal     string `json:"ashtakootTotal"`
		AshtakootKoots     string `json:"ashtakootKoots"`
		AshtakootGanaTotal string `json:"ashtakootGanaTotal"`
		PathuPasses        string `json:"pathuPasses"`
	} `json:"domainDigests"`
}

func loadMatchingGolden(t *testing.T) matchingGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "matching-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g matchingGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Results) == 0 {
		t.Fatal("golden is empty")
	}
	return g
}

func allNatalMoons() []NatalMoon {
	out := make([]NatalMoon, 0, 12*27)
	for r := 0; r < 12; r++ {
		for n := 0; n < 27; n++ {
			out = append(out, NatalMoon{Rashi: r, Nakshatra: n})
		}
	}
	return out
}

func TestPathuPoruthamTablesMatchTypeScript(t *testing.T) {
	g := loadMatchingGolden(t)
	tb := g.Tables

	if len(tb.NakshatraRajju) != 27 {
		t.Fatalf("golden has %d rajju entries, want 27", len(tb.NakshatraRajju))
	}
	for i, want := range tb.NakshatraRajju {
		if string(NakshatraRajju[i]) != want {
			t.Errorf("NakshatraRajju[%d] = %q, TypeScript %q", i, NakshatraRajju[i], want)
		}
	}
	if len(tb.VedhaPairs) != len(VedhaPairs) {
		t.Fatalf("golden has %d vedha pairs, Go has %d", len(tb.VedhaPairs), len(VedhaPairs))
	}
	for i, want := range tb.VedhaPairs {
		if VedhaPairs[i][0] != want[0] || VedhaPairs[i][1] != want[1] {
			t.Errorf("VedhaPairs[%d] = %v, TypeScript %v", i, VedhaPairs[i], want)
		}
	}
	if len(tb.VedhaOf) != 27 {
		t.Fatalf("golden has %d vedhaOf entries, want 27", len(tb.VedhaOf))
	}
	unpaired := 0
	for i, want := range tb.VedhaOf {
		got, ok := VedhaOf(i)
		if want == nil {
			unpaired++
			if ok {
				t.Errorf("VedhaOf(%d) = %d, TypeScript null", i, got)
			}
			continue
		}
		if !ok {
			t.Errorf("VedhaOf(%d) reported no partner, TypeScript %d", i, *want)
		} else if got != *want {
			t.Errorf("VedhaOf(%d) = %d, TypeScript %d", i, got, *want)
		}
	}
	if unpaired != 1 {
		t.Errorf("%d nakshatras have no Vedha partner; the canonical table leaves "+
			"exactly one (Chitra)", unpaired)
	}
	for i, want := range tb.MahendraAuspiciousDistances {
		if MahendraAuspiciousDistances[i] != want {
			t.Errorf("MahendraAuspiciousDistances[%d] = %d, TypeScript %d",
				i, MahendraAuspiciousDistances[i], want)
		}
	}
	for i, want := range tb.DinaAuspiciousRemainders {
		if DinaAuspiciousRemainders[i] != want {
			t.Errorf("DinaAuspiciousRemainders[%d] = %d, TypeScript %d",
				i, DinaAuspiciousRemainders[i], want)
		}
	}
	for i, want := range tb.RashiDoshicDistances {
		if RashiDoshicDistances[i][0] != want[0] || RashiDoshicDistances[i][1] != want[1] {
			t.Errorf("RashiDoshicDistances[%d] = %v, TypeScript %v",
				i, RashiDoshicDistances[i], want)
		}
	}
}

func TestRajjuLadderIsSymmetricAboutSira(t *testing.T) {
	cycle := [9]Rajju{
		RajjuPada, RajjuKati, RajjuNabhi, RajjuKantha, RajjuSira,
		RajjuKantha, RajjuNabhi, RajjuKati, RajjuPada,
	}
	for i := 0; i < 27; i++ {
		if want := cycle[i%9]; NakshatraRajju[i] != want {
			t.Errorf("NakshatraRajju[%d] = %q, the 9-band ladder says %q", i, NakshatraRajju[i], want)
		}
	}
	counts := map[Rajju]int{}
	for _, r := range NakshatraRajju {
		counts[r]++
	}
	if counts[RajjuSira] != 3 {
		t.Errorf("Sira covers %d nakshatras, want 3; an inverted ladder gives 6", counts[RajjuSira])
	}
	if counts[RajjuPada] != 6 {
		t.Errorf("Pada covers %d nakshatras, want 6; an inverted ladder gives 3", counts[RajjuPada])
	}
	for _, r := range []Rajju{RajjuKati, RajjuNabhi, RajjuKantha} {
		if counts[r] != 6 {
			t.Errorf("%s covers %d nakshatras, want 6", r, counts[r])
		}
	}
	for _, i := range []int{4, 13, 22} {
		if NakshatraRajju[i] != RajjuSira {
			t.Errorf("nakshatra %d is %q; Sira is Mrigashira, Chitra and Dhanishtha only",
				i, NakshatraRajju[i])
		}
	}
	for _, i := range []int{0, 8, 9, 17, 18, 26} {
		if NakshatraRajju[i] != RajjuPada {
			t.Errorf("nakshatra %d is %q; Pada is Ashwini, Ashlesha, Magha, Jyeshtha, "+
				"Mula and Revati", i, NakshatraRajju[i])
		}
	}
}

func TestVedhaPairsAreAPartialMatching(t *testing.T) {
	seen := map[int]int{}
	for _, p := range VedhaPairs {
		if p[0] == p[1] {
			t.Errorf("pair %v pairs a nakshatra with itself", p)
		}
		for _, n := range p {
			if n < 0 || n > 26 {
				t.Errorf("pair %v contains %d, outside 0..26", p, n)
			}
			seen[n]++
		}
	}
	unpaired := []int{}
	for n := 0; n < 27; n++ {
		switch seen[n] {
		case 0:
			unpaired = append(unpaired, n)
		case 1:
		default:
			t.Errorf("nakshatra %d appears in %d pairs; the table is a matching", n, seen[n])
		}
	}
	if len(unpaired) != 1 || unpaired[0] != 13 {
		t.Errorf("unpaired nakshatras are %v; the canonical table leaves exactly "+
			"Chitra (13). An earlier revision left Dhanishtha (22) instead, which "+
			"is the specific error this checks for", unpaired)
	}
	for n := 0; n < 27; n++ {
		partner, ok := VedhaOf(n)
		if !ok {
			continue
		}
		back, ok2 := VedhaOf(partner)
		if !ok2 || back != n {
			t.Errorf("VedhaOf(%d) = %d but VedhaOf(%d) = %d/%v", n, partner, partner, back, ok2)
		}
	}
	symmetric := true
	for _, p := range VedhaPairs {
		if p[0]+p[1] != 17 && p[0]+p[1] != 44 {
			symmetric = false
			break
		}
	}
	if symmetric {
		t.Error("every Vedha pair sums to 17 or 44: that is the rejected " +
			"mirror-symmetric enumeration, not the classical table")
	}
}

func TestMahendraSetIsClosedUnderReversal(t *testing.T) {
	in := map[int]bool{}
	for _, d := range MahendraAuspiciousDistances {
		in[d] = true
	}
	for d := range in {
		if !in[29-d] {
			t.Errorf("%d is in the Mahendra set but its reverse %d is not; the "+
				"outcome is then direction-dependent and the docblock is wrong", d, 29-d)
		}
	}
	// Distance is (boy - girl + 27) % 27 + 1, so 13 and its reverse 16 sit on
	// either side of the > 13 threshold and must score differently.
	at13 := scoreSthreeDeergha(NatalMoon{Nakshatra: 12}, NatalMoon{})
	at16 := scoreSthreeDeergha(NatalMoon{Nakshatra: 15}, NatalMoon{})
	if at13.Passes || !at16.Passes {
		t.Errorf("Sthree Deergha at distance 13 passes=%v, at 16 passes=%v; the threshold "+
			"is > 13 on a 1..27 distance, so 13 must fail and 16 must pass", at13.Passes, at16.Passes)
	}
}

func TestRashiDoshicIsASubsetOfBhakoot(t *testing.T) {
	inBhakoot := func(a, b int) bool {
		for _, p := range BhakootDoshicDistances {
			if p[0] == a && p[1] == b {
				return true
			}
		}
		return false
	}
	for _, p := range RashiDoshicDistances {
		if !inBhakoot(p[0], p[1]) {
			t.Errorf("RashiDoshicDistances contains %v, which BhakootDoshicDistances "+
				"does not; the first is documented as a subset of the second", p)
		}
	}
	if len(RashiDoshicDistances) >= len(BhakootDoshicDistances) {
		t.Errorf("RashiDoshicDistances has %d entries and BhakootDoshicDistances %d; "+
			"the first is a *proper* subset (Bhakoot adds 5/9)",
			len(RashiDoshicDistances), len(BhakootDoshicDistances))
	}
	for _, table := range [][][2]int{sliceOfPairs(RashiDoshicDistances[:]), sliceOfPairs(BhakootDoshicDistances[:])} {
		for _, p := range table {
			found := false
			for _, q := range table {
				if q[0] == p[1] && q[1] == p[0] {
					found = true
					break
				}
			}
			if !found {
				t.Errorf("%v has no mirror in its table; the doshic relation is mutual", p)
			}
		}
	}
}

func sliceOfPairs(in [][2]int) [][2]int { return in }

func TestMatchingResultsMatchTypeScript(t *testing.T) {
	g := loadMatchingGolden(t)
	vetoesSeen := map[PoruthamName]int{}
	cancellationsSeen := map[string]int{}
	for _, r := range g.Results {
		boy := NatalMoon{
			Rashi: r.Boy.Rashi, Nakshatra: r.Boy.Nakshatra,
			LagnaRashi: r.Boy.LagnaRashi, NavamsaRashi: r.Boy.NavamsaRashi,
			NakshatraPada: r.Boy.NakshatraPada,
		}
		girl := NatalMoon{
			Rashi: r.Girl.Rashi, Nakshatra: r.Girl.Nakshatra,
			LagnaRashi: r.Girl.LagnaRashi, NavamsaRashi: r.Girl.NavamsaRashi,
			NakshatraPada: r.Girl.NakshatraPada,
		}

		for _, arm := range []struct {
			label string
			opts  AshtakootOptions
			want  AshtakootResult
		}{
			{"ashtakoot", AshtakootOptions{}, r.Ashtakoot},
			{"ashtakootGana", AshtakootOptions{GanaCancellation: true}, r.AshtakootGana},
		} {
			got, err := ComputeAshtakoot(boy, girl, arm.opts)
			if err != nil {
				t.Fatalf("%s/%s: %v", r.Label, arm.label, err)
			}
			where := r.Label + "/" + arm.label
			if got.TotalScore != arm.want.TotalScore {
				t.Errorf("%s: totalScore %v, TypeScript %v", where, got.TotalScore, arm.want.TotalScore)
			}
			if len(got.Koots) != len(arm.want.Koots) {
				t.Fatalf("%s: %d koots, TypeScript %d", where, len(got.Koots), len(arm.want.Koots))
			}
			for i := range got.Koots {
				if got.Koots[i] != arm.want.Koots[i] {
					t.Errorf("%s koot %d: %+v, TypeScript %+v", where, i, got.Koots[i], arm.want.Koots[i])
				}
			}
			if !stringsEqual(got.Cancellations, arm.want.Cancellations) {
				t.Errorf("%s: cancellations %q, TypeScript %q", where, got.Cancellations, arm.want.Cancellations)
			}
			for _, c := range got.Cancellations {
				cancellationsSeen[c]++
			}
		}

		got, err := ComputePathuPorutham(boy, girl)
		if err != nil {
			t.Fatalf("%s/pathu: %v", r.Label, err)
		}
		w := r.PathuPorutham
		if got.TotalPasses != w.TotalPasses || got.Recommended != w.Recommended {
			t.Errorf("%s: passes/recommended %d/%v, TypeScript %d/%v",
				r.Label, got.TotalPasses, got.Recommended, w.TotalPasses, w.Recommended)
		}
		if len(got.Poruthams) != len(w.Poruthams) {
			t.Fatalf("%s: %d poruthams, TypeScript %d", r.Label, len(got.Poruthams), len(w.Poruthams))
		}
		for i := range got.Poruthams {
			gp, wp := got.Poruthams[i], w.Poruthams[i]
			if gp.Name != wp.Name || gp.Passes != wp.Passes || gp.Description != wp.Description {
				t.Errorf("%s porutham %d: %+v, TypeScript %+v", r.Label, i, gp, wp)
			}
			if (gp.Veto == nil) != (wp.Veto == nil) {
				t.Errorf("%s porutham %s: veto present Go=%v TS=%v: the key is ABSENT "+
					"on a passing koot, not false", r.Label, gp.Name, gp.Veto != nil, wp.Veto != nil)
			}
			if gp.Veto != nil {
				if !*gp.Veto {
					t.Errorf("%s porutham %s: veto is present and false; the TypeScript "+
						"only ever sets it to true", r.Label, gp.Name)
				}
				vetoesSeen[gp.Name]++
			}
		}
	}
	for _, name := range VetoPoruthams {
		if vetoesSeen[name] == 0 {
			t.Errorf("no pair in the sweep triggered the %s veto; that branch is "+
				"untested", name)
		}
	}
	for _, want := range []string{
		"Bhakoot: same lagna-lord", "Bhakoot: same 7th-house lord",
		"Bhakoot: same Navamsa lord", "Bhakoot: same rashi-lord",
		"Nadi: same nakshatra", "Gana: same rashi-lord",
	} {
		if cancellationsSeen[want] == 0 {
			t.Errorf("the cancellation %q never fired; the pair chosen to reach it "+
				"no longer does", want)
		}
	}
	t.Logf("%d pairs compared leaf for leaf; vetoes reached %v", len(g.Results), vetoesSeen)
}

func stringsEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestGrahaMaitriDescriptionCarriesTheIndex(t *testing.T) {
	boy := NatalMoon{Rashi: 0, Nakshatra: 0}
	girl := NatalMoon{Rashi: 7, Nakshatra: 17}
	got, err := ComputeAshtakoot(boy, girl, AshtakootOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var maitri KootScore
	for _, k := range got.Koots {
		if k.Name == KootGrahaMaitri {
			maitri = k
		}
	}
	if want := "Same rashi-lord (graha 2), full marks"; maitri.Description != want {
		t.Errorf("Graha Maitri description = %q, want %q: the TypeScript "+
			"interpolates RASHI_LORD's numeric value, not the graha's name",
			maitri.Description, want)
	}
	if int(RashiLord[0]) != 2 || RashiLord[0] != RashiLord[7] {
		t.Fatalf("Aries and Scorpio are no longer both ruled by graha 2 (%d, %d); "+
			"the pair above no longer reaches the branch", RashiLord[0], RashiLord[7])
	}

	pp, err := ComputePathuPorutham(boy, girl)
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range pp.Poruthams {
		if p.Name != PoruthamRashyathipathi {
			continue
		}
		if want := "Same rashi-lord (graha index 2), full compatibility"; p.Description != want {
			t.Errorf("Rashyathipathi description = %q, want %q", p.Description, want)
		}
	}
}

func TestMatchingOverTheWholeDomain(t *testing.T) {
	g := loadMatchingGolden(t)
	moons := allNatalMoons()
	if len(moons)*len(moons) != g.DomainSize {
		t.Fatalf("Go enumerates %d pairs, the golden %d", len(moons)*len(moons), g.DomainSize)
	}
	const digestMod = 1_000_003
	gen := func(_ int, yield func(int64)) {
		for i := 0; i < len(moons)*len(moons); i++ {
			yield(int64(i))
		}
	}
	pairAt := func(i int64) (NatalMoon, NatalMoon) {
		return moons[int(i)/len(moons)], moons[int(i)%len(moons)]
	}
	must := func(r AshtakootResult, err error) AshtakootResult {
		if err != nil {
			t.Fatalf("%v", err)
		}
		return r
	}

	for _, c := range []struct {
		name string
		want string
		fn   func(int64) float64
	}{
		{"ashtakootTotal", g.DomainDigests.AshtakootTotal, func(i int64) float64 {
			b, gl := pairAt(i)
			return must(ComputeAshtakoot(b, gl, AshtakootOptions{})).TotalScore
		}},
		{"ashtakootKoots", g.DomainDigests.AshtakootKoots, func(i int64) float64 {
			b, gl := pairAt(i)
			acc := 0
			for _, k := range must(ComputeAshtakoot(b, gl, AshtakootOptions{})).Koots {
				acc = (acc*17 + int(k.Score*2)) % digestMod
			}
			return float64(acc)
		}},
		{"ashtakootGanaTotal", g.DomainDigests.AshtakootGanaTotal, func(i int64) float64 {
			b, gl := pairAt(i)
			return must(ComputeAshtakoot(b, gl, AshtakootOptions{GanaCancellation: true})).TotalScore
		}},
		{"pathuPasses", g.DomainDigests.PathuPasses, func(i int64) float64 {
			b, gl := pairAt(i)
			r, err := ComputePathuPorutham(b, gl)
			if err != nil {
				t.Fatalf("%v", err)
			}
			acc := r.TotalPasses * 2
			if r.Recommended {
				acc++
			}
			for _, p := range r.Poruthams {
				v := 0
				if p.Passes {
					v += 2
				}
				if p.Veto != nil && *p.Veto {
					v++
				}
				acc = (acc*5 + v) % digestMod
			}
			return float64(acc)
		}},
	} {
		got := chartDigest(len(moons)*len(moons), gen, c.fn)
		if got != c.want {
			t.Errorf("%s digest %s, golden %s over all %d pairs",
				c.name, got, c.want, len(moons)*len(moons))
		}
	}
	t.Logf("4 digests bit-identical over the whole %d-pair domain", len(moons)*len(moons))
}

func TestAshtakootStructuralInvariants(t *testing.T) {
	moons := allNatalMoons()
	seenTotal := map[float64]bool{}
	seenScores := map[KootName]map[float64]bool{}
	for _, n := range AllKootNames {
		seenScores[n] = map[float64]bool{}
	}
	for _, boy := range moons {
		for _, girl := range moons {
			r, err := ComputeAshtakoot(boy, girl, AshtakootOptions{})
			if err != nil {
				t.Fatalf("(%d,%d)x(%d,%d): %v", boy.Rashi, boy.Nakshatra, girl.Rashi, girl.Nakshatra, err)
			}
			if len(r.Koots) != 8 {
				t.Fatalf("%d koots, want 8", len(r.Koots))
			}
			sum := 0.0
			for i, k := range r.Koots {
				if k.Name != AllKootNames[i] {
					t.Fatalf("koot %d is %q, want %q", i, k.Name, AllKootNames[i])
				}
				if k.MaxScore != KootMaxScores[i] {
					t.Errorf("%s maxScore %v, want %v", k.Name, k.MaxScore, KootMaxScores[i])
				}
				if k.Score < 0 || k.Score > k.MaxScore {
					t.Errorf("%s score %v outside [0, %v]", k.Name, k.Score, k.MaxScore)
				}
				if k.Description == "" {
					t.Errorf("%s has an empty description", k.Name)
				}
				seenScores[k.Name][k.Score] = true
				sum += k.Score
			}
			if r.TotalScore != sum {
				t.Errorf("totalScore %v but the koots sum to %v", r.TotalScore, sum)
			}
			if r.TotalScore < 0 || r.TotalScore > 36 {
				t.Errorf("totalScore %v outside [0, 36]", r.TotalScore)
			}
			seenTotal[r.TotalScore] = true
		}
	}
	for name, vals := range seenScores {
		if len(vals) < 2 {
			t.Errorf("%s took only %d distinct score(s) over the whole domain; its "+
				"rule is constant", name, len(vals))
		}
	}
	if !seenTotal[36] {
		t.Error("no pair in the whole domain scores a perfect 36; the fixture " +
			"corpus contains such pairs, so the scale is wrong somewhere")
	}
	lowest := 36.0
	for v := range seenTotal {
		if v < lowest {
			lowest = v
		}
	}
	t.Logf("over %d pairs: totals span [%v, 36], %d distinct totals",
		len(moons)*len(moons), lowest, len(seenTotal))
}

func TestPathuPoruthamStructuralInvariants(t *testing.T) {
	moons := allNatalMoons()
	vetoed, recommended := 0, 0
	for _, boy := range moons {
		for _, girl := range moons {
			r, err := ComputePathuPorutham(boy, girl)
			if err != nil {
				t.Fatalf("%v", err)
			}
			if len(r.Poruthams) != 10 {
				t.Fatalf("%d poruthams, want 10", len(r.Poruthams))
			}
			passes, veto := 0, false
			for i, p := range r.Poruthams {
				if p.Name != AllPoruthamNames[i] {
					t.Fatalf("porutham %d is %q, want %q", i, p.Name, AllPoruthamNames[i])
				}
				if p.Passes {
					passes++
				}
				if p.Veto == nil {
					continue
				}
				veto = true
				if p.Passes {
					t.Errorf("%s carries a veto and also passes", p.Name)
				}
				isVetoKoot := false
				for _, v := range VetoPoruthams {
					if p.Name == v {
						isVetoKoot = true
					}
				}
				if !isVetoKoot {
					t.Errorf("%s carries a veto; only Yoni, Rajju and Vedha may", p.Name)
				}
			}
			if r.TotalPasses != passes {
				t.Errorf("totalPasses %d, counted %d", r.TotalPasses, passes)
			}
			if want := !veto && passes >= 5; r.Recommended != want {
				t.Errorf("recommended %v, want %v (veto=%v passes=%d)",
					r.Recommended, want, veto, passes)
			}
			if veto {
				vetoed++
			}
			if r.Recommended {
				recommended++
			}
		}
	}
	if vetoed == 0 || recommended == 0 || vetoed == len(moons)*len(moons) {
		t.Errorf("%d vetoed and %d recommended of %d pairs; the sweep must contain "+
			"both outcomes or the contract above is vacuous",
			vetoed, recommended, len(moons)*len(moons))
	}
	t.Logf("over %d pairs: %d vetoed, %d recommended", len(moons)*len(moons), vetoed, recommended)
}

func TestMatchingRejectsOutOfRangeInput(t *testing.T) {
	ptr := func(v int) *int { return &v }
	good := NatalMoon{Rashi: 0, Nakshatra: 0}
	for _, c := range []struct {
		name string
		m    NatalMoon
	}{
		{"rashi 12", NatalMoon{Rashi: 12, Nakshatra: 0}},
		{"rashi -1", NatalMoon{Rashi: -1, Nakshatra: 0}},
		{"nakshatra 27", NatalMoon{Rashi: 0, Nakshatra: 27}},
		{"lagnaRashi 12", NatalMoon{Rashi: 0, Nakshatra: 0, LagnaRashi: ptr(12)}},
		{"navamsaRashi -1", NatalMoon{Rashi: 0, Nakshatra: 0, NavamsaRashi: ptr(-1)}},
		{"nakshatraPada 0", NatalMoon{Rashi: 0, Nakshatra: 0, NakshatraPada: ptr(0)}},
		{"nakshatraPada 5", NatalMoon{Rashi: 0, Nakshatra: 0, NakshatraPada: ptr(5)}},
	} {
		for _, fn := range []struct {
			label string
			run   func(NatalMoon, NatalMoon) error
		}{
			{"ashtakoot", func(a, b NatalMoon) error {
				_, err := ComputeAshtakoot(a, b, AshtakootOptions{})
				return err
			}},
			{"pathu", func(a, b NatalMoon) error {
				_, err := ComputePathuPorutham(a, b)
				return err
			}},
		} {
			for _, arm := range []struct {
				a, b NatalMoon
			}{{c.m, good}, {good, c.m}} {
				err := fn.run(arm.a, arm.b)
				var pe *types.PanchangError
				if !errors.As(err, &pe) {
					t.Errorf("%s/%s: err = %v, want a PanchangError", fn.label, c.name, err)
					continue
				}
				if pe.Code != types.ErrInvalidInput {
					t.Errorf("%s/%s: code %s, want %s", fn.label, c.name, pe.Code, types.ErrInvalidInput)
				}
			}
		}
	}
	if _, err := ComputeAshtakoot(
		NatalMoon{Rashi: 0, Nakshatra: 0, NakshatraPada: ptr(1)}, good, AshtakootOptions{},
	); err != nil {
		t.Errorf("pada 1 must be accepted: %v", err)
	}
	if _, err := ComputeAshtakoot(
		NatalMoon{Rashi: 0, Nakshatra: 0, NakshatraPada: ptr(4)}, good, AshtakootOptions{},
	); err != nil {
		t.Errorf("pada 4 must be accepted: %v", err)
	}
}
