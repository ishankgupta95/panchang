package muhurta

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang/source/go/v5/internal/astronomy"
	"github.com/ishankgupta95/panchang/source/go/v5/internal/tablejson"
	"github.com/ishankgupta95/panchang/source/go/v5/types"
)

var (
	pune         = types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}
	longyearbyen = types.GeoLocation{Latitude: 78.2232, Longitude: 15.6267}
	ist          = MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330)}
)

func TestVaraTithiYogasDefaultsToOnWhenUnset(t *testing.T) {
	yes, no := true, false
	base := MuhurtaRule{Occasion: "probe"}
	unset := base
	explicitTrue := base
	explicitTrue.VaraTithiYogas = &yes
	explicitFalse := base
	explicitFalse.VaraTithiYogas = &no

	if !ruleScoresVaraTithiYogas(unset) {
		t.Fatal("an unset VaraTithiYogas must score the layer: a nil pointer is the " +
			"TypeScript's `undefined`, and `undefined !== false` is true")
	}
	if !ruleScoresVaraTithiYogas(explicitTrue) {
		t.Error("VaraTithiYogas: &true must score the layer")
	}
	if ruleScoresVaraTithiYogas(explicitFalse) {
		t.Error("VaraTithiYogas: &false must suppress the layer")
	}

	ctx := &astronomy.EphemerisCtx{}
	found := false
	for day := 0; day < 40 && !found; day++ {
		ms := types.DateUTC(2025, 0, 1).Ms() + int64(day)*dayMs + 6*3600_000
		on, err := ScoreMuhurta(ctx, ms, pune, unset, ist)
		if err != nil {
			t.Fatal(err)
		}
		off, err := ScoreMuhurta(ctx, ms, pune, explicitFalse, ist)
		if err != nil {
			t.Fatal(err)
		}
		exp, err := ScoreMuhurta(ctx, ms, pune, explicitTrue, ist)
		if err != nil {
			t.Fatal(err)
		}
		if on.Score != exp.Score {
			t.Errorf("%s: nil and &true disagree (%d vs %d)",
				types.Date(ms).ISOString()[:10], on.Score, exp.Score)
		}
		if on.Score != off.Score {
			found = true
			t.Logf("%s: layer on = %d, off = %d: the default is observable",
				types.Date(ms).ISOString()[:10], on.Score, off.Score)
		}
	}
	if !found {
		t.Fatal("no day in the first 40 of 2025 at Pune scored differently with the " +
			"Vara x Tithi layer off, so this test cannot see the default it exists to pin")
	}
}

func TestBhadraIsThreeStateAndSupersedesTheDeprecatedBoolean(t *testing.T) {
	exclude, ignore, penalize := BhadraExclude, BhadraIgnore, BhadraPenalize
	for _, c := range []struct {
		name string
		rule MuhurtaRule
		want BhadraMode
	}{
		{"neither set", MuhurtaRule{}, BhadraIgnore},
		{"legacy true", MuhurtaRule{ExcludeBhadra: true}, BhadraExclude},
		{"legacy false", MuhurtaRule{ExcludeBhadra: false}, BhadraIgnore},
		{"bhadra ignore", MuhurtaRule{Bhadra: &ignore}, BhadraIgnore},
		{"bhadra penalize", MuhurtaRule{Bhadra: &penalize}, BhadraPenalize},
		{"bhadra exclude", MuhurtaRule{Bhadra: &exclude}, BhadraExclude},
		{"both, bhadra loosest", MuhurtaRule{Bhadra: &ignore, ExcludeBhadra: true}, BhadraIgnore},
		{"both, bhadra strictest", MuhurtaRule{Bhadra: &exclude, ExcludeBhadra: false}, BhadraExclude},
		{"both, bhadra middle", MuhurtaRule{Bhadra: &penalize, ExcludeBhadra: true}, BhadraPenalize},
	} {
		if got := ruleResolvedBhadra(c.rule); got != c.want {
			t.Errorf("%s: want %q, got %q", c.name, c.want, got)
		}
	}
}

func TestExcludeBhadraFalseIsIndistinguishableFromAbsent(t *testing.T) {
	absent := MuhurtaRule{Occasion: "a"}
	explicitFalse := MuhurtaRule{Occasion: "a", ExcludeBhadra: false}
	if ruleResolvedBhadra(absent) != ruleResolvedBhadra(explicitFalse) {
		t.Error("an absent excludeBhadra and an explicit false must resolve alike")
	}
	if ruleResolvedBhadra(absent) != BhadraIgnore {
		t.Errorf("both must resolve to %q, got %q", BhadraIgnore, ruleResolvedBhadra(absent))
	}
}

