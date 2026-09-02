package muhurta_test

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/astronomy"
	mu "github.com/ishankgupta95/panchang-ts/source/go/v5/internal/muhurta"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/muhurta/rules"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/repopath"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/tablejson"
	"github.com/ishankgupta95/panchang-ts/source/go/v5/internal/types"
)

type muRuleJSON struct {
	Occasion               string   `json:"occasion"`
	Name                   *string  `json:"name"`
	AuspiciousTithis       *[]int   `json:"auspiciousTithis"`
	InauspiciousTithis     *[]int   `json:"inauspiciousTithis"`
	AuspiciousNakshatras   *[]int   `json:"auspiciousNakshatras"`
	InauspiciousNakshatras *[]int   `json:"inauspiciousNakshatras"`
	AuspiciousVaras        *[]int   `json:"auspiciousVaras"`
	InauspiciousVaras      *[]int   `json:"inauspiciousVaras"`
	AuspiciousYogas        *[]int   `json:"auspiciousYogas"`
	InauspiciousYogas      *[]int   `json:"inauspiciousYogas"`
	Bhadra                 *string  `json:"bhadra"`
	ExcludeBhadra          *bool    `json:"excludeBhadra"`
	ExcludeEkadashi        *bool    `json:"excludeEkadashi"`
	RequirePaksha          *string  `json:"requirePaksha"`
	ExcludeAdhikaMasa      *bool    `json:"excludeAdhikaMasa"`
	ExcludeEclipse         *bool    `json:"excludeEclipse"`
	ExcludeGandaMula       *bool    `json:"excludeGandaMula"`
	ExcludePanchaka        *bool    `json:"excludePanchaka"`
	VaraTithiYogas         *bool    `json:"varaTithiYogas"`
	_                      struct{} // forces keyed literals
}

type muRuleEntry struct {
	ID   string     `json:"id"`
	Rule muRuleJSON `json:"rule"`
}

type muVtyCell struct {
	Vara  int                `json:"vara"`
	Tithi int                `json:"tithi"`
	Yogas []mu.VaraTithiYoga `json:"yogas"`
}

type muFactorJSON struct {
	Code  string `json:"code"`
	Axis  string `json:"axis"`
	Index *int   `json:"index"`
	Delta int    `json:"delta"`
}

type muScoreCase struct {
	Label   string         `json:"label"`
	Score   int            `json:"score"`
	Passes  bool           `json:"passes"`
	Reasons []string       `json:"reasons"`
	Factors []muFactorJSON `json:"factors"`
}

