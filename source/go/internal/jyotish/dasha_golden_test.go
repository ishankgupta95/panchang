package jyotish

import (
	"encoding/json"
	"errors"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"math"
	"sort"
	"testing"
	"time"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/utils"
)

type gPeriod struct {
	Lord      types.DashaLord `json:"lord"`
	Yogini    string          `json:"yogini"`
	Rashi     *int            `json:"rashi"`
	StartDate types.JSDate    `json:"startDate"`
	EndDate   types.JSDate    `json:"endDate"`
	Years     float64         `json:"years"`
	Antar     []gPeriod       `json:"antarDashas"`
}

type gResult struct {
	CurrentMahaDashaLord types.DashaLord `json:"currentMahaDashaLord"`
	CurrentYogini        YoginiName      `json:"currentYogini"`
	CurrentIndex         *int            `json:"currentIndex"`
	CurrentRashi         *int            `json:"currentRashi"`
	Direction            string          `json:"direction"`
	StartingRashi        int             `json:"startingRashi"`
	MahaDashas           []gPeriod       `json:"mahaDashas"`
}

type dashaGolden struct {
	Meta struct {
		AsOf string `json:"asOf"`
	} `json:"_meta"`
	Samples   int `json:"samples"`
	Locations []struct {
		Name      string  `json:"name"`
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
	} `json:"locations"`
	PinOffsets        []int64            `json:"pinOffsets"`
	MsPerYear         float64            `json:"msPerYear"`
	DashaYears        map[string]float64 `json:"dashaYears"`
	DashaOrder        []string           `json:"dashaOrder"`
	NakshatraLord     []string           `json:"nakshatraLord"`
	AshtottariOrder   []string           `json:"ashtottariOrder"`
	AshtottariYears   map[string]float64 `json:"ashtottariYears"`
	AshtottariGroups  [][]int            `json:"ashtottariGroups"`
	YoginiOrder       []string           `json:"yoginiOrder"`
	YoginiYears       map[string]float64 `json:"yoginiYears"`
	YoginiPlanet      map[string]string  `json:"yoginiPlanet"`
	CharaRashiYears   []float64          `json:"charaRashiYears"`
	VishamaPadaRashis []int              `json:"vishamaPadaRashis"`
	SamaPadaRashis    []int              `json:"samaPadaRashis"`
	Instants          []int64            `json:"instants"`
	Sweep             []struct {
		Ms                 int64     `json:"ms"`
		Loc                string    `json:"loc"`
		MoonLon            float64   `json:"moonLon"`
		Vimshottari        gResult   `json:"vimshottari"`
		VimshottariAtPins  []int     `json:"vimshottariAtPins"`
		Ashtottari         gResult   `json:"ashtottari"`
		AshtottariAtPins   []int     `json:"ashtottariAtPins"`
		Yogini             gResult   `json:"yogini"`
		YoginiAtPins       []int     `json:"yoginiAtPins"`
		Chara              gResult   `json:"chara"`
		CharaAtPins        []int     `json:"charaAtPins"`
		NarayanFixed       gResult   `json:"narayanFixed"`
		NarayanFixedAtPins []int     `json:"narayanFixedAtPins"`
		NarayanVariable    gResult   `json:"narayanVariable"`
		NarayanVarAtPins   []int     `json:"narayanVariableAtPins"`
		PratyantarOf       gPeriod   `json:"pratyantarOf"`
		Pratyantar         []gPeriod `json:"pratyantar"`
	} `json:"sweep"`
	BoundaryBirthMs int64 `json:"boundaryBirthMs"`
	// Recomputing this in Go would mix a ULP difference into an exact test.
	BoundaryBirthMoonLon float64 `json:"boundaryBirthMoonLon"`
	Boundary             []struct {
		MoonLon             float64 `json:"moonLon"`
		NakIdx              int     `json:"nakIdx"`
		Vimshottari         gResult `json:"vimshottari"`
		FirstMahaAntarCount int     `json:"firstMahaAntarCount"`
		Ashtottari          gResult `json:"ashtottari"`
		Yogini              gResult `json:"yogini"`
	} `json:"boundary"`
	PratyantarAll []struct {
		Maha    int             `json:"maha"`
		Antar   int             `json:"antar"`
		Lord    types.DashaLord `json:"lord"`
		Periods []gPeriod       `json:"periods"`
	} `json:"pratyantarAll"`
	FromBirth []struct {
		Ayanamsa types.AyanamsaType `json:"ayanamsa"`
		Result   gResult            `json:"result"`
	} `json:"fromBirth"`
	FromBirthDefault gResult `json:"fromBirthDefault"`
	Rule4            []struct {
		Label    string  `json:"label"`
		Ms       int64   `json:"ms"`
		Variable gResult `json:"variable"`
	} `json:"rule4"`
	Rule4dTie []struct {
		Label    string  `json:"label"`
		Ms       int64   `json:"ms"`
		Variable gResult `json:"variable"`
	} `json:"rule4dTie"`
	HalfOpenPins []struct {
		PinMs int64 `json:"pinMs"`
		Index int   `json:"index"`
	} `json:"halfOpenPins"`
}