func TestScoreIsIntegerArithmeticThroughout(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	seen := map[int]bool{}
	for day := 0; day < 90; day++ {
		ms := types.DateUTC(2025, 0, 1).Ms() + int64(day)*dayMs + 6*3600_000
		for _, rule := range []MuhurtaRule{
			{Occasion: "a", AuspiciousTithis: []int{0, 5, 10, 15, 20, 25}},
			{Occasion: "b", InauspiciousNakshatras: []int{0, 1, 2, 3, 4, 5}},
			{Occasion: "c"},
		} {
			r, err := ScoreMuhurta(ctx, ms, pune, rule, ist)
			if err != nil {
				t.Fatal(err)
			}
			if r.Score < 0 || r.Score > 100 {
				t.Fatalf("score %d is outside the clamp", r.Score)
			}
			seen[r.Score] = true
			raw := 50
			for _, f := range r.Factors {
				raw += f.Delta
				switch f.Delta {
				case 10, -15, 5, -10, 0:
				default:
					t.Errorf("factor %q carries delta %d, which is not one of the "+
						"five the scorer can add", f.Code, f.Delta)
				}
			}
			clamped := raw
			if clamped < 0 {
				clamped = 0
			}
			if clamped > 100 {
				clamped = 100
			}
			if r.Score != clamped {
				t.Errorf("score %d is not 50 + sum(deltas) clamped (%d)", r.Score, clamped)
			}
			if r.Passes != (r.Score >= 50) {
				t.Errorf("passes %v does not follow score %d", r.Passes, r.Score)
			}
		}
	}
	if len(seen) < 3 {
		t.Errorf("only %d distinct scores over 90 days x 3 rules: the sweep is "+
			"too narrow to say anything", len(seen))
	}
}

func TestEmptyReasonsAndFactorsMarshalAsArrays(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	no := false
	rule := MuhurtaRule{Occasion: "neutral", VaraTithiYogas: &no}
	found := false
	for day := 0; day < 120 && !found; day++ {
		ms := types.DateUTC(2025, 0, 1).Ms() + int64(day)*dayMs + 6*3600_000
		r, err := ScoreMuhurta(ctx, ms, pune, rule, ist)
		if err != nil {
			t.Fatal(err)
		}
		if len(r.Factors) != 0 {
			continue
		}
		found = true
		b, err := json.Marshal(r)
		if err != nil {
			t.Fatal(err)
		}
		s := string(b)
		if strings.Contains(s, `"reasons":null`) {
			t.Error(`empty reasons marshalled as null; JavaScript writes []`)
		}
		if strings.Contains(s, `"factors":null`) {
			t.Error(`empty factors marshalled as null; JavaScript writes []`)
		}
		if !strings.Contains(s, `"reasons":[]`) || !strings.Contains(s, `"factors":[]`) {
			t.Errorf("want empty arrays on the wire, got %s", s)
		}
	}
	if !found {
		t.Fatal("no neutral day in 120: this test never checked the empty case")
	}
	strict := MuhurtaRule{Occasion: "impossible", ExcludeEkadashi: true,
		InauspiciousTithis: []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
			15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29},
		InauspiciousNakshatras: []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
			14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
	}
	days, err := ComputeAuspiciousDatesInRange(context.Background(), ctx, strict,
		types.DateUTC(2025, 0, 1).Ms(), types.DateUTC(2025, 0, 5).Ms(), pune, ist)
	if err != nil {
		t.Fatal(err)
	}
	b, err := json.Marshal(days)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) == "null" {
		t.Error("an empty range result marshalled as null")
	}
}

