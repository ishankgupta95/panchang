package jyotish

import (
	"math"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/utils"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

func buildAntarDashasTruncating(mahaLord types.DashaLord, mahaVirtualStart int64, mahaFullDurationMs float64, clipStartMs int64) []types.AntarDasha {
	mahaIdx := int(mahaLord)
	out := make([]types.AntarDasha, 0, 9)
	cursor := mahaVirtualStart
	for i := 0; i < 9; i++ {
		antarLord := DashaOrder[(mahaIdx+i)%9]
		antarMs := float64((DashaYears[antarLord] / 120) * mahaFullDurationMs)
		adStart := cursor
		adEnd := int64(float64(cursor) + antarMs)
		cursor = adEnd
		if adEnd <= clipStartMs {
			continue
		}
		displayStart := adStart
		if adStart < clipStartMs {
			displayStart = clipStartMs
		}
		out = append(out, types.AntarDasha{
			Lord: antarLord, StartDate: types.Date(displayStart), EndDate: types.Date(adEnd),
		})
	}
	return out
}

func TestAntarDashaCursorKeepsItsFraction(t *testing.T) {
	worstFrac := 0.0
	worstPair := "none"
	for _, maha := range types.AllDashaLords {
		full := float64(DashaYears[maha] * msPerYear)
		for _, antar := range types.AllDashaLords {
			antarMs := float64((DashaYears[antar] / 120) * full)
			exact := DashaYears[antar] * DashaYears[maha] * 262_980_000
			if exact != math.Trunc(exact) {
				t.Fatalf("%v/%v: the closed form %v is not an integer, so the "+
					"near-integrality argument does not apply", maha, antar, exact)
			}
			if d := math.Abs(antarMs - exact); d > worstFrac {
				worstFrac, worstPair = d, maha.String()+"/"+antar.String()
			}
		}
	}
	if worstFrac > 0.5 {
		t.Fatalf("antardasha lengths deviate from an integer by up to %g ms (%s); "+
			"above half a millisecond the float and truncating cursors can publish "+
			"different instants and the mirror stops being cosmetic",
			worstFrac, worstPair)
	}
	t.Logf("worst antardasha-length deviation from an exact integer: %g ms (%s)",
		worstFrac, worstPair)

	start := int64(631_152_000_123)
	full := float64(DashaYears[types.DashaVenus] * msPerYear)
	kept := buildAntarDashas(types.DashaVenus, start, full, start)
	trunc := buildAntarDashasTruncating(types.DashaVenus, start, full, start)
	if len(kept) != 9 || len(trunc) != 9 {
		t.Fatalf("expected 9 antardashas each, got %d and %d", len(kept), len(trunc))
	}
	var worst int64
	for i := range kept {
		if d := abs64(kept[i].EndDate.Ms() - trunc[i].EndDate.Ms()); d > worst {
			worst = d
		}
	}
	if worst != 0 {
		t.Errorf("float and truncating cursors disagree by up to %d ms. That "+
			"contradicts the near-integrality measured above. Recheck the closed "+
			"form before touching either loop", worst)
	}
}

func abs64(x int64) int64 {
	if x < 0 {
		return -x
	}
	return x
}

func TestMsPerYearIsExact(t *testing.T) {
	if msPerYear != 31_557_600_000 {
		t.Fatalf("msPerYear = %v, expected 31557600000", msPerYear)
	}
	if float64(int64(msPerYear)) != msPerYear {
		t.Fatal("msPerYear is not an exact integer")
	}
	check := func(what string, years float64) {
		t.Helper()
		p := years * msPerYear
		if p != math.Trunc(p) {
			t.Errorf("%s: %v x msPerYear = %v is not an integer", what, years, p)
		}
		if math.Abs(p) >= 1<<53 {
			t.Errorf("%s: %v exceeds 2^53, so integrality is not preserved", what, p)
		}
	}
	for _, l := range types.AllDashaLords {
		check("DashaYears["+l.String()+"]", DashaYears[l])
		if AshtottariYears[l] != 0 {
			check("AshtottariYears["+l.String()+"]", AshtottariYears[l])
		}
	}
	for i, y := range YoginiYears {
		check("YoginiYears["+itoa(i)+"]", y)
	}
	for i, y := range CharaRashiYears {
		check("CharaRashiYears["+itoa(i)+"]", y)
	}
}

func TestDashaCycleTotals(t *testing.T) {
	var vim float64
	for _, l := range types.AllDashaLords {
		vim += DashaYears[l]
	}
	if vim != 120 {
		t.Errorf("Vimshottari total %v years, expected 120", vim)
	}
	var ash float64
	for _, l := range AshtottariOrder {
		ash += AshtottariYears[l]
	}
	if ash != ashtottariTotalYears {
		t.Errorf("Ashtottari total %v years, expected %v", ash, ashtottariTotalYears)
	}
	var yog float64
	for _, y := range YoginiYears {
		yog += y
	}
	if yog != yoginiTotalYears {
		t.Errorf("Yogini total %v years, expected %v", yog, yoginiTotalYears)
	}
	var cha float64
	for _, y := range CharaRashiYears {
		cha += y
	}
	if cha != 96 {
		t.Errorf("Chara total %v years, expected 96", cha)
	}
}

func TestNakshatraLordRepeatsTheCycle(t *testing.T) {
	for i := 0; i < 27; i++ {
		if want := DashaOrder[i%9]; NakshatraLord[i] != want {
			t.Errorf("NakshatraLord[%d] = %v, cycle says %v", i, NakshatraLord[i], want)
		}
	}
}

func TestAshtottariGroupsPartitionTheZodiac(t *testing.T) {
	seen := map[int]int{}
	total := 0
	for gi, group := range AshtottariNakshatraGroups {
		if len(group) == 0 {
			t.Fatalf("group %d is empty", gi)
		}
		for _, n := range group {
			if n < 0 || n > 26 {
				t.Fatalf("group %d contains nakshatra %d", gi, n)
			}
			seen[n]++
			total++
		}
	}
	if total != 27 {
		t.Errorf("groups hold %d nakshatras in total, expected 27", total)
	}
	for n := 0; n < 27; n++ {
		if seen[n] != 1 {
			t.Errorf("nakshatra %d appears in %d groups, expected exactly 1", n, seen[n])
		}
	}
	wantSizes := [8]int{4, 3, 4, 3, 3, 3, 4, 3}
	for i, want := range wantSizes {
		if got := len(AshtottariNakshatraGroups[i]); got != want {
			t.Errorf("%v group has %d nakshatras, expected %d",
				AshtottariOrder[i], got, want)
		}
	}
	if AshtottariNakshatraGroups[0][0] != 5 {
		t.Errorf("Sun's group starts at nakshatra %d, expected 5 (Ardra)",
			AshtottariNakshatraGroups[0][0])
	}
}

func TestAshtottariExcludesKetu(t *testing.T) {
	if AshtottariYears[types.DashaKetu] != 0 {
		t.Errorf("AshtottariYears[Ketu] = %v; Ashtottari has no Ketu period",
			AshtottariYears[types.DashaKetu])
	}
	for i, l := range AshtottariOrder {
		if l == types.DashaKetu {
			t.Fatalf("AshtottariOrder[%d] is Ketu", i)
		}
		if AshtottariYears[l] == 0 {
			t.Errorf("AshtottariYears[%v] is zero but %v is in the cycle", l, l)
		}
	}
	if len(AshtottariOrder) != 8 {
		t.Errorf("AshtottariOrder has %d lords, expected 8", len(AshtottariOrder))
	}
}

func TestYoginiStartIsOffsetByThree(t *testing.T) {
	cases := []struct {
		nakshatra string
		nakIdx    int
		want      YoginiName
	}{
		{"Ashwini", 0, YoginiBhramari},
		{"Pushya", 7, YoginiDhanya},
		{"Anuradha", 16, YoginiBhramari},
	}
	birth := int64(645_445_800_000)
	for _, c := range cases {
		lon := (float64(c.nakIdx) + 0.5) * utils.NakshatraSpan
		got, err := ComputeYoginiDasha(birth, lon, birth)
		if err != nil {
			t.Fatalf("%s: %v", c.nakshatra, err)
		}
		if got.MahaDashas[0].Yogini != c.want {
			t.Errorf("%s (nakshatra %d): starting Yogini %s, classical sources say %s",
				c.nakshatra, c.nakIdx, got.MahaDashas[0].Yogini, c.want)
		}
	}

	wantPlanet := map[YoginiName]types.DashaLord{
		YoginiMangala: types.DashaMoon, YoginiPingala: types.DashaSun,
		YoginiDhanya: types.DashaJupiter, YoginiBhramari: types.DashaMars,
		YoginiBhadrika: types.DashaMercury, YoginiUlka: types.DashaSaturn,
		YoginiSiddha: types.DashaVenus, YoginiSankata: types.DashaRahu,
	}
	for i, y := range YoginiOrder {
		if YoginiPlanet[i] != wantPlanet[y] {
			t.Errorf("%s's planet is %v, expected %v", y, YoginiPlanet[i], wantPlanet[y])
		}
		if YoginiYears[i] != float64(i+1) {
			t.Errorf("%s runs %v years, expected %d (the durations ascend 1..8)",
				y, YoginiYears[i], i+1)
		}
	}
}

func TestCharaRashiLordAgreesWithTheOthers(t *testing.T) {
	for r := 0; r < 12; r++ {
		chara := charaRashiLord[r].Graha()
		match := RashiLord[r].Graha()
		catalog := rashiLords[r].Graha()
		primary := rashiPrimaryLord[r]
		if chara != match {
			t.Errorf("rashi %d: charaRashiLord says %v, matchingtables.RashiLord says %v",
				r, chara, match)
		}
		if chara != catalog {
			t.Errorf("rashi %d: charaRashiLord says %v, yogascatalog.rashiLords says %v",
				r, chara, catalog)
		}
		if chara != primary {
			t.Errorf("rashi %d: charaRashiLord says %v, rashiPrimaryLord says %v",
				r, chara, primary)
		}
	}
	counts := map[types.Graha]int{}
	for r := 0; r < 12; r++ {
		counts[charaRashiLord[r].Graha()]++
	}
	for g, want := range map[types.Graha]int{
		types.GrahaSun: 1, types.GrahaMoon: 1, types.GrahaMars: 2, types.GrahaMercury: 2,
		types.GrahaJupiter: 2, types.GrahaVenus: 2, types.GrahaSaturn: 2,
	} {
		if counts[g] != want {
			t.Errorf("%v lords %d signs, expected %d", g, counts[g], want)
		}
	}
	if counts[types.GrahaRahu] != 0 || counts[types.GrahaKetu] != 0 {
		t.Error("a node appears as a primary sign lord")
	}
}

func TestNarayanExaltationDiffersOnlyAtTheNodes(t *testing.T) {
	for _, g := range types.AllGrahas {
		isNode := g == types.GrahaRahu || g == types.GrahaKetu
		sameExalt := narayanExaltationRashi[g] == exaltation[g]
		sameDebil := narayanDebilitationRashi[g] == debilitation[g]
		if isNode {
			if sameExalt {
				t.Errorf("%v: Narayan exaltation %d equals dignity.go's. Narayan uses "+
					"Manteswara (Rahu Gemini, Ketu Sagittarius), dignity.go uses "+
					"Parashara (Rahu Taurus, Ketu Scorpio)", g, narayanExaltationRashi[g])
			}
			if sameDebil {
				t.Errorf("%v: Narayan debilitation %d equals dignity.go's", g, narayanDebilitationRashi[g])
			}
			continue
		}
		if !sameExalt {
			t.Errorf("%v: Narayan exaltation %d, dignity.go %d. The seven visible "+
				"grahas must agree", g, narayanExaltationRashi[g], exaltation[g])
		}
		if !sameDebil {
			t.Errorf("%v: Narayan debilitation %d, dignity.go %d", g, narayanDebilitationRashi[g], debilitation[g])
		}
	}
	if narayanExaltationRashi[types.GrahaRahu] != 2 {
		t.Errorf("Rahu's Narayan exaltation is %d, Manteswara says 2 (Gemini)",
			narayanExaltationRashi[types.GrahaRahu])
	}
	if narayanExaltationRashi[types.GrahaKetu] != 8 {
		t.Errorf("Ketu's Narayan exaltation is %d, Manteswara says 8 (Sagittarius)",
			narayanExaltationRashi[types.GrahaKetu])
	}
	for _, g := range types.AllGrahas {
		if want := (narayanExaltationRashi[g] + 6) % 12; narayanDebilitationRashi[g] != want {
			t.Errorf("%v: debilitation %d is not opposite exaltation %d",
				g, narayanDebilitationRashi[g], narayanExaltationRashi[g])
		}
	}
}

func TestRasiDrishtiIsThreeSignsEach(t *testing.T) {
	adjacent := func(a, b int) bool { return (a+1)%12 == b || (b+1)%12 == a }

	for a := 0; a < 12; a++ {
		n := 0
		for b := 0; b < 12; b++ {
			if rasiDrishti(a, b) {
				n++
				if adjacent(a, b) {
					t.Errorf("rashi %d aspects its adjacent sign %d; Table 4 excludes it", a, b)
				}
			}
			if rasiDrishti(a, b) != rasiDrishti(b, a) {
				t.Errorf("rasiDrishti is asymmetric at (%d,%d)", a, b)
			}
		}
		if n != 3 {
			t.Errorf("rashi %d aspects %d signs, Table 4 says exactly 3", a, n)
		}
		if rasiDrishti(a, a) {
			t.Errorf("rashi %d aspects itself", a)
		}
	}

	for a := 0; a < 12; a++ {
		for b := 0; b < 12; b++ {
			if a == b {
				continue
			}
			want := !adjacent(a, b) &&
				((rashiModality[a] == 2 && rashiModality[b] == 2) ||
					(rashiModality[a] == 0 && rashiModality[b] == 1) ||
					(rashiModality[a] == 1 && rashiModality[b] == 0))
			if rasiDrishti(a, b) != want {
				t.Errorf("rasiDrishti(%d,%d) = %v, the rule says %v",
					a, b, rasiDrishti(a, b), want)
			}
		}
	}

	ones := 0
	for a := 0; a < 12; a++ {
		for b := 0; b < 12; b++ {
			if rasiDrishti(a, b) {
				ones++
			}
		}
	}
	if ones != 36 {
		t.Errorf("the aspect matrix has %d ones, expected 36 (12 signs x 3); it had "+
			"44 before the adjacent pairs were excluded", ones)
	}
	for _, pr := range [][2]int{{0, 1}, {3, 4}, {6, 7}, {9, 10}} {
		if rasiDrishti(pr[0], pr[1]) || rasiDrishti(pr[1], pr[0]) {
			t.Errorf("rashi %d and %d still aspect each other; they are adjacent "+
				"movable/fixed and Table 4 excludes the pair", pr[0], pr[1])
		}
	}
}

func TestInclusiveSignCount(t *testing.T) {
	for _, anti := range []bool{false, true} {
		for src := 0; src < 12; src++ {
			if got := inclusiveSignCount(src, src, anti); got != 1 {
				t.Errorf("count(%d,%d,anti=%v) = %d, expected 1", src, src, anti, got)
			}
			for dst := 0; dst < 12; dst++ {
				n := inclusiveSignCount(src, dst, anti)
				if n < 1 || n > 12 {
					t.Errorf("count(%d,%d,anti=%v) = %d out of range", src, dst, anti, n)
				}
				m := inclusiveSignCount(src, dst, !anti)
				want := 14
				if src == dst {
					want = 2
				}
				if n+m != want {
					t.Errorf("count(%d,%d) forward+backward = %d, expected %d", src, dst, n+m, want)
				}
			}
		}
	}
	if got := inclusiveSignCount(0, 1, false); got != 2 {
		t.Errorf("count(Aries→Taurus, zodiacal) = %d, expected 2", got)
	}
	if got := inclusiveSignCount(0, 1, true); got != 12 {
		t.Errorf("count(Aries→Taurus, anti-zodiacal) = %d, expected 12", got)
	}
}

func TestMJLFactorsDoubleCountTheOwnLord(t *testing.T) {
	var placements [types.GrahaCount]int
	for i := range placements {
		placements[i] = 0
	}
	placements[types.GrahaMercury] = 5
	if rashiPrimaryLord[2] != types.GrahaMercury {
		t.Fatalf("Gemini's primary lord is %v, this test assumes Mercury", rashiPrimaryLord[2])
	}
	if got := countMJLAspectFactors(2, &placements); got != 2 {
		t.Errorf("Gemini with only Mercury aspecting scores %d factors, expected 2 "+
			"(Mercury and own-lord counted separately). A deduplicating "+
			"implementation scores 1", got)
	}
	placements[types.GrahaJupiter] = 8
	if got := countMJLAspectFactors(2, &placements); got != 3 {
		t.Errorf("Gemini with Mercury and Jupiter aspecting scores %d, expected 3", got)
	}
	placements[types.GrahaVenus] = 8
	if got := countMJLAspectFactors(11, &placements); got > 3 {
		t.Errorf("Pisces scores %d factors, the maximum is 3", got)
	}
}

func TestCompareRashiStrengthPrioritisesPlanetCount(t *testing.T) {
	var p [types.GrahaCount]int
	for i := range p {
		p[i] = 0
	}
	if got := compareRashiStrength(0, 1, &p); got != 1 {
		t.Errorf("Aries (9 planets) vs Taurus (0) → %d, expected 1", got)
	}
	if got := compareRashiStrength(1, 0, &p); got != -1 {
		t.Errorf("Taurus (0) vs Aries (9) → %d, expected -1", got)
	}
	for i := range p {
		p[i] = 2
	}
	if got := compareRashiStrength(0, 1, &p); got != 0 {
		t.Errorf("two empty unaspected signs → %d, expected 0 (tie). "+
			"factors: Aries %d, Taurus %d", got,
			countMJLAspectFactors(0, &p), countMJLAspectFactors(1, &p))
	}
}

func TestPlanetsInRashiCountsAllNine(t *testing.T) {
	var p [types.GrahaCount]int
	for i := range p {
		p[i] = 4
	}
	if got := planetsInRashi(&p, 4); got != types.GrahaCount {
		t.Errorf("all nine in Leo counts %d, expected %d", got, types.GrahaCount)
	}
	p[types.GrahaRahu] = 5
	p[types.GrahaKetu] = 11
	if got := planetsInRashi(&p, 4); got != types.GrahaCount-2 {
		t.Errorf("with both nodes moved out, Leo counts %d, expected %d",
			got, types.GrahaCount-2)
	}
}

func TestVimshottariSequenceIsContiguous(t *testing.T) {
	birth := int64(645_445_800_000)
	for step := 0; step < 27; step++ {
		lon := (float64(step) + 0.37) * utils.NakshatraSpan
		r, err := ComputeVimshottariDasha(birth, lon, birth)
		if err != nil {
			t.Fatalf("nakshatra %d: %v", step, err)
		}
		if len(r.MahaDashas) != 9 {
			t.Fatalf("nakshatra %d: %d mahadashas", step, len(r.MahaDashas))
		}
		if r.MahaDashas[0].StartDate.Ms() != birth {
			t.Errorf("nakshatra %d: first mahadasha starts at %d, birth is %d",
				step, r.MahaDashas[0].StartDate.Ms(), birth)
		}
		if want := NakshatraLord[step]; r.MahaDashas[0].Lord != want {
			t.Errorf("nakshatra %d: starting lord %v, table says %v", step, r.MahaDashas[0].Lord, want)
		}
		for i, m := range r.MahaDashas {
			if i > 0 && m.StartDate.Ms() != r.MahaDashas[i-1].EndDate.Ms() {
				t.Errorf("nakshatra %d: mahadasha %d starts at %d, previous ended at %d",
					step, i, m.StartDate.Ms(), r.MahaDashas[i-1].EndDate.Ms())
			}
			if i > 0 {
				if want := DashaOrder[(int(r.MahaDashas[0].Lord)+i)%9]; m.Lord != want {
					t.Errorf("nakshatra %d: mahadasha %d lord %v, cycle says %v", step, i, m.Lord, want)
				}
			}
			if len(m.AntarDashas) == 0 {
				t.Errorf("nakshatra %d: mahadasha %d has no antardashas", step, i)
				continue
			}
			for j := 1; j < len(m.AntarDashas); j++ {
				if m.AntarDashas[j].StartDate.Ms() != m.AntarDashas[j-1].EndDate.Ms() {
					t.Errorf("nakshatra %d: maha %d antar %d is not contiguous", step, i, j)
				}
			}
			if got := m.AntarDashas[0].StartDate.Ms(); got != m.StartDate.Ms() {
				t.Errorf("nakshatra %d: maha %d first antardasha starts at %d, mahadasha at %d",
					step, i, got, m.StartDate.Ms())
			}
			last := m.AntarDashas[len(m.AntarDashas)-1].EndDate.Ms()
			if d := abs64(last - m.EndDate.Ms()); d > 1 {
				t.Errorf("nakshatra %d: maha %d antardashas end %d ms from the mahadasha end",
					step, i, last-m.EndDate.Ms())
			}
			if i > 0 && len(m.AntarDashas) != 9 {
				t.Errorf("nakshatra %d: mahadasha %d has %d antardashas, expected 9",
					step, i, len(m.AntarDashas))
			}
		}
	}
}

func TestNarayanVariableYearsStayInRange(t *testing.T) {
	g := loadDashaGolden(t)
	hist := map[int]int{}
	for _, s := range g.Sweep {
		for _, m := range s.NarayanVariable.MahaDashas {
			y := m.Years
			if y != math.Trunc(y) || y < 0 || y > 12 {
				t.Errorf("ms=%d: Narayan variable duration %v out of 0..12", s.Ms, y)
			}
			hist[int(y)]++
		}
	}
	rule4Hist := map[int]int{}
	sawCap := false
	for _, c := range g.Rule4 {
		for _, m := range c.Variable.MahaDashas {
			y := m.Years
			if y != math.Trunc(y) || y < 0 || y > 12 {
				t.Errorf("rule4 %s: duration %v out of 0..12", c.Label, y)
			}
			rule4Hist[int(y)]++
			if m.Rashi != nil && y == 12 &&
				(*m.Rashi == 7 || *m.Rashi == 10) && isBothInLabel(c.Label, *m.Rashi) {
				sawCap = true
			}
		}
	}
	if !sawCap {
		t.Errorf("no Rule 4(a) case published the 12-year duration; the cap and "+
			"the both-lords-in-sign branch are both untested. rule4 histogram: %v",
			rule4Hist)
	}
	t.Logf("Narayan variable durations: sweep %v, rule4 %v", hist, rule4Hist)
}

func TestCharaAndNarayanFixedAgreeOnDurations(t *testing.T) {
	g := loadDashaGolden(t)
	for _, s := range g.Sweep {
		for _, m := range s.NarayanFixed.MahaDashas {
			if m.Rashi == nil {
				t.Fatal("narayan period carries no rashi")
			}
			if want := CharaRashiYears[*m.Rashi]; m.Years != want {
				t.Errorf("ms=%d rashi %d: fixed Narayan years %v, CharaRashiYears %v",
					s.Ms, *m.Rashi, m.Years, want)
			}
		}
	}
}

func isBothInLabel(label string, rashi int) bool {
	return label == itoa(rashi)+"-a-both-in"
}