func loadDashaGolden(t *testing.T) dashaGolden {
	t.Helper()
	b, err := repopath.ReadTestData("goldens", "jyotish", "dasha-golden.json")
	if err != nil {
		t.Fatalf("read golden: %v", err)
	}
	var g dashaGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatalf("parse golden: %v", err)
	}
	if len(g.Sweep) == 0 || len(g.Boundary) == 0 || len(g.Rule4) == 0 {
		t.Fatal("golden is empty")
	}
	if g.Meta.AsOf == "" {
		t.Fatal("_meta.asOf is empty: the generator did not pin the instant the " +
			"Current* leaves were taken at, so they cannot be compared")
	}
	if g.Sweep[0].Vimshottari.CurrentIndex == nil {
		t.Fatal("currentIndex is absent from the golden")
	}
	return g
}

func dashaLoc(g dashaGolden, name string) types.GeoLocation {
	for _, l := range g.Locations {
		if l.Name == name {
			return types.GeoLocation{Latitude: l.Latitude, Longitude: l.Longitude}
		}
	}
	panic("unknown location " + name)
}

func TestDashaTablesMatchTypeScript(t *testing.T) {
	g := loadDashaGolden(t)

	if g.MsPerYear != msPerYear {
		t.Errorf("msPerYear %v, TypeScript %v", msPerYear, g.MsPerYear)
	}
	for name, want := range g.DashaYears {
		lord := dashaLordByName(t, name)
		if DashaYears[lord] != want {
			t.Errorf("DashaYears[%s] = %v, TypeScript %v", name, DashaYears[lord], want)
		}
	}
	if len(g.DashaOrder) != types.DashaLordCount {
		t.Fatalf("DASHA_ORDER has %d entries, expected %d", len(g.DashaOrder), types.DashaLordCount)
	}
	for i, name := range g.DashaOrder {
		if DashaOrder[i].String() != name {
			t.Errorf("DashaOrder[%d] = %s, TypeScript %s", i, DashaOrder[i], name)
		}
	}
	for i, name := range g.NakshatraLord {
		if NakshatraLord[i].String() != name {
			t.Errorf("NakshatraLord[%d] = %s, TypeScript %s", i, NakshatraLord[i], name)
		}
	}
	for i, name := range g.AshtottariOrder {
		if AshtottariOrder[i].String() != name {
			t.Errorf("AshtottariOrder[%d] = %s, TypeScript %s", i, AshtottariOrder[i], name)
		}
	}
	for name, want := range g.AshtottariYears {
		lord := dashaLordByName(t, name)
		if AshtottariYears[lord] != want {
			t.Errorf("AshtottariYears[%s] = %v, TypeScript %v", name, AshtottariYears[lord], want)
		}
	}
	if len(g.AshtottariGroups) != len(AshtottariNakshatraGroups) {
		t.Fatalf("Ashtottari groups: %d, TypeScript %d",
			len(AshtottariNakshatraGroups), len(g.AshtottariGroups))
	}
	for i, want := range g.AshtottariGroups {
		got := AshtottariNakshatraGroups[i]
		if len(got) != len(want) {
			t.Errorf("AshtottariNakshatraGroups[%d]: %v, TypeScript %v", i, got, want)
			continue
		}
		for j := range want {
			if got[j] != want[j] {
				t.Errorf("AshtottariNakshatraGroups[%d][%d] = %d, TypeScript %d", i, j, got[j], want[j])
			}
		}
	}
	for i, name := range g.YoginiOrder {
		if string(YoginiOrder[i]) != name {
			t.Errorf("YoginiOrder[%d] = %s, TypeScript %s", i, YoginiOrder[i], name)
		}
	}
	for name, want := range g.YoginiYears {
		i := yoginiIndexByName(t, name)
		if YoginiYears[i] != want {
			t.Errorf("YoginiYears[%s] = %v, TypeScript %v", name, YoginiYears[i], want)
		}
	}
	for name, want := range g.YoginiPlanet {
		i := yoginiIndexByName(t, name)
		if YoginiPlanet[i].String() != want {
			t.Errorf("YoginiPlanet[%s] = %s, TypeScript %s", name, YoginiPlanet[i], want)
		}
	}
	for i, want := range g.CharaRashiYears {
		if CharaRashiYears[i] != want {
			t.Errorf("CharaRashiYears[%d] = %v, TypeScript %v", i, CharaRashiYears[i], want)
		}
	}
	for r := 0; r < 12; r++ {
		wantVishama := intsContain(g.VishamaPadaRashis, r)
		wantSama := intsContain(g.SamaPadaRashis, r)
		if VishamaPadaRashis[r] != wantVishama {
			t.Errorf("VishamaPadaRashis[%d] = %v, TypeScript %v", r, VishamaPadaRashis[r], wantVishama)
		}
		if SamaPadaRashis[r] != wantSama {
			t.Errorf("SamaPadaRashis[%d] = %v, TypeScript %v", r, SamaPadaRashis[r], wantSama)
		}
		if wantVishama == wantSama {
			t.Errorf("rashi %d is in %d pada sets, expected exactly 1", r, b2i(wantVishama)+b2i(wantSama))
		}
	}
}