func TestPolarDayScoresZeroWithoutAnError(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	ms := types.DateUTC(2025, 11, 15).Ms() + 6*3600_000
	r, err := ScoreMuhurta(ctx, ms, longyearbyen, MuhurtaRule{Occasion: "probe"},
		MuhurtaScoreOptions{Timezone: types.TimezoneOffset(60)})
	if err != nil {
		t.Fatalf("a polar day must not be an error: %v", err)
	}
	if r.Score != 0 || r.Passes {
		t.Errorf("want score 0 and passes false, got %d / %v", r.Score, r.Passes)
	}
	if len(r.Factors) != 1 || r.Factors[0].Code != "no_sunrise" ||
		r.Factors[0].Axis != AxisExclusion || r.Factors[0].Delta != 0 {
		t.Errorf("want a single no_sunrise exclusion factor, got %+v", r.Factors)
	}
	if r.Factors[0].Index != nil {
		t.Error("the no_sunrise factor must carry no index")
	}
	if r.Date.Ms() != ms {
		t.Errorf("the polar arm must echo the requested instant, got %s", r.Date.ISOString())
	}
	days, err := ComputeAuspiciousDatesInRange(context.Background(), ctx, MuhurtaRule{Occasion: "probe"},
		ms, ms+3*dayMs, longyearbyen,
		MuhurtaScoreOptions{Timezone: types.TimezoneOffset(60), IncludeFailures: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 0 {
		t.Errorf("the range enumerator must skip polar days, got %d", len(days))
	}
}

func TestFactorIndexDistinguishesZeroFromAbsent(t *testing.T) {
	zeroIdx := MuhurtaFactor{Code: "auspicious_vara", Axis: AxisVara, Index: factorIndex(0), Delta: 10}
	absent := MuhurtaFactor{Code: "auspicious_vara", Axis: AxisVara, Delta: 10}

	b, err := json.Marshal(zeroIdx)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), `"index":0`) {
		t.Errorf("an index of 0 must reach the wire, got %s", b)
	}
	b, err = json.Marshal(absent)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(b), `"index"`) {
		t.Errorf("an absent index must not reach the wire, got %s", b)
	}
	if got := string(b); got != `{"code":"auspicious_vara","axis":"vara","delta":10}` {
		t.Errorf("key order without an index: got %s", got)
	}
	b, _ = json.Marshal(zeroIdx)
	if got := string(b); got != `{"code":"auspicious_vara","axis":"vara","index":0,"delta":10}` {
		t.Errorf("key order with an index: got %s", got)
	}

	d := newFactorDictionary()
	if a, b := d.intern(zeroIdx), d.intern(absent); a == b {
		t.Errorf("interning a 0 index and an absent index gave the same slot (%d): "+
			"the TypeScript's key is `${f.index ?? ''}`, so they differ", a)
	}
	if len(d.entries) != 2 {
		t.Errorf("want 2 dictionary entries, got %d", len(d.entries))
	}
	if a, b := d.intern(zeroIdx), d.intern(zeroIdx); a != b || len(d.entries) != 2 {
		t.Errorf("interning the same factor twice grew the dictionary to %d", len(d.entries))
	}
}

func TestAuspiciousWinsWhenAnIndexIsInBothLists(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	no := false
	both := MuhurtaRule{
		Occasion:               "both",
		VaraTithiYogas:         &no,
		AuspiciousVaras:        []int{0, 1, 2, 3, 4, 5, 6},
		InauspiciousVaras:      []int{0, 1, 2, 3, 4, 5, 6},
		AuspiciousNakshatras:   []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
		InauspiciousNakshatras: []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
	}
	ms := types.DateUTC(2025, 0, 15).Ms() + 6*3600_000
	r, err := ScoreMuhurta(ctx, ms, pune, both, ist)
	if err != nil {
		t.Fatal(err)
	}
	varaFactors, nakFactors := 0, 0
	for _, f := range r.Factors {
		switch f.Axis {
		case AxisVara:
			varaFactors++
			if f.Delta != 10 {
				t.Errorf("vara factor delta %d, want +10 (auspicious wins)", f.Delta)
			}
		case AxisNakshatra:
			nakFactors++
			if f.Delta != 10 {
				t.Errorf("nakshatra factor delta %d, want +10", f.Delta)
			}
		}
	}
	if varaFactors != 1 || nakFactors != 1 {
		t.Errorf("want exactly one factor per axis, got %d vara and %d nakshatra",
			varaFactors, nakFactors)
	}
}

func TestRangeSortIsStableOnEqualScores(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	rule := MuhurtaRule{Occasion: "probe", AuspiciousTithis: []int{0, 5, 10, 15, 20, 25}}
	days, err := ComputeAuspiciousDatesInRange(context.Background(), ctx, rule,
		types.DateUTC(2025, 0, 1).Ms(), types.DateUTC(2025, 2, 31).Ms(), pune,
		MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330), IncludeFailures: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(days) < 60 {
		t.Fatalf("want a long enough run, got %d days", len(days))
	}
	ties := 0
	for i := 1; i < len(days); i++ {
		if days[i-1].Score < days[i].Score {
			t.Fatalf("day %d scores %d, below day %d's %d: not sorted descending",
				i, days[i].Score, i-1, days[i-1].Score)
		}
		if days[i-1].Score == days[i].Score {
			ties++
			if days[i-1].Date.Ms() > days[i].Date.Ms() {
				t.Errorf("days %d and %d share score %d but are out of date order: "+
					"the sort is not stable", i-1, i, days[i].Score)
			}
		}
	}
	if ties == 0 {
		t.Fatal("no two days shared a score, so stability was not exercised")
	}
	t.Logf("%d days, %d adjacent score ties, all in date order", len(days), ties)
}