type muSpan struct {
	Name      string  `json:"name"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  int     `json:"timezone"`
	From      [3]int  `json:"from"`
	Days      int     `json:"days"`
}

type muRangeCase struct {
	Key  string   `json:"key"`
	Days []string `json:"days"`
}

type muTableCase struct {
	Key           string              `json:"key"`
	Sha256        string              `json:"sha256"`
	Bytes         int                 `json:"bytes"`
	DictLength    int                 `json:"dictLength"`
	DayCount      int                 `json:"dayCount"`
	MetaKeys      []string            `json:"metaKeys"`
	Range         mu.MuhurtaYearRange `json:"range"`
	Occasion      string              `json:"occasion"`
	Best          []string            `json:"best"`
	ForYearLength *int                `json:"forYearLength"`
	ForYearFirst  *string             `json:"forYearFirst"`
	ForDate       *string             `json:"forDate"`
	OutOfRange    bool                `json:"outOfRange"`
}

type muhurtaGolden struct {
	Meta struct {
		Claim string `json:"claim"`
	} `json:"_meta"`
	StockIds     []string       `json:"stockIds"`
	SyntheticIds []string       `json:"syntheticIds"`
	Spans        []muSpan       `json:"spans"`
	RuleDigest   string         `json:"ruleDigest"`
	VtyDigest    string         `json:"vtyDigest"`
	ScoreDigest  string         `json:"scoreDigest"`
	BuildDigest  string         `json:"buildDigest"`
	ArmHits      map[string]int `json:"armHits"`
	RuleTable    []muRuleEntry  `json:"ruleTable"`
	VtyGrid      []muVtyCell    `json:"vtyGrid"`
	ScoreCases   []muScoreCase  `json:"scoreCases"`
	RangeCases   []muRangeCase  `json:"rangeCases"`
	Tables       []muTableCase  `json:"tables"`
}

func loadMuhurtaGolden(t *testing.T) muhurtaGolden {
	t.Helper()
	raw, err := repopath.ReadTestData("goldens", "muhurta", "muhurta-golden.json")
	if err != nil {
		t.Fatalf("reading muhurta-golden.json: %v", err)
	}
	var g muhurtaGolden
	if err := json.Unmarshal(raw, &g); err != nil {
		t.Fatalf("parsing muhurta-golden.json: %v", err)
	}
	if len(g.RuleTable) == 0 || len(g.ScoreCases) == 0 {
		t.Fatalf("golden is empty: %d rules, %d cases", len(g.RuleTable), len(g.ScoreCases))
	}
	return g
}

func synthetic() []struct {
	id   string
	rule mu.MuhurtaRule
} {
	yes, no := true, false
	exclude, ignore, pen := mu.BhadraExclude, mu.BhadraIgnore, mu.BhadraPenalize
	seq := func(n int) []int {
		out := make([]int, n)
		for i := range out {
			out[i] = i
		}
		return out
	}
	return []struct {
		id   string
		rule mu.MuhurtaRule
	}{
		{"syn-yoga", mu.MuhurtaRule{
			Occasion:          "syn-yoga",
			AuspiciousYogas:   []int{0, 1, 2, 3, 4, 5, 6, 7},
			InauspiciousYogas: []int{16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
		}},
		{"syn-shukla", mu.MuhurtaRule{Occasion: "syn-shukla", RequirePaksha: mu.PakshaShukla}},
		{"syn-krishna", mu.MuhurtaRule{Occasion: "syn-krishna", RequirePaksha: mu.PakshaKrishna}},
		{"syn-bhadra-exclude", mu.MuhurtaRule{Occasion: "syn-bhadra-exclude", Bhadra: &exclude}},
		{"syn-bhadra-ignore", mu.MuhurtaRule{Occasion: "syn-bhadra-ignore", Bhadra: &ignore}},
		{"syn-bhadra-legacy", mu.MuhurtaRule{Occasion: "syn-bhadra-legacy", ExcludeBhadra: true}},
		{"syn-bhadra-both", mu.MuhurtaRule{
			Occasion: "syn-bhadra-both", Bhadra: &pen, ExcludeBhadra: true,
		}},
		{"syn-novty", mu.MuhurtaRule{
			Occasion: "syn-novty", VaraTithiYogas: &no,
			AuspiciousTithis: []int{0, 5, 10, 15, 20, 25},
		}},
		{"syn-vty-explicit-true", mu.MuhurtaRule{
			Occasion: "syn-vty-explicit-true", VaraTithiYogas: &yes,
			AuspiciousTithis: []int{0, 5, 10, 15, 20, 25},
		}},
		{"syn-panchaka", mu.MuhurtaRule{Occasion: "syn-panchaka", ExcludePanchaka: true}},
		{"syn-gandamula", mu.MuhurtaRule{Occasion: "syn-gandamula", ExcludeGandaMula: true}},
		{"syn-eclipse", mu.MuhurtaRule{Occasion: "syn-eclipse", ExcludeEclipse: true}},
		{"syn-adhika", mu.MuhurtaRule{Occasion: "syn-adhika", ExcludeAdhikaMasa: true}},
		{"syn-ekadashi", mu.MuhurtaRule{Occasion: "syn-ekadashi", ExcludeEkadashi: true}},
		{"syn-clamp-high", mu.MuhurtaRule{
			Occasion:             "syn-clamp-high",
			AuspiciousTithis:     seq(30),
			AuspiciousNakshatras: seq(27),
			AuspiciousVaras:      []int{0, 1, 2, 3, 4, 5, 6},
			AuspiciousYogas:      seq(27),
		}},
		{"syn-clamp-low", mu.MuhurtaRule{
			Occasion:               "syn-clamp-low",
			InauspiciousTithis:     seq(30),
			InauspiciousNakshatras: seq(27),
			InauspiciousVaras:      []int{0, 1, 2, 3, 4, 5, 6},
			InauspiciousYogas:      seq(27),
			Bhadra:                 &pen,
		}},
		{"syn-unnamed", mu.MuhurtaRule{Occasion: "syn-unnamed"}},
	}
}

func allRules() []struct {
	id   string
	rule mu.MuhurtaRule
} {
	out := []struct {
		id   string
		rule mu.MuhurtaRule
	}{}
	for _, id := range rules.Order() {
		r, ok := rules.Get(id)
		if !ok {
			panic("muhurta: stock rule " + id + " is missing")
		}
		out = append(out, struct {
			id   string
			rule mu.MuhurtaRule
		}{id, r})
	}
	return append(out, synthetic()...)
}

func TestStockRulesMatchTypeScript(t *testing.T) {
	g := loadMuhurtaGolden(t)
	if got := rules.Order(); len(got) != len(g.StockIds) {
		t.Fatalf("stock rule count: want %d, got %d", len(g.StockIds), len(got))
	}
	h := sha256.New()

	for i, id := range g.StockIds {
		if rules.Order()[i] != id {
			t.Errorf("stock rule %d: want %q, got %q", i, id, rules.Order()[i])
		}
		r, ok := rules.Get(id)
		if !ok {
			t.Fatalf("Go has no stock rule %q", id)
		}
		name := "<none>"
		if r.Name != "" {
			name = r.Name
		}
		h.Write([]byte(fmt.Sprintf("%s|%s|%s|", id, r.Occasion, name)))
		for _, f := range []struct {
			key  string
			list []int
		}{
			{"auspiciousTithis", r.AuspiciousTithis},
			{"inauspiciousTithis", r.InauspiciousTithis},
			{"auspiciousNakshatras", r.AuspiciousNakshatras},
			{"inauspiciousNakshatras", r.InauspiciousNakshatras},
			{"auspiciousVaras", r.AuspiciousVaras},
			{"inauspiciousVaras", r.InauspiciousVaras},
			{"auspiciousYogas", r.AuspiciousYogas},
			{"inauspiciousYogas", r.InauspiciousYogas},
		} {
			v := "<none>"
			if f.list != nil {
				parts := make([]string, len(f.list))
				for i, n := range f.list {
					parts[i] = strconv.Itoa(n)
				}
				v = strings.Join(parts, ",")
			}
			h.Write([]byte(f.key + "=" + v + ";"))
		}
		h.Write([]byte("bhadra=" + optString(r.Bhadra) + ";"))
		h.Write([]byte("excludeBhadra=" + optBoolFalseAsAbsent(r.ExcludeBhadra) + ";"))
		h.Write([]byte("excludeEkadashi=" + optBoolFalseAsAbsent(r.ExcludeEkadashi) + ";"))
		h.Write([]byte("requirePaksha=" + optPaksha(r.RequirePaksha) + ";"))
		h.Write([]byte("excludeAdhikaMasa=" + optBoolFalseAsAbsent(r.ExcludeAdhikaMasa) + ";"))
		h.Write([]byte("excludeEclipse=" + optBoolFalseAsAbsent(r.ExcludeEclipse) + ";"))
		h.Write([]byte("excludeGandaMula=" + optBoolFalseAsAbsent(r.ExcludeGandaMula) + ";"))
		h.Write([]byte("excludePanchaka=" + optBoolFalseAsAbsent(r.ExcludePanchaka) + ";"))
		h.Write([]byte("varaTithiYogas=" + optBoolPtr(r.VaraTithiYogas) + ";"))
		h.Write([]byte("\n"))
	}

	if got := hex.EncodeToString(h.Sum(nil)); got != g.RuleDigest {
		t.Errorf("rule table digest mismatch:\n  want %s\n  got  %s", g.RuleDigest, got)
	}
}

func optString(m *mu.BhadraMode) string {
	if m == nil {
		return "<none>"
	}
	return string(*m)
}

func optBoolFalseAsAbsent(b bool) string {
	if !b {
		return "<none>"
	}
	return "true"
}

func optBoolPtr(b *bool) string {
	if b == nil {
		return "<none>"
	}
	if *b {
		return "true"
	}
	return "false"
}

func optPaksha(p mu.Paksha) string {
	if p == "" {
		return "<none>"
	}
	return string(p)
}

func TestStockRulesExplicitFields(t *testing.T) {
	g := loadMuhurtaGolden(t)
	for _, entry := range g.RuleTable {
		r, ok := rules.Get(entry.ID)
		if !ok {
			t.Fatalf("Go has no stock rule %q", entry.ID)
		}
		w := entry.Rule
		if r.Occasion != w.Occasion {
			t.Errorf("%s occasion: want %q, got %q", entry.ID, w.Occasion, r.Occasion)
		}
		wantName := ""
		if w.Name != nil {
			wantName = *w.Name
		}
		if r.Name != wantName {
			t.Errorf("%s name: want %q, got %q", entry.ID, wantName, r.Name)
		}
		for _, f := range []struct {
			key  string
			got  []int
			want *[]int
		}{
			{"auspiciousTithis", r.AuspiciousTithis, w.AuspiciousTithis},
			{"inauspiciousTithis", r.InauspiciousTithis, w.InauspiciousTithis},
			{"auspiciousNakshatras", r.AuspiciousNakshatras, w.AuspiciousNakshatras},
			{"inauspiciousNakshatras", r.InauspiciousNakshatras, w.InauspiciousNakshatras},
			{"auspiciousVaras", r.AuspiciousVaras, w.AuspiciousVaras},
			{"inauspiciousVaras", r.InauspiciousVaras, w.InauspiciousVaras},
			{"auspiciousYogas", r.AuspiciousYogas, w.AuspiciousYogas},
			{"inauspiciousYogas", r.InauspiciousYogas, w.InauspiciousYogas},
		} {
			if f.want == nil {
				if f.got != nil {
					t.Errorf("%s.%s: want absent, got %v", entry.ID, f.key, f.got)
				}
				continue
			}
			if len(f.got) != len(*f.want) {
				t.Errorf("%s.%s: want %v, got %v", entry.ID, f.key, *f.want, f.got)
				continue
			}
			for i := range *f.want {
				if f.got[i] != (*f.want)[i] {
					t.Errorf("%s.%s[%d]: want %v, got %v", entry.ID, f.key, i, *f.want, f.got)
					break
				}
			}
		}
		if optString(r.Bhadra) != strOr(w.Bhadra, "<none>") {
			t.Errorf("%s.bhadra: want %v, got %v", entry.ID, w.Bhadra, r.Bhadra)
		}
		if r.ExcludeBhadra != boolOr(w.ExcludeBhadra) {
			t.Errorf("%s.excludeBhadra: want %v, got %v", entry.ID, w.ExcludeBhadra, r.ExcludeBhadra)
		}
		if r.ExcludeEkadashi != boolOr(w.ExcludeEkadashi) {
			t.Errorf("%s.excludeEkadashi: want %v, got %v", entry.ID, w.ExcludeEkadashi, r.ExcludeEkadashi)
		}
		if optPaksha(r.RequirePaksha) != strOr(w.RequirePaksha, "<none>") {
			t.Errorf("%s.requirePaksha: want %v, got %q", entry.ID, w.RequirePaksha, r.RequirePaksha)
		}
		if r.ExcludeAdhikaMasa != boolOr(w.ExcludeAdhikaMasa) {
			t.Errorf("%s.excludeAdhikaMasa: want %v, got %v", entry.ID, w.ExcludeAdhikaMasa, r.ExcludeAdhikaMasa)
		}
		if r.ExcludeEclipse != boolOr(w.ExcludeEclipse) {
			t.Errorf("%s.excludeEclipse: want %v, got %v", entry.ID, w.ExcludeEclipse, r.ExcludeEclipse)
		}
		if r.ExcludeGandaMula != boolOr(w.ExcludeGandaMula) {
			t.Errorf("%s.excludeGandaMula: want %v, got %v", entry.ID, w.ExcludeGandaMula, r.ExcludeGandaMula)
		}
		if r.ExcludePanchaka != boolOr(w.ExcludePanchaka) {
			t.Errorf("%s.excludePanchaka: want %v, got %v", entry.ID, w.ExcludePanchaka, r.ExcludePanchaka)
		}
		if optBoolPtr(r.VaraTithiYogas) != optBoolPtr(w.VaraTithiYogas) {
			t.Errorf("%s.varaTithiYogas: want %v, got %v", entry.ID, w.VaraTithiYogas, r.VaraTithiYogas)
		}
	}
}

func strOr(p *string, fallback string) string {
	if p == nil {
		return fallback
	}
	return *p
}

func boolOr(p *bool) bool { return p != nil && *p }

func TestVaraTithiGridMatchesTypeScript(t *testing.T) {
	g := loadMuhurtaGolden(t)
	h := sha256.New()
	byKey := map[string]muVtyCell{}
	for _, c := range g.VtyGrid {
		byKey[fmt.Sprintf("%d|%d", c.Vara, c.Tithi)] = c
	}
	if len(byKey) != 210 {
		t.Fatalf("golden grid has %d cells, want 210", len(byKey))
	}

	for v := 0; v < 7; v++ {
		for tt := 0; tt < 30; tt++ {
			got, err := mu.ComputeVaraTithiYogas(v, tt)
			if err != nil {
				t.Fatalf("(%d,%d): %v", v, tt, err)
			}
			parts := make([]string, len(got))
			for i, y := range got {
				parts[i] = string(y.Type) + "/" + string(y.Polarity)
			}
			h.Write([]byte(fmt.Sprintf("%d|%d|%s\n", v, tt, strings.Join(parts, ","))))

			want := byKey[fmt.Sprintf("%d|%d", v, tt)]
			if len(got) != len(want.Yogas) {
				t.Errorf("(%d,%d): want %d yogas, got %d", v, tt, len(want.Yogas), len(got))
				continue
			}
			for i := range want.Yogas {
				if got[i] != want.Yogas[i] {
					t.Errorf("(%d,%d)[%d]: want %+v, got %+v", v, tt, i, want.Yogas[i], got[i])
				}
			}
		}
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != g.VtyDigest {
		t.Errorf("vara x tithi digest mismatch:\n  want %s\n  got  %s", g.VtyDigest, got)
	}
}

func TestMuhurtaScoresMatchTypeScript(t *testing.T) {
	g := loadMuhurtaGolden(t)
	h := sha256.New()
	hits := map[string]int{}
	for k := range g.ArmHits {
		hits[k] = 0
	}
	byLabel := map[string]muScoreCase{}
	for _, c := range g.ScoreCases {
		byLabel[c.Label] = c
	}
	all := allRules()

	for _, span := range g.Spans {
		geo := types.GeoLocation{Latitude: span.Latitude, Longitude: span.Longitude}
		base := types.DateUTC(span.From[0], span.From[1], span.From[2]).Ms() + 6*3600_000
		for i := 0; i < span.Days; i++ {
			ms := base + int64(i)*86_400_000
			ctx := &astronomy.EphemerisCtx{}
			for _, ar := range all {
				r, err := mu.ScoreMuhurta(ctx, ms, geo, ar.rule,
					mu.MuhurtaScoreOptions{Timezone: types.TimezoneOffset(span.Timezone)})
				if err != nil {
					t.Fatalf("%s %s %s: %v", span.Name, types.Date(ms).ISOString()[:10], ar.id, err)
				}
				label := fmt.Sprintf("%s|%s|%s", span.Name, types.Date(ms).ISOString()[:10], ar.id)
				muCountArms(r, ar.rule, hits)

				passes := 0
				if r.Passes {
					passes = 1
				}
				h.Write([]byte(fmt.Sprintf("%s %d %d ", label, r.Score, passes)))
				for _, f := range r.Factors {
					idx := "n"
					if f.Index != nil {
						idx = strconv.Itoa(*f.Index)
					}
					h.Write([]byte(fmt.Sprintf("%s/%s/%s/%d;", f.Code, f.Axis, idx, f.Delta)))
				}
				h.Write([]byte("| " + strings.Join(r.Reasons, " ~ ") + "\n"))

				if want, ok := byLabel[label]; ok {
					checkScoreCase(t, label, want, r)
				}
			}
		}
	}

	if got := hex.EncodeToString(h.Sum(nil)); got != g.ScoreDigest {
		t.Errorf("score digest mismatch:\n  want %s\n  got  %s", g.ScoreDigest, got)
	}
	for k, want := range g.ArmHits {
		if hits[k] != want {
			t.Errorf("arm %q: want %d, got %d", k, want, hits[k])
		}
		if want == 0 {
			t.Errorf("arm %q was never reached by the golden's own sweep, so the "+
				"Go side agreeing with it proves nothing", k)
		}
	}
	for k, got := range hits {
		if _, ok := g.ArmHits[k]; !ok {
			t.Errorf("arm %q: not in golden, got %d", k, got)
		}
	}
}

func checkScoreCase(t *testing.T, label string, want muScoreCase, got mu.MuhurtaScore) {
	t.Helper()
	if got.Score != want.Score || got.Passes != want.Passes {
		t.Errorf("%s: want score=%d passes=%v, got score=%d passes=%v",
			label, want.Score, want.Passes, got.Score, got.Passes)
	}
	if len(got.Reasons) != len(want.Reasons) {
		t.Errorf("%s: want %d reasons, got %d\n  want %v\n  got  %v",
			label, len(want.Reasons), len(got.Reasons), want.Reasons, got.Reasons)
	} else {
		for i := range want.Reasons {
			if got.Reasons[i] != want.Reasons[i] {
				t.Errorf("%s reason[%d]: want %q, got %q", label, i, want.Reasons[i], got.Reasons[i])
			}
		}
	}
	if len(got.Factors) != len(want.Factors) {
		t.Errorf("%s: want %d factors, got %d", label, len(want.Factors), len(got.Factors))
		return
	}
	for i, w := range want.Factors {
		f := got.Factors[i]
		gotIdx := (*int)(nil)
		if f.Index != nil {
			v := *f.Index
			gotIdx = &v
		}
		if f.Code != w.Code || string(f.Axis) != w.Axis || f.Delta != w.Delta ||
			(gotIdx == nil) != (w.Index == nil) ||
			(gotIdx != nil && *gotIdx != *w.Index) {
			t.Errorf("%s factor[%d]: want %+v, got code=%s axis=%s index=%v delta=%d",
				label, i, w, f.Code, f.Axis, f.Index, f.Delta)
		}
	}
}

func muCountArms(r mu.MuhurtaScore, rule mu.MuhurtaRule, hits map[string]int) {
	bump := func(k string) { hits[k]++ }
	for _, f := range r.Factors {
		if f.Code == "no_sunrise" {
			bump("excl_no_sunrise")
			bump("days_null")
			return
		}
	}
	bump("days_scored")

	if len(r.Factors) == 1 && r.Factors[0].Axis == mu.AxisExclusion {
		bump("excl_" + r.Factors[0].Code)
		return
	}
	for _, f := range r.Factors {
		switch {
		case f.Axis == mu.AxisVaraTithiYoga:
			bump("vty_scored")
			bump("vty_" + strings.TrimPrefix(f.Code, "vara_tithi_"))
		case f.Code == "bhadra" && f.Axis == mu.AxisKarana:
			bump("bhadra_penalize")
		case f.Axis == mu.AxisSpecialYoga:
			if f.Code == "jwalamukhi" {
				bump("sy_jwalamukhi")
			} else {
				bump("sy_bonus")
			}
		default:
			bump(f.Code)
		}
	}
	if rule.VaraTithiYogas != nil && !*rule.VaraTithiYogas {
		bump("vty_suppressed")
	}
	raw := 50
	for _, f := range r.Factors {
		raw += f.Delta
	}
	if raw < 0 {
		bump("clamp_low")
	}
	if raw > 100 {
		bump("clamp_high")
	}
}

func TestMuhurtaBuildAndReadMatchTypeScript(t *testing.T) {
	g := loadMuhurtaGolden(t)
	h := sha256.New()
	pune := types.GeoLocation{Latitude: 18.5204, Longitude: 73.8567}

	byKey := map[string]muRangeCase{}
	for _, c := range g.RangeCases {
		byKey[c.Key] = c
	}
	for _, id := range []string{"vivah", "grihaPravesh", "travelStart"} {
		rule, ok := rules.Get(id)
		if !ok {
			t.Fatalf("no stock rule %q", id)
		}
		for _, includeFailures := range []bool{false, true} {
			ctx := &astronomy.EphemerisCtx{}
			days, err := mu.ComputeAuspiciousDatesInRange(ctx, rule,
				types.DateUTC(2025, 0, 1).Ms(), types.DateUTC(2025, 1, 28).Ms(), pune,
				mu.MuhurtaScoreOptions{
					Timezone: types.TimezoneOffset(330), IncludeFailures: includeFailures,
				})
			if err != nil {
				t.Fatalf("%s: %v", id, err)
			}
			flat := make([]string, len(days))
			for i, d := range days {
				p := 0
				if d.Passes {
					p = 1
				}
				flat[i] = fmt.Sprintf("%d/%d/%d", d.Date.Ms(), d.Score, p)
			}
			key := fmt.Sprintf("%s|%v", id, includeFailures)
			h.Write([]byte("range " + key + " " + strings.Join(flat, " ") + "\n"))

			want, ok := byKey[key]
			if !ok {
				t.Fatalf("golden has no range case %q", key)
			}
			if len(flat) != len(want.Days) {
				t.Errorf("%s: want %d days, got %d", key, len(want.Days), len(flat))
			} else {
				for i := range want.Days {
					if flat[i] != want.Days[i] {
						t.Errorf("%s day[%d]: want %s, got %s", key, i, want.Days[i], flat[i])
						break
					}
				}
			}
		}
	}

	tablesByKey := map[string]muTableCase{}
	for _, tc := range g.Tables {
		tablesByKey[tc.Key] = tc
	}
	syn := synthetic()
	unnamed := syn[len(syn)-1].rule
	for _, id := range []string{"vivah", "syn-unnamed"} {
		var rule mu.MuhurtaRule
		if id == "vivah" {
			r, ok := rules.Get("vivah")
			if !ok {
				t.Fatal("no vivah rule")
			}
			rule = r
		} else {
			rule = unnamed
		}
		for _, includeFailures := range []bool{false, true} {
			ctx := &astronomy.EphemerisCtx{}
			file, err := mu.BuildMuhurtaTable(ctx, mu.BuildMuhurtaTableOptions{
				Rule: rule, Location: pune, TimezoneOffsetMinutes: 330,
				StartYear: 2025, EndYear: 2025, IncludeFailures: includeFailures,
				ReferenceLocation: "Pune", GeneratedAt: muPinnedGeneratedAt,
			})
			if err != nil {
				t.Fatalf("%s: %v", id, err)
			}
			raw, err := tablejson.Marshal(file)
			if err != nil {
				t.Fatalf("%s: %v", id, err)
			}
			sum := sha256.Sum256(raw)
			gotSha := hex.EncodeToString(sum[:])
			key := fmt.Sprintf("%s|%v", id, includeFailures)
			metaKeys := metaKeyOrder(t, raw)
			h.Write([]byte(fmt.Sprintf("table %s %s %d %d %s\n",
				key, gotSha, len(raw), len(file.Dict), strings.Join(metaKeys, ","))))

			best := mu.ReadBestMuhurtaDays(file, 5)
			for _, d := range best {
				p := 0
				if d.Passes {
					p = 1
				}
				h.Write([]byte(fmt.Sprintf("  best %s/%d/%d\n", d.Date, d.Score, p)))
			}

			want, ok := tablesByKey[key]
			if !ok {
				t.Fatalf("golden has no table case %q", key)
			}
			if gotSha != want.Sha256 {
				t.Errorf("%s: table bytes differ\n  want sha %s (%d bytes)\n  got  sha %s (%d bytes)",
					key, want.Sha256, want.Bytes, gotSha, len(raw))
			}
			if len(raw) != want.Bytes {
				t.Errorf("%s: want %d bytes, got %d", key, want.Bytes, len(raw))
			}
			if len(file.Dict) != want.DictLength {
				t.Errorf("%s: want %d dict entries, got %d", key, want.DictLength, len(file.Dict))
			}
			if got := len(file.Years["2025"]); got != want.DayCount {
				t.Errorf("%s: want %d days, got %d", key, want.DayCount, got)
			}
			if strings.Join(metaKeys, ",") != strings.Join(want.MetaKeys, ",") {
				t.Errorf("%s: _meta key order\n  want %v\n  got  %v", key, want.MetaKeys, metaKeys)
			}
			if got := mu.ReadMuhurtaYearRange(file); got != want.Range {
				t.Errorf("%s: year range want %+v, got %+v", key, want.Range, got)
			}
			if got := mu.ReadMuhurtaOccasion(file); got != want.Occasion {
				t.Errorf("%s: occasion want %q, got %q", key, want.Occasion, got)
			}
			gotBest := make([]string, len(best))
			for i, d := range best {
				p := 0
				if d.Passes {
					p = 1
				}
				gotBest[i] = fmt.Sprintf("%s/%d/%d", d.Date, d.Score, p)
			}
			if strings.Join(gotBest, ",") != strings.Join(want.Best, ",") {
				t.Errorf("%s: best days\n  want %v\n  got  %v", key, want.Best, gotBest)
			}
			forYear, yearOk := mu.ReadMuhurtaForYear(file, 2025)
			if want.ForYearLength == nil {
				if yearOk {
					t.Errorf("%s: want no 2025 entry", key)
				}
			} else if !yearOk || len(forYear) != *want.ForYearLength {
				t.Errorf("%s: want %d days for 2025, got %d (ok=%v)",
					key, *want.ForYearLength, len(forYear), yearOk)
			}
			if want.ForYearFirst != nil && yearOk && len(forYear) > 0 {
				if got := fmt.Sprintf("%s/%d", forYear[0].Date, forYear[0].Score); got != *want.ForYearFirst {
					t.Errorf("%s: first 2025 day want %s, got %s", key, *want.ForYearFirst, got)
				}
			}
			forDate, dateOk := mu.ReadMuhurtaForDateKey(file, "2025-02-05")
			if want.ForDate == nil {
				if dateOk {
					t.Errorf("%s: want no entry for 2025-02-05, got %+v", key, forDate)
				}
			} else {
				p := 0
				if forDate.Passes {
					p = 1
				}
				got := fmt.Sprintf("%s/%d/%d", forDate.Date, forDate.Score, p)
				if !dateOk || got != *want.ForDate {
					t.Errorf("%s: 2025-02-05 want %s, got %s (ok=%v)", key, *want.ForDate, got, dateOk)
				}
			}
			if _, ok := mu.ReadMuhurtaForYear(file, 2099); ok != !want.OutOfRange {
				t.Errorf("%s: 2099 should be out of range", key)
			}
		}
	}

	ctx := &astronomy.EphemerisCtx{}
	seemantham, ok := rules.Get("seemantham")
	if !ok {
		t.Fatal("no seemantham rule")
	}
	yearDays, err := mu.ComputeAuspiciousDatesForYear(ctx, 2025, seemantham, pune,
		mu.MuhurtaScoreOptions{Timezone: types.TimezoneOffset(330)})
	if err != nil {
		t.Fatalf("seemantham 2025: %v", err)
	}
	parts := make([]string, len(yearDays))
	for i, d := range yearDays {
		parts[i] = fmt.Sprintf("%d/%d", d.Date.Ms(), d.Score)
	}
	h.Write([]byte(fmt.Sprintf("year seemantham 2025 %d %s\n",
		len(yearDays), strings.Join(parts, " "))))

	if got := hex.EncodeToString(h.Sum(nil)); got != g.BuildDigest {
		t.Errorf("build digest mismatch:\n  want %s\n  got  %s", g.BuildDigest, got)
	}
}

const muPinnedGeneratedAt = "2026-08-23T00:00:00.000Z"

func metaKeyOrder(t *testing.T, raw []byte) []string {
	t.Helper()
	var doc struct {
		Meta json.RawMessage `json:"_meta"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("re-parsing the emitted table: %v", err)
	}
	dec := json.NewDecoder(strings.NewReader(string(doc.Meta)))
	tok, err := dec.Token()
	if err != nil || tok != json.Delim('{') {
		t.Fatalf("_meta is not an object: %v", err)
	}
	var keys []string
	for dec.More() {
		k, err := dec.Token()
		if err != nil {
			t.Fatalf("reading _meta keys: %v", err)
		}
		keys = append(keys, k.(string))
		var v json.RawMessage
		if err := dec.Decode(&v); err != nil {
			t.Fatalf("skipping a _meta value: %v", err)
		}
	}
	return keys
}