func dashaLordByName(t *testing.T, name string) types.DashaLord {
	t.Helper()
	for _, l := range types.AllDashaLords {
		if l.String() == name {
			return l
		}
	}
	t.Fatalf("unknown dasha lord %q in the golden", name)
	return 0
}

func yoginiIndexByName(t *testing.T, name string) int {
	t.Helper()
	for i, y := range YoginiOrder {
		if string(y) == name {
			return i
		}
	}
	t.Fatalf("unknown Yogini %q in the golden", name)
	return 0
}

func intsContain(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

func TestDashaOrderIsTheEnumOrder(t *testing.T) {
	for i := 0; i < types.DashaLordCount; i++ {
		if DashaOrder[i] != types.DashaLord(i) {
			t.Fatalf("DashaOrder[%d] = %v, but int(lord) is used as the cycle index "+
				"throughout dasha.go, which requires DashaOrder[i] == DashaLord(i)",
				i, DashaOrder[i])
		}
	}
	for i, l := range types.AllDashaLords {
		if int(l) != i {
			t.Fatalf("AllDashaLords[%d] = %d", i, int(l))
		}
	}
}

func comparePeriods(t *testing.T, where string, got, want []gPeriod) {
	t.Helper()
	if len(got) != len(want) {
		t.Errorf("%s: %d periods, TypeScript %d", where, len(got), len(want))
		return
	}
	for i := range got {
		gp, wp := got[i], want[i]
		if gp.Lord != wp.Lord {
			t.Errorf("%s[%d]: lord %v, TypeScript %v", where, i, gp.Lord, wp.Lord)
		}
		if gp.Yogini != wp.Yogini {
			t.Errorf("%s[%d]: yogini %q, TypeScript %q", where, i, gp.Yogini, wp.Yogini)
		}
		if (gp.Rashi == nil) != (wp.Rashi == nil) ||
			(gp.Rashi != nil && *gp.Rashi != *wp.Rashi) {
			t.Errorf("%s[%d]: rashi %v, TypeScript %v", where, i, gp.Rashi, wp.Rashi)
		}
		if gp.StartDate.Ms() != wp.StartDate.Ms() {
			t.Errorf("%s[%d]: startDate %d, TypeScript %d (delta %d ms)",
				where, i, gp.StartDate.Ms(), wp.StartDate.Ms(),
				gp.StartDate.Ms()-wp.StartDate.Ms())
		}
		if gp.EndDate.Ms() != wp.EndDate.Ms() {
			t.Errorf("%s[%d]: endDate %d, TypeScript %d (delta %d ms)",
				where, i, gp.EndDate.Ms(), wp.EndDate.Ms(),
				gp.EndDate.Ms()-wp.EndDate.Ms())
		}
		if gp.Years != wp.Years {
			t.Errorf("%s[%d]: years %v, TypeScript %v", where, i, gp.Years, wp.Years)
		}
		if len(gp.Antar) != len(wp.Antar) {
			t.Errorf("%s[%d]: %d antardashas, TypeScript %d", where, i, len(gp.Antar), len(wp.Antar))
			continue
		}
		if len(gp.Antar) > 0 {
			comparePeriods(t, where+"/antar["+itoa(i)+"]", gp.Antar, wp.Antar)
		}
	}
}

func vimPeriods(r types.VimshottariDashaResult) []gPeriod {
	out := make([]gPeriod, 0, len(r.MahaDashas))
	for _, m := range r.MahaDashas {
		p := gPeriod{Lord: m.Lord, StartDate: m.StartDate, EndDate: m.EndDate, Years: m.Years}
		for _, a := range m.AntarDashas {
			p.Antar = append(p.Antar, gPeriod{Lord: a.Lord, StartDate: a.StartDate, EndDate: a.EndDate})
		}
		out = append(out, p)
	}
	return out
}

func yoginiPeriods(r YoginiDashaResult) []gPeriod {
	out := make([]gPeriod, 0, len(r.MahaDashas))
	for _, m := range r.MahaDashas {
		p := gPeriod{Lord: m.Lord, Yogini: string(m.Yogini), StartDate: m.StartDate,
			EndDate: m.EndDate, Years: m.Years}
		for _, a := range m.AntarDashas {
			p.Antar = append(p.Antar, gPeriod{
				Lord: a.Lord, Yogini: string(a.Yogini), StartDate: a.StartDate, EndDate: a.EndDate})
		}
		out = append(out, p)
	}
	return out
}

func charaPeriods(r CharaDashaResult) []gPeriod {
	out := make([]gPeriod, 0, len(r.MahaDashas))
	for i := range r.MahaDashas {
		m := r.MahaDashas[i]
		rashi := m.Rashi
		out = append(out, gPeriod{Lord: m.Lord, Rashi: &rashi, StartDate: m.StartDate,
			EndDate: m.EndDate, Years: m.Years})
	}
	return out
}

func narayanPeriods(r NarayanDashaResult) []gPeriod {
	out := make([]gPeriod, 0, len(r.MahaDashas))
	for i := range r.MahaDashas {
		m := r.MahaDashas[i]
		rashi := m.Rashi
		out = append(out, gPeriod{Lord: m.Lord, Rashi: &rashi, StartDate: m.StartDate,
			EndDate: m.EndDate, Years: m.Years})
	}
	return out
}

func antarPeriods(list []types.AntarDasha) []gPeriod {
	out := make([]gPeriod, 0, len(list))
	for _, a := range list {
		out = append(out, gPeriod{Lord: a.Lord, StartDate: a.StartDate, EndDate: a.EndDate})
	}
	return out
}

func pratyantarPeriods(list []types.PratyantarDasha) []gPeriod {
	out := make([]gPeriod, 0, len(list))
	for _, p := range list {
		out = append(out, gPeriod{Lord: p.Lord, StartDate: p.StartDate, EndDate: p.EndDate})
	}
	return out
}

func dashaPin(birthMs int64, g dashaGolden, k int) int64 { return birthMs + g.PinOffsets[k] }

func TestVimshottariMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	totalAntar := 0
	for _, s := range g.Sweep {
		got, err := ComputeVimshottariDasha(s.Ms, s.MoonLon, dashaPin(s.Ms, g, 3))
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		comparePeriods(t, "vimshottari@"+itoa(int(s.Ms%100000)), vimPeriods(got), s.Vimshottari.MahaDashas)
		for _, m := range got.MahaDashas {
			totalAntar += len(m.AntarDashas)
		}
	}
	t.Logf("%d charts, %d mahadashas, %d antardashas compared instant-for-instant",
		len(g.Sweep), len(g.Sweep)*9, totalAntar)
}

func TestAshtottariMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	for _, s := range g.Sweep {
		got, err := ComputeAshtottariDasha(s.Ms, s.MoonLon, dashaPin(s.Ms, g, 3))
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		comparePeriods(t, "ashtottari@"+itoa(int(s.Ms%100000)), vimPeriods(got), s.Ashtottari.MahaDashas)
	}
}

func TestYoginiMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	seen := map[string]int{}
	for _, s := range g.Sweep {
		got, err := ComputeYoginiDasha(s.Ms, s.MoonLon, dashaPin(s.Ms, g, 3))
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		comparePeriods(t, "yogini@"+itoa(int(s.Ms%100000)), yoginiPeriods(got), s.Yogini.MahaDashas)
		seen[string(got.MahaDashas[0].Yogini)]++
	}
	if len(seen) != 8 {
		t.Errorf("only %d distinct starting Yoginis across %d charts: %v",
			len(seen), len(g.Sweep), seen)
	}
}

func TestCharaMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	for _, s := range g.Sweep {
		got, err := ComputeCharaDasha(ctx, s.Ms, dashaLoc(g, s.Loc), "", dashaPin(s.Ms, g, 3))
		if err != nil {
			t.Fatalf("ms=%d loc=%s: %v", s.Ms, s.Loc, err)
		}
		comparePeriods(t, "chara@"+itoa(int(s.Ms%100000)), charaPeriods(got), s.Chara.MahaDashas)
	}
}

func TestNarayanMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	dirs := map[NarayanDirection]int{}
	for _, s := range g.Sweep {
		loc := dashaLoc(g, s.Loc)
		pin := dashaPin(s.Ms, g, 3)

		gotF, err := ComputeNarayanDasha(ctx, s.Ms, loc, "", pin)
		if err != nil {
			t.Fatalf("ms=%d fixed: %v", s.Ms, err)
		}
		if string(gotF.Direction) != s.NarayanFixed.Direction {
			t.Errorf("ms=%d: direction %q, TypeScript %q", s.Ms, gotF.Direction, s.NarayanFixed.Direction)
		}
		if gotF.StartingRashi != s.NarayanFixed.StartingRashi {
			t.Errorf("ms=%d: startingRashi %d, TypeScript %d",
				s.Ms, gotF.StartingRashi, s.NarayanFixed.StartingRashi)
		}
		comparePeriods(t, "narayanFixed@"+itoa(int(s.Ms%100000)), narayanPeriods(gotF), s.NarayanFixed.MahaDashas)
		dirs[gotF.Direction]++

		gotV, err := ComputeNarayanDashaVariable(ctx, s.Ms, loc, "", pin)
		if err != nil {
			t.Fatalf("ms=%d variable: %v", s.Ms, err)
		}
		comparePeriods(t, "narayanVar@"+itoa(int(s.Ms%100000)), narayanPeriods(gotV), s.NarayanVariable.MahaDashas)
	}
	if len(dirs) != 2 {
		t.Errorf("only one cycle direction across %d charts: %v. The vishama/sama "+
			"parity rule is then untested", len(g.Sweep), dirs)
	}
	t.Logf("narayan directions: %v", dirs)
}