func TestDateKeyCompareMatchesLocaleCompare(t *testing.T) {
	keys := []string{}
	for _, year := range []int{1999, 2000, 2025, 2100} {
		for m := 0; m < 12; m++ {
			for d := 1; d <= 28; d++ {
				keys = append(keys, toDateKey(types.DateUTC(year, m, d).Ms(), 0))
			}
		}
	}
	for _, k := range keys {
		if len(k) != 10 || k[4] != '-' || k[7] != '-' {
			t.Fatalf("key %q is not YYYY-MM-DD", k)
		}
		for i, c := range k {
			if i == 4 || i == 7 {
				continue
			}
			if c < '0' || c > '9' {
				t.Fatalf("key %q has a non-digit at %d", k, i)
			}
		}
	}
	for i := 1; i < len(keys); i++ {
		prev, cur := keys[i-1], keys[i]
		if prev >= cur && !(prev[:4] != cur[:4] && prev > cur) {
			if prev >= cur {
				t.Errorf("keys out of order at %d: %q then %q", i, prev, cur)
			}
		}
	}
}

func TestBuildMuhurtaTableRejectsBadInput(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	base := BuildMuhurtaTableOptions{
		Rule: MuhurtaRule{Occasion: "probe"}, Location: pune,
		TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025,
	}
	noRule := base
	noRule.Rule = MuhurtaRule{}
	if _, err := BuildMuhurtaTable(context.Background(), ctx, noRule); err == nil {
		t.Error("a rule with no Occasion must be rejected")
	} else {
		var pe *types.PanchangError
		if !errors.As(err, &pe) || pe.Code != types.ErrInvalidInput {
			t.Errorf("want INVALID_INPUT, got %v", err)
		}
	}
	inverted := base
	inverted.StartYear, inverted.EndYear = 2026, 2025
	if _, err := BuildMuhurtaTable(context.Background(), ctx, inverted); err == nil {
		t.Error("startYear > endYear must be rejected")
	}
	badLoc := base
	badLoc.Location = types.GeoLocation{Latitude: 91}
	if _, err := BuildMuhurtaTable(context.Background(), ctx, badLoc); err == nil {
		t.Error("an invalid location must be rejected")
	}
}

func TestMuhurtaTableOmitsOccasionNameWhenUnnamed(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	for _, c := range []struct {
		name      string
		rule      MuhurtaRule
		wantKey   bool
		wantValue string
	}{
		{"named", MuhurtaRule{Occasion: "probe", Name: "Probe rule"}, true, "Probe rule"},
		{"unnamed", MuhurtaRule{Occasion: "probe"}, false, ""},
	} {
		file, err := BuildMuhurtaTable(context.Background(), ctx, BuildMuhurtaTableOptions{
			Rule: c.rule, Location: pune, TimezoneOffsetMinutes: 330,
			StartYear: 2025, EndYear: 2025,
		})
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		raw, err := tablejson.Marshal(file)
		if err != nil {
			t.Fatal(err)
		}
		has := strings.Contains(string(raw), `"occasionName"`)
		if has != c.wantKey {
			t.Errorf("%s: occasionName present = %v, want %v", c.name, has, c.wantKey)
		}
		if c.wantKey && !strings.Contains(string(raw), `"occasionName": "`+c.wantValue+`"`) {
			t.Errorf("%s: occasionName value missing", c.name)
		}
		if c.wantKey {
			meta := string(raw)
			noteAt := strings.Index(meta, `"note"`)
			nameAt := strings.Index(meta, `"occasionName"`)
			if noteAt < 0 || nameAt < 0 || nameAt < noteAt {
				t.Errorf("%s: occasionName must follow note (note at %d, occasionName at %d)",
					c.name, noteAt, nameAt)
			}
		}
	}
}

func TestBuildMuhurtaTableNoteDefaultsButCanBeEmptied(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	base := BuildMuhurtaTableOptions{
		Rule: MuhurtaRule{Occasion: "probe"}, Location: pune,
		TimezoneOffsetMinutes: 330, StartYear: 2025, EndYear: 2025,
	}
	def, err := BuildMuhurtaTable(context.Background(), ctx, base)
	if err != nil {
		t.Fatal(err)
	}
	if def.Meta.Note != DefaultMuhurtaNote {
		t.Errorf("a nil Note must select the default, got %q", def.Meta.Note)
	}
	empty := ""
	withEmpty := base
	withEmpty.Note = &empty
	got, err := BuildMuhurtaTable(context.Background(), ctx, withEmpty)
	if err != nil {
		t.Fatal(err)
	}
	if got.Meta.Note != "" {
		t.Errorf("a pointer to \"\" must produce an empty note, got %q", got.Meta.Note)
	}
}

func TestReaderDropsOutOfRangeDictionaryIndices(t *testing.T) {
	file := MuhurtaFile{
		Meta: MuhurtaTableMeta{Format: 2, Occasion: "probe", StartYear: 2025, EndYear: 2025},
		Dict: []MuhurtaFactor{{Code: "a", Axis: AxisTithi, Delta: 10}},
		Years: map[string][]PackedMuhurtaTableDay{
			"2025": {{Date: "2025-01-01", S: 60, P: 1, F: []int{0, 7, -1}}},
		},
	}
	days, ok := ReadMuhurtaForYear(file, 2025)
	if !ok || len(days) != 1 {
		t.Fatalf("want one day, got %d (ok=%v)", len(days), ok)
	}
	if len(days[0].Factors) != 1 || days[0].Factors[0].Code != "a" {
		t.Errorf("want only the in-range factor, got %+v", days[0].Factors)
	}
	if _, ok := ReadMuhurtaForYear(file, 2026); ok {
		t.Error("an absent year must report ok=false")
	}
	file.Years["2026"] = []PackedMuhurtaTableDay{}
	if days, ok := ReadMuhurtaForYear(file, 2026); !ok || len(days) != 0 {
		t.Errorf("a present empty year must report ok=true with 0 days, got %d / %v",
			len(days), ok)
	}
}

func TestReadBestMuhurtaDaysOrdersByScoreThenDate(t *testing.T) {
	file := MuhurtaFile{
		Meta: MuhurtaTableMeta{Format: 2, Occasion: "probe", StartYear: 2024, EndYear: 2025},
		Dict: []MuhurtaFactor{},
		Years: map[string][]PackedMuhurtaTableDay{
			"2025": {
				{Date: "2025-03-01", S: 70, P: 1}, {Date: "2025-01-01", S: 70, P: 1},
				{Date: "2025-02-01", S: 90, P: 1},
			},
			"2024": {{Date: "2024-06-01", S: 70, P: 1}, {Date: "2024-01-01", S: 100, P: 1}},
		},
	}
	got := ReadBestMuhurtaDays(file, 10)
	want := []string{"2024-01-01", "2025-02-01", "2024-06-01", "2025-01-01", "2025-03-01"}
	if len(got) != len(want) {
		t.Fatalf("want %d days, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i].Date != want[i] {
			t.Errorf("position %d: want %s, got %s (full order %v)", i, want[i], got[i].Date, got)
			break
		}
	}
	for _, c := range []struct{ limit, want int }{{0, 0}, {-5, 0}, {3, 3}, {99, 5}} {
		if got := ReadBestMuhurtaDays(file, c.limit); len(got) != c.want {
			t.Errorf("limit %d: want %d days, got %d", c.limit, c.want, len(got))
		}
	}
}

func TestTableJSONMatchesJSONStringify(t *testing.T) {
	type inner struct {
		Empty  []int          `json:"empty"`
		EmptyM map[string]int `json:"emptyM"`
		N      float64        `json:"n"`
	}
	type doc struct {
		A string `json:"a"`
		B []int  `json:"b"`
		C inner  `json:"c"`
	}
	got, err := tablejson.Marshal(doc{
		A: "a<b>c&d",
		B: []int{1, 2},
		C: inner{Empty: []int{}, EmptyM: map[string]int{}, N: 18.5204},
	})
	if err != nil {
		t.Fatal(err)
	}
	want := `{
  "a": "a<b>c&d",
  "b": [
    1,
    2
  ],
  "c": {
    "empty": [],
    "emptyM": {},
    "n": 18.5204
  }
}
`
	if string(got) != want {
		t.Errorf("tablejson.Marshal does not match JSON.stringify(x, null, 2) + '\\n':\n"+
			"--- want ---\n%s\n--- got ---\n%s", want, got)
	}
	if got[len(got)-1] != '\n' {
		t.Error("the trailing newline is missing")
	}
	if strings.Contains(string(got), `\u003c`) {
		t.Error("HTML escaping is on; JavaScript does not escape < > &")
	}
}