func TestNarayanRule4BranchesAreExercised(t *testing.T) {
	g := loadDashaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	loc := dashaLoc(g, g.Locations[0].Name)
	labels := map[string]int{}

	for _, c := range g.Rule4 {
		got, err := ComputeNarayanDashaVariable(ctx, c.Ms, loc, "", c.Ms)
		if err != nil {
			t.Fatalf("rule4 %s ms=%d: %v", c.Label, c.Ms, err)
		}
		comparePeriods(t, "rule4/"+c.Label, narayanPeriods(got), c.Variable.MahaDashas)
		if lbls := goRule4Labels(t, ctx, c.Ms); lbls[0] != c.Label && lbls[1] != c.Label {
			t.Errorf("rule4 ms=%d: Go classifies %v, generator labelled %q. The "+
				"two languages disagree about where the dual lords sit",
				c.Ms, lbls, c.Label)
		}
		labels[c.Label]++
	}

	var want []string
	for _, rashi := range []string{"7", "10"} {
		for _, kind := range []string{"a-both-in", "b-joint", "c-lordA-in", "c-lordB-in", "d-split"} {
			want = append(want, rashi+"-"+kind)
		}
	}
	for _, l := range want {
		if labels[l] == 0 {
			t.Errorf("Narayan Rule 4 branch %q was never exercised", l)
		}
	}
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	t.Logf("Rule-4 branches exercised: %v", keys)
}

func TestNarayanRule4TiebreakCases(t *testing.T) {
	g := loadDashaGolden(t)
	if len(g.Rule4dTie) == 0 {
		t.Fatal("golden carries no Rule-4(d) tiebreak cases")
	}
	ctx := astronomy.NewEphemerisCtx()
	loc := dashaLoc(g, g.Locations[0].Name)
	labels := map[string]int{}

	for _, c := range g.Rule4dTie {
		got, err := ComputeNarayanDashaVariable(ctx, c.Ms, loc, "", c.Ms)
		if err != nil {
			t.Fatalf("%s ms=%d: %v", c.Label, c.Ms, err)
		}
		comparePeriods(t, "rule4dTie/"+c.Label, narayanPeriods(got), c.Variable.MahaDashas)
		labels[c.Label]++

		rashi := 7
		if c.Label[0] == '1' {
			rashi = 10
		}
		lordA, lordB := types.GrahaMars, types.GrahaKetu
		if rashi == 10 {
			lordA, lordB = types.GrahaSaturn, types.GrahaRahu
		}
		p, err := ComputePlanetaryPositions(ctx, c.Ms, "lahiri", nil, nil, "")
		if err != nil {
			t.Fatal(err)
		}
		var placements [types.GrahaCount]int
		for _, gr := range types.AllGrahas {
			gp, _ := p.Get(gr)
			placements[gr] = int(math.Floor(gp.SiderealLongitude/30)) % 12
		}
		ra, rb := placements[lordA], placements[lordB]
		if ra == rashi || rb == rashi || ra == rb {
			t.Errorf("%s ms=%d: not branch 4(d), lords in %d and %d for rashi %d",
				c.Label, c.Ms, ra, rb, rashi)
			continue
		}
		if na, nb := planetsInRashi(&placements, ra), planetsInRashi(&placements, rb); na != nb {
			t.Errorf("%s ms=%d: planet counts %d vs %d are not tied, so the aspect "+
				"factors never decide and this case does not exercise the tiebreak",
				c.Label, c.Ms, na, nb)
		}
	}
	if len(labels) != 2 {
		t.Errorf("only %d of the two dual-lord rashis have tiebreak cases: %v",
			len(labels), labels)
	}
	t.Logf("%d Rule-4(d) tiebreak charts across %v", len(g.Rule4dTie), labels)
}

func goRule4Labels(t *testing.T, ctx *astronomy.EphemerisCtx, ms int64) [2]string {
	t.Helper()
	p, err := ComputePlanetaryPositions(ctx, ms, "lahiri", nil, nil, "")
	if err != nil {
		t.Fatalf("positions at %d: %v", ms, err)
	}
	r := func(lon float64) int { return int(math.Floor(lon/30)) % 12 }
	pairs := []struct {
		rashi  int
		ra, rb int
	}{
		{7, r(p.Mars.SiderealLongitude), r(p.Ketu.SiderealLongitude)},
		{10, r(p.Saturn.SiderealLongitude), r(p.Rahu.SiderealLongitude)},
	}
	var out [2]string
	for k, pr := range pairs {
		var kind string
		switch {
		case pr.ra == pr.rashi && pr.rb == pr.rashi:
			kind = "a-both-in"
		case pr.ra == pr.rb:
			kind = "b-joint"
		case pr.ra == pr.rashi:
			kind = "c-lordA-in"
		case pr.rb == pr.rashi:
			kind = "c-lordB-in"
		default:
			kind = "d-split"
		}
		out[k] = itoa(pr.rashi) + "-" + kind
	}
	return out
}

func TestDashaCurrentIndexAtPins(t *testing.T) {
	g := loadDashaGolden(t)
	ctx := astronomy.NewEphemerisCtx()
	clamped, inside := 0, 0

	for _, s := range g.Sweep {
		loc := dashaLoc(g, s.Loc)
		for k, off := range g.PinOffsets {
			pin := s.Ms + off

			vim, err := ComputeVimshottariDasha(s.Ms, s.MoonLon, pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "vimshottari", s.Ms, off, vim.CurrentIndex, s.VimshottariAtPins[k])
			if vim.CurrentMahaDashaLord != vim.MahaDashas[vim.CurrentIndex].Lord {
				t.Errorf("ms=%d: currentMahaDashaLord %v does not name mahaDashas[%d]",
					s.Ms, vim.CurrentMahaDashaLord, vim.CurrentIndex)
			}

			ash, err := ComputeAshtottariDasha(s.Ms, s.MoonLon, pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "ashtottari", s.Ms, off, ash.CurrentIndex, s.AshtottariAtPins[k])

			yog, err := ComputeYoginiDasha(s.Ms, s.MoonLon, pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "yogini", s.Ms, off, yog.CurrentIndex, s.YoginiAtPins[k])
			if yog.CurrentYogini != yog.MahaDashas[yog.CurrentIndex].Yogini {
				t.Errorf("ms=%d: currentYogini %q does not name mahaDashas[%d]",
					s.Ms, yog.CurrentYogini, yog.CurrentIndex)
			}

			cha, err := ComputeCharaDasha(ctx, s.Ms, loc, "", pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "chara", s.Ms, off, cha.CurrentIndex, s.CharaAtPins[k])
			if cha.CurrentRashi != cha.MahaDashas[cha.CurrentIndex].Rashi {
				t.Errorf("ms=%d: currentRashi %d does not name mahaDashas[%d]",
					s.Ms, cha.CurrentRashi, cha.CurrentIndex)
			}

			narF, err := ComputeNarayanDasha(ctx, s.Ms, loc, "", pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "narayanFixed", s.Ms, off, narF.CurrentIndex, s.NarayanFixedAtPins[k])

			narV, err := ComputeNarayanDashaVariable(ctx, s.Ms, loc, "", pin)
			if err != nil {
				t.Fatalf("ms=%d: %v", s.Ms, err)
			}
			checkIndex(t, "narayanVariable", s.Ms, off, narV.CurrentIndex, s.NarayanVarAtPins[k])

			if off < 0 || off > int64(120*msPerYear) {
				clamped++
			} else {
				inside++
			}
		}
	}
	if clamped == 0 || inside == 0 {
		t.Fatalf("pins reached only one branch: %d clamped, %d inside", clamped, inside)
	}
	t.Logf("%d pin evaluations across 6 systems: %d outside the sequence (clamped to 0), %d inside",
		len(g.Sweep)*len(g.PinOffsets), clamped, inside)
}

func checkIndex(t *testing.T, system string, birthMs, off int64, got, want int) {
	t.Helper()
	if got != want {
		t.Errorf("%s: birth=%d pin=birth%+d → index %d, TypeScript re-derivation %d",
			system, birthMs, off, got, want)
	}
}

func TestHalfOpenPinBoundaries(t *testing.T) {
	g := loadDashaGolden(t)
	s := g.Sweep[0]
	if len(g.HalfOpenPins) == 0 {
		t.Fatal("golden carries no half-open pins")
	}
	for _, p := range g.HalfOpenPins {
		got, err := ComputeVimshottariDasha(s.Ms, s.MoonLon, p.PinMs)
		if err != nil {
			t.Fatalf("%v", err)
		}
		if got.CurrentIndex != p.Index {
			t.Errorf("pin %d → index %d, TypeScript %d", p.PinMs, got.CurrentIndex, p.Index)
		}
	}
	t.Logf("%d half-open boundary pins", len(g.HalfOpenPins))
}

func TestVimshottariBoundaryLongitudes(t *testing.T) {
	g := loadDashaGolden(t)
	counts := map[int]int{}
	for _, b := range g.Boundary {
		if utils.NakshatraOf(b.MoonLon) != b.NakIdx {
			t.Errorf("moonLon %.17g: Go nakshatra %d, TypeScript %d",
				b.MoonLon, utils.NakshatraOf(b.MoonLon), b.NakIdx)
		}
		vim, err := ComputeVimshottariDasha(g.BoundaryBirthMs, b.MoonLon, g.BoundaryBirthMs)
		if err != nil {
			t.Fatalf("moonLon %.17g: %v", b.MoonLon, err)
		}
		comparePeriods(t, "boundary/vim", vimPeriods(vim), b.Vimshottari.MahaDashas)
		if n := len(vim.MahaDashas[0].AntarDashas); n != b.FirstMahaAntarCount {
			t.Errorf("moonLon %.17g: first mahadasha has %d antardashas, TypeScript %d",
				b.MoonLon, n, b.FirstMahaAntarCount)
		}
		counts[b.FirstMahaAntarCount]++

		ash, err := ComputeAshtottariDasha(g.BoundaryBirthMs, b.MoonLon, g.BoundaryBirthMs)
		if err != nil {
			t.Fatalf("moonLon %.17g: %v", b.MoonLon, err)
		}
		comparePeriods(t, "boundary/ash", vimPeriods(ash), b.Ashtottari.MahaDashas)

		yog, err := ComputeYoginiDasha(g.BoundaryBirthMs, b.MoonLon, g.BoundaryBirthMs)
		if err != nil {
			t.Fatalf("moonLon %.17g: %v", b.MoonLon, err)
		}
		comparePeriods(t, "boundary/yog", yoginiPeriods(yog), b.Yogini.MahaDashas)
	}
	if counts[9] == 0 {
		t.Errorf("no boundary longitude produced an unclipped first mahadasha: %v", counts)
	}
	if len(counts) < 3 {
		t.Errorf("first-mahadasha antardasha counts span only %v across %d probes; "+
			"the clip is barely exercised", counts, len(g.Boundary))
	}
	t.Logf("first-mahadasha antardasha counts across %d boundary longitudes: %v",
		len(g.Boundary), counts)
}

func TestVimshottariPratyantarMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	for _, s := range g.Sweep {
		ad := types.AntarDasha{
			Lord: s.PratyantarOf.Lord, StartDate: s.PratyantarOf.StartDate, EndDate: s.PratyantarOf.EndDate,
		}
		got, err := ComputeVimshottariPratyantar(ad)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		comparePeriods(t, "pratyantar@"+itoa(int(s.Ms%100000)), pratyantarPeriods(got), s.Pratyantar)
	}

	vim, err := ComputeVimshottariDasha(g.BoundaryBirthMs, g.BoundaryBirthMoonLon, g.BoundaryBirthMs)
	if err != nil {
		t.Fatalf("%v", err)
	}
	for _, c := range g.PratyantarAll {
		ad := vim.MahaDashas[c.Maha].AntarDashas[c.Antar]
		if ad.Lord != c.Lord {
			t.Fatalf("maha %d antar %d: lord %v, TypeScript %v", c.Maha, c.Antar, ad.Lord, c.Lord)
		}
		got, err := ComputeVimshottariPratyantar(ad)
		if err != nil {
			t.Fatalf("maha %d antar %d: %v", c.Maha, c.Antar, err)
		}
		comparePeriods(t, "pratyantarAll/"+itoa(c.Maha)+"."+itoa(c.Antar),
			pratyantarPeriods(got), c.Periods)
	}
	t.Logf("%d sweep pratyantars + %d exhaustive", len(g.Sweep), len(g.PratyantarAll))
}

func TestPratyantarRejectsInvalidLord(t *testing.T) {
	_, err := ComputeVimshottariPratyantar(types.AntarDasha{Lord: types.DashaLord(99)})
	if err == nil {
		t.Fatal("an out-of-range lord was accepted")
	}
	// INVALID_INPUT has no sentinel; only branched-on codes get one.
	var pe *types.PanchangError
	if !errors.As(err, &pe) || pe.Code != types.ErrInvalidInput {
		t.Errorf("error is %v, expected a PanchangError with code INVALID_INPUT", err)
	}
	if want := "Invalid antardasha lord: DashaLord(99)"; err.Error() != want {
		t.Errorf("message %q, expected %q", err.Error(), want)
	}
	if _, err := ComputeVimshottariPratyantar(types.AntarDasha{
		Lord: types.DashaKetu, StartDate: types.Date(0), EndDate: types.Date(86_400_000),
	}); err != nil {
		t.Errorf("a valid lord was rejected: %v", err)
	}
}

// The wrapper computes its own Moon longitude, so a truncation can flip: hence the 1 ms allowance.
func TestVimshottariDashaFromBirthMatchesTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	ctx := astronomy.NewEphemerisCtx()

	check := func(where string, got types.VimshottariDashaResult, want []gPeriod) {
		t.Helper()
		gp := vimPeriods(got)
		if len(gp) != len(want) {
			t.Fatalf("%s: %d mahadashas, TypeScript %d", where, len(gp), len(want))
		}
		var worst int64
		for i := range gp {
			if gp[i].Lord != want[i].Lord {
				t.Errorf("%s[%d]: lord %v, TypeScript %v", where, i, gp[i].Lord, want[i].Lord)
			}
			for _, d := range []int64{
				gp[i].StartDate.Ms() - want[i].StartDate.Ms(),
				gp[i].EndDate.Ms() - want[i].EndDate.Ms(),
			} {
				if d < 0 {
					d = -d
				}
				if d > worst {
					worst = d
				}
			}
			if len(gp[i].Antar) != len(want[i].Antar) {
				t.Errorf("%s[%d]: %d antardashas, TypeScript %d",
					where, i, len(gp[i].Antar), len(want[i].Antar))
				continue
			}
			for j := range gp[i].Antar {
				if gp[i].Antar[j].Lord != want[i].Antar[j].Lord {
					t.Errorf("%s[%d].antar[%d]: lord %v, TypeScript %v",
						where, i, j, gp[i].Antar[j].Lord, want[i].Antar[j].Lord)
				}
				for _, d := range []int64{
					gp[i].Antar[j].StartDate.Ms() - want[i].Antar[j].StartDate.Ms(),
					gp[i].Antar[j].EndDate.Ms() - want[i].Antar[j].EndDate.Ms(),
				} {
					if d < 0 {
						d = -d
					}
					if d > worst {
						worst = d
					}
				}
			}
		}
		if worst > 1 {
			t.Errorf("%s: worst instant delta %d ms, allowance 1 ms. That is more "+
				"than the truncation quantum can explain from an ULP-level Moon "+
				"longitude difference. Look for an arithmetic divergence, not rounding",
				where, worst)
		}
		if worst > 0 {
			t.Logf("%s: worst instant delta %d ms (truncation flip, expected)", where, worst)
		}
	}

	for _, fb := range g.FromBirth {
		got, err := ComputeVimshottariDashaFromBirth(ctx, g.BoundaryBirthMs, fb.Ayanamsa, g.BoundaryBirthMs)
		if err != nil {
			t.Fatalf("ayanamsa %s: %v", fb.Ayanamsa, err)
		}
		check("fromBirth/"+string(fb.Ayanamsa), got, fb.Result.MahaDashas)
	}
	got, err := ComputeVimshottariDashaFromBirth(ctx, g.BoundaryBirthMs, "", g.BoundaryBirthMs)
	if err != nil {
		t.Fatalf("%v", err)
	}
	check("fromBirth/default", got, g.FromBirthDefault.MahaDashas)
	t.Logf("%d ayanamsas plus the default", len(g.FromBirth))
}