func TestPackedDayPassesFlagIsZeroOrOne(t *testing.T) {
	ctx := &astronomy.EphemerisCtx{}
	file, err := BuildMuhurtaTable(context.Background(), ctx, BuildMuhurtaTableOptions{
		Rule:     MuhurtaRule{Occasion: "probe", AuspiciousTithis: []int{0, 5, 10}},
		Location: pune, TimezoneOffsetMinutes: 330,
		StartYear: 2025, EndYear: 2025, IncludeFailures: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[int]int{}
	for _, d := range file.Years["2025"] {
		if d.P != 0 && d.P != 1 {
			t.Fatalf("packed day %s carries p=%d", d.Date, d.P)
		}
		seen[d.P]++
		if (d.P == 1) != (d.S >= 50) {
			t.Errorf("packed day %s: p=%d does not follow s=%d", d.Date, d.P, d.S)
		}
	}
	if seen[0] == 0 || seen[1] == 0 {
		t.Errorf("want both outcomes present with IncludeFailures, got %v", seen)
	}
}

// BuildMuhurtaTable scores days built with only the scorer's sections and no
// end times. Under rules that reach every veto and penalty, across a year with
// eclipses, an adhika month and every Bhadra, Panchaka and Ganda Mula case, and
// at a polar location, the lean walk must score every day as the full walk does,
// in the same order.
func TestScoreOnlyCivilDaysScoresLikeTheFullWalk(t *testing.T) {
	exclude, penalize := BhadraExclude, BhadraPenalize
	rules := []MuhurtaRule{
		{Occasion: "vetoes", Bhadra: &exclude, ExcludeEkadashi: true, ExcludeEclipse: true,
			ExcludeAdhikaMasa: true, ExcludeGandaMula: true, ExcludePanchaka: true,
			AuspiciousTithis: []int{1, 2, 4, 6}, InauspiciousNakshatras: []int{5, 8}},
		{Occasion: "penalties", Bhadra: &penalize, RequirePaksha: PakshaShukla,
			AuspiciousNakshatras: []int{3, 12, 21}, InauspiciousVaras: []int{2, 6},
			AuspiciousYogas: []int{1, 2}, InauspiciousYogas: []int{0, 5}},
	}
	type walk struct {
		loc        types.GeoLocation
		opts       MuhurtaScoreOptions
		start, end int64
	}
	walks := []walk{
		{pune, MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330), IncludeFailures: true},
			types.DateUTC(2026, 0, 1).Ms() - 330*60_000, types.DateUTC(2027, 0, 1).Ms() - 1 - 330*60_000},
		{pune, MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330), MasaSystem: types.Amanta, Ayanamsa: types.Raman},
			types.DateUTC(2023, 6, 1).Ms() - 330*60_000, types.DateUTC(2023, 9, 1).Ms() - 330*60_000},
		{longyearbyen, MuhurtaScoreOptions{Timezone: types.TimezoneOffset(60), IncludeFailures: true},
			types.DateUTC(2025, 0, 1).Ms() - 60*60_000, types.DateUTC(2025, 3, 1).Ms() - 60*60_000},
	}
	days := 0
	for _, w := range walks {
		for _, rule := range rules {
			full, err := ScoreCivilDays(context.Background(), astronomy.NewEphemerisCtx(), rule, w.start, w.end, w.loc, w.opts)
			if err != nil {
				t.Fatal(err)
			}
			lean, err := scoreOnlyCivilDays(context.Background(), astronomy.NewEphemerisCtx(), rule, w.start, w.end, w.loc, w.opts)
			if err != nil {
				t.Fatal(err)
			}
			if len(full) != len(lean) {
				t.Fatalf("%s: full walk kept %d days, lean %d", rule.Occasion, len(full), len(lean))
			}
			for i := range full {
				a, _ := json.Marshal(full[i].MuhurtaScore)
				b, _ := json.Marshal(lean[i].MuhurtaScore)
				if string(a) != string(b) {
					t.Fatalf("%s day %d: full %s\n lean %s", rule.Occasion, i, a, b)
				}
			}
			days += len(full)
		}
	}
	if days < 700 {
		t.Fatalf("compared %d scored days", days)
	}
}