func TestDashaCurrentLeavesMatchTheTypeScript(t *testing.T) {
	g := loadDashaGolden(t)
	asOf, err := time.Parse(time.RFC3339, g.Meta.AsOf)
	if err != nil {
		t.Fatalf("_meta.asOf %q: %v", g.Meta.AsOf, err)
	}
	pin := asOf.UnixMilli()
	ctx := astronomy.NewEphemerisCtx()

	var compared int
	idx := map[int]int{}
	for _, s := range g.Sweep {
		loc := dashaLoc(g, s.Loc)

		vim, err := ComputeVimshottariDasha(s.Ms, s.MoonLon, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "vimshottari", s.Ms, s.Vimshottari,
			vim.CurrentIndex, vim.CurrentMahaDashaLord.String(), s.Vimshottari.CurrentMahaDashaLord.String(), -1, idx)

		ash, err := ComputeAshtottariDasha(s.Ms, s.MoonLon, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "ashtottari", s.Ms, s.Ashtottari,
			ash.CurrentIndex, ash.CurrentMahaDashaLord.String(), s.Ashtottari.CurrentMahaDashaLord.String(), -1, idx)

		yog, err := ComputeYoginiDasha(s.Ms, s.MoonLon, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "yogini", s.Ms, s.Yogini,
			yog.CurrentIndex, string(yog.CurrentYogini), string(s.Yogini.CurrentYogini), -1, idx)

		cha, err := ComputeCharaDasha(ctx, s.Ms, loc, types.Lahiri, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "chara", s.Ms, s.Chara, cha.CurrentIndex, "", "", cha.CurrentRashi, idx)

		narF, err := ComputeNarayanDasha(ctx, s.Ms, loc, types.Lahiri, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "narayanFixed", s.Ms, s.NarayanFixed, narF.CurrentIndex, "", "", narF.CurrentRashi, idx)

		narV, err := ComputeNarayanDashaVariable(ctx, s.Ms, loc, types.Lahiri, pin)
		if err != nil {
			t.Fatalf("ms=%d: %v", s.Ms, err)
		}
		compared += checkCurrent(t, "narayanVariable", s.Ms, s.NarayanVariable, narV.CurrentIndex, "", "", narV.CurrentRashi, idx)
	}

	if compared == 0 {
		t.Fatal("compared nothing; the golden's Current* leaves are absent")
	}
	if len(idx) < 3 {
		t.Errorf("only %d distinct currentIndex values across %d comparisons (%v); "+
			"the pin may have fallen outside every arc", len(idx), compared, idx)
	}
	t.Logf("%d Current* comparisons at %s, %d distinct indices", compared, g.Meta.AsOf, len(idx))
}

func checkCurrent(t *testing.T, system string, ms int64, want gResult, gotIndex int, gotName, wantName string, gotRashi int, idx map[int]int) int {
	t.Helper()
	if want.CurrentIndex == nil {
		t.Errorf("ms=%d %s: golden has no currentIndex", ms, system)
		return 0
	}
	n := 1
	if gotIndex != *want.CurrentIndex {
		t.Errorf("ms=%d %s: currentIndex = %d, TypeScript said %d", ms, system, gotIndex, *want.CurrentIndex)
	}
	idx[gotIndex]++
	if gotName != "" || wantName != "" {
		n++
		if gotName != wantName {
			t.Errorf("ms=%d %s: named leaf = %q, TypeScript said %q", ms, system, gotName, wantName)
		}
	}
	if want.CurrentRashi != nil {
		n++
		if gotRashi >= 0 && gotRashi != *want.CurrentRashi {
			t.Errorf("ms=%d %s: currentRashi = %d, TypeScript said %d", ms, system, gotRashi, *want.CurrentRashi)
		}
	}
	return n
}
